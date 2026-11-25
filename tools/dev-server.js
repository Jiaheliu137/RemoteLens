'use strict';
/**
 * Run the RemoteLens server without Eagle, for development:
 *
 *   node tools/dev-server.js "D:\path\to\My.library" [port]
 *
 * Binds to 127.0.0.1 only. No preview converter is available outside Eagle, so large images
 * and HEIC files are served as originals. The token is printed on start.
 */
const path = require('path');
const os = require('os');
const { Library } = require('../RemoteLens/server/library');
const { PreviewCache } = require('../RemoteLens/server/previews');
const { createApp, Listener, newToken } = require('../RemoteLens/server/index');

async function main() {
    const libraryPath = process.argv[2];
    const port = Number(process.argv[3]) || 41800;
    if (!libraryPath) {
        console.error('usage: node tools/dev-server.js <path-to-.library> [port]');
        process.exit(1);
    }
    const log = (level, message) => console.log(`[${level}] ${message}`);
    const cacheDir = path.join(os.tmpdir(), 'remotelens-dev');
    const library = new Library(libraryPath, { cacheDir, log });
    await library.load();
    library.watch();
    const token = process.env.REMOTELENS_TOKEN || newToken();
    const app = createApp({
        getContext: () => ({ library, previews: new PreviewCache({ dir: null }) }),
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
