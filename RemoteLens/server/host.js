'use strict';
/**
 * Glue between the plugin window and the server core: settings on disk, the current library,
 * which addresses to listen on, and Tailscale Serve. Still free of Eagle/Electron APIs — the
 * plugin passes in the library path and the preview converter.
 */
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { Library } = require('./library');
const { PreviewCache } = require('./previews');
const { createApp, Listener, newToken } = require('./index');
const net = require('./net');
const tailscale = require('./tailscale');

const DATA_DIR = path.join(os.homedir(), '.remotelens');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DEFAULTS = { enabled: false, port: 41800, token: '', allowLan: false, previewCacheMB: 2048 };
const NETWORK_POLL_MS = 15000;

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    return (hash >>> 0).toString(36);
}

function sanitize(name) {
    return String(name).replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) || 'library';
}

function validPort(value) {
    const port = Number(value);
    // One below the maximum: the Tailscale HTTPS endpoint uses port + 1.
    return Number.isInteger(port) && port >= 1024 && port <= 65534 ? port : null;
}

class Host {
    /**
     * @param {object} o {webDir, makePreview, log, onChange}
     */
    constructor(o) {
        this.webDir = o.webDir;
        this.makePreview = o.makePreview || null;
        this.log = o.log || (() => {});
        this.onChange = o.onChange || (() => {});
        this.settings = { ...DEFAULTS };
        this.libraryPath = '';
        this.context = null;
        this.libraryError = '';
        this.listenError = '';
        this.bound = [];
        this.tailscale = { installed: false, running: false, dnsName: '', ips: [], https: false };
        this.served = false;
        this._queue = Promise.resolve();
        this._networkTimer = null;
        this._hostsKey = '';
        this.listener = new Listener(createApp({
            getContext: () => this.context,
            getConfig: () => ({
                token: this.settings.token,
                allowLan: this.settings.allowLan,
                tailscaleIps: this.tailscale.ips,
                dnsName: this.tailscale.dnsName,
            }),
            webDir: this.webDir,
            log: this.log,
        }), this.log);
    }

    async init() {
        try {
            const saved = JSON.parse(await fsp.readFile(SETTINGS_FILE, 'utf8'));
            this.settings = {
                ...DEFAULTS,
                enabled: saved.enabled === true,
                allowLan: saved.allowLan === true,
                port: validPort(saved.port) || DEFAULTS.port,
                token: typeof saved.token === 'string' && saved.token.length >= 12 ? saved.token : '',
                previewCacheMB: Number(saved.previewCacheMB) > 0 ? Number(saved.previewCacheMB) : DEFAULTS.previewCacheMB,
            };
        } catch (err) {
            if (err.code !== 'ENOENT') this.log('warn', `settings unreadable, using defaults: ${err.message}`);
        }
        if (!this.settings.token) {
            this.settings = { ...this.settings, token: newToken() };
            await this._saveSettings();
        }
    }

    async _saveSettings() {
        await fsp.mkdir(DATA_DIR, { recursive: true });
        const tmp = `${SETTINGS_FILE}.tmp`;
        await fsp.writeFile(tmp, JSON.stringify(this.settings, null, 2));
        await fsp.rename(tmp, SETTINGS_FILE);
    }

    /** Serialise state changes: toggles, library switches and network changes never interleave. */
    _enqueue(task) {
        const run = this._queue.then(task).catch((err) => {
            this.log('error', err.stack || err.message);
        }).then(() => this.onChange());
        this._queue = run;
        return run;
    }

    /** @param {object} patch subset of {enabled, port, allowLan} */
    update(patch) {
        return this._enqueue(async () => {
            const next = { ...this.settings };
            if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
            if (typeof patch.allowLan === 'boolean') next.allowLan = patch.allowLan;
            if (patch.port !== undefined) {
                const port = validPort(patch.port);
                if (!port) throw new Error(`invalid port: ${patch.port}`);
                next.port = port;
            }
            const portChanged = next.port !== this.settings.port;
            if (portChanged && this.served) await this._unserve();
            this.settings = next;
            await this._saveSettings();
            await this._apply();
        });
    }

    /** A new token signs out every device at once. */
    resetToken() {
        return this._enqueue(async () => {
            this.settings = { ...this.settings, token: newToken() };
            await this._saveSettings();
        });
    }

    /** Called at start-up and whenever Eagle switches to another library. */
    setLibrary(libraryPath) {
        return this._enqueue(async () => {
            if (libraryPath === this.libraryPath && this.context) return;
            this.libraryPath = libraryPath || '';
            await this._apply({ reloadLibrary: true });
        });
    }

    async _apply({ reloadLibrary = false } = {}) {
        if (!this.settings.enabled) {
            await this._stop();
            return;
        }
        if (reloadLibrary || !this.context) await this._openLibrary();
        await this._listen();
        this._watchNetwork();
    }

