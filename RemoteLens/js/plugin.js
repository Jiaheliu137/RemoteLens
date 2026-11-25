'use strict';
/* RemoteLens plugin window: owns the Host (server lifecycle) and shows its state. */

const path = require('path');

const EAGLE_THEME_MAP = {
    LIGHT: 'theme-light', LIGHTGRAY: 'theme-lightgray', GRAY: 'theme-gray',
    DARK: 'theme-dark', BLUE: 'theme-blue', PURPLE: 'theme-purple',
};
const ALL_THEMES = Object.values(EAGLE_THEME_MAP);
const REFRESH_MS = 3000;

let host = null;
let lastState = null;
let tokenVisible = false;
let selectedUrlKind = '';
let refreshTimer = 0;

const $ = (id) => document.getElementById(id);
const t = (key, vars) => (typeof i18next !== 'undefined' ? i18next.t(key, vars) : key);

function log(level, message) {
    const fn = (eagle.log && eagle.log[level]) || console.log;
    try {
        fn.call(eagle.log, `[RemoteLens] ${message}`);
    } catch {
        console.log(`[RemoteLens] ${level}: ${message}`);
    }
}

function syncEagleTheme() {
    if (typeof eagle === 'undefined' || !eagle.app) return;
    const themeClass = EAGLE_THEME_MAP[eagle.app.theme] || (eagle.app.isDarkColors() ? 'theme-gray' : 'theme-light');
    ALL_THEMES.forEach((name) => document.body.classList.remove(name));
    document.body.classList.add(themeClass);
}

function applyStaticText() {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
        node.textContent = t(node.dataset.i18n);
    });
    $('titlebar-minimize').title = t('ui.minimize');
    $('titlebar-close').title = t('ui.close');
}

async function currentLibraryPath() {
    if (eagle.library.path) return eagle.library.path;
    try {
        const info = await eagle.library.info();
        return (info && (info.path || (info.library && info.library.path))) || '';
    } catch (err) {
        log('warn', `library path unavailable: ${err.message}`);
        return '';
    }
}

function showModal(message, { confirmOnly = false } = {}) {
    return new Promise((resolve) => {
        const overlay = $('modalOverlay');
        $('modalBody').textContent = message;
        $('modalCancel').style.display = confirmOnly ? 'none' : '';
        overlay.style.display = 'flex';
        const finish = (result) => {
            overlay.style.display = 'none';
            $('modalConfirm').onclick = null;
            $('modalCancel').onclick = null;
            resolve(result);
        };
        $('modalConfirm').onclick = () => finish(true);
        $('modalCancel').onclick = () => finish(false);
    });
}

function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function copyText(text, button) {
    try {
        await eagle.clipboard.writeText(text);
    } catch {
        await navigator.clipboard.writeText(text);
    }
    const original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = t('ui.copied');
    setTimeout(() => { button.textContent = original; }, 1500);
}

function urlLabel(kind) {
    if (kind === 'tailscale-https') return t('ui.urlTailscaleHttps');
    if (kind === 'tailscale-ip') return t('ui.urlTailscaleIp');
    return t('ui.urlLan');
}

