'use strict';
/**
 * The set of libraries a phone may open: the ones Eagle itself knows about, nothing else.
 * Libraries are opened lazily (a large one takes a while to index the first time) and only a few
 * stay in memory. Clients name a library by an opaque id, never by path.
 */
const crypto = require('crypto');
const path = require('path');
const { Library } = require('./library');
const { PreviewCache } = require('./previews');

const MAX_OPEN = 3;

function idOf(libraryPath) {
    return crypto.createHash('sha1').update(path.resolve(libraryPath).toLowerCase()).digest('hex').slice(0, 12);
}

function nameOf(libraryPath) {
    return path.basename(libraryPath).replace(/\.library$/i, '');
}

function cacheFolderName(libraryPath) {
    const safe = nameOf(libraryPath).replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) || 'library';
    return `${safe}_${idOf(libraryPath)}`;
}

class LibraryPool {
    /**
     * @param {object} o {cacheRoot, makePreview, previewBytes, log}
     */
    constructor(o) {
        this.cacheRoot = o.cacheRoot;
        this.makePreview = o.makePreview || null;
        this.previewBytes = o.previewBytes;
        this.log = o.log || (() => {});
        this.known = new Map();
        this.currentId = '';
        this.entries = new Map();
    }

    /**
     * @param {string} currentPath the library open in Eagle ('' when none)
     * @param {string[]} otherPaths further libraries Eagle knows; pass [] to expose the current one only
     */
    setKnown(currentPath, otherPaths) {
        const known = new Map();
        for (const libraryPath of [currentPath, ...otherPaths]) {
            if (libraryPath && /\.library$/i.test(libraryPath)) known.set(idOf(libraryPath), path.resolve(libraryPath));
        }
        this.known = known;
        this.currentId = currentPath ? idOf(currentPath) : '';
        for (const id of Array.from(this.entries.keys())) {
            if (!known.has(id)) this._close(id);
        }
    }

    list() {
        return Array.from(this.known, ([id, libraryPath]) => ({ id, name: nameOf(libraryPath), current: id === this.currentId }));
    }

    /**
     * @param {string} id library id; '' means "whatever is open in Eagle"
     * @returns {{status:'ready'|'loading'|'unavailable'|'unknown', id:string, ctx?:object, error?:string}}
     */
    get(id) {
        const wanted = id || this.currentId;
        if (!wanted || !this.known.has(wanted)) return { status: id ? 'unknown' : 'unavailable', id: wanted };
        let entry = this.entries.get(wanted);
        if (!entry) {
            entry = this._open(wanted, this.known.get(wanted));
            this.entries.set(wanted, entry);
            this._evict(wanted);
        }
        entry.usedAt = Date.now();
        if (entry.ctx) return { status: 'ready', id: wanted, ctx: entry.ctx };
        if (entry.error) {
            // Forget the failure so the next request retries (the drive may have been plugged back in).
            this.entries.delete(wanted);
            return { status: 'unavailable', id: wanted, error: entry.error };
        }
        return { status: 'loading', id: wanted };
    }

    /** Resolves once the library is indexed (or failed). */
    async ready(id) {
        const first = this.get(id);
        const entry = this.entries.get(first.id);
        if (entry) await entry.loading;
        return this.get(id);
    }

    _open(id, libraryPath) {
        const cacheDir = path.join(this.cacheRoot, cacheFolderName(libraryPath));
        const library = new Library(libraryPath, { cacheDir, log: this.log });
        const entry = { ctx: null, error: '', usedAt: Date.now(), library, loading: null };
        entry.loading = library.load().then(() => {
            if (this.entries.get(id) !== entry) return;
            library.watch();
            entry.ctx = {
                library,
                previews: new PreviewCache({
                    dir: path.join(cacheDir, 'previews'), maxBytes: this.previewBytes, make: this.makePreview, log: this.log,
                }),
            };
        }).catch((err) => {
            entry.error = err.code === 'ENOENT' ? 'library_missing' : (err.message || 'library_error');
            this.log('error', `cannot open library: ${err.message}`);
        });
        return entry;
    }

    /** Keep the library open in Eagle plus the most recently used others. */
    _evict(justOpened) {
        const others = Array.from(this.entries.entries())
            .filter(([id]) => id !== this.currentId && id !== justOpened)
            .sort((a, b) => b[1].usedAt - a[1].usedAt);
        const room = MAX_OPEN - 1 - (justOpened !== this.currentId ? 1 : 0);
        for (const [id] of others.slice(Math.max(0, room))) this._close(id);
    }

    _close(id) {
        const entry = this.entries.get(id);
        if (entry) entry.library.unwatch();
        this.entries.delete(id);
    }

    closeAll() {
        for (const id of Array.from(this.entries.keys())) this._close(id);
    }

    async clearPreviews() {
        for (const entry of this.entries.values()) if (entry.ctx) await entry.ctx.previews.clear();
    }

    async previewBytesUsed() {
        let total = 0;
        for (const entry of this.entries.values()) if (entry.ctx) total += await entry.ctx.previews.size();
        return total;
    }
}

module.exports = { LibraryPool, idOf };