    async _openLibrary() {
        if (this.context) this.context.library.unwatch();
        this.context = null;
        this.libraryError = '';
        if (!this.libraryPath) {
            this.libraryError = 'no_library';
            return;
        }
        const cacheDir = path.join(DATA_DIR, 'cache',
            `${sanitize(path.basename(this.libraryPath).replace(/\.library$/i, ''))}_${simpleHash(this.libraryPath)}`);
        const library = new Library(this.libraryPath, { cacheDir, log: this.log });
        try {
            await library.load();
        } catch (err) {
            this.libraryError = err.code === 'ENOENT' ? 'library_missing' : (err.message || 'library_error');
            this.log('error', `cannot open library ${this.libraryPath}: ${err.message}`);
            return;
        }
        library.watch();
        const previews = new PreviewCache({
            dir: path.join(cacheDir, 'previews'),
            maxBytes: this.settings.previewCacheMB * 1024 * 1024,
            make: this.makePreview,
            log: this.log,
        });
        this.context = { library, previews };
    }

    /** HTTPS port published inside the tailnet; kept apart from the plain HTTP port to avoid any clash. */
    get servePort() {
        return this.settings.port + 1;
    }

    /**
     * Loopback is always enough when Tailscale Serve forwards to us. Only without it do we listen
     * on the Tailscale address directly, and only "allow LAN" opens every interface.
     */
    _wantedHosts() {
        if (this.settings.allowLan) return ['0.0.0.0'];
        if (this.served) return ['127.0.0.1'];
        // Addresses reported by Tailscale itself: 100.64.0.0/10 on some other adapter is carrier NAT, not ours.
        return ['127.0.0.1', ...(this.tailscale.running ? this.tailscale.ips : [])];
    }

    async _listen() {
        this.tailscale = await tailscale.status();
        if (this.tailscale.running && this.tailscale.https) {
            try {
                await tailscale.serveOn(this.servePort, this.settings.port);
                this.served = true;
            } catch (err) {
                this.served = false;
                this.log('warn', `tailscale serve failed: ${(err.stderr || err.message).trim()}`);
            }
        } else {
            this.served = false;
        }
        const hosts = this._wantedHosts();
        const result = await this.listener.listen(hosts, this.settings.port);
        this.bound = result.bound;
        this._hostsKey = hosts.join(',');
        const fatal = result.failed.find((f) => f.host === '127.0.0.1' || f.host === '0.0.0.0');
        this.listenError = fatal ? fatal.error : '';
        for (const f of result.failed) this.log('warn', `cannot listen on ${f.host}:${this.settings.port} (${f.error})`);
        if (this.listenError && this.served) await this._unserve();
    }

    _watchNetwork() {
        if (this._networkTimer) return;
        this._networkTimer = setInterval(async () => {
            if (!this.settings.enabled) return;
            const now = await tailscale.status();
            const serveShouldBe = now.running && now.https;
            if (serveShouldBe === this.served && this._hostsKey === this._wantedHosts().join(',')) return;
            this._enqueue(() => this._listen());
        }, NETWORK_POLL_MS);
        if (this._networkTimer.unref) this._networkTimer.unref();
    }

    async _unserve() {
        await tailscale.serveOff(this.servePort);
        this.served = false;
    }

    async _stop() {
        if (this._networkTimer) clearInterval(this._networkTimer);
        this._networkTimer = null;
        if (this.served) await this._unserve();
        await this.listener.close();
        this.bound = [];
        this.listenError = '';
        if (this.context) this.context.library.unwatch();
        this.context = null;
    }

    /** Stop everything without changing the saved "enabled" preference (Eagle is quitting). */
    shutdown() {
        return this._enqueue(() => this._stop());
    }

    clearPreviewCache() {
        return this._enqueue(async () => {
            if (this.context) await this.context.previews.clear();
        });
    }

    /** Everything the plugin window shows. */
    async describe() {
        const { port, token } = this.settings;
        const addresses = net.localAddresses();
        const urls = [];
        const running = this.settings.enabled && this.bound.length > 0 && !this.listenError;
        if (running) {
            if (this.served && this.tailscale.dnsName) {
                urls.push({ kind: 'tailscale-https', url: `https://${this.tailscale.dnsName}:${this.servePort}/` });
            }
            const direct = this.settings.allowLan
                ? (this.tailscale.running ? this.tailscale.ips : [])
                : this.bound.filter((ip) => this.tailscale.ips.includes(ip));
            for (const ip of direct) urls.push({ kind: 'tailscale-ip', url: `http://${ip}:${port}/` });
            if (this.settings.allowLan) for (const ip of addresses.lan) urls.push({ kind: 'lan', url: `http://${ip}:${port}/` });
        }
        const library = this.context ? this.context.library : null;
        return {
            settings: { ...this.settings },
            running,
            listenError: this.listenError,
            libraryError: this.libraryError,
            libraryPath: this.libraryPath,
            library: library ? { name: library.name, count: library.counts.all } : null,
            tailscale: { ...this.tailscale },
            urls: urls.map((u) => ({ ...u, withToken: `${u.url}?k=${encodeURIComponent(token)}` })),
            connections: this.listener.connections,
            previewCacheBytes: this.context ? await this.context.previews.size() : 0,
        };
    }
}

module.exports = { Host, DATA_DIR };
