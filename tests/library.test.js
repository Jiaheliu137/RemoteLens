'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { Library, kindOf, isSafeFilePart } = require('../RemoteLens/server/library');
const net = require('../RemoteLens/server/net');
const { parseRange } = require('../RemoteLens/server/sendfile');
const { createLibrary, cleanup } = require('./fixture');

const base = {
    scope: 'all', folder: '', recursive: true, tags: [], text: '', kind: '', star: 0, exts: [], shape: '', color: null,
    sort: 'created', order: 'desc',
};

test('library index', async (t) => {
    const fx = createLibrary();
    t.after(() => cleanup(fx.root));
    const library = new Library(fx.lib, { cacheDir: path.join(fx.root, 'cache') });
    await library.load();

    await t.test('hides trashed, password-protected and unsafe items', () => {
        assert.equal(library.counts.all, 6);
        for (const id of ['T1', 'P1', 'P2', 'X1', 'J1']) assert.equal(library.get(id), null, id);
        assert.ok(library.get('A1'));
        assert.equal(library.folders.byId.has('SECRET'), false);
        assert.equal(library.folders.byId.get('JAPAN').color, 'red');
        assert.equal(library.folders.byId.get('TOKYO').color, '');
        assert.equal(library.folders.byId.has('DEEP'), false);
    });

    await t.test('counts folders directly and including descendants', () => {
        assert.equal(library.folders.byId.get('TOKYO').count, 2);
        assert.equal(library.folders.byId.get('JAPAN').count, 3);
        assert.equal(library.folders.byId.get('JAPAN').total, 5);
        assert.equal(library.folders.byId.get('ROOT').total, 5);
        assert.equal(library.counts.uncategorized, 1);
        assert.equal(library.counts.untagged, 2);
    });

    await t.test('filters by folder, tag, kind and text', () => {
        assert.deepEqual(library.query({ ...base, scope: 'folder', folder: 'JAPAN' }).ids, ['A1', 'A2', 'A3', 'V1', 'S1'].sort((a, b) =>
            library.items.get(b).btime - library.items.get(a).btime || (a < b ? -1 : 1)));
        assert.equal(library.query({ ...base, scope: 'folder', folder: 'JAPAN', recursive: false }).total, 3);
        assert.deepEqual(library.query({ ...base, tags: ['tokyo'] }).ids, ['A1', 'V1']);
        assert.deepEqual(library.query({ ...base, kind: 'video' }).ids, ['V1']);
        assert.deepEqual(library.query({ ...base, text: 'GOLDEN pavilion' }).ids, ['A2']);
        assert.deepEqual(library.query({ ...base, text: 'tokyo' }).ids, ['A1', 'V1']);
        assert.deepEqual(library.query({ ...base, scope: 'uncategorized' }).ids, ['U1']);
        assert.equal(library.query({ ...base, scope: 'folder', folder: 'SECRET' }).total, 0);
    });

    await t.test('keeps file access inside the library and hidden tags out of tag groups', async () => {
        assert.ok(await library.contained(library.originalPath(library.get('A1'))));
        assert.equal(await library.contained(path.join(fx.lib, 'images', 'J1.info', 'linked.jpg')), null);
        assert.equal(await library.contained(path.join(fx.lib, 'metadata.json')), null);
        assert.equal(await library.contained(path.join(fx.lib, 'images', 'A1.info', 'missing.jpg')), null);
        assert.deepEqual(library.visibleTagGroups()[0].tags, ['tokyo', 'kyoto']);
    });

    await t.test('filters by rating, format, shape and colour, and reports ratios', () => {
        assert.deepEqual(library.query({ ...base, star: 4 }).ids, ['A2']);
        assert.deepEqual(library.query({ ...base, exts: ['png', 'mov'] }).ids, ['A3', 'V1']);
        assert.deepEqual(library.query({ ...base, shape: 'portrait' }).ids, ['A3']);
        assert.equal(library.query({ ...base, shape: 'landscape' }).total, 5);
        assert.deepEqual(library.query({ ...base, color: 0xe02020 }).ids, ['A1']);
        assert.equal(library.query({ ...base, color: 0x20e020 }).total, 0);
        assert.deepEqual(library.exts.map((e) => e.ext).sort(), ['heic', 'jpg', 'mov', 'png', 'svg']);
        assert.deepEqual(library.extCounts({ ...base, scope: 'folder', folder: 'TOKYO', exts: ['png'] }),
            [{ ext: 'jpg', count: 1 }, { ext: 'mov', count: 1 }]);
        assert.deepEqual(library.extCounts({ ...base, kind: 'video' }), [{ ext: 'mov', count: 1 }]);
        const ratios = library.ratios({ ...base, exts: ['png', 'mov'] });
        assert.deepEqual([ratios.readUInt16LE(0), ratios.readUInt16LE(2)], [500, 1333]);
    });

    await t.test('sorts names naturally and by size', () => {
        const names = library.query({ ...base, scope: 'folder', folder: 'JAPAN', recursive: false, sort: 'name', order: 'asc' })
            .ids.map((id) => library.items.get(id).name);
        assert.deepEqual(names, ['temple 2', 'temple 10', 'vector']);
        assert.equal(library.query({ ...base, sort: 'size', order: 'desc' }).ids[0], 'A1');
    });

    await t.test('picks up changes incrementally and restores from its cache', async () => {
        const before = library.version;
        fx.writeItem(fx.item('N1', 'new one', 'jpg', { folders: ['TOKYO'] }));
        const mtimeFile = path.join(fx.lib, 'mtime.json');
        fs.writeFileSync(mtimeFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(mtimeFile, 'utf8')), N1: 9 }));
        await library.load();
        assert.equal(library.version, before + 1);
        assert.ok(library.get('N1'));
        assert.equal(library.counts.all, 7);

        const second = new Library(fx.lib, { cacheDir: path.join(fx.root, 'cache') });
        await second.load();
        assert.equal(second.counts.all, 7);
        assert.equal(second.get('X1'), null);
    });
});

