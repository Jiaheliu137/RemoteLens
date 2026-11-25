'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { LibraryPool, idOf } = require('../RemoteLens/server/pool');
const { createLibrary, cleanup } = require('./fixture');

test('library pool', async (t) => {
    const a = createLibrary();
    const b = createLibrary();
    t.after(() => {
        cleanup(a.root);
        cleanup(b.root);
    });
    const pool = new LibraryPool({ cacheRoot: path.join(a.root, 'cache'), previewBytes: 0 });
    t.after(() => pool.closeAll());

    await t.test('only opens libraries it was told about, by opaque id', async () => {
        pool.setKnown(a.lib, [b.lib, 'not-a-library-folder', '']);
        assert.deepEqual(pool.list().map((l) => l.current), [true, false]);
        assert.equal(pool.get('nope').status, 'unknown');
        assert.equal(pool.get(a.lib).status, 'unknown');
        assert.equal(pool.get('').status, 'loading');
        const current = await pool.ready('');
        assert.equal(current.status, 'ready');
        assert.equal(current.id, idOf(a.lib));
        const other = await pool.ready(idOf(b.lib));
        assert.equal(other.status, 'ready');
        assert.notEqual(other.ctx.library, current.ctx.library);
    });

    await t.test('follows Eagle to another library and forgets removed ones', async () => {
        pool.setKnown(b.lib, []);
        assert.equal(pool.get(idOf(a.lib)).status, 'unknown');
        assert.equal((await pool.ready('')).id, idOf(b.lib));
        pool.setKnown('', []);
        assert.equal(pool.get('').status, 'unavailable');
    });

    await t.test('reports a missing library and retries later', async () => {
        const gone = path.join(a.root, 'Gone.library');
        pool.setKnown(gone, []);
        const result = await pool.ready('');
        assert.equal(result.status, 'unavailable');
        assert.equal(result.error, 'library_missing');
        assert.equal(pool.get('').status, 'loading');
    });
});
