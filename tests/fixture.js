'use strict';
/** Builds a tiny Eagle-shaped library in a temp folder for tests. */
const fs = require('fs');
const os = require('os');
const path = require('path');

const WEBP_HEADER = Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

function writeItem(root, meta, { body = 'original-bytes', thumb = true } = {}) {
    const dir = path.join(root, 'images', `${meta.id}.info`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(meta));
    const safe = !/[\\/]/.test(meta.name);
    if (safe) fs.writeFileSync(path.join(dir, `${meta.name}.${meta.ext}`), body);
    if (safe && thumb) fs.writeFileSync(path.join(dir, `${meta.name}_thumbnail.png`), WEBP_HEADER);
}

function item(id, name, ext, extra = {}) {
    return {
        id, name, ext, size: 100, btime: 1000, mtime: 2000, modificationTime: 3000, lastModified: 4000,
        tags: [], folders: [], isDeleted: false, url: '', annotation: '', width: 40, height: 30, ...extra,
    };
}

function createLibrary() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'remotelens-test-'));
    const lib = path.join(root, 'Sample.library');
    fs.mkdirSync(path.join(lib, 'images'), { recursive: true });
    const folders = [
        {
            id: 'ROOT', name: 'Trips', password: '', children: [
                { id: 'JAPAN', name: 'Japan', password: '', children: [{ id: 'TOKYO', name: 'Tokyo', password: '', children: [] }] },
                { id: 'SECRET', name: 'Private', password: 'x', children: [{ id: 'DEEP', name: 'Deep', password: '', children: [] }] },
            ],
        },
    ];
    fs.writeFileSync(path.join(lib, 'metadata.json'), JSON.stringify({
        folders, smartFolders: [], tagsGroups: [{ id: 'G1', name: 'Places', tags: ['tokyo', 'kyoto', 'secret-tag'] }],
    }));
    const items = [
        item('A1', 'sakura', 'jpg', {
            folders: ['TOKYO'], tags: ['tokyo', 'spring'], btime: 5000, size: 300,
            palettes: [{ color: [230, 40, 40], ratio: 60 }, { color: [20, 230, 20], ratio: 2 }],
        }),
        item('A2', 'temple 10', 'jpg', { folders: ['JAPAN'], tags: ['kyoto'], btime: 4000, size: 200, annotation: 'golden pavilion', star: 4 }),
        item('A3', 'temple 2', 'png', { folders: ['JAPAN'], tags: [], btime: 3000, width: 20, height: 40 }),
        item('V1', 'clip', 'mov', { folders: ['TOKYO'], tags: ['tokyo'], duration: 12.4, btime: 2000 }),
        item('U1', 'loose', 'heic', { folders: [], tags: ['misc'] }),
        item('T1', 'trashed', 'jpg', { folders: ['JAPAN'], isDeleted: true }),
        item('P1', 'hidden', 'jpg', { folders: ['SECRET'], tags: ['secret-tag'] }),
        item('P2', 'hidden deep', 'jpg', { folders: ['DEEP', 'JAPAN'] }),
        item('X1', '..\\..\\escape', 'jpg', { folders: ['JAPAN'] }),
        item('S1', 'vector', 'svg', { folders: ['JAPAN'] }),
    ];
    const mtimes = {};
    for (const meta of items) {
        writeItem(lib, meta, { body: meta.id === 'V1' ? '0123456789' : `bytes-of-${meta.id}`, thumb: meta.id !== 'A3' });
        mtimes[meta.id] = meta.lastModified;
    }
    // An item folder that is really a junction to somewhere outside the library.
    const outside = path.join(root, 'outside');
    fs.mkdirSync(outside);
    const linked = item('J1', 'linked', 'jpg', { folders: ['JAPAN'] });
    fs.writeFileSync(path.join(outside, 'metadata.json'), JSON.stringify(linked));
    fs.writeFileSync(path.join(outside, 'linked.jpg'), 'outside-the-library');
    fs.symlinkSync(outside, path.join(lib, 'images', 'J1.info'), 'junction');
    mtimes.J1 = linked.lastModified;
    mtimes.all = items.length;
    fs.writeFileSync(path.join(lib, 'mtime.json'), JSON.stringify(mtimes));
    return { root, lib, writeItem: (meta, opts) => writeItem(lib, meta, opts), item };
}

function cleanup(root) {
    fs.rmSync(root, { recursive: true, force: true });
}

module.exports = { createLibrary, cleanup };
