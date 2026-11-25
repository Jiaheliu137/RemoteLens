'use strict';
/**
 * Read-only index of ONE Eagle library folder.
 *
 * Reads only: <lib>/metadata.json, <lib>/mtime.json and <lib>/images/<id>.info/metadata.json.
 * Never writes inside the library. The optional index cache lives in `cacheDir`
 * (outside the library) so a large library does not need a full rescan on every start.
 */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const INDEX_CACHE_VERSION = 4;
const PALETTE_MIN_RATIO = 8;
const PALETTE_KEEP = 4;
const COLOR_DISTANCE = 110;
const READ_CONCURRENCY = 48;
const QUERY_CACHE_SIZE = 24;

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg', 'heic', 'heif', 'tif', 'tiff',
    'dng', 'cr2', 'cr3', 'nef', 'arw', 'raf', 'orf', 'rw2', 'psd', 'ico', 'jfif', 'apng', 'jxl']);
const VIDEO_EXT = new Set(['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'wmv', 'flv', 'ts', '3gp', 'mpg', 'mpeg']);
const AUDIO_EXT = new Set(['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus', 'amr', 'wma', 'aiff']);

function kindOf(ext) {
    if (IMAGE_EXT.has(ext)) return 'image';
    if (VIDEO_EXT.has(ext)) return 'video';
    if (AUDIO_EXT.has(ext)) return 'audio';
    return 'other';
}

async function readJson(file) {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
}

async function readJsonOr(file, fallback) {
    try {
        return await readJson(file);
    } catch (err) {
        if (err.code === 'ENOENT') return fallback;
        throw err;
    }
}

/** Run `worker` over `list` with bounded concurrency. */
async function mapLimit(list, limit, worker) {
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, list.length) }, async () => {
        while (next < list.length) {
            const i = next++;
            await worker(list[i], i);
        }
    });
    await Promise.all(runners);
}

/** True when the string contains a path separator or a NUL character. */
function hasPathChar(text) {
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code === 0 || code === 47 || code === 92) return true;
    }
    return false;
}

/**
 * `name` and `ext` come from a file inside the library and end up in a file path, so a crafted
 * library must not be able to point outside its own item folder.
 */
function isSafeFilePart(name, ext) {
    if (name === '' || name === '.' || name === '..' || hasPathChar(name)) return false;
    return /^[a-z0-9_+-]{1,16}$/.test(ext);
}

/** The few dominant colours Eagle extracted, each packed as 0xRRGGBB. */
function packPalette(palettes) {
    if (!Array.isArray(palettes)) return [];
    const out = [];
    for (const entry of palettes) {
        const c = entry && entry.color;
        if (!Array.isArray(c) || c.length < 3 || !(Number(entry.ratio) >= PALETTE_MIN_RATIO)) continue;
        out.push(((c[0] & 255) << 16) | ((c[1] & 255) << 8) | (c[2] & 255));
        if (out.length >= PALETTE_KEEP) break;
    }
    return out;
}

/** Perceptual-ish distance between two packed colours ("redmean"), roughly 0..765. */
function colorDistance(a, b) {
    const r1 = a >> 16;
    const r2 = b >> 16;
    const dr = r1 - r2;
    const dg = ((a >> 8) & 255) - ((b >> 8) & 255);
    const db = (a & 255) - (b & 255);
    const mean = (r1 + r2) / 2;
    return Math.sqrt((2 + mean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - mean) / 256) * db * db);
}

function shapeOf(item) {
    if (!item.w || !item.h) return '';
    const ratio = item.w / item.h;
    if (ratio > 1.08) return 'landscape';
    if (ratio < 0.93) return 'portrait';
    return 'square';
}

function toRecord(meta) {
    const ext = String(meta.ext || '').toLowerCase();
    const name = String(meta.name == null ? '' : meta.name);
    return {
        id: String(meta.id),
        name,
        ext,
        unsafe: !isSafeFilePart(name, ext),
        kind: kindOf(ext),
        size: Number(meta.size) || 0,
        w: Number(meta.width) || 0,
        h: Number(meta.height) || 0,
        btime: Number(meta.btime) || 0,
        mtime: Number(meta.mtime) || 0,
        added: Number(meta.modificationTime) || 0,
        lm: Number(meta.lastModified) || Number(meta.modificationTime) || 0,
        tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [],
        folders: Array.isArray(meta.folders) ? meta.folders.map(String) : [],
        star: Number(meta.star) || 0,
        annotation: String(meta.annotation || ''),
        url: String(meta.url || ''),
        duration: Number(meta.duration) || 0,
        pal: packPalette(meta.palettes),
        deleted: meta.isDeleted === true,
    };
}

