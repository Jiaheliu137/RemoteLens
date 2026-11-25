'use strict';
/* RemoteLens mobile web client. No build step, no dependencies. Read-only. */
(() => {
    // ───────────────────────── i18n ─────────────────────────
    const ZH = (navigator.language || '').toLowerCase().startsWith('zh');
    const STRINGS = {
        all: ['全部', 'All'], uncategorized: ['未分类', 'Uncategorized'], untagged: ['未标签', 'Untagged'],
        folders: ['文件夹', 'Folders'], tags: ['标签', 'Tags'], search: ['搜索名称、标签、备注', 'Search name, tags, notes'],
        items: ['{0} 项', '{0} items'], empty: ['这里没有内容', 'Nothing here'],
        emptySearch: ['没有匹配的内容', 'No matches'], loading: ['加载中…', 'Loading…'],
        sortBy: ['排序', 'Sort by'], added: ['添加日期', 'Date added'], created: ['创建日期', 'Date created'],
        modified: ['修改日期', 'Date modified'], name: ['名称', 'Name'], size: ['文件大小', 'File size'],
        duration: ['时长', 'Duration'], ext: ['格式', 'Format'], asc: ['升序', 'Ascending'], desc: ['降序', 'Descending'],
        type: ['类型', 'Type'], anyType: ['全部', 'All'], image: ['图片', 'Images'], video: ['视频', 'Videos'],
        audio: ['音频', 'Audio'], other: ['其他', 'Other'], columns: ['每行数量', 'Columns'], auto: ['自动', 'Auto'],
        recursive: ['包含子文件夹里的内容', 'Include subfolder contents'], view: ['显示', 'View'],
        info: ['详细信息', 'Details'], dimensions: ['尺寸', 'Dimensions'], folder: ['所在文件夹', 'Folders'],
        note: ['备注', 'Note'], link: ['来源链接', 'Source'], rating: ['评分', 'Rating'],
        download: ['下载原文件', 'Download original'], openOriginal: ['打开原文件', 'Open original'],
        cantShow: ['浏览器无法显示这种格式，可以下载原文件查看', 'This format cannot be shown in the browser. Download it instead.'],
        unavailable: ['素材库暂时不可用：电脑上的远程访问已关闭，或素材库所在的磁盘没有连接。',
            'Library unavailable: remote access is switched off on the computer, or the library drive is not connected.'],
        offline: ['连不上电脑，正在重试…', 'Cannot reach the computer. Retrying…'],
        filterTags: ['筛选标签', 'Filter tags'], noTags: ['没有标签', 'No tags'], ungrouped: ['未分组', 'Ungrouped'],
        allTags: ['全部标签', 'All tags'], close: ['关闭', 'Close'], menu: ['菜单', 'Menu'], back: ['返回', 'Back'],
        prev: ['上一个', 'Previous'], next: ['下一个', 'Next'], libraryChanged: ['素材库有更新，已刷新', 'Library updated'],
        libraries: ['素材库', 'Libraries'],
        switchHint: ['切换后，电脑上的 Eagle 也会一起切换', 'Eagle on the computer switches too'],
        switching: ['正在切换素材库…', 'Switching library…'], switchFailed: ['切换失败，请在电脑上确认 Eagle 正常运行', 'Could not switch. Check that Eagle is running on the computer.'],
        onDesktop: ['当前', 'Current'], opening: ['正在打开素材库，首次打开大的库需要一点时间…', 'Opening the library. A large one takes a moment the first time…'],
        reader: ['阅读模式', 'Reading mode'], readerV: ['竖向', 'Vertical'], readerL: ['横向 →', 'Horizontal →'], readerR: ['横向 ←', 'Horizontal ←'],
        readerEmpty: ['这里没有可以连续阅读的图片', 'No images to read here'],
        layout: ['布局', 'Layout'], layoutGrid: ['方格', 'Squares'], layoutJust: ['自适应', 'Justified'],
        filter: ['筛选', 'Filter'], anyRating: ['不限', 'Any'], shape: ['形状', 'Shape'], anyShape: ['不限', 'Any'],
        landscape: ['横图', 'Landscape'], portrait: ['竖图', 'Portrait'], square: ['方图', 'Square'],
        color: ['颜色', 'Colour'], formats: ['格式', 'Formats'], clearFilters: ['清除筛选', 'Clear filters'],
        stale: ['插件已更新，但电脑上的 Eagle 还没重启。请完全退出 Eagle 再打开，然后刷新本页。',
            'The plugin was updated but Eagle has not been restarted. Quit Eagle completely, open it again, then reload this page.'],
        failed: ['请求失败（{0}），请刷新页面重试', 'Request failed ({0}). Reload the page and try again.'],
        openFolder: ['打开所在文件夹', 'Open containing folder'],
        slideshow: ['幻灯片', 'Slideshow'], stars: ['{0} 星及以上', '{0}+ stars'],
    };
    const t = (key, ...args) => {
        const pair = STRINGS[key];
        const text = pair ? pair[ZH ? 0 : 1] : key;
        return text.replace(/\{(\d)\}/g, (_, i) => args[Number(i)]);
    };
    document.documentElement.lang = ZH ? 'zh-CN' : 'en';

    // ───────────────────────── helpers ─────────────────────────
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const ICONS = {
        menu: 'M4 7h16M4 12h16M4 17h16', search: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM20 20l-3.9-3.9',
        sort: 'M7 5v14M7 19l-3-3M7 5l3 3M17 19V5M17 5l3 3M17 19l-3-3', close: 'M6 6l12 12M18 6L6 18',
        back: 'M15 5l-7 7l7 7', chevron: 'M9 6l6 6l-6 6', info: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 11v6M12 7.5v.5',
        folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
        all: 'M4 5h16v14H4zM4 15l4-4l4 4l3-3l5 5', inbox: 'M4 13l2-8h12l2 8v6H4zM4 13h5l1 2h4l1-2h5',
        tag: 'M4 4h7l9 9l-7 7l-9-9zM8 8v.5', download: 'M12 4v11M7 11l5 5l5-5M5 20h14',
        open: 'M14 5h5v5M19 5l-8 8M10 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4',
        play: 'M8 5l11 7l-11 7z', file: 'M7 3h7l5 5v13H7zM14 3v5h5',
        book: 'M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2z',
        check: 'M5 12.5l4.5 4.5L19 7.5', pause: 'M8 5v14M16 5v14', swap: 'M7 4v16M7 4L3.5 7.5M7 4l3.5 3.5M17 20V4M17 20l-3.5-3.5M17 20l3.5-3.5',
    };
    function icon(name, size = 22) {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', size);
        svg.setAttribute('height', size);
        svg.setAttribute('aria-hidden', 'true');
        svg.classList.add('icon');
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', ICONS[name]);
        svg.appendChild(path);
        return svg;
    }
    /** Tiny DOM builder. Text is always set as text, never as HTML: library names and tags are untrusted. */
    function h(tag, props, ...children) {
        const el = document.createElement(tag);
        for (const [key, value] of Object.entries(props || {})) {
            if (value === false || value == null) continue;
            if (key === 'class') el.className = value;
            else if (key === 'dataset') Object.assign(el.dataset, value);
            else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
            else if (key in el && key !== 'list') el[key] = value;
            else el.setAttribute(key, value === true ? '' : value);
        }
        for (const child of children.flat(Infinity)) {
            if (child == null || child === false) continue;
            el.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(child) : child);
        }
        return el;
    }
    const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
    function formatBytes(n) {
        if (n < 1024) return `${n} B`;
        const units = ['KB', 'MB', 'GB', 'TB'];
        let v = n / 1024;
        let i = 0;
        while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
        return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
    }
    function formatDuration(sec) {
        const s = Math.max(0, Math.round(sec));
        const hh = Math.floor(s / 3600);
        const mm = Math.floor((s % 3600) / 60);
        const ss = String(s % 60).padStart(2, '0');
        return hh ? `${hh}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
    }
    const formatDate = (ms) => (ms ? new Date(ms).toLocaleString(ZH ? 'zh-CN' : undefined, {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }) : '');

    const PREF_KEY = 'remotelens.prefs.v1';
    const DEFAULT_PREFS = { sort: 'added', order: 'desc', cols: 0, recursive: true, expanded: {}, reader: 'v', layout: 'grid' };
    function loadPrefs() {
        try {
            return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') };
        } catch {
            return { ...DEFAULT_PREFS };
        }
    }
    let prefs = loadPrefs();
    function setPrefs(patch) {
        prefs = { ...prefs, ...patch };
        try {
            localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
        } catch { /* private mode: keep the session copy only */ }
    }

    class ApiError extends Error {
        constructor(status, code) {
            super(`HTTP ${status}`);
            this.status = status;
            this.code = code || '';
        }
    }
    // Media URLs carry the library id only to keep caches apart: the same item id may exist in two libraries.
    const mediaUrl = (kind, row) => `/${kind}/${row.id}?v=${row.v}&l=${state.libId}`;
    const fileUrl = (id, download) => `/file/${id}?l=${state.libId}${download ? '&dl=1' : ''}`;
    async function api(path) {
        let res;
        try {
            res = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
        } catch {
            throw new ApiError(0);
        }
        if (res.status === 401) {
            location.reload();
            throw new ApiError(401);
        }
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new ApiError(res.status, body.error);
        }
        return res.json();
    }
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // ───────────────────────── state ─────────────────────────
    /** Must match API_VERSION in server/index.js. */
    const CLIENT_API = 4;
    const PAGE = 150;
    const GAP = 2;
    const state = {
        lib: null,
        folderIndex: new Map(),
        view: { scope: 'all', folder: '', tags: [], q: '', kind: '', star: 0, exts: [], shape: '', color: '' },
        total: 0,
        rows: [],
        pages: new Map(),
        generation: 0,
        version: 0,
        libId: '',
        locateAfterLoad: '',
        stale: false,
        facetKey: '',
        facetExts: null,
        scrollMemory: new Map(),
    };

    const BLANK_VIEW = { scope: 'all', folder: '', tags: [], q: '', kind: '', star: 0, exts: [], shape: '', color: '' };
    function parseHash() {
        const raw = location.hash.replace(/^#\/?/, '');
        const cut = raw.indexOf('?');
        const segs = (cut === -1 ? raw : raw.slice(0, cut)).split('/');
        const params = new URLSearchParams(cut === -1 ? '' : raw.slice(cut + 1));
        const view = {
            scope: 'all', folder: '', tags: params.getAll('tag'), q: params.get('q') || '', kind: params.get('kind') || '',
            star: Number(params.get('star')) || 0, exts: params.getAll('ext'), shape: params.get('shape') || '',
            color: /^[0-9a-f]{6}$/i.test(params.get('color') || '') ? params.get('color') : '',
        };
        if (segs[0] === 'folder' && segs[1]) {
            view.scope = 'folder';
            view.folder = segs[1];
        } else if (segs[0] === 'uncategorized' || segs[0] === 'untagged') {
            view.scope = segs[0];
        }
        return view;
    }
    /** Filter part of a view as URL parameters (shared by the address bar and the API). */
    function filterParams(view, params) {
        (view.tags || []).forEach((tag) => params.append('tag', tag));
        if (view.q) params.set('q', view.q);
        if (view.kind) params.set('kind', view.kind);
        if (view.star) params.set('star', String(view.star));
        (view.exts || []).forEach((ext) => params.append('ext', ext));
        if (view.shape) params.set('shape', view.shape);
        if (view.color) params.set('color', view.color);
        return params;
    }
    function isFiltered(view) {
        return Boolean(view.q || (view.tags || []).length || view.kind || view.star || (view.exts || []).length || view.shape || view.color);
    }
    function hashOf(view) {
        const params = filterParams(view, new URLSearchParams());
        const base = view.scope === 'folder' ? `folder/${view.folder}` : view.scope;
        const qs = params.toString();
        return `#/${base}${qs ? `?${qs}` : ''}`;
    }
    function queryString(view) {
        const params = new URLSearchParams({
            scope: view.scope, sort: prefs.sort, order: prefs.order, recursive: prefs.recursive ? '1' : '0',
        });
        if (view.scope === 'folder') params.set('folder', view.folder);
        return filterParams(view, params).toString();
    }

    // ───────────────────────── layers (drawer, sheets, viewer) ─────────────────────────
    // Each open layer owns one history entry, so the system back gesture closes the top one.
    const layers = [];
    let pendingView = null;
    function pushLayer(close) {
        layers.push(close);
        history.pushState({ depth: layers.length }, '');
    }
    function closeTopLayer() {
        if (layers.length) history.back();
    }
    function navigate(view, { replace = false } = {}) {
        if (layers.length) {
            pendingView = view;
            history.go(-layers.length);
            return;
        }
        const target = hashOf(view);
        if (target === location.hash) return;
        state.scrollMemory.set(location.hash, window.scrollY);
        if (replace) {
            history.replaceState(null, '', target);
            onRoute(false);
        } else {
            location.hash = target;
        }
    }
    window.addEventListener('popstate', (event) => {
        const depth = (event.state && event.state.depth) || 0;
        while (layers.length > depth) layers.pop()();
        if (pendingView && layers.length === 0) {
            const view = pendingView;
            pendingView = null;
            navigate(view);
        }
    });
    window.addEventListener('hashchange', () => onRoute(true));

    // ───────────────────────── skeleton ─────────────────────────
    const el = {};
    function buildSkeleton() {
        el.title = h('h1', { class: 'title' });
        el.subtitle = h('div', { class: 'subtitle' });
        el.searchInput = h('input', {
            class: 'search-input', type: 'search', placeholder: t('search'), enterKeyHint: 'search',
            autocapitalize: 'off', autocomplete: 'off', spellcheck: false,
        });
        el.searchBar = h('div', { class: 'searchbar', hidden: true },
            h('span', { class: 'search-icon' }, icon('search', 18)),
            el.searchInput,
            h('button', { class: 'icon-btn', 'aria-label': t('close'), onClick: () => closeSearch(true) }, icon('close')));
        el.topRow = h('div', { class: 'top-row' },
            h('button', { class: 'icon-btn menu-btn', 'aria-label': t('menu'), onClick: openDrawer }, icon('menu')),
            h('div', { class: 'title-wrap', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) }, el.title, el.subtitle),
            h('button', { class: 'icon-btn', 'aria-label': t('search'), onClick: openSearch }, icon('search')),
            h('button', { class: 'icon-btn', 'aria-label': t('reader'), onClick: () => openReader(null) }, icon('book')),
            h('button', { class: 'icon-btn', 'aria-label': t('sortBy'), onClick: openSortSheet }, icon('sort')));
        el.chips = h('div', { class: 'chips', hidden: true });
        el.banner = h('div', { class: 'banner', hidden: true, role: 'status' });
        el.header = h('header', { class: 'topbar' }, el.topRow, el.searchBar, el.chips, el.banner);
        el.grid = h('div', { class: 'grid' });
        el.empty = h('div', { class: 'empty', hidden: true });
        el.main = h('main', { class: 'main' }, el.grid, el.empty);
        el.drawer = h('aside', { class: 'drawer' });
        el.scrim = h('div', { class: 'scrim', hidden: true, onClick: closeTopLayer });
        el.sheet = h('div', { class: 'sheet', hidden: true });
        el.viewer = h('div', { class: 'viewer', hidden: true });
        el.reader = h('div', { class: 'reader', hidden: true });
        el.toast = h('div', { class: 'toast', hidden: true, role: 'status' });
        document.getElementById('app').append(el.header, el.main, el.scrim, el.drawer, el.sheet, el.viewer, el.reader, el.toast);

        let searchTimer = 0;
        el.searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => navigate({ ...state.view, q: el.searchInput.value.trim() }, { replace: true }), 280);
        });
        el.searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') el.searchInput.blur();
            if (event.key === 'Escape') closeSearch(true);
        });
        // A long press (or right click) on a picture shows its details without opening it.
        const press = { timer: 0, fired: false, x: 0, y: 0 };
        const cancelPress = () => {
            clearTimeout(press.timer);
            press.timer = 0;
        };
        const showDetails = (cell) => {
            const row = cell && state.rows[Number(cell.dataset.i)];
            if (row) openInfoSheet(row);
        };
        el.grid.addEventListener('touchstart', (event) => {
            const cell = event.target.closest('.cell');
            cancelPress();
            press.fired = false;
            if (!cell || event.touches.length !== 1) return;
            press.x = event.touches[0].clientX;
            press.y = event.touches[0].clientY;
            press.timer = setTimeout(() => {
                press.fired = true;
                if (navigator.vibrate) navigator.vibrate(8);
                showDetails(cell);
            }, 480);
        }, { passive: true });
        el.grid.addEventListener('touchmove', (event) => {
            const touch = event.touches[0];
            if (Math.abs(touch.clientX - press.x) > 10 || Math.abs(touch.clientY - press.y) > 10) cancelPress();
        }, { passive: true });
        el.grid.addEventListener('touchend', cancelPress, { passive: true });
        el.grid.addEventListener('touchcancel', cancelPress, { passive: true });
        el.grid.addEventListener('contextmenu', (event) => {
            const cell = event.target.closest('.cell');
            if (!cell) return;
            event.preventDefault();
            if (!press.fired) showDetails(cell);
        });
        el.grid.addEventListener('click', (event) => {
            if (press.fired) {
                press.fired = false;
                return;
            }
            const cell = event.target.closest('.cell');
            if (cell) openViewer(Number(cell.dataset.i));
        });
    }
    function openSearch() {
        el.searchBar.hidden = false;
        el.topRow.hidden = true;
        el.searchInput.value = state.view.q;
        el.searchInput.focus();
    }
    function closeSearch(clear) {
        el.searchBar.hidden = true;
        el.topRow.hidden = false;
        if (clear && state.view.q) navigate({ ...state.view, q: '' }, { replace: true });
    }
    let toastTimer = 0;
    function toast(message) {
        el.toast.textContent = message;
        el.toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2200);
    }
    function setBanner(message) {
        el.banner.textContent = message || '';
        el.banner.hidden = !message;
    }

    // ───────────────────────── library + routing ─────────────────────────
    function indexFolders(nodes, parent) {
        for (const node of nodes) {
            state.folderIndex.set(node.id, { node, parent });
            indexFolders(node.children, node.id);
        }
    }
    async function fetchLibrary() {
        for (;;) {
            try {
                return await api('/api/library');
            } catch (err) {
                if (err.code === 'library_loading') {
                    el.title.textContent = t('libraries');
                    el.subtitle.textContent = '';
                    setBanner(t('opening'));
                    await sleep(800);
                } else {
                    throw err;
                }
            }
        }
    }
    async function loadLibrary() {
        const lib = await fetchLibrary();
        state.stale = lib.api !== CLIENT_API;
        setBanner(state.stale ? t('stale') : '');
        state.lib = lib;
        state.libId = lib.id;
        state.version = lib.version;
        state.folderIndex = new Map();
        indexFolders(lib.folders, null);
        document.title = `${lib.name} · RemoteLens`;
        renderDrawer();
    }
    function viewTitle(view) {
        if (view.scope === 'folder') {
            const hit = state.folderIndex.get(view.folder);
            return hit ? hit.node.name : t('folders');
        }
        if (view.scope === 'all' && view.tags.length === 1 && !view.q) return view.tags[0];
        return t(view.scope);
    }
    function onRoute(fromHistory) {
        const view = parseHash();
        state.facetKey = '';
        state.facetExts = null;
        if (view.scope === 'folder' && state.lib && !state.folderIndex.has(view.folder)) {
            history.replaceState(null, '', '#/all');
            return onRoute(false);
        }
        state.view = view;
        if (view.q && el.searchBar.hidden) openSearch();
        if (!view.q && !el.searchBar.hidden && document.activeElement !== el.searchInput) closeSearch(false);
        el.title.textContent = viewTitle(view);
        renderChips();
        renderDrawer();
        const restore = fromHistory ? state.scrollMemory.get(location.hash) || 0 : 0;
        return resetGrid(restore);
    }

    function renderChips() {
        const view = state.view;
        const chips = [];
        if (view.scope === 'folder' && !view.q) {
            const hit = state.folderIndex.get(view.folder);
            if (hit && hit.parent) {
                chips.push(h('button', { class: 'chip chip-up', onClick: () => navigate({ ...view, folder: hit.parent }) },
                    icon('back', 14), state.folderIndex.get(hit.parent).node.name));
            }
            for (const child of hit ? hit.node.children : []) {
                chips.push(h('button', { class: 'chip', onClick: () => navigate({ ...view, folder: child.id }) },
                    folderIcon(child, 14), child.name, h('span', { class: 'chip-count' }, String(child.total))));
            }
        }
        for (const tag of view.tags) {
            chips.push(h('button', {
                class: 'chip chip-active',
                onClick: () => navigate({ ...view, tags: view.tags.filter((x) => x !== tag) }),
            }, icon('tag', 14), tag, icon('close', 12)));
        }
        const filterChip = (label, cleared, swatch) => chips.push(h('button', {
            class: 'chip chip-active', onClick: () => navigate({ ...view, ...cleared }),
        }, swatch && h('span', { class: 'swatch-dot', style: `background:#${swatch}` }), label, icon('close', 12)));
        if (view.kind) filterChip(t(view.kind), { kind: '' });
        if (view.star) filterChip(`${'★'.repeat(view.star)}+`, { star: 0 });
        if (view.shape) filterChip(t(view.shape), { shape: '' });
        if (view.color) filterChip(t('color'), { color: '' }, view.color);
        for (const ext of view.exts || []) filterChip(ext.toUpperCase(), { exts: view.exts.filter((x) => x !== ext) });
        el.chips.replaceChildren(...chips);
        el.chips.hidden = chips.length === 0;
    }

    // ───────────────────────── virtual grid ─────────────────────────
    // Two layouts share one virtualised renderer: square cells, or rows justified to the full width
    // that keep each picture's proportions (needs every item's ratio up front, fetched as one small buffer).
    const grid = { cols: 3, cell: 100, nodes: new Map(), fetchTimer: 0, frame: 0, ratios: null, just: null, height: 0 };
    const RATIO_MIN = 0.45;
    const RATIO_MAX = 3;
    function justify(ratios, width, target) {
        const n = ratios.length;
        const x = new Float32Array(n);
        const y = new Float32Array(n);
        const w = new Float32Array(n);
        const hh = new Float32Array(n);
        const ratioAt = (i) => clamp(ratios[i] / 1000, RATIO_MIN, RATIO_MAX);
        let top = 0;
        let start = 0;
        let sum = 0;
        const place = (end, rowH) => {
            let left = 0;
            for (let i = start; i <= end; i++) {
                x[i] = left;
                y[i] = top;
                w[i] = ratioAt(i) * rowH;
                hh[i] = rowH;
                left += w[i] + GAP;
            }
            top += rowH + GAP;
            start = end + 1;
            sum = 0;
        };
        for (let i = 0; i < n; i++) {
            sum += ratioAt(i);
            const gaps = (i - start) * GAP;
            if (sum * target + gaps >= width) place(i, (width - gaps) / sum);
        }
        if (start < n) place(n - 1, Math.min(target * 1.25, (width - (n - 1 - start) * GAP) / sum));
        return { x, y, w, h: hh, height: Math.max(0, top - GAP) };
    }
    function layoutGrid() {
        const width = el.grid.clientWidth || window.innerWidth;
        const auto = width < 520 ? 3 : Math.max(4, Math.round(width / 170));
        grid.cols = prefs.cols > 0 ? prefs.cols : auto;
        grid.cell = (width - GAP * (grid.cols - 1)) / grid.cols;
        const usable = prefs.layout === 'just' && grid.ratios && grid.ratios.length === state.total && state.total > 0;
        grid.just = usable ? justify(grid.ratios, width, grid.cell) : null;
        grid.height = grid.just
            ? grid.just.height
            : Math.max(0, Math.ceil(state.total / grid.cols) * (grid.cell + GAP) - GAP);
        el.grid.style.height = `${grid.height}px`;
    }
    /** @returns {{x:number,y:number,w:number,h:number}} box of item `i` inside the grid */
    function boxOf(i) {
        if (grid.just) return { x: grid.just.x[i], y: grid.just.y[i], w: grid.just.w[i], h: grid.just.h[i] };
        const step = grid.cell + GAP;
        return { x: (i % grid.cols) * step, y: Math.floor(i / grid.cols) * step, w: grid.cell, h: grid.cell };
    }
    async function fetchRatios(generation) {
        try {
            const res = await fetch(`/api/ratios?${queryString(state.view)}`, { credentials: 'same-origin', cache: 'no-store' });
            if (!res.ok || generation !== state.generation) return;
            grid.ratios = new Uint16Array(await res.arrayBuffer());
        } catch {
            grid.ratios = null;
        }
    }
    async function resetGrid(restoreScroll) {
        const generation = ++state.generation;
        state.total = 0;
        state.rows = [];
        state.pages = new Map();
        grid.ratios = null;
        for (const node of grid.nodes.values()) node.remove();
        grid.nodes.clear();
        el.empty.hidden = true;
        el.subtitle.textContent = t('loading');
        layoutGrid();
        window.scrollTo(0, 0);
        try {
            await Promise.all([fetchPage(0, generation), prefs.layout === 'just' ? fetchRatios(generation) : null]);
        } catch (err) {
            if (generation === state.generation) showLoadError(err);
            return;
        }
        if (generation !== state.generation) return;
        layoutGrid();
        if (restoreScroll) window.scrollTo(0, restoreScroll);
        renderGrid();
        if (state.locateAfterLoad) {
            const wanted = state.locateAfterLoad;
            state.locateAfterLoad = '';
            try {
                const found = await api(`/api/items?${queryString(state.view)}&limit=1&locate=${wanted}`);
                if (generation === state.generation && found.index >= 0) {
                    scrollToIndex(found.index, 'start');
                    renderGrid();
                    const cell = grid.nodes.get(found.index);
                    if (cell) cell.classList.add('located');
                }
            } catch { /* the folder still opened; only the jump to the picture is skipped */ }
        }
    }
    function showLoadError(err) {
        if (!(err instanceof ApiError)) console.error(err);
        el.subtitle.textContent = '';
        setBanner(errorText(err));
    }
    /** Only a failed connection is "cannot reach the computer"; anything else is named for what it is. */
    function errorText(err) {
        if (state.stale) return t('stale');
        if (err.code === 'library_loading') return t('opening');
        if (err.status === 503) return t('unavailable');
        if (!err.status) return t('offline');
        return t('failed', err.status);
    }
    async function fetchPage(page, generation = state.generation) {
        if (state.pages.has(page)) return state.pages.get(page);
        const job = api(`/api/items?${queryString(state.view)}&offset=${page * PAGE}&limit=${PAGE}`).then((data) => {
            if (generation !== state.generation) return;
            setBanner(state.stale ? t('stale') : '');
            state.total = data.total;
            state.version = data.version;
            data.items.forEach((row, i) => { state.rows[data.offset + i] = row; });
            el.subtitle.textContent = t('items', data.total.toLocaleString());
            el.empty.hidden = data.total > 0;
            el.empty.textContent = isFiltered(state.view) ? t('emptySearch') : t('empty');
        }).catch((err) => {
            state.pages.delete(page);
            throw err;
        });
        state.pages.set(page, job);
        return job;
    }
    /** First index whose box ends below `edge` (justified layout; tops never decrease with the index). */
    function firstBelow(edge) {
        const { y, h: heights } = grid.just;
        let lo = 0;
        let hi = state.total;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (y[mid] + heights[mid] < edge) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }
    function visibleRange() {
        const top = -el.grid.getBoundingClientRect().top;
        const buffer = window.innerHeight * 0.8;
        if (grid.just) {
            const first = Math.min(state.total - 1, firstBelow(top - buffer));
            let last = first;
            const limit = top + window.innerHeight + buffer;
            while (last + 1 < state.total && grid.just.y[last + 1] <= limit) last++;
            return { first: Math.max(0, first), last };
        }
        const rowH = grid.cell + GAP;
        const firstRow = Math.max(0, Math.floor((top - buffer) / rowH));
        const lastRow = Math.floor((top + window.innerHeight + buffer) / rowH);
        return { first: firstRow * grid.cols, last: Math.min(state.total - 1, (lastRow + 1) * grid.cols - 1) };
    }
    function badgeFor(row) {
        if (row.k === 'v') return row.d ? formatDuration(row.d) : row.e.toUpperCase();
        if (row.k !== 'i' || row.e === 'gif') return row.e.toUpperCase();
        return '';
    }
    function fillCell(node, row) {
        node.classList.remove('pending');
        const img = h('img', { alt: '', decoding: 'async', draggable: false });
        img.addEventListener('error', () => {
            img.remove();
            node.classList.add('noimg');
            node.prepend(h('span', { class: 'cell-ext' }, row.e.toUpperCase() || '?'));
        }, { once: true });
        img.src = mediaUrl('thumb', row);
        node.appendChild(img);
        const badge = badgeFor(row);
        if (badge) node.appendChild(h('span', { class: `badge${row.k === 'v' ? ' badge-video' : ''}` }, badge));
    }
    function renderGrid() {
        grid.frame = 0;
        if (state.total === 0) return;
        const { first, last } = visibleRange();
        for (const [index, node] of grid.nodes) {
            if (index < first || index > last) {
                const img = node.querySelector('img');
                if (img) img.src = '';
                node.remove();
                grid.nodes.delete(index);
            }
        }
        for (let i = first; i <= last; i++) {
            let node = grid.nodes.get(i);
            if (!node) {
                node = h('div', { class: 'cell pending', dataset: { i: String(i) } });
                grid.nodes.set(i, node);
                el.grid.appendChild(node);
                if (state.rows[i]) fillCell(node, state.rows[i]);
            } else if (node.classList.contains('pending') && state.rows[i]) {
                fillCell(node, state.rows[i]);
            }
            const box = boxOf(i);
            node.style.width = `${box.w}px`;
            node.style.height = `${box.h}px`;
            node.style.transform = `translate(${box.x}px, ${box.y}px)`;
        }
        // Fetch only once scrolling settles, so a fling does not request every page it flies past.
        clearTimeout(grid.fetchTimer);
        grid.fetchTimer = setTimeout(() => {
            const range = visibleRange();
            const generation = state.generation;
            for (let p = Math.floor(range.first / PAGE); p <= Math.floor(Math.max(range.first, range.last) / PAGE); p++) {
                if (state.pages.has(p)) continue;
                fetchPage(p, generation).then(() => generation === state.generation && scheduleRender(), showLoadError);
            }
        }, 70);
    }
    function scheduleRender() {
        if (!grid.frame) grid.frame = requestAnimationFrame(renderGrid);
    }
    async function relayout() {
        const { first } = visibleRange();
        const anchor = Math.min(Math.max(0, state.total - 1), first + grid.cols * 2);
        if (prefs.layout === 'just' && !grid.ratios && state.total > 0) await fetchRatios(state.generation);
        for (const node of grid.nodes.values()) node.remove();
        grid.nodes.clear();
        layoutGrid();
        if (state.total > 0) scrollToIndex(anchor, 'start');
        renderGrid();
    }
    function scrollToIndex(index, where) {
        const box = boxOf(index);
        const gridTop = el.grid.getBoundingClientRect().top + window.scrollY;
        const headerH = el.header.offsetHeight;
        const top = gridTop + box.y - headerH;
        if (where === 'start') {
            window.scrollTo(0, Math.max(0, top));
            return;
        }
        const bottom = top + box.h + headerH;
        if (top < window.scrollY) window.scrollTo(0, Math.max(0, top - 8));
        else if (bottom > window.scrollY + window.innerHeight) window.scrollTo(0, bottom - window.innerHeight + 8);
    }
    window.addEventListener('scroll', scheduleRender, { passive: true });
    let resizeTimer = 0;
    let lastGridWidth = 0;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (Math.abs(el.grid.clientWidth - lastGridWidth) > 0.5) {
                lastGridWidth = el.grid.clientWidth;
                relayout();
            }
            if (viewer.open) resetZoom();
        }, 120);
    });

    // ───────────────────────── drawer ─────────────────────────
    function drawerRow(iconName, label, count, active, onClick) {
        return h('button', { class: `drawer-row${active ? ' active' : ''}`, onClick },
            icon(iconName, 18), h('span', { class: 'drawer-label' }, label),
            count != null && h('span', { class: 'drawer-count' }, count.toLocaleString()));
    }
    function goFromDrawer(view) {
        navigate({ ...BLANK_VIEW, ...view });
    }
    const FOLDER_COLORS = {
        red: '#e5484d', orange: '#f08c00', yellow: '#dba800', green: '#2f9e44', aqua: '#0ca5b0', blue: '#1c7ed6',
        purple: '#8e44ad', pink: '#e64980',
    };
    /** Folder icon, tinted when the folder has a colour in Eagle. */
    function folderIcon(node, size) {
        const svg = icon('folder', size);
        const colour = node && FOLDER_COLORS[node.color];
        if (colour) {
            svg.style.color = colour;
            svg.classList.add('folder-tinted');
        }
        return svg;
    }
    function renderFolderNodes(nodes, depth, expandedForPath) {
        return nodes.map((node) => {
            const open = Boolean(prefs.expanded[node.id]) || expandedForPath.has(node.id);
            const active = state.view.scope === 'folder' && state.view.folder === node.id;
            const toggle = h('button', {
                class: `tree-toggle${open ? ' open' : ''}`,
                'aria-label': node.name,
                style: node.children.length ? '' : 'visibility:hidden',
                onClick: (event) => {
                    event.stopPropagation();
                    setPrefs({ expanded: { ...prefs.expanded, [node.id]: !open } });
                    expandedForPath.delete(node.id);
                    renderDrawer(expandedForPath);
                },
            }, icon('chevron', 14));
            const row = h('div', { class: `tree-row${active ? ' active' : ''}`, style: `padding-left:${depth * 14}px` },
                toggle,
                h('button', { class: 'tree-main', onClick: () => goFromDrawer({ scope: 'folder', folder: node.id }) },
                    folderIcon(node, 18), h('span', { class: 'drawer-label' }, node.name),
                    node.total > 0 && h('span', { class: 'drawer-count' }, node.total.toLocaleString())));
            return [row, open && renderFolderNodes(node.children, depth + 1, expandedForPath)];
        });
    }
    function renderDrawer(keepExpanded) {
        const lib = state.lib;
        if (!lib) return;
        const pathOpen = keepExpanded || new Set();
        if (!keepExpanded && state.view.scope === 'folder') {
            let cur = state.folderIndex.get(state.view.folder);
            while (cur && cur.parent) {
                pathOpen.add(cur.parent);
                cur = state.folderIndex.get(cur.parent);
            }
        }
        const plain = state.view.tags.length === 0;
        // Rebuilding the list must not throw the reader back to the top of a long folder tree.
        const previous = el.drawer.querySelector('.drawer-scroll');
        const scrollTop = previous ? previous.scrollTop : 0;
        el.drawer.replaceChildren(
            h('div', { class: 'drawer-head' },
                h('img', { src: '/icon.svg', alt: '', width: 28, height: 28 }),
                h('button', { class: 'drawer-lib', onClick: openLibrarySheet },
                    h('span', { class: 'drawer-lib-name' }, lib.name), icon('swap', 16)),
                h('button', { class: 'icon-btn drawer-close', 'aria-label': t('close'), onClick: closeTopLayer }, icon('close'))),
            h('div', { class: 'drawer-scroll' },
                drawerRow('all', t('all'), lib.counts.all, state.view.scope === 'all' && plain, () => goFromDrawer({})),
                drawerRow('inbox', t('uncategorized'), lib.counts.uncategorized, state.view.scope === 'uncategorized',
                    () => goFromDrawer({ scope: 'uncategorized' })),
                drawerRow('tag', t('untagged'), lib.counts.untagged, state.view.scope === 'untagged',
                    () => goFromDrawer({ scope: 'untagged' })),
                drawerRow('tag', t('tags'), lib.tags.length, !plain, openTagSheet),
                h('div', { class: 'drawer-section' }, `${t('folders')} (${state.folderIndex.size})`),
                renderFolderNodes(lib.folders, 0, pathOpen)));
        el.drawer.querySelector('.drawer-scroll').scrollTop = scrollTop;
    }
    /** Bring the folder being viewed into sight if the list is scrolled somewhere else. */
    function revealActiveFolder() {
        const scroller = el.drawer.querySelector('.drawer-scroll');
        const active = scroller && scroller.querySelector('.tree-row.active');
        if (!active) return;
        const box = scroller.getBoundingClientRect();
        const row = active.getBoundingClientRect();
        if (row.top < box.top + 8 || row.bottom > box.bottom - 8) {
            scroller.scrollTop += row.top - box.top - box.height / 2 + row.height / 2;
        }
    }
    function openDrawer() {
        renderDrawer();
        revealActiveFolder();
        document.body.classList.add('drawer-open');
        el.scrim.hidden = false;
        pushLayer(() => {
            document.body.classList.remove('drawer-open');
            el.scrim.hidden = true;
        });
    }

    // ───────────────────────── bottom sheet ─────────────────────────
    function openSheet(title, body, { tall = false } = {}) {
        const wasScrim = el.scrim.hidden;
        el.sheet.replaceChildren(
            h('div', { class: 'sheet-head' },
                h('div', { class: 'sheet-title' }, title),
                h('button', { class: 'icon-btn', 'aria-label': t('close'), onClick: closeTopLayer }, icon('close'))),
            h('div', { class: 'sheet-body' }, body));
        el.sheet.classList.toggle('sheet-tall', tall);
        el.sheet.hidden = false;
        el.scrim.hidden = false;
        document.body.classList.add('sheet-open');
        pushLayer(() => {
            el.sheet.hidden = true;
            el.scrim.hidden = wasScrim;
            document.body.classList.remove('sheet-open');
        });
    }
    function optionGroup(label, options, current, onPick) {
        return h('div', { class: 'opt-group' },
            h('div', { class: 'opt-label' }, label),
            h('div', { class: 'opt-row' }, options.map(([value, text]) => h('button', {
                class: `opt${value === current ? ' active' : ''}`,
                onClick: () => onPick(value),
            }, text))));
    }
    const SWATCHES = ['e53935', 'fb8c00', 'fdd835', '7cb342', '00897b', '29b6f6', '1e55d6', '8e44ad', 'ec407a', '8d6e63',
        'ffffff', '9e9e9e', '111111'];
    function renderSortSheet() {
        const refresh = (patch, refetch) => {
            setPrefs(patch);
            el.sheet.querySelector('.sheet-body').replaceChildren(renderSortSheet());
            if (refetch) resetGrid(0);
            else relayout();
        };
        const sorts = ['added', 'created', 'modified', 'name', 'size', 'duration', 'ext'].map((key) => [key, t(key)]);
        const kinds = [['', t('anyType')], ['image', t('image')], ['video', t('video')], ['audio', t('audio')], ['other', t('other')]];
        return h('div', null,
            optionGroup(t('sortBy'), sorts, prefs.sort, (sort) => refresh({ sort }, true)),
            optionGroup('', [['desc', t('desc')], ['asc', t('asc')]], prefs.order, (order) => refresh({ order }, true)),
            optionGroup(t('layout'), [['grid', t('layoutGrid')], ['just', t('layoutJust')]], prefs.layout,
                (layout) => refresh({ layout }, false)),
            optionGroup(t('type'), kinds, state.view.kind, (kind) => navigate({ ...state.view, kind })),
            optionGroup(t('rating'), [[0, t('anyRating')], [1, '★'], [2, '★★'], [3, '★★★'], [4, '★★★★'], [5, '★★★★★']],
                state.view.star, (star) => navigate({ ...state.view, star })),
            optionGroup(t('shape'), [['', t('anyShape')], ['landscape', t('landscape')], ['portrait', t('portrait')], ['square', t('square')]],
                state.view.shape, (shape) => navigate({ ...state.view, shape })),
            h('div', { class: 'opt-group' },
                h('div', { class: 'opt-label' }, t('color')),
                h('div', { class: 'opt-row' }, SWATCHES.map((hex) => h('button', {
                    class: `swatch${state.view.color === hex ? ' active' : ''}`,
                    style: `background:#${hex}`,
                    'aria-label': `#${hex}`,
                    onClick: () => navigate({ ...state.view, color: state.view.color === hex ? '' : hex }),
                })))),
            h('div', { class: 'opt-group' },
                h('div', { class: 'opt-label' }, t('formats')),
                h('div', { class: 'opt-row' }, (state.facetExts || (state.lib && state.lib.exts) || []).slice(0, 24).map((entry) => {
                    const on = state.view.exts.includes(entry.ext);
                    return h('button', {
                        class: `opt${on ? ' active' : ''}`,
                        onClick: () => navigate({
                            ...state.view,
                            exts: on ? state.view.exts.filter((x) => x !== entry.ext) : [...state.view.exts, entry.ext],
                        }),
                    }, entry.ext.toUpperCase(), h('span', { class: 'opt-count' }, entry.count.toLocaleString()));
                }))),
            optionGroup(t('columns'), [[0, t('auto')], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [8, '8']],
                prefs.cols, (cols) => refresh({ cols }, false)),
            h('label', { class: 'opt-check' },
                h('input', {
                    type: 'checkbox', checked: prefs.recursive,
                    onChange: (event) => refresh({ recursive: event.target.checked }, true),
                }), t('recursive')));
    }
    function openSortSheet() {
        openSheet(t('view'), renderSortSheet());
        // Format counts are for what is on screen now (this folder, these filters), not the whole library.
        const key = queryString(state.view);
        if (state.facetKey === key) return;
        api(`/api/facets?${key}`).then((data) => {
            state.facetKey = key;
            state.facetExts = data.exts;
            const body = el.sheet.querySelector('.sheet-body');
            if (!el.sheet.hidden && body && queryString(state.view) === key) body.replaceChildren(renderSortSheet());
        }).catch(() => { /* an older server has no facets: keep the library-wide counts */ });
    }
    function openTagSheet() {
        const lib = state.lib;
        const counts = new Map(lib.tags.map((tag) => [tag.name, tag.count]));
        const grouped = new Set();
        const groups = lib.tagGroups.map((group) => {
            const names = group.tags.filter((name) => counts.has(name));
            names.forEach((name) => grouped.add(name));
            return { name: group.name, names };
        }).filter((group) => group.names.length);
        const rest = lib.tags.map((tag) => tag.name).filter((name) => !grouped.has(name));
        if (rest.length) groups.push({ name: groups.length ? t('ungrouped') : t('allTags'), names: rest });
        const list = h('div', { class: 'tag-list' });
        const MAX_SHOWN = 600;
        const render = (filter) => {
            const needle = filter.trim().toLowerCase();
            let shown = 0;
            const sections = [];
            for (const group of groups) {
                const names = needle ? group.names.filter((name) => name.toLowerCase().includes(needle)) : group.names;
                if (!names.length || shown >= MAX_SHOWN) continue;
                const slice = names.slice(0, MAX_SHOWN - shown);
                shown += slice.length;
                sections.push(h('div', { class: 'tag-group' }, `${group.name} (${names.length})`),
                    h('div', { class: 'tag-wrap' }, slice.map((name) => h('button', {
                        class: `chip${state.view.tags.includes(name) ? ' chip-active' : ''}`,
                        onClick: () => navigate({ ...BLANK_VIEW, tags: [name] }),
                    }, name, h('span', { class: 'chip-count' }, String(counts.get(name)))))));
            }
            list.replaceChildren(...(sections.length ? sections : [h('div', { class: 'empty-inline' }, t('noTags'))]));
        };
        const filterInput = h('input', {
            class: 'search-input sheet-filter', type: 'search', placeholder: t('filterTags'),
            autocapitalize: 'off', autocomplete: 'off', onInput: (event) => render(event.target.value),
        });
        render('');
        // The tag sheet replaces the drawer rather than stacking on it.
        const show = () => openSheet(t('tags'), h('div', null, filterInput, list), { tall: true });
        if (layers.length) {
            history.back();
            window.addEventListener('popstate', () => setTimeout(show, 0), { once: true });
        } else {
            show();
        }
    }

    // ───────────────────────── viewer ─────────────────────────
    const viewer = {
        open: false, index: 0, slides: [], track: null, scale: 1, tx: 0, ty: 0,
        chrome: true, animating: false, counter: null, name: null,
    };
    const MAX_SCALE = 8;
    function buildViewer() {
        viewer.track = h('div', { class: 'v-track' });
        viewer.slides = [0, 1, 2].map(() => h('div', { class: 'v-slide' }));
        viewer.track.append(...viewer.slides);
        viewer.counter = h('div', { class: 'v-counter' });
        viewer.name = h('div', { class: 'v-name' });
        const top = h('div', { class: 'v-top' },
            h('button', { class: 'icon-btn', 'aria-label': t('back'), onClick: closeTopLayer }, icon('back')),
            h('div', { class: 'v-title' }, viewer.name, viewer.counter),
            (viewer.playBtn = h('button', { class: 'icon-btn', 'aria-label': t('slideshow'), onClick: toggleSlideshow }, icon('play'))),
            h('button', { class: 'icon-btn', 'aria-label': t('info'), onClick: openInfoSheet }, icon('info')));
        const prev = h('button', { class: 'v-nav v-prev', 'aria-label': t('prev'), onClick: () => step(-1) }, icon('back', 26));
        const next = h('button', { class: 'v-nav v-next', 'aria-label': t('next'), onClick: () => step(1) }, icon('chevron', 26));
        el.viewer.append(viewer.track, top, prev, next);
        bindGestures();
    }
    function placeSlides() {
        viewer.slides.forEach((slide, i) => { slide.style.transform = `translateX(${(i - 1) * 100}%)`; });
        viewer.track.style.transition = 'none';
        viewer.track.style.transform = 'translate3d(0,0,0)';
    }
    function currentRow() {
        return state.rows[viewer.index];
    }
    /** Removing a playing <video> from the page does not silence it on every phone: stop it explicitly. */
    function stopMedia(root) {
        for (const media of root.querySelectorAll('video, audio')) {
            media.pause();
            media.removeAttribute('src');
            media.load();
        }
    }
    function fillSlide(slide, index, isCurrent) {
        stopMedia(slide);
        slide.replaceChildren();
        slide.dataset.index = String(index);
        if (index < 0 || index >= state.total) return;
        const row = state.rows[index];
        if (!row) {
            const generation = state.generation;
            fetchPage(Math.floor(index / PAGE)).then(() => {
                if (generation === state.generation && viewer.open && slide.dataset.index === String(index)) {
                    fillSlide(slide, index, index === viewer.index);
                    if (index === viewer.index) updateViewerChrome();
                }
            }).catch(() => {});
            return;
        }
        const zoomer = h('div', { class: 'v-zoom' });
        const thumb = mediaUrl('thumb', row);
        if (row.k === 'i') {
            const low = h('img', { class: 'v-img v-low', alt: '', draggable: false, src: thumb });
            const full = h('img', { class: 'v-img v-full', alt: row.n, draggable: false, decoding: 'async' });
            full.addEventListener('load', () => {
                full.classList.add('ready');
                low.remove();
            }, { once: true });
            full.addEventListener('error', () => {
                full.remove();
                slide.appendChild(h('div', { class: 'v-note' }, t('cantShow')));
            }, { once: true });
            full.src = mediaUrl('preview', row);
            zoomer.append(low, full);
        } else if (row.k === 'v') {
            if (isCurrent) {
                zoomer.appendChild(h('video', {
                    class: 'v-video', controls: true, playsInline: true, preload: 'metadata',
                    poster: thumb, src: fileUrl(row.id),
                }));
            } else {
                zoomer.append(h('img', { class: 'v-img', alt: '', draggable: false, src: thumb }),
                    h('div', { class: 'v-play' }, icon('play', 34)));
            }
        } else {
            zoomer.appendChild(h('div', { class: 'v-file' },
                icon('file', 56),
                h('div', { class: 'v-file-name' }, `${row.n}.${row.e}`),
                row.k === 'a' && isCurrent && h('audio', { controls: true, preload: 'none', src: fileUrl(row.id) }),
                h('a', { class: 'btn-primary', href: fileUrl(row.id, true), download: `${row.n}.${row.e}` },
                    icon('download', 18), t('download'))));
        }
        slide.appendChild(zoomer);
    }
    function fillAllSlides() {
        fillSlide(viewer.slides[0], viewer.index - 1, false);
        fillSlide(viewer.slides[1], viewer.index, true);
        fillSlide(viewer.slides[2], viewer.index + 1, false);
        placeSlides();
        resetZoom();
        updateViewerChrome();
    }
    function updateViewerChrome() {
        const row = currentRow();
        viewer.name.textContent = row ? row.n : '';
        viewer.counter.textContent = `${(viewer.index + 1).toLocaleString()} / ${state.total.toLocaleString()}`;
        el.viewer.classList.toggle('at-first', viewer.index === 0);
        el.viewer.classList.toggle('at-last', viewer.index >= state.total - 1);
    }
    function openViewer(index) {
        if (viewer.open || !Number.isFinite(index) || index < 0 || index >= state.total) return;
        viewer.open = true;
        viewer.index = index;
        setChrome(true);
        el.viewer.hidden = false;
        el.viewer.style.setProperty('--v-dim', '1');
        document.body.classList.add('viewing');
        fillAllSlides();
        pushLayer(() => {
            viewer.open = false;
            stopSlideshow();
            viewer.slides.forEach((slide) => {
                stopMedia(slide);
                slide.replaceChildren();
            });
            el.viewer.hidden = true;
            document.body.classList.remove('viewing');
            scrollToIndex(viewer.index, 'nearest');
            scheduleRender();
        });
    }
    const SLIDE_MS = 4000;
    function stopSlideshow() {
        if (!viewer.slideTimer) return;
        clearInterval(viewer.slideTimer);
        viewer.slideTimer = 0;
        viewer.playBtn.replaceChildren(icon('play'));
    }
    function toggleSlideshow() {
        if (viewer.slideTimer) {
            stopSlideshow();
            return;
        }
        viewer.playBtn.replaceChildren(icon('pause'));
        setChrome(false);
        viewer.slideTimer = setInterval(() => {
            const playing = viewer.slides[1].querySelector('video');
            if (playing && !playing.paused && !playing.ended) return;
            if (viewer.index >= state.total - 1) stopSlideshow();
            else step(1);
        }, SLIDE_MS);
    }
    function setChrome(on) {
        viewer.chrome = on;
        el.viewer.classList.toggle('chrome-off', !on);
    }
    function zoomTarget() {
        return viewer.slides[1].querySelector('.v-zoom');
    }
    function fitSize() {
        const row = currentRow();
        const vw = el.viewer.clientWidth;
        const vh = el.viewer.clientHeight;
        const img = viewer.slides[1].querySelector('.v-full.ready, .v-img');
        const w = (row && row.w) || (img && img.naturalWidth) || vw;
        const hgt = (row && row.h) || (img && img.naturalHeight) || vh;
        const ratio = Math.min(vw / w, vh / hgt);
        return { w: w * ratio, h: hgt * ratio, vw, vh };
    }
    function applyZoom(animate) {
        const target = zoomTarget();
        if (!target) return;
        const fit = fitSize();
        const maxX = Math.max(0, (fit.w * viewer.scale - fit.vw) / 2);
        const maxY = Math.max(0, (fit.h * viewer.scale - fit.vh) / 2);
        viewer.tx = clamp(viewer.tx, -maxX, maxX);
        viewer.ty = clamp(viewer.ty, -maxY, maxY);
        target.style.transition = animate ? 'transform 200ms ease-out' : 'none';
        target.style.transform = `translate3d(${viewer.tx}px, ${viewer.ty}px, 0) scale(${viewer.scale})`;
    }
    function resetZoom(animate) {
        viewer.scale = 1;
        viewer.tx = 0;
        viewer.ty = 0;
        applyZoom(animate);
    }
    /** Zoom to `scale` keeping the screen point (x, y), measured from the viewer centre, fixed. */
    function zoomAround(scale, x, y, animate) {
        const next = clamp(scale, 1, MAX_SCALE);
        const k = next / viewer.scale;
        viewer.tx = x - (x - viewer.tx) * k;
        viewer.ty = y - (y - viewer.ty) * k;
        viewer.scale = next;
        applyZoom(animate);
    }
    function canZoom() {
        const row = currentRow();
        return Boolean(row && row.k === 'i');
    }
    function step(direction) {
        if (viewer.animating) return;
        const target = viewer.index + direction;
        if (target < 0 || target >= state.total) {
            slideTrack(0, true);
            return;
        }
        viewer.animating = true;
        const done = () => {
            if (!viewer.animating) return;
            viewer.animating = false;
            clearTimeout(fallback);
            viewer.track.removeEventListener('transitionend', done);
            if (!viewer.open) return;
            viewer.index = target;
            // Recycle the slide that scrolled out instead of rebuilding all three.
            if (direction > 0) viewer.slides.push(viewer.slides.shift());
            else viewer.slides.unshift(viewer.slides.pop());
            fillSlide(viewer.slides[direction > 0 ? 2 : 0], target + direction, false);
            fillSlide(viewer.slides[direction > 0 ? 0 : 2], target - direction, false);
            if (currentRow() && currentRow().k !== 'i') fillSlide(viewer.slides[1], target, true);
            placeSlides();
            resetZoom();
            updateViewerChrome();
        };
        const fallback = setTimeout(done, 320);
        viewer.track.addEventListener('transitionend', done);
        slideTrack(-direction * el.viewer.clientWidth, true);
    }
    function slideTrack(x, animate) {
        viewer.track.style.transition = animate ? 'transform 220ms cubic-bezier(.2,.8,.2,1)' : 'none';
        viewer.track.style.transform = `translate3d(${x}px,0,0)`;
    }
    function bindGestures() {
        const g = { mode: '', x: 0, y: 0, startX: 0, startY: 0, t0: 0, tx0: 0, ty0: 0, dist0: 0, scale0: 1, lastTap: 0, tapTimer: 0 };
        const centre = (touch) => {
            const rect = el.viewer.getBoundingClientRect();
            return { x: touch.clientX - rect.left - rect.width / 2, y: touch.clientY - rect.top - rect.height / 2 };
        };
        const isControl = (target) => Boolean(target.closest('.v-top, .v-nav, video, audio, a, button'));
        el.viewer.addEventListener('touchstart', (event) => {
            if (viewer.animating || isControl(event.target)) {
                g.mode = 'ignore';
                return;
            }
            if (event.touches.length === 2 && canZoom()) {
                const [a, b] = event.touches;
                g.mode = 'pinch';
                g.dist0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
                g.scale0 = viewer.scale;
                return;
            }
            const touch = event.touches[0];
            g.mode = viewer.scale > 1.01 ? 'pan' : 'undecided';
            g.startX = g.x = touch.clientX;
            g.startY = g.y = touch.clientY;
            g.tx0 = viewer.tx;
            g.ty0 = viewer.ty;
            g.t0 = performance.now();
        }, { passive: true });
        el.viewer.addEventListener('touchmove', (event) => {
            if (g.mode === 'ignore' || g.mode === '') return;
            if (g.mode === 'pinch' && event.touches.length >= 2) {
                event.preventDefault();
                const [a, b] = event.touches;
                const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
                const mid = centre({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
                zoomAround(g.scale0 * (dist / g.dist0), mid.x, mid.y, false);
                g.scale0 = viewer.scale;
                g.dist0 = dist || 1;
                return;
            }
            const touch = event.touches[0];
            const dx = touch.clientX - g.startX;
            const dy = touch.clientY - g.startY;
            g.x = touch.clientX;
            g.y = touch.clientY;
            if (g.mode === 'undecided') {
                if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
                g.mode = Math.abs(dx) > Math.abs(dy) ? 'page' : (dy > 0 ? 'dismiss' : 'ignore');
            }
            if (g.mode === 'ignore') return;
            event.preventDefault();
            if (g.mode === 'pan') {
                viewer.tx = g.tx0 + dx;
                viewer.ty = g.ty0 + dy;
                applyZoom(false);
            } else if (g.mode === 'page') {
                const atEdge = (dx > 0 && viewer.index === 0) || (dx < 0 && viewer.index >= state.total - 1);
                slideTrack(atEdge ? dx * 0.3 : dx, false);
            } else if (g.mode === 'dismiss') {
                viewer.slides[1].style.transform = `translate3d(0, ${dy}px, 0) scale(${1 - Math.min(0.25, dy / 1600)})`;
                el.viewer.style.setProperty('--v-dim', String(clamp(1 - dy / 420, 0.25, 1)));
            }
        }, { passive: false });
        const finish = (event) => {
            const mode = g.mode;
            if (event.touches.length > 0) {
                // One finger of a pinch lifted: continue as a pan from here.
                if (mode === 'pinch') {
                    const touch = event.touches[0];
                    g.mode = viewer.scale > 1.01 ? 'pan' : 'ignore';
                    g.startX = touch.clientX;
                    g.startY = touch.clientY;
                    g.tx0 = viewer.tx;
                    g.ty0 = viewer.ty;
                }
                return;
            }
            g.mode = '';
            const dx = g.x - g.startX;
            const dy = g.y - g.startY;
            const elapsed = Math.max(1, performance.now() - g.t0);
            if (mode === 'pinch') {
                if (viewer.scale < 1.05) resetZoom(true);
            } else if (mode === 'page') {
                const fast = Math.abs(dx) / elapsed > 0.45 && Math.abs(dx) > 24;
                if (Math.abs(dx) > el.viewer.clientWidth * 0.22 || fast) step(dx < 0 ? 1 : -1);
                else slideTrack(0, true);
            } else if (mode === 'dismiss') {
                viewer.slides[1].style.transition = 'transform 180ms ease-out';
                viewer.slides[1].style.transform = 'translateX(0)';
                setTimeout(() => { viewer.slides[1].style.transition = ''; }, 200);
                el.viewer.style.setProperty('--v-dim', '1');
                if (dy > 110 || (dy / elapsed > 0.6 && dy > 40)) closeTopLayer();
            } else if (mode === 'undecided' || (mode === 'pan' && Math.abs(dx) < 6 && Math.abs(dy) < 6)) {
                if (elapsed > 400) return;
                const now = performance.now();
                if (now - g.lastTap < 280 && canZoom()) {
                    clearTimeout(g.tapTimer);
                    g.lastTap = 0;
                    const point = centre({ clientX: g.x, clientY: g.y });
                    if (viewer.scale > 1.01) resetZoom(true);
                    else zoomAround(2.5, point.x, point.y, true);
                } else {
                    g.lastTap = now;
                    clearTimeout(g.tapTimer);
                    g.tapTimer = setTimeout(() => setChrome(!viewer.chrome), 290);
                }
            }
        };
        el.viewer.addEventListener('touchend', finish, { passive: true });
        el.viewer.addEventListener('touchcancel', finish, { passive: true });

        // Mouse and keyboard, for desktop browsers.
        el.viewer.addEventListener('dblclick', (event) => {
            if (isControl(event.target) || !canZoom()) return;
            const point = centre(event);
            if (viewer.scale > 1.01) resetZoom(true);
            else zoomAround(2.5, point.x, point.y, true);
        });
        el.viewer.addEventListener('wheel', (event) => {
            if (!canZoom()) return;
            event.preventDefault();
            const point = centre(event);
            zoomAround(viewer.scale * (event.deltaY < 0 ? 1.2 : 1 / 1.2), point.x, point.y, false);
        }, { passive: false });
        let drag = null;
        el.viewer.addEventListener('mousedown', (event) => {
            if (event.button !== 0 || isControl(event.target) || viewer.scale <= 1.01) return;
            drag = { x: event.clientX, y: event.clientY, tx: viewer.tx, ty: viewer.ty };
            event.preventDefault();
        });
        window.addEventListener('mousemove', (event) => {
            if (!drag) return;
            viewer.tx = drag.tx + event.clientX - drag.x;
            viewer.ty = drag.ty + event.clientY - drag.y;
            applyZoom(false);
        });
        window.addEventListener('mouseup', () => { drag = null; });
        window.addEventListener('keydown', (event) => {
            if (!viewer.open || !el.sheet.hidden) return;
            if (event.key === 'ArrowLeft') step(-1);
            else if (event.key === 'ArrowRight') step(1);
            else if (event.key === 'Escape') closeTopLayer();
        });
    }
    function infoRow(label, value) {
        return h('div', { class: 'info-row' }, h('div', { class: 'info-label' }, label), h('div', { class: 'info-value' }, value));
    }
    /** @param {object} [target] a list row; defaults to the picture open in the viewer */
    async function openInfoSheet(target) {
        const row = target && typeof target.id === 'string' && target.v ? target : currentRow();
        if (!row) return;
        const body = h('div', { class: 'info' }, h('div', { class: 'empty-inline' }, t('loading')));
        openSheet(t('info'), body, { tall: true });
        let item;
        try {
            item = await api(`/api/item/${row.id}`);
        } catch {
            body.replaceChildren(h('div', { class: 'empty-inline' }, t('offline')));
            return;
        }
        const chipTo = (label, view, iconName) => h('button', {
            class: 'chip',
            onClick: () => navigate({ ...BLANK_VIEW, ...view }),
        }, icon(iconName, 14), label);
        const safeLink = /^https?:\/\//i.test(item.url);
        const goToFolder = (folder) => {
            state.locateAfterLoad = item.id;
            navigate({ ...BLANK_VIEW, scope: 'folder', folder: folder.id });
        };
        const rows = [
            h('div', { class: 'info-name' }, `${item.name}.${item.ext}`),
            infoRow(t('dimensions'), item.width && item.height ? `${item.width} × ${item.height}` : '—'),
            infoRow(t('size'), formatBytes(item.size)),
            item.duration > 0 && infoRow(t('duration'), formatDuration(item.duration)),
            infoRow(t('created'), formatDate(item.created)),
            infoRow(t('added'), formatDate(item.added)),
            item.star > 0 && infoRow(t('rating'), '★'.repeat(item.star)),
            item.folders.length > 0 && infoRow(t('folder'), h('div', { class: 'tag-wrap' },
                item.folders.map((f) => h('button', { class: 'chip', onClick: () => goToFolder(f) }, icon('folder', 14), f.name)))),
            item.tags.length > 0 && infoRow(t('tags'), h('div', { class: 'tag-wrap' },
                item.tags.map((tag) => chipTo(tag, { tags: [tag] }, 'tag')))),
            item.annotation && infoRow(t('note'), h('div', { class: 'info-note' }, item.annotation)),
            item.url && infoRow(t('link'), safeLink
                ? h('a', { class: 'info-link', href: item.url, target: '_blank', rel: 'noopener noreferrer' }, item.url)
                : h('span', { class: 'info-note' }, item.url)),
            h('div', { class: 'info-actions' },
                item.folders.length > 0 && h('button', { class: 'btn-primary', onClick: () => goToFolder(item.folders[0]) },
                    icon('folder', 18), t('openFolder')),
                h('a', { class: item.folders.length ? 'btn-secondary' : 'btn-primary', href: fileUrl(item.id, true), download: `${item.name}.${item.ext}` },
                    icon('download', 18), t('download')),
                h('a', { class: 'btn-secondary', href: fileUrl(item.id), target: '_blank', rel: 'noopener' },
                    icon('open', 18), t('openOriginal'))),
        ];
        body.replaceChildren(...rows.filter(Boolean));
    }

    // ───────────────────────── library switcher ─────────────────────────
    /** Drop everything on screen and show the library Eagle has open now. */
    async function reloadForLibrary() {
        state.scrollMemory.clear();
        state.lib = null;
        // Empty the grid at once: nothing of the previous library may stay on screen.
        state.generation++;
        state.total = 0;
        state.rows = [];
        state.pages = new Map();
        for (const node of grid.nodes.values()) node.remove();
        grid.nodes.clear();
        layoutGrid();
        el.empty.hidden = true;
        el.chips.hidden = true;
        if (location.hash !== '#/all') history.replaceState(null, '', '#/all');
        try {
            await loadLibrary();
        } catch (err) {
            showLoadError(err);
            return;
        }
        await onRoute(false);
    }
    /** Ask Eagle on the computer to open another library, then follow it. */
    async function switchLibrary(id) {
        if (id === state.libId) return;
        el.title.textContent = t('libraries');
        el.subtitle.textContent = '';
        setBanner(t('switching'));
        try {
            const res = await fetch('/api/switch', {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new ApiError(res.status);
        } catch {
            setBanner(t('switchFailed'));
            el.title.textContent = viewTitle(state.view);
            return;
        }
        // Eagle needs a moment to open the library and tell the plugin.
        for (let attempt = 0; attempt < 40; attempt++) {
            await sleep(400);
            try {
                if ((await api('/api/ping')).id === id) break;
            } catch { /* still opening */ }
        }
        await reloadForLibrary();
    }
    async function openLibrarySheet() {
        let libraries = [];
        try {
            libraries = (await api('/api/libraries')).libraries;
        } catch (err) {
            showLoadError(err);
            return;
        }
        const row = (lib) => h('button', {
            class: `lib-row${lib.current ? ' active' : ''}`,
            onClick: () => navigateThen(() => switchLibrary(lib.id)),
        }, h('span', { class: 'lib-text' }, h('span', { class: 'lib-name' }, lib.name),
            lib.current && h('span', { class: 'lib-note' }, t('onDesktop'))), lib.current && icon('check', 18));
        const body = h('div', null, h('div', { class: 'lib-hint' }, t('switchHint')), h('div', { class: 'lib-list' }, libraries.map(row)));
        const show = () => openSheet(t('libraries'), body, { tall: libraries.length > 6 });
        if (layers.length) {
            history.back();
            window.addEventListener('popstate', () => setTimeout(show, 0), { once: true });
        } else {
            show();
        }
    }
    /** Close every open layer, then run `action`. */
    function navigateThen(action) {
        if (!layers.length) {
            action();
            return;
        }
        window.addEventListener('popstate', () => setTimeout(action, 0), { once: true });
        history.go(-layers.length);
    }

    // ───────────────────────── reading mode ─────────────────────────
    // Images of the current view stitched into one seamless strip (vertical, or horizontal either way),
    // for comics and photo sequences. Only blocks near the viewport hold a decoded image.
    const READ_PAGE = 60;
    const READ_MODES = ['v', 'l', 'r'];
    const reader = {
        open: false, query: '', total: 0, first: 0, last: -1, busy: false, generation: 0,
        strip: null, counter: null, modeBtn: null, observer: null, frame: 0,
    };
    function buildReader() {
        reader.strip = h('div', { class: 'r-strip' });
        reader.counter = h('div', { class: 'v-counter' });
        reader.modeBtn = h('button', { class: 'r-mode', onClick: cycleReaderMode });
        const top = h('div', { class: 'v-top r-top' },
            h('button', { class: 'icon-btn', 'aria-label': t('back'), onClick: closeTopLayer }, icon('back')),
            h('div', { class: 'v-title' }, h('div', { class: 'v-name' }, t('reader')), reader.counter),
            reader.modeBtn);
        el.reader.append(reader.strip, top);
        reader.strip.addEventListener('scroll', () => {
            if (!reader.frame) reader.frame = requestAnimationFrame(onReaderScroll);
        }, { passive: true });
        reader.strip.addEventListener('click', () => el.reader.classList.toggle('chrome-off'));
    }
    function readerHorizontal() {
        return prefs.reader !== 'v';
    }
    function applyReaderMode() {
        el.reader.dataset.mode = prefs.reader;
        reader.modeBtn.textContent = t({ v: 'readerV', l: 'readerL', r: 'readerR' }[prefs.reader]);
    }
    function readerBlock(row, index) {
        const block = h('div', { class: 'r-item', dataset: { i: String(index), src: mediaUrl('preview', row), thumb: mediaUrl('thumb', row) } });
        block.style.aspectRatio = `${row.w || 3} / ${row.h || 4}`;
        reader.observer.observe(block);
        return block;
    }
    function onReaderIntersect(entries) {
        for (const entry of entries) {
            const block = entry.target;
            const img = block.firstChild;
            if (entry.isIntersecting && !img) {
                const added = h('img', { alt: '', decoding: 'async' });
                // A format this browser cannot decode: show Eagle's thumbnail rather than a broken image.
                added.addEventListener('error', () => {
                    if (added.isConnected && block.dataset.thumb) added.src = block.dataset.thumb;
                }, { once: true });
                added.src = block.dataset.src;
                block.appendChild(added);
            } else if (!entry.isIntersecting && img) {
                img.src = '';
                img.remove();
            }
        }
    }
    async function readerFetch(offset) {
        const data = await api(`/api/items?${reader.query}&offset=${offset}&limit=${READ_PAGE}`);
        return data.items;
    }
    /** Add a page after the loaded range, or before it while keeping what is on screen in place. */
    async function readerExtend(forward) {
        if (reader.busy || !reader.open) return;
        const offset = forward ? reader.last + 1 : Math.max(0, reader.first - READ_PAGE);
        const count = forward ? READ_PAGE : reader.first - offset;
        if ((forward && offset >= reader.total) || (!forward && reader.first === 0)) return;
        reader.busy = true;
        const generation = reader.generation;
        try {
            const rows = (await readerFetch(offset)).slice(0, count);
            if (generation !== reader.generation || !rows.length) return;
            const blocks = rows.map((row, i) => readerBlock(row, offset + i));
            if (forward) {
                reader.strip.append(...blocks);
                reader.last = offset + rows.length - 1;
            } else {
                const anchor = reader.strip.firstElementChild;
                const before = anchor.getBoundingClientRect();
                reader.strip.prepend(...blocks);
                const after = anchor.getBoundingClientRect();
                reader.strip.scrollBy(after.left - before.left, after.top - before.top);
                reader.first = offset;
            }
        } catch (err) {
            if (!(err instanceof ApiError)) console.error(err);
        } finally {
            reader.busy = false;
        }
    }
    function readerCurrentBlock() {
        const rect = reader.strip.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit ? hit.closest('.r-item') : null;
    }
    function onReaderScroll() {
        reader.frame = 0;
        if (!reader.open) return;
        const block = readerCurrentBlock();
        if (block) reader.counter.textContent = `${(Number(block.dataset.i) + 1).toLocaleString()} / ${reader.total.toLocaleString()}`;
        const strip = reader.strip;
        const horizontal = readerHorizontal();
        const size = horizontal ? strip.clientWidth : strip.clientHeight;
        const length = horizontal ? strip.scrollWidth : strip.scrollHeight;
        const travelled = Math.abs(horizontal ? strip.scrollLeft : strip.scrollTop);
        if (length - travelled - size < size * 2) readerExtend(true);
        if (travelled < size * 1.5) readerExtend(false);
    }
    function cycleReaderMode(event) {
        event.stopPropagation();
        const current = readerCurrentBlock();
        setPrefs({ reader: READ_MODES[(READ_MODES.indexOf(prefs.reader) + 1) % READ_MODES.length] });
        applyReaderMode();
        if (current) current.scrollIntoView({ block: 'start', inline: 'start' });
        onReaderScroll();
    }
    /** @param {object|null} startRow open at this item; null starts from the first image of the view */
    async function openReader(startRow) {
        const view = { ...state.view, kind: 'image' };
        const query = queryString(view);
        let probe;
        try {
            probe = await api(`/api/items?${query}&limit=1${startRow ? `&locate=${startRow.id}` : ''}`);
        } catch (err) {
            showLoadError(err);
            return;
        }
        if (!probe.total) {
            toast(t('readerEmpty'));
            return;
        }
        const start = Math.max(0, probe.index || 0);
        navigateThen(async () => {
            reader.generation++;
            reader.open = true;
            reader.query = query;
            reader.total = probe.total;
            reader.first = Math.floor(start / READ_PAGE) * READ_PAGE;
            reader.last = reader.first - 1;
            reader.strip.replaceChildren();
            if (reader.observer) reader.observer.disconnect();
            reader.observer = new IntersectionObserver(onReaderIntersect, { root: reader.strip, rootMargin: '150% 150%' });
            applyReaderMode();
            el.reader.classList.remove('chrome-off');
            el.reader.hidden = false;
            document.body.classList.add('viewing');
            pushLayer(() => {
                reader.open = false;
                reader.generation++;
                reader.observer.disconnect();
                reader.strip.replaceChildren();
                el.reader.hidden = true;
                document.body.classList.remove('viewing');
            });
            await readerExtend(true);
            const target = reader.strip.querySelector(`.r-item[data-i="${start}"]`);
            if (target) target.scrollIntoView({ block: 'start', inline: 'start' });
            onReaderScroll();
        });
    }

    // ───────────────────────── keep in sync with the desktop ─────────────────────────
    async function poll() {
        if (document.hidden || !state.lib) return;
        try {
            const ping = await api('/api/ping');
            state.stale = ping.api !== CLIENT_API;
            setBanner(state.stale ? t('stale') : '');
            if (ping.version !== state.version || ping.id !== state.libId) {
                if (ping.id !== state.libId) {
                    // Eagle moved to another library: nothing on screen belongs to it any more.
                    navigateThen(reloadForLibrary);
                    return;
                }
                await loadLibrary();
                if (viewer.open || reader.open) return;
                await onRoute(false);
                toast(t('libraryChanged'));
            }
        } catch (err) {
            if (err.status !== 401) setBanner(errorText(err));
        }
        return undefined;
    }

    async function start() {
        buildSkeleton();
        buildViewer();
        buildReader();
        if (history.state && history.state.depth) history.replaceState(null, '');
        try {
            await loadLibrary();
        } catch (err) {
            showLoadError(err);
            setTimeout(() => location.reload(), 5000);
            return;
        }
        await onRoute(false);
        setInterval(poll, 4000);
        document.addEventListener('visibilitychange', poll);
    }
    start();
})();