test('file name safety', () => {
    assert.equal(isSafeFilePart('2015-07-11 172427', 'jpg'), true);
    assert.equal(isSafeFilePart('..\\..\\secret', 'jpg'), false);
    assert.equal(isSafeFilePart('a/b', 'jpg'), false);
    assert.equal(isSafeFilePart('..', 'jpg'), false);
    assert.equal(isSafeFilePart('ok', 'j/pg'), false);
    assert.equal(isSafeFilePart('ok', ''), false);
    assert.equal(kindOf('heic'), 'image');
    assert.equal(kindOf('mov'), 'video');
    assert.equal(kindOf('docx'), 'other');
});

test('address zones', () => {
    assert.equal(net.classify('127.0.0.1'), 'loopback');
    assert.equal(net.classify('::1'), 'loopback');
    assert.equal(net.classify('::ffff:100.101.102.103'), 'tailscale');
    assert.equal(net.classify('100.63.0.1'), 'public');
    assert.equal(net.classify('100.128.0.1'), 'public');
    assert.equal(net.classify('fd7a:115c:a1e0::1'), 'tailscale');
    assert.equal(net.classify('192.168.1.20'), 'lan');
    assert.equal(net.classify('10.0.0.5'), 'lan');
    assert.equal(net.classify('172.32.0.1'), 'public');
    assert.equal(net.classify('8.8.8.8'), 'public');
    assert.equal(net.classify('2001:db8::1'), 'public');
    assert.equal(net.isAllowed('192.168.1.20', { allowLan: false }), false);
    assert.equal(net.isAllowed('192.168.1.20', { allowLan: true }), true);
    assert.equal(net.isAllowed('8.8.8.8', { allowLan: true }), false);
    assert.equal(net.isAllowed('100.64.0.7', { allowLan: false }), true);
});

test('range parsing', () => {
    assert.deepEqual(parseRange('bytes=0-99', 1000), { start: 0, end: 99 });
    assert.deepEqual(parseRange('bytes=500-', 1000), { start: 500, end: 999 });
    assert.deepEqual(parseRange('bytes=-100', 1000), { start: 900, end: 999 });
    assert.deepEqual(parseRange('bytes=0-5000', 1000), { start: 0, end: 999 });
    assert.equal(parseRange('bytes=1000-', 1000), false);
    assert.equal(parseRange('bytes=5-2', 1000), false);
    assert.equal(parseRange(undefined, 1000), null);
    assert.equal(parseRange('bytes=0-1,5-6', 1000), null);
});
