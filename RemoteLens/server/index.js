'use strict';
/**
 * RemoteLens HTTP server: a read-only window onto ONE Eagle library.
 * Pure Node (no Eagle/Electron dependency) so it can also run standalone for development.
 *
 * Every request passes two gates: the client address zone (loopback / Tailscale / optional LAN),
 * then the access token (session cookie). Media is only ever resolved through the item index,
 * never from a path supplied by the client.
 */
const http = require('http');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { sendFile, mimeOf, sniffImageType } = require('./sendfile');
const net = require('./net');

/**
 * Bumped whenever the web client needs something new from the server. The web files are read from
 * disk on every request but this code only loads when Eagle starts, so after an update the two can
 * disagree until Eagle is restarted; the client compares this number and says so.
 */
const API_VERSION = 3;
const COOKIE = 'rl_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const PAGE_LIMIT_MAX = 500;
const PREVIEW_EDGE = 2048;
const THUMB_EDGE = 480;
const BROWSER_NATIVE = new Set(['jpg', 'jpeg', 'jfif', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'apng']);
const SMALL_ENOUGH_BYTES = 1.2 * 1024 * 1024;
const SMALL_ENOUGH_EDGE = 2560;
const THUMB_FALLBACK_BYTES = 3 * 1024 * 1024;

const STATIC_FILES = {
    '/app.js': 'app.js', '/app.css': 'app.css', '/login.js': 'login.js', '/icon.svg': 'icon.svg',
    '/manifest.webmanifest': 'manifest.webmanifest',
};
const BASE_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, nofollow',
};
const PAGE_CSP = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; " +
    "style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
/** Library files are untrusted content: never let one run script in our origin. */
const MEDIA_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; media-src 'self'";

function newToken() {
    return crypto.randomBytes(15).toString('base64url');
}

function sessionValue(token, expires) {
    return crypto.createHmac('sha256', String(token)).update(`remotelens-session-v2:${expires}`).digest('hex');
}