function renderQr(text) {
    const box = $('qr');
    if (!text) {
        box.replaceChildren();
        box.classList.add('qr-empty');
        return;
    }
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    box.classList.remove('qr-empty');
    // The SVG is generated locally from our own URL; it contains no external input.
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

function renderUrls(state) {
    const list = $('urls');
    const urls = state.urls;
    if (!urls.some((u) => u.kind === selectedUrlKind)) selectedUrlKind = urls.length ? urls[0].kind : '';
    const selected = urls.find((u) => u.kind === selectedUrlKind) || null;
    renderQr(selected ? selected.withToken : '');
    $('qrHint').textContent = !state.running ? t('ui.offHint') : (selected ? t('ui.scanHint') : t('ui.noUrl'));
    list.replaceChildren(...urls.map((entry) => {
        const row = document.createElement('div');
        row.className = `url-row${entry.kind === selectedUrlKind ? ' active' : ''}`;
        const main = document.createElement('button');
        main.className = 'url-main';
        const label = document.createElement('span');
        label.className = 'url-kind';
        label.textContent = urlLabel(entry.kind);
        const address = document.createElement('span');
        address.className = 'url-text';
        address.textContent = entry.url;
        main.append(label, address);
        main.onclick = () => {
            selectedUrlKind = entry.kind;
            renderUrls(lastState);
        };
        const copy = document.createElement('button');
        copy.className = 'btn-secondary';
        copy.textContent = t('ui.copy');
        copy.onclick = () => copyText(entry.url, copy);
        row.append(main, copy);
        return row;
    }));
}

function noticeFor(state) {
    if (!state.settings.enabled) return '';
    if (state.listenError) return t('ui.errPort', { port: state.settings.port, error: state.listenError });
    if (state.libraryError === 'library_missing') return t('ui.errLibraryMissing');
    if (state.libraryError && state.libraryError !== 'no_library') return t('ui.errLibrary', { error: state.libraryError });
    if (!state.tailscale.installed) return t('ui.noTailscale');
    if (!state.tailscale.running) return t('ui.tailscaleStopped');
    if (!state.tailscale.https) return t('ui.tailscaleNoHttps');
    return '';
}

async function render() {
    if (!host) return;
    const state = await host.describe();
    lastState = state;
    $('enabled').checked = state.settings.enabled;
    $('status').textContent = !state.settings.enabled ? t('ui.statusOff') : (state.running ? t('ui.statusOn') : t('ui.statusStarting'));
    document.body.classList.toggle('is-running', state.running);
    document.body.classList.toggle('is-off', !state.settings.enabled);

    const notice = noticeFor(state);
    $('notice').textContent = notice;
    $('notice').hidden = !notice;

    const libraryName = state.library ? state.library.name
        : path.basename(state.libraryPath || '').replace(/\.library$/i, '');
    $('library').textContent = state.library
        ? `${libraryName} · ${t('ui.items', { count: state.library.count.toLocaleString() })}`
        : (libraryName || t('ui.noLibrary'));

    renderUrls(state);
    $('token').textContent = tokenVisible ? state.settings.token : '•'.repeat(12);
    $('tokenToggle').textContent = tokenVisible ? t('ui.hide') : t('ui.show');
    if (document.activeElement !== $('port')) $('port').value = state.settings.port;
    $('allowLan').checked = state.settings.allowLan;
    $('connections').textContent = state.running ? t('ui.connections', { count: state.connections }) : '';
    $('cacheSize').textContent = formatBytes(state.previewCacheBytes);
}

function bindControls() {
    $('titlebar-minimize').addEventListener('click', () => eagle.window.minimize().catch(() => {}));
    // In service mode closing the window only hides it; the server keeps running in the background.
    $('titlebar-close').addEventListener('click', () => window.close());

    $('enabled').addEventListener('change', (event) => host.update({ enabled: event.target.checked }));
    $('allowLan').addEventListener('change', (event) => host.update({ allowLan: event.target.checked }));
    $('tokenToggle').addEventListener('click', () => {
        tokenVisible = !tokenVisible;
        render();
    });
    $('tokenCopy').addEventListener('click', () => copyText(host.settings.token, $('tokenCopy')));
    $('tokenReset').addEventListener('click', async () => {
        if (await showModal(t('ui.resetConfirm'))) await host.resetToken();
    });
    const applyPort = async () => {
        const port = Number($('port').value);
        if (!Number.isInteger(port) || port < 1024 || port > 65534) {
            await showModal(t('ui.portInvalid'), { confirmOnly: true });
            $('port').value = host.settings.port;
            return;
        }
        $('port').blur();
        if (port !== host.settings.port) await host.update({ port });
    };
    $('portApply').addEventListener('click', applyPort);
    $('port').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') applyPort();
    });
    $('cacheClear').addEventListener('click', () => host.clearPreviewCache());
}

function startRefreshing() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
        if (!document.hidden) render().catch((err) => log('warn', `render failed: ${err.message}`));
    }, REFRESH_MS);
}

eagle.onPluginCreate(async (plugin) => {
    syncEagleTheme();
    applyStaticText();
    bindControls();
    try {
        const { Host } = require(path.join(plugin.path, 'server', 'host.js'));
        host = new Host({
            webDir: path.join(plugin.path, 'web'),
            makePreview: window.RemoteLensPreview.make,
            log,
            onChange: () => render().catch((err) => log('warn', `render failed: ${err.message}`)),
        });
        await host.init();
        await host.setLibrary(await currentLibraryPath());
        await render();
        startRefreshing();
    } catch (err) {
        log('error', `start-up failed: ${err.stack || err.message}`);
        $('notice').textContent = String(err.message || err);
        $('notice').hidden = false;
    }
});

eagle.onPluginShow(() => {
    if (host) render().catch(() => {});
});

eagle.onLibraryChanged(async () => {
    if (host) await host.setLibrary(await currentLibraryPath());
});

eagle.onThemeChanged(() => {
    syncEagleTheme();
});

eagle.onPluginBeforeExit(() => {
    if (host) host.shutdown();
});
