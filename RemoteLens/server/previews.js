'use strict';
/**
 * Disk cache of downsized previews. Lives outside the Eagle library.
 * The actual image decoding is injected (`make`), because it needs Chromium/Electron and the
 * server core must stay runnable under plain Node.
 */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const EXT_BY_TYPE = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const TYPE_BY_EXT = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' };
const MAX_PARALLEL = 2;
const MAX_QUEUED = 24;

class PreviewCache {
    /**
     * @param {object} o {dir, maxBytes, make: async ({file, ext, maxEdge}) => {buffer, type}|null, log}
     */
    constructor(o) {
        this.dir = o.dir;
        this.maxBytes = o.maxBytes || 2 * 1024 * 1024 * 1024;
        this.make = o.make || null;
        this.log = o.log || (() => {});
        this._bytes = null;
        this._inflight = new Map();
        this._running = 0;
        this._queue = [];
    }

    get enabled() {
        return Boolean(this.make && this.dir);
    }

    async _find(key) {
        for (const ext of Object.keys(TYPE_BY_EXT)) {
            const file = path.join(this.dir, `${key}.${ext}`);
            try {
                await fsp.access(file);
                return { file, type: TYPE_BY_EXT[ext] };
            } catch { /* try next extension */ }
        }
        return null;
    }

    /**
     * @param {string} key cache key made of [A-Za-z0-9_-] only
     * @returns {Promise<{file:string,type:string}|null>} null when no preview could be produced
     */
    async get(key, source) {
        if (!this.enabled) return null;
        const cached = await this._find(key);
        if (cached) return cached;
        if (!this._inflight.has(key)) {
            // Bounded backlog: when the converter is saturated the caller falls back to a lighter file.
            if (this._queue.length >= MAX_QUEUED) return null;
            const job = this._schedule(() => this._build(key, source)).finally(() => this._inflight.delete(key));
            this._inflight.set(key, job);
        }
        return this._inflight.get(key);
    }

    _schedule(task) {
        return new Promise((resolve, reject) => {
            const run = () => {
                this._running++;
                task().then(resolve, reject).finally(() => {
                    this._running--;
                    const next = this._queue.shift();
                    if (next) next();
                });
            };
            if (this._running < MAX_PARALLEL) run();
            else this._queue.push(run);
        });
    }

    async _build(key, source) {
        let made;
        try {
            made = await this.make(source);
        } catch (err) {
            this.log('warn', `preview failed for ${path.basename(source.file)}: ${err.message}`);
            return null;
        }
        if (!made || !made.buffer || !EXT_BY_TYPE[made.type]) return null;
        const file = path.join(this.dir, `${key}.${EXT_BY_TYPE[made.type]}`);
        await fsp.mkdir(this.dir, { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        await fsp.writeFile(tmp, made.buffer);
        await fsp.rename(tmp, file);
        if (this._bytes !== null) this._bytes += made.buffer.length;
        this._pruneIfNeeded().catch((err) => this.log('warn', `preview prune failed: ${err.message}`));
        return { file, type: made.type };
    }

    async _list() {
        const names = await fsp.readdir(this.dir).catch(() => []);
        const files = [];
        for (const name of names) {
            try {
                const stat = await fsp.stat(path.join(this.dir, name));
                if (stat.isFile()) files.push({ file: path.join(this.dir, name), size: stat.size, mtime: stat.mtimeMs });
            } catch { /* removed meanwhile */ }
        }
        return files;
    }

    async size() {
        if (!this.dir) return 0;
        if (this._bytes === null) this._bytes = (await this._list()).reduce((sum, f) => sum + f.size, 0);
        return this._bytes;
    }

    async _pruneIfNeeded() {
        if ((await this.size()) <= this.maxBytes) return;
        const files = (await this._list()).sort((a, b) => a.mtime - b.mtime);
        let total = files.reduce((sum, f) => sum + f.size, 0);
        for (const f of files) {
            if (total <= this.maxBytes * 0.8) break;
            await fsp.unlink(f.file).catch(() => {});
            total -= f.size;
        }
        this._bytes = total;
    }

    async clear() {
        if (!this.dir) return;
        for (const f of await this._list()) await fsp.unlink(f.file).catch(() => {});
        this._bytes = 0;
    }
}

module.exports = { PreviewCache };