function safeEqual(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function parseCookies(header) {
    const out = {};
    for (const part of String(header || '').split(';')) {
        const eq = part.indexOf('=');
        if (eq > 0) out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    }
    return out;
}

function readBody(req, limit = 4096) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > limit) {
                reject(Object.assign(new Error('body too large'), { status: 413 }));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function folderTree(nodes) {
    return nodes.map((n) => ({ id: n.id, name: n.name, count: n.count, total: n.total, children: folderTree(n.children) }));
}

function listRow(item) {
    const row = { id: item.id, n: item.name, e: item.ext, k: item.kind[0], w: item.w, h: item.h, v: item.lm.toString(36) };
    if (item.duration) row.d = Math.round(item.duration);
    return row;
}

/**
 * @param {object} deps
 *   getContext(id): {status:'ready'|'loading'|'unavailable'|'unknown', id, ctx:{library, previews}}
 *                   id '' selects the library open in Eagle
 *   getLibraries(): Promise<{id, name, current}[]>   libraries a client may switch to
 *   getConfig(): {token, allowLan}
 *   webDir: folder with the mobile web app
 *   log(level, message)
 */
function createApp(deps) {
    const log = deps.log || (() => {});
    const failures = new Map();

    function clientOf(req) {
        const remote = net.normalize(req.socket.remoteAddress);
        // Tailscale Serve replaces any client-supplied X-Forwarded-For with the real peer address;
        // the rightmost entry is the one the nearest proxy wrote. Only a loopback peer may name a client.
        const chain = String(req.headers['x-forwarded-for'] || '').split(',').map((part) => part.trim()).filter(Boolean);
        const viaProxy = net.isLoopback(remote) && chain.length > 0;
        const forwarded = viaProxy ? net.normalize(chain[chain.length - 1]) : '';
        return {
            remote,
            forwarded,
            key: viaProxy ? forwarded : remote,
            https: viaProxy && req.headers['x-forwarded-proto'] === 'https',
        };
    }

    /**
     * Network gate, checked before any token. @returns {string} reason for refusal, or '' when allowed.
     */
    function refusal(req, client) {
        const config = deps.getConfig();
        const zone = net.classify(client.remote);
        if (zone === 'public') return 'public address';
        if (zone === 'lan' && !config.allowLan) return 'lan not allowed';
        // 100.64.0.0/10 is also carrier-grade NAT: only trust it when it arrived on our real Tailscale address.
        if (zone === 'tailscale' && Array.isArray(config.tailscaleIps) &&
            !config.tailscaleIps.includes(net.normalize(req.socket.localAddress))) return 'not the tailscale interface';
        // Behind a local reverse proxy the real client must itself be local or on the tailnet (never Funnel).
        if (req.headers['tailscale-funnel-request']) return 'funnel';
        if (client.forwarded && !['loopback', 'tailscale'].includes(net.classify(client.forwarded))) return 'forwarded public address';
        // DNS rebinding: an attacker's domain can resolve to us, but it cannot be an IP literal or our own name.
        const host = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
        const named = host === 'localhost' || (config.dnsName && host === String(config.dnsName).toLowerCase());
        if (!named && net.classify(host) === 'public') return 'unexpected host header';
        return '';
    }

    /** Requests another website caused the browser to make must not be able to sign in or burn login attempts. */
    function isCrossSite(req) {
        return req.headers['sec-fetch-site'] === 'cross-site';
    }

    function send(req, res, status, body, headers = {}) {
        let payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
        const all = { ...BASE_HEADERS, 'Cache-Control': 'no-store', ...headers };
        const compressible = /^(text\/|application\/(json|manifest\+json)|image\/svg)/.test(all['Content-Type'] || '');
        if (compressible && payload.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
            payload = zlib.gzipSync(payload, { level: 5 });
            all['Content-Encoding'] = 'gzip';
            all.Vary = 'Accept-Encoding';
        }
        all['Content-Length'] = payload.length;
        res.writeHead(status, all);
        res.end(req.method === 'HEAD' ? undefined : payload);
    }

    function json(req, res, status, data) {
        send(req, res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8' });
    }

    /** Session cookie: `<expiry>.<signature>`. Stateless, expires on its own, and dies with the token. */
    function isAuthed(req) {
        const { token } = deps.getConfig();
        const got = String(parseCookies(req.headers.cookie)[COOKIE] || '');
        const dot = got.indexOf('.');
        if (!token || dot <= 0) return false;
        const expires = Number.parseInt(got.slice(0, dot), 36);
        if (!Number.isFinite(expires) || expires < Date.now()) return false;
        return safeEqual(got.slice(dot + 1), sessionValue(token, expires));
    }

    function tooManyFailures(key) {
        const entry = failures.get(key);
        if (!entry) return false;
        if (Date.now() - entry.first > LOGIN_WINDOW_MS) {
            failures.delete(key);
            return false;
        }
        return entry.count >= LOGIN_MAX_FAILURES;
    }

    function noteFailure(key) {
        const entry = failures.get(key);
        if (!entry || Date.now() - entry.first > LOGIN_WINDOW_MS) failures.set(key, { first: Date.now(), count: 1 });
        else entry.count++;
        if (failures.size > 1000) failures.delete(failures.keys().next().value);
    }

    /** @returns {'ok'|'bad'|'locked'} */
    function tryLogin(client, candidate) {
        const { token } = deps.getConfig();
        // The right token always works, so nobody can lock the owner out by failing on purpose;
        // the limit only caps how fast wrong guesses are answered and logged.
        if (token && candidate && safeEqual(candidate, token)) {
            failures.delete(client.key);
            return 'ok';
        }
        if (tooManyFailures(client.key)) return 'locked';
        noteFailure(client.key);
        log('warn', `rejected access token from ${client.key}`);
        return 'bad';
    }

    function sessionCookie(client) {
        const { token } = deps.getConfig();
        const expires = Date.now() + COOKIE_MAX_AGE * 1000;
        const flags = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${COOKIE_MAX_AGE}`];
        if (client.https) flags.push('Secure');
        return `${COOKIE}=${expires.toString(36)}.${sessionValue(token, expires)}; ${flags.join('; ')}`;
    }

    async function servePage(req, res, name) {
        const ok = await sendFile(req, res, path.join(deps.webDir, name), {
            type: mimeOf(path.extname(name).slice(1)),
            cacheControl: 'no-cache',
            extraHeaders: { ...BASE_HEADERS, 'Content-Security-Policy': PAGE_CSP },
        });
        if (!ok) send(req, res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    /** Raster images, audio, video and PDF cannot script; everything else (HTML, SVG, unknown) is sandboxed. */
    function mediaHeaders(type) {
        const inert = /^(image\/(?!svg)|video\/|audio\/|application\/pdf$)/.test(type || '');
        return inert ? { ...BASE_HEADERS } : { ...BASE_HEADERS, 'Content-Security-Policy': MEDIA_CSP };
    }

    async function sendOriginal(req, res, ctx, item, { download }) {
        const filename = `${item.name}.${item.ext}`;
        const file = await ctx.library.contained(ctx.library.originalPath(item));
        if (!file) return false;
        return sendFile(req, res, file, {
            type: mimeOf(item.ext),
            cacheControl: 'private, max-age=86400',
            download: download ? filename : undefined,
            inlineName: download ? undefined : filename,
            extraHeaders: mediaHeaders(mimeOf(item.ext)),
        });
    }

    async function sendGenerated(req, res, ctx, item, edge) {
        if (item.kind !== 'image' || !ctx.previews || !ctx.previews.enabled) return false;
        const file = await ctx.library.contained(ctx.library.originalPath(item));
        if (!file) return false;
        const made = await ctx.previews.get(`${item.id}-${item.lm.toString(36)}-${edge}`, { file, ext: item.ext, maxEdge: edge });
        if (!made) return false;
        return sendFile(req, res, made.file, {
            type: made.type, cacheControl: 'private, max-age=31536000, immutable', extraHeaders: mediaHeaders(made.type),
        });
    }

    async function handleThumb(req, res, ctx, item) {
        const thumbFile = await ctx.library.contained(ctx.library.thumbnailPath(item));
        const thumbType = thumbFile ? await sniffImageType(thumbFile, 'image/png') : null;
        if (thumbType) {
            const sent = await sendFile(req, res, thumbFile, {
                type: thumbType, cacheControl: 'private, max-age=31536000, immutable', extraHeaders: mediaHeaders(thumbType),
            });
            if (sent) return true;
        }
        // Eagle keeps no thumbnail for small images: the original is the thumbnail.
        if (item.kind === 'image' && BROWSER_NATIVE.has(item.ext) && item.size <= THUMB_FALLBACK_BYTES) {
            return sendOriginal(req, res, ctx, item, { download: false });
        }
        return sendGenerated(req, res, ctx, item, THUMB_EDGE);
    }

    async function handlePreview(req, res, ctx, item) {
        if (item.kind !== 'image') return false;
        const native = BROWSER_NATIVE.has(item.ext);
        const alreadySmall = item.size <= SMALL_ENOUGH_BYTES && Math.max(item.w, item.h) <= SMALL_ENOUGH_EDGE;
        const keepOriginal = native && (alreadySmall || item.ext === 'gif' || item.ext === 'svg' || item.ext === 'apng');
        if (keepOriginal) return sendOriginal(req, res, ctx, item, { download: false });
        if (await sendGenerated(req, res, ctx, item, PREVIEW_EDGE)) return true;
        // No converter available: HEIC still renders in Safari, everything else falls back to the thumbnail.
        if (native || item.ext === 'heic' || item.ext === 'heif') return sendOriginal(req, res, ctx, item, { download: false });
        return handleThumb(req, res, ctx, item);
    }

    function parseQuery(url, library) {
        const p = url.searchParams;
        const scope = ['all', 'uncategorized', 'untagged', 'folder'].includes(p.get('scope')) ? p.get('scope') : 'all';
        const kind = ['image', 'video', 'audio', 'other'].includes(p.get('kind')) ? p.get('kind') : '';
        const folder = String(p.get('folder') || '');
        if (scope === 'folder' && !library.folders.byId.has(folder)) return null;
        return {
            scope,
            folder: scope === 'folder' ? folder : '',
            recursive: p.get('recursive') !== '0',
            tags: p.getAll('tag').map(String).filter(Boolean).slice(0, 20),
            text: String(p.get('q') || '').slice(0, 200),
            kind,
            star: Math.min(5, Math.max(0, Number.parseInt(p.get('star'), 10) || 0)),
            exts: p.getAll('ext').map((e) => String(e).toLowerCase()).filter(Boolean).slice(0, 30),
            shape: ['landscape', 'portrait', 'square'].includes(p.get('shape')) ? p.get('shape') : '',
            color: /^[0-9a-f]{6}$/i.test(p.get('color') || '') ? Number.parseInt(p.get('color'), 16) : null,
            sort: String(p.get('sort') || 'added'),
            order: p.get('order') === 'asc' ? 'asc' : 'desc',
        };
    }

    function intParam(url, name, fallback, min, max) {
        const n = Number.parseInt(url.searchParams.get(name), 10);
        return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    }

    async function handleApi(req, res, url, ctx, libraryId) {
        const { library } = ctx;
        if (url.pathname === '/api/ping') {
            return json(req, res, 200, { api: API_VERSION, id: libraryId, version: library.version, name: library.name });
        }
        if (url.pathname === '/api/library') {
            return json(req, res, 200, {
                api: API_VERSION,
                id: libraryId,
                name: library.name,
                version: library.version,
                counts: library.counts,
                folders: folderTree(library.folders.roots),
                tags: library.tags,
                exts: library.exts,
                tagGroups: library.visibleTagGroups(),
            });
        }
        if (url.pathname === '/api/items') {
            const q = parseQuery(url, library);
            if (!q) return json(req, res, 404, { error: 'folder_not_found' });
            const result = library.query(q);
            const offset = intParam(url, 'offset', 0, 0, Number.MAX_SAFE_INTEGER);
            const limit = intParam(url, 'limit', 200, 1, PAGE_LIMIT_MAX);
            const items = result.ids.slice(offset, offset + limit).map((id) => listRow(library.items.get(id)));
            const body = { version: library.version, total: result.total, offset, items };
            // Position of one item inside this ordering, so a viewer can open at it.
            const locate = url.searchParams.get('locate');
            if (locate) body.index = result.ids.indexOf(locate);
            return json(req, res, 200, body);
        }
        if (url.pathname === '/api/ratios') {
            const q = parseQuery(url, library);
            if (!q) return json(req, res, 404, { error: 'folder_not_found' });
            return send(req, res, 200, library.ratios(q), { 'Content-Type': 'application/octet-stream' });
        }
        const detail = /^\/api\/item\/([A-Za-z0-9]+)$/.exec(url.pathname);
        if (detail) {
            const item = library.get(detail[1]);
            if (!item) return json(req, res, 404, { error: 'item_not_found' });
            return json(req, res, 200, {
                id: item.id, name: item.name, ext: item.ext, kind: item.kind, size: item.size,
                width: item.w, height: item.h, created: item.btime, modified: item.mtime, added: item.added,
                tags: item.tags, star: item.star, annotation: item.annotation, url: item.url, duration: item.duration,
                folders: item.folders.filter((f) => library.folders.byId.has(f))
                    .map((f) => ({ id: f, name: library.folders.byId.get(f).name })),
            });
        }
        return json(req, res, 404, { error: 'not_found' });
    }

    async function handleMedia(req, res, url, ctx) {
        const m = /^\/(thumb|preview|file)\/([A-Za-z0-9]+)$/.exec(url.pathname);
        if (!m) return false;
        const item = ctx.library.get(m[2]);
        let sent = false;
        if (item) {
            if (m[1] === 'thumb') sent = await handleThumb(req, res, ctx, item);
            else if (m[1] === 'preview') sent = await handlePreview(req, res, ctx, item);
            else sent = await sendOriginal(req, res, ctx, item, { download: url.searchParams.get('dl') === '1' });
        }
        if (!sent && !res.headersSent) send(req, res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
        return true;
    }

    async function route(req, res) {
        const client = clientOf(req);
        const refused = refusal(req, client);
        if (refused) {
            log('warn', `blocked ${client.key} (${refused})`);
            return send(req, res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        const url = new URL(req.url, 'http://local');
        const isRead = req.method === 'GET' || req.method === 'HEAD';

        if (url.pathname === '/api/login' && req.method === 'POST') {
            const isJson = /^application\/json\b/i.test(String(req.headers['content-type'] || ''));
            if (!isJson || isCrossSite(req)) return json(req, res, 400, { error: 'bad_request' });
            let candidate = '';
            try {
                candidate = String(JSON.parse(await readBody(req)).token || '').trim();
            } catch (err) {
                return json(req, res, err.status || 400, { error: 'bad_request' });
            }
            const outcome = tryLogin(client, candidate);
            if (outcome === 'locked') return json(req, res, 429, { error: 'too_many_attempts' });
            if (outcome === 'bad') return json(req, res, 401, { error: 'wrong_token' });
            res.setHeader('Set-Cookie', sessionCookie(client));
            return json(req, res, 200, { ok: true });
        }
        if (!isRead) return send(req, res, 405, 'Method not allowed', { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });

        // A scanned QR code carries the token once; swap it for a cookie and drop it from the address bar.
        if (url.pathname === '/' && url.searchParams.has('k')) {
            const outcome = isCrossSite(req) ? 'bad' : tryLogin(client, url.searchParams.get('k'));
            if (outcome === 'ok') res.setHeader('Set-Cookie', sessionCookie(client));
            res.writeHead(302, { ...BASE_HEADERS, 'Cache-Control': 'no-store', Location: '/' });
            return res.end();
        }

        if (STATIC_FILES[url.pathname]) return servePage(req, res, STATIC_FILES[url.pathname]);
        const authed = isAuthed(req);
        if (url.pathname === '/') return servePage(req, res, authed ? 'index.html' : 'login.html');
        if (!authed) {
            if (url.pathname.startsWith('/api/')) return json(req, res, 401, { error: 'unauthorized' });
            return send(req, res, 401, 'Unauthorized', { 'Content-Type': 'text/plain; charset=utf-8' });
        }

        if (url.pathname === '/api/libraries') {
            const libraries = deps.getLibraries ? await deps.getLibraries() : [];
            return json(req, res, 200, { libraries });
        }
        const selected = deps.getContext(String(url.searchParams.get('lib') || ''));
        if (selected.status === 'unknown') return json(req, res, 404, { error: 'library_not_found' });
        if (selected.status === 'loading') return json(req, res, 503, { error: 'library_loading' });
        if (selected.status !== 'ready') return json(req, res, 503, { error: 'library_unavailable' });
        const { ctx } = selected;
        if (url.pathname.startsWith('/api/')) return handleApi(req, res, url, ctx, selected.id);
        if (await handleMedia(req, res, url, ctx)) return undefined;
        return send(req, res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    }

    return (req, res) => {
        route(req, res).catch((err) => {
            // The query string can carry the access token: never log it.
            log('error', `${req.method} ${String(req.url).split('?')[0]}: ${err.stack || err.message}`);
            if (!res.headersSent) send(req, res, 500, 'Internal error', { 'Content-Type': 'text/plain; charset=utf-8' });
            else res.destroy();
        });
    };
}

/** Owns the listening sockets. One http.Server per bind address so a missing interface fails alone. */
class Listener {
    constructor(handler, log) {
        this.handler = handler;
        this.log = log || (() => {});
        this.servers = new Map();
        this.port = 0;
    }

    /** @returns {Promise<{bound:string[], failed:{host:string,error:string}[]}>} */
    async listen(hosts, port) {
        if (port !== this.port) await this.close();
        this.port = port;
        for (const host of Array.from(this.servers.keys())) {
            if (!hosts.includes(host)) await this._closeOne(host);
        }
        const failed = [];
        for (const host of hosts) {
            if (this.servers.has(host)) continue;
            try {
                this.servers.set(host, await this._open(host, port));
            } catch (err) {
                failed.push({ host, error: err.code || err.message });
            }
        }
        return { bound: Array.from(this.servers.keys()), failed };
    }

    _open(host, port) {
        return new Promise((resolve, reject) => {
            const server = http.createServer(this.handler);
            const sockets = new Set();
            server.on('connection', (socket) => {
                sockets.add(socket);
                socket.on('close', () => sockets.delete(socket));
            });
            server.keepAliveTimeout = 30000;
            server.once('error', reject);
            server.listen(port, host, () => {
                server.removeListener('error', reject);
                server.on('error', (err) => this.log('error', `server ${host}: ${err.message}`));
                resolve({ server, sockets });
            });
        });
    }

    _closeOne(host) {
        const entry = this.servers.get(host);
        this.servers.delete(host);
        if (!entry) return Promise.resolve();
        return new Promise((resolve) => {
            entry.server.close(() => resolve());
            for (const socket of entry.sockets) socket.destroy();
        });
    }

    async close() {
        await Promise.all(Array.from(this.servers.keys()).map((host) => this._closeOne(host)));
    }

    get connections() {
        let n = 0;
        for (const entry of this.servers.values()) n += entry.sockets.size;
        return n;
    }
}

module.exports = { createApp, Listener, newToken, sessionValue, API_VERSION };
