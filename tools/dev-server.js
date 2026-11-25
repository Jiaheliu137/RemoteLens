'use strict';
/**
 * Run the RemoteLens server without Eagle, for development:
 *
 *   node tools/dev-server.js "D:\path\to\My.library" [port] [more.library ...]
 *
 * Binds to 127.0.0.1 only. No preview converter is available outside Eagle, so large images
 * and HEIC files are served as originals. The token is printed on start.
 */
const path = require('path');
const os = require('os');
const { LibraryPool } = require('../RemoteLens/server/pool');
const { createApp, Listener, newToken } = require('../RemoteLens/server/index');

async function main() {
    const libraryPath = process.argv[2];
    const port = Number(process.argv[3]) || 41800;
    if (!libraryPath) {
        console.error('usage: node tools/dev-server.js <path-to-.library> [port]');
        process.exit(1);
    }
    const log = (level, message) => console.log(`[${level}] ${message}`);
    const pool = new LibraryPool({ cacheRoot: path.join(os.tmpdir(), 'remotelens-dev'), previewBytes: 0, log });
    pool.setKnown(libraryPath, process.argv.slice(4));
    const first = await pool.ready('');
    if (first.status !== 'ready') throw new Error(`cannot open ${libraryPath}: ${first.error || first.status}`);
    const token = process.env.REMOTELENS_TOKEN || newToken();
    const app = createApp({
        getContext: () => pool.get(''),
        getLibraries: async () => pool.list(),
        // No Eagle here: "switching" just changes which of the given libraries counts as open.
        switchLibrary: async (id) => {
            const target = pool.known.get(id);
            if (!target) return false;
            pool.setKnown(target, Array.from(pool.known.values()));
            return true;
        },
        getConfig: () => ({ token, allowLan: false }),
        webDir: path.join(__dirname, '..', 'RemoteLens', 'web'),
        log,
    });
    const listener = new Listener(app, log);
    const result = await listener.listen(['127.0.0.1'], port);
    if (result.failed.length) throw new Error(`cannot listen: ${JSON.stringify(result.failed)}`);
    console.log(`RemoteLens dev server: http://127.0.0.1:${port}/?k=${token}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