/** Flatten Eagle's nested folder tree; a folder with a password hides itself and its whole subtree. */
function buildFolders(rawFolders) {
    const byId = new Map();
    const hidden = new Set();
    const walk = (list, parentId, parentHidden) => {
        const out = [];
        for (const raw of Array.isArray(list) ? list : []) {
            const id = String(raw.id);
            const isHidden = parentHidden || Boolean(raw.password);
            if (isHidden) {
                hidden.add(id);
                walk(raw.children, id, true);
                continue;
            }
            const node = { id, name: String(raw.name || ''), parent: parentId, children: [], count: 0, total: 0 };
            byId.set(id, node);
            node.children = walk(raw.children, id, false);
            out.push(node);
        }
        return out;
    };
    const roots = walk(rawFolders, null, false);
    return { roots, byId, hidden };
}

function ancestorsOf(folderId, byId) {
    const chain = [];
    let cur = byId.get(folderId);
    while (cur) {
        chain.push(cur.id);
        cur = cur.parent ? byId.get(cur.parent) : null;
    }
    return chain;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const SORTERS = {
    added: (a, b) => a.added - b.added || a.btime - b.btime,
    created: (a, b) => a.btime - b.btime,
    modified: (a, b) => a.mtime - b.mtime,
    name: (a, b) => collator.compare(a.name, b.name),
    size: (a, b) => a.size - b.size,
    duration: (a, b) => a.duration - b.duration,
    ext: (a, b) => (a.ext < b.ext ? -1 : a.ext > b.ext ? 1 : 0),
};

class Library {
    constructor(libraryPath, options = {}) {
        this.path = path.resolve(libraryPath);
        this.name = path.basename(this.path).replace(/\.library$/i, '');
        this.cacheDir = options.cacheDir || null;
        this.log = options.log || (() => {});
        this.version = 0;
        this.items = new Map();
        this.itemMtime = new Map();
        this.folders = { roots: [], byId: new Map(), hidden: new Set() };
        this.tags = [];
        this.exts = [];
        this.tagGroups = [];
        this.counts = { all: 0, uncategorized: 0, untagged: 0 };
        this.loadedAt = 0;
        this._queryCache = new Map();
        this._loading = null;
        this._watchTimer = null;
        this._lastStamp = '';
    }

    imagesDir() {
        return path.join(this.path, 'images');
    }

    itemDir(id) {
        return path.join(this.imagesDir(), `${id}.info`);
    }

    /** Full or incremental (re)load. Concurrent callers share one run. */
    load() {
        if (!this._loading) {
            this._loading = this._load().finally(() => {
                this._loading = null;
            });
        }
        return this._loading;
    }

    async _load() {
        const started = Date.now();
        const root = await readJson(path.join(this.path, 'metadata.json'));
        const mtimes = await readJsonOr(path.join(this.path, 'mtime.json'), {});
        if (this.items.size === 0) await this._restoreIndexCache();

        const entries = await fsp.readdir(this.imagesDir(), { withFileTypes: true }).catch((err) => {
            if (err.code === 'ENOENT') return [];
            throw err;
        });
        const ids = entries.filter((e) => e.isDirectory() && e.name.endsWith('.info')).map((e) => e.name.slice(0, -5));

        const nextItems = new Map();
        const nextMtime = new Map();
        const toRead = [];
        for (const id of ids) {
            const stamp = mtimes[id];
            const known = this.items.get(id);
            if (known && stamp !== undefined && this.itemMtime.get(id) === stamp) {
                nextItems.set(id, known);
                nextMtime.set(id, stamp);
            } else {
                toRead.push(id);
            }
        }

        let failed = 0;
        await mapLimit(toRead, READ_CONCURRENCY, async (id) => {
            try {
                const meta = await readJson(path.join(this.itemDir(id), 'metadata.json'));
                nextItems.set(id, toRecord({ ...meta, id }));
                if (mtimes[id] !== undefined) nextMtime.set(id, mtimes[id]);
            } catch (err) {
                failed++;
                if (failed <= 5) this.log('warn', `skip item ${id}: ${err.message}`);
            }
        });

        this.items = nextItems;
        this.itemMtime = nextMtime;
        this.folders = buildFolders(root.folders);
        this.tagGroups = (Array.isArray(root.tagsGroups) ? root.tagsGroups : []).map((g) => ({
            id: String(g.id),
            name: String(g.name || ''),
            tags: Array.isArray(g.tags) ? g.tags.map(String) : [],
        }));
        this._summarize();
        this._queryCache.clear();
        this.version++;
        this.loadedAt = Date.now();
        this._lastStamp = await this._stamp();
        this.log('info', `indexed "${this.name}": ${this.counts.all} items, read ${toRead.length}, ` +
            `failed ${failed}, ${Date.now() - started} ms`);
        if (toRead.length > 0 || ids.length !== this._cachedCount) await this._saveIndexCache();
    }

    /** An item is visible unless it is in the trash or sits in a password-protected folder. */
    isVisible(item) {
        if (item.deleted || item.unsafe) return false;
        for (const f of item.folders) if (this.folders.hidden.has(f)) return false;
        return true;
    }

    _summarize() {
        const tagCount = new Map();
        const extCount = new Map();
        const counts = { all: 0, uncategorized: 0, untagged: 0 };
        for (const node of this.folders.byId.values()) {
            node.count = 0;
            node.total = 0;
        }
        for (const item of this.items.values()) {
            if (!this.isVisible(item)) continue;
            counts.all++;
            extCount.set(item.ext, (extCount.get(item.ext) || 0) + 1);
            if (item.tags.length === 0) counts.untagged++;
            for (const t of item.tags) tagCount.set(t, (tagCount.get(t) || 0) + 1);
            const known = item.folders.filter((f) => this.folders.byId.has(f));
            if (known.length === 0) counts.uncategorized++;
            const withAncestors = new Set();
            for (const f of known) {
                this.folders.byId.get(f).count++;
                for (const a of ancestorsOf(f, this.folders.byId)) withAncestors.add(a);
            }
            for (const a of withAncestors) this.folders.byId.get(a).total++;
        }
        this.counts = counts;
        this.exts = Array.from(extCount, ([ext, count]) => ({ ext, count })).sort((a, b) => b.count - a.count);
        this.tags = Array.from(tagCount, ([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count || collator.compare(a.name, b.name));
    }

    /** Folder ids of `id` and everything below it. */
    descendants(id) {
        const out = new Set();
        const walk = (node) => {
            out.add(node.id);
            node.children.forEach(walk);
        };
        const start = this.folders.byId.get(id);
        if (start) walk(start);
        return out;
    }

    /**
     * @param {object} q {scope:'all'|'uncategorized'|'untagged'|'folder', folder, recursive, tags[], text, kind,
     *                    star (minimum rating), exts[], shape, color (0xRRGGBB or null), sort, order}
     * @returns {{total:number, ids:string[]}} the full ordered id list (cached per library version)
     */
    query(q) {
        const key = JSON.stringify([q.scope, q.folder, q.recursive, q.tags, q.text, q.kind, q.star, q.exts, q.shape,
            q.color, q.sort, q.order]);
        const hit = this._queryCache.get(key);
        if (hit) {
            this._queryCache.delete(key);
            this._queryCache.set(key, hit);
            return hit;
        }
        const folderSet = q.scope === 'folder'
            ? (q.recursive ? this.descendants(q.folder) : new Set(this.folders.byId.has(q.folder) ? [q.folder] : []))
            : null;
        const terms = String(q.text || '').toLowerCase().split(/\s+/).filter(Boolean);
        const wantTags = q.tags || [];
        const wantExts = q.exts && q.exts.length ? new Set(q.exts) : null;
        const wantColor = Number.isInteger(q.color) ? q.color : null;
        const matched = [];
        for (const item of this.items.values()) {
            if (!this.isVisible(item)) continue;
            if (q.kind && item.kind !== q.kind) continue;
            if (q.star && item.star < q.star) continue;
            if (wantExts && !wantExts.has(item.ext)) continue;
            if (q.shape && shapeOf(item) !== q.shape) continue;
            if (wantColor !== null && !item.pal.some((c) => colorDistance(c, wantColor) <= COLOR_DISTANCE)) continue;
            if (folderSet && !item.folders.some((f) => folderSet.has(f))) continue;
            if (q.scope === 'uncategorized' && item.folders.some((f) => this.folders.byId.has(f))) continue;
            if (q.scope === 'untagged' && item.tags.length > 0) continue;
            if (wantTags.length && !wantTags.every((t) => item.tags.includes(t))) continue;
            if (terms.length) {
                const hay = this._haystack(item);
                if (!terms.every((t) => hay.includes(t))) continue;
            }
            matched.push(item);
        }
        const sorter = SORTERS[q.sort] || SORTERS.added;
        const dir = q.order === 'asc' ? 1 : -1;
        matched.sort((a, b) => dir * sorter(a, b) || (a.id < b.id ? -1 : 1));
        const result = { total: matched.length, ids: matched.map((i) => i.id) };
        this._queryCache.set(key, result);
        if (this._queryCache.size > QUERY_CACHE_SIZE) this._queryCache.delete(this._queryCache.keys().next().value);
        return result;
    }

    /**
     * Width/height ratio of every item of a query, x1000, for laying out a whole view at once.
     * @returns {Buffer} little-endian Uint16 per item (1000 when the size is unknown)
     */
    ratios(q) {
        const { ids } = this.query(q);
        const out = Buffer.alloc(ids.length * 2);
        for (let i = 0; i < ids.length; i++) {
            const item = this.items.get(ids[i]);
            const ratio = item.w && item.h ? Math.round((item.w / item.h) * 1000) : 1000;
            out.writeUInt16LE(Math.min(20000, Math.max(50, ratio)), i * 2);
        }
        return out;
    }

    _haystack(item) {
        if (item._hay === undefined) {
            const folderNames = item.folders.map((f) => (this.folders.byId.get(f) || {}).name || '');
            const hay = [item.name, item.ext, item.annotation, item.url, ...item.tags, ...folderNames].join('\n').toLowerCase();
            Object.defineProperty(item, '_hay', { value: hay, enumerable: false, writable: true });
        }
        return item._hay;
    }

    get(id) {
        const item = this.items.get(id);
        return item && this.isVisible(item) ? item : null;
    }

    originalPath(item) {
        return path.join(this.itemDir(item.id), `${item.name}.${item.ext}`);
    }

    thumbnailPath(item) {
        return path.join(this.itemDir(item.id), `${item.name}_thumbnail.png`);
    }

    /**
     * Resolve links and return the real path only when it is still inside this library's `images`
     * folder; a symlink or junction planted in a library must not reach the rest of the disk.
     * @returns {Promise<string|null>} null when the file is missing or escapes the library
     */
    async contained(file) {
        try {
            if (!this._imagesRoot) this._imagesRoot = (await fsp.realpath(this.imagesDir())) + path.sep;
            const real = await fsp.realpath(file);
            return real.startsWith(this._imagesRoot) ? real : null;
        } catch {
            return null;
        }
    }

    /** Tag groups limited to tags that visible items carry, so hidden items cannot leak tag names. */
    visibleTagGroups() {
        const visible = new Set(this.tags.map((tag) => tag.name));
        return this.tagGroups.map((group) => ({ ...group, tags: group.tags.filter((name) => visible.has(name)) }));
    }

    /** True while the library folder is reachable (it may live on a removable drive). */
    async isAvailable() {
        try {
            await fsp.access(path.join(this.path, 'metadata.json'));
            return true;
        } catch {
            return false;
        }
    }

    async _stamp() {
        const stat = async (name) => {
            try {
                const s = await fsp.stat(path.join(this.path, name));
                return `${s.mtimeMs}:${s.size}`;
            } catch {
                return 'none';
            }
        };
        return `${await stat('mtime.json')}|${await stat('metadata.json')}`;
    }

    /** Poll the two library-level files Eagle rewrites on every change; reload when they move. */
    watch(intervalMs = 5000) {
        this.unwatch();
        this._watchTimer = setInterval(async () => {
            if (this._loading) return;
            try {
                const stamp = await this._stamp();
                if (stamp !== this._lastStamp && !stamp.startsWith('none')) await this.load();
            } catch (err) {
                this.log('warn', `refresh failed: ${err.message}`);
            }
        }, intervalMs);
        if (this._watchTimer.unref) this._watchTimer.unref();
    }

    unwatch() {
        if (this._watchTimer) clearInterval(this._watchTimer);
        this._watchTimer = null;
    }

    _indexCacheFile() {
        return this.cacheDir ? path.join(this.cacheDir, 'index.json') : null;
    }

    async _restoreIndexCache() {
        const file = this._indexCacheFile();
        if (!file) return;
        try {
            const data = await readJson(file);
            if (data.v !== INDEX_CACHE_VERSION || data.path !== this.path) return;
            for (const [rec, stamp] of data.items) {
                this.items.set(rec.id, rec);
                this.itemMtime.set(rec.id, stamp);
            }
            this._cachedCount = data.items.length;
        } catch (err) {
            if (err.code !== 'ENOENT') this.log('warn', `index cache ignored: ${err.message}`);
        }
    }

    async _saveIndexCache() {
        const file = this._indexCacheFile();
        if (!file) return;
        try {
            const items = [];
            for (const [id, rec] of this.items) {
                const stamp = this.itemMtime.get(id);
                if (stamp !== undefined) items.push([rec, stamp]);
            }
            await fsp.mkdir(path.dirname(file), { recursive: true });
            const tmp = `${file}.tmp`;
            await fsp.writeFile(tmp, JSON.stringify({ v: INDEX_CACHE_VERSION, path: this.path, items }));
            await fsp.rename(tmp, file);
            this._cachedCount = this.items.size;
        } catch (err) {
            this.log('warn', `index cache not saved: ${err.message}`);
        }
    }
}

module.exports = { Library, kindOf, isSafeFilePart };
