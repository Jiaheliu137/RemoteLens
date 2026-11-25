'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');
const { Library } = require('../RemoteLens/server/library');
const { PreviewCache } = require('../RemoteLens/server/previews');
const { createApp, API_VERSION } = require('../RemoteLens/server/index');
const { createLibrary, cleanup } = require('./fixture');

const TOKEN = 'test-token-0123456789';

function request(port, method, url, { headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, method, path: url, headers, agent: false }, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', reject);
        req.end(body);
    });
}

test('http server', async (t) => {
    const fx = createLibrary();
    const library = new Library(fx.lib);
    await library.load();
    let context = { library, previews: new PreviewCache({ dir: null }) };
    const config = { token: TOKEN, allowLan: false };
    const server = http.createServer(createApp({
        getContext: (id) => {
            if (id && id !== 'main') return { status: 'unknown', id };
            return context ? { status: 'ready', id: 'main', ctx: context } : { status: 'unavailable', id: 'main' };
        },
        getLibraries: async () => [{ id: 'main', name: 'Sample', current: true }],
        getConfig: () => config,
        webDir: path.join(__dirname, '..', 'RemoteLens', 'web'),
    }));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    t.after(() => {
        server.close();
        cleanup(fx.root);
    });
    const get = (url, headers) => request(port, 'GET', url, { headers });
    const login = await get(`/?k=${TOKEN}`);
    const cookie = String(login.headers['set-cookie']).split(';')[0];
    const authed = (url, headers = {}) => get(url, { ...headers, cookie });

    await t.test('everything except the login page needs the session cookie', async () => {
        for (const url of ['/api/library', '/api/items', '/api/item/A1', '/thumb/A1', '/preview/A1', '/file/A1']) {
            assert.equal((await get(url)).status, 401, url);
        }
        const page = await get('/');
        assert.equal(page.status, 200);
        assert.match(page.body, /loginForm/);
        assert.equal((await get('/api/library', { cookie: 'rl_session=deadbeef' })).status, 401);
    });

    await t.test('the QR link swaps the token for an HttpOnly cookie and leaves the URL clean', () => {
        assert.equal(login.status, 302);
        assert.equal(login.headers.location, '/');
        assert.match(String(login.headers['set-cookie']), /HttpOnly/);
        assert.match(String(login.headers['set-cookie']), /SameSite=Lax/);
        assert.equal(cookie.includes(TOKEN), false);
    });

    await t.test('serves the app, the library and paged items once signed in', async () => {
        assert.match((await authed('/')).body, /app\.js/);
        const lib = JSON.parse((await authed('/api/library')).body);
        assert.equal(lib.name, 'Sample');
        assert.equal(lib.api, API_VERSION);
        assert.equal(JSON.parse((await authed('/api/ping')).body).api, API_VERSION);
        assert.equal(lib.counts.all, 6);
        assert.equal(JSON.stringify(lib).includes('Private'), false);
        assert.equal(JSON.stringify(lib).includes('secret-tag'), false);
        const page = JSON.parse((await authed('/api/items?scope=all&sort=created&order=desc&offset=1&limit=2')).body);
        assert.equal(page.total, 6);
        assert.deepEqual(page.items.map((row) => row.id), ['A2', 'A3']);
        assert.equal((await authed('/api/items?scope=folder&folder=SECRET')).status, 404);
    });

    await t.test('never serves hidden, unsafe or unknown items', async () => {
        for (const id of ['T1', 'P1', 'P2', 'X1', 'J1', 'NOPE']) {
            for (const kind of ['thumb', 'preview', 'file']) assert.equal((await authed(`/${kind}/${id}`)).status, 404, `${kind}/${id}`);
            assert.equal((await authed(`/api/item/${id}`)).status, 404, id);
        }
        for (const url of ['/file/..%2f..%2fmetadata.json', '/file/A1/../../metadata.json', '/web/../server/index.js', '/metadata.json']) {
            assert.equal((await authed(url)).status, 404, url);
        }
    });

    await t.test('sends media with the right type, ranges and a sandbox for scriptable files', async () => {
        const thumb = await authed('/thumb/A1');
        assert.equal(thumb.headers['content-type'], 'image/webp');
        assert.equal(thumb.headers['x-content-type-options'], 'nosniff');
        const fallback = await authed('/thumb/A3');
        assert.equal(fallback.headers['content-type'], 'image/png');
        assert.equal(fallback.body, 'bytes-of-A3');
        const part = await authed('/file/V1', { range: 'bytes=2-5' });
        assert.equal(part.status, 206);
        assert.equal(part.body, '2345');
        assert.equal(part.headers['content-range'], 'bytes 2-5/10');
        assert.equal((await authed('/file/V1', { range: 'bytes=50-' })).status, 416);
        const svg = await authed('/file/S1');
        assert.match(svg.headers['content-security-policy'], /sandbox/);
        assert.equal((await authed('/file/A1')).headers['content-security-policy'], undefined);
        assert.match((await authed('/file/A1?dl=1')).headers['content-disposition'], /^attachment/);
    });

    await t.test('is read-only and reports an unavailable library', async () => {
        for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
            assert.equal((await request(port, method, '/api/library', { headers: { cookie } })).status, 405, method);
        }
        const saved = context;
        context = null;
        assert.equal((await authed('/api/library')).status, 503);
        context = saved;
        assert.equal((await authed('/api/library?lib=other')).status, 404);
        assert.equal((await authed('/thumb/A1?lib=other')).status, 404);
        assert.deepEqual(JSON.parse((await authed('/api/libraries')).body).libraries.map((l) => l.id), ['main']);
        assert.equal((await get('/api/libraries')).status, 401);
        assert.equal(JSON.parse((await authed('/api/items?scope=all&sort=created&locate=A3')).body).index, 2);
    });

    await t.test('a new token signs every device out', async () => {
        config.token = 'another-token-9876543210';
        assert.equal((await authed('/api/library')).status, 401);
        config.token = TOKEN;
        assert.equal((await authed('/api/library')).status, 200);
    });

    await t.test('locks out repeated wrong tokens', async () => {
        const post = (token) => request(port, 'POST', '/api/login', {
            headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
        });
        for (let i = 0; i < 8; i++) assert.equal((await post('wrong')).status, 401);
        assert.equal((await post('wrong')).status, 429);
        assert.equal((await authed('/api/library')).status, 200);
        // The right token still works, so failing on purpose cannot lock the owner out.
        assert.equal((await post(TOKEN)).status, 200);
    });

    await t.test('refuses requests that did not come the intended way', async () => {
        const post = (headers) => request(port, 'POST', '/api/login', { headers, body: JSON.stringify({ token: TOKEN }) });
        assert.equal((await post({ 'content-type': 'text/plain' })).status, 400);
        assert.equal((await post({ 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' })).status, 400);
        const crossSite = await get(`/?k=${TOKEN}`, { 'sec-fetch-site': 'cross-site' });
        assert.equal(crossSite.headers['set-cookie'], undefined);
        assert.equal((await authed('/api/library', { host: 'evil.example.com' })).status, 403);
        assert.equal((await authed('/api/library', { host: 'localhost:1234' })).status, 200);
        assert.equal((await authed('/api/library', { 'x-forwarded-for': '100.64.0.7' })).status, 200);
        assert.equal((await authed('/api/library', { 'x-forwarded-for': '8.8.8.8' })).status, 403);
        assert.equal((await authed('/api/library', { 'x-forwarded-for': '100.64.0.7, 8.8.8.8' })).status, 403);
        assert.equal((await authed('/api/library', { 'tailscale-funnel-request': '?1' })).status, 403);
    });

    await t.test('sessions expire', async () => {
        const [, signature] = cookie.split('=')[1].split('.');
        const past = (Date.now() - 1000).toString(36);
        assert.equal((await get('/api/library', { cookie: `rl_session=${past}.${signature}` })).status, 401);
        const far = (Date.now() + 1e12).toString(36);
        assert.equal((await get('/api/library', { cookie: `rl_session=${far}.${signature}` })).status, 401);
    });
});
