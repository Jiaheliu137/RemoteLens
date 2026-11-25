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
    const DEFAULT_PREFS = { sort: 'added', order: 'desc', cols: 0, recursive: true, expanded: {} };
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
        constructor(status) {
            super(`HTTP ${status}`);
            this.status = status;
        }
    }
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
        if (!res.ok) throw new ApiError(res.status);
        return res.json();
    }

    // ───────────────────────── state ─────────────────────────
    const PAGE = 150;
    const GAP = 2;
    const state = {
        lib: null,
        folderIndex: new Map(),
        view: { scope: 'all', folder: '', tags: [], q: '', kind: '' },
        total: 0,
        rows: [],
        pages: new Map(),
        generation: 0,
        version: 0,
        scrollMemory: new Map(),
    };

    function parseHash() {
        const raw = location.hash.replace(/^#\/?/, '');
        const cut = raw.indexOf('?');
        const segs = (cut === -1 ? raw : raw.slice(0, cut)).split('/');
        const params = new URLSearchParams(cut === -1 ? '' : raw.slice(cut + 1));
        const view = { scope: 'all', folder: '', tags: params.getAll('tag'), q: params.get('q') || '', kind: params.get('kind') || '' };
        if (segs[0] === 'folder' && segs[1]) {
            view.scope = 'folder';
            view.folder = segs[1];
        } else if (segs[0] === 'uncategorized' || segs[0] === 'untagged') {
            view.scope = segs[0];
        }
        return view;
    }
    function hashOf(view) {
        const params = new URLSearchParams();
        view.tags.forEach((tag) => params.append('tag', tag));
        if (view.q) params.set('q', view.q);
        if (view.kind) params.set('kind', view.kind);
        const base = view.scope === 'folder' ? `folder/${view.folder}` : view.scope;
        const qs = params.toString();
        return `#/${base}${qs ? `?${qs}` : ''}`;
    }
    function queryString(view) {
        const params = new URLSearchParams({
            scope: view.scope, sort: prefs.sort, order: prefs.order, recursive: prefs.recursive ? '1' : '0',
        });
        if (view.scope === 'folder') params.set('folder', view.folder);
        view.tags.forEach((tag) => params.append('tag', tag));
        if (view.q) params.set('q', view.q);
        if (view.kind) params.set('kind', view.kind);
        return params.toString();
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
        el.toast = h('div', { class: 'toast', hidden: true, role: 'status' });
        document.getElementById('app').append(el.header, el.main, el.scrim, el.drawer, el.sheet, el.viewer, el.toast);

        let searchTimer = 0;
        el.searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => navigate({ ...state.view, q: el.searchInput.value.trim() }, { replace: true }), 280);
        });
        el.searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') el.searchInput.blur();
            if (event.key === 'Escape') closeSearch(true);
        });
        el.grid.addEventListener('click', (event) => {
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
    async function loadLibrary() {
        const lib = await api('/api/library');
        state.lib = lib;
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
                    icon('folder', 14), child.name, h('span', { class: 'chip-count' }, String(child.total))));
            }
        }
        for (const tag of view.tags) {
            chips.push(h('button', {
                class: 'chip chip-active',
                onClick: () => navigate({ ...view, tags: view.tags.filter((x) => x !== tag) }),
            }, icon('tag', 14), tag, icon('close', 12)));
        }
        if (view.kind) {
            chips.push(h('button', { class: 'chip chip-active', onClick: () => navigate({ ...view, kind: '' }) },
                t(view.kind), icon('close', 12)));
        }
        el.chips.replaceChildren(...chips);
        el.chips.hidden = chips.length === 0;
    }

    // ───────────────────────── virtual grid ─────────────────────────
    const grid = { cols: 3, cell: 100, nodes: new Map(), fetchTimer: 0, frame: 0 };
    function layoutGrid() {
        const width = el.grid.clientWidth || window.innerWidth;
        const auto = width < 520 ? 3 : Math.max(4, Math.round(width / 170));
        grid.cols = prefs.cols > 0 ? prefs.cols : auto;
        grid.cell = (width - GAP * (grid.cols - 1)) / grid.cols;
        const rowCount = Math.ceil(state.total / grid.cols);
        el.grid.style.height = `${Math.max(0, rowCount * (grid.cell + GAP) - GAP)}px`;
    }
    async function resetGrid(restoreScroll) {
        const generation = ++state.generation;
        state.total = 0;
        state.rows = [];
        state.pages = new Map();
        for (const node of grid.nodes.values()) node.remove();
        grid.nodes.clear();
        el.empty.hidden = true;
        el.subtitle.textContent = t('loading');
        layoutGrid();
        window.scrollTo(0, 0);
        try {
            await fetchPage(0, generation);
        } catch (err) {
            if (generation === state.generation) showLoadError(err);
            return;
        }
        if (generation !== state.generation) return;
        layoutGrid();
        if (restoreScroll) window.scrollTo(0, restoreScroll);
        renderGrid();
    }
    function showLoadError(err) {
        if (!(err instanceof ApiError)) console.error(err);
        el.subtitle.textContent = '';
        setBanner(err.status === 503 ? t('unavailable') : t('offline'));
    }
    async function fetchPage(page, generation = state.generation) {
        if (state.pages.has(page)) return state.pages.get(page);
        const job = api(`/api/items?${queryString(state.view)}&offset=${page * PAGE}&limit=${PAGE}`).then((data) => {
            if (generation !== state.generation) return;
            setBanner('');
            state.total = data.total;
            state.version = data.version;
            data.items.forEach((row, i) => { state.rows[data.offset + i] = row; });
            el.subtitle.textContent = t('items', data.total.toLocaleString());
            el.empty.hidden = data.total > 0;
            el.empty.textContent = state.view.q || state.view.tags.length || state.view.kind ? t('emptySearch') : t('empty');
        }).catch((err) => {
            state.pages.delete(page);
            throw err;
        });
        state.pages.set(page, job);
        return job;
    }
    function visibleRange() {
        const rowH = grid.cell + GAP;
        const top = -el.grid.getBoundingClientRect().top;
        const buffer = window.innerHeight * 0.8;
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
        img.src = `/thumb/${row.id}?v=${row.v}`;
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
        const size = `${grid.cell}px`;
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
            const col = i % grid.cols;
            const rowIndex = Math.floor(i / grid.cols);
            node.style.width = size;
            node.style.height = size;
            node.style.transform = `translate(${col * (grid.cell + GAP)}px, ${rowIndex * (grid.cell + GAP)}px)`;
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
    function relayout() {
        const { first } = visibleRange();
        const anchor = Math.max(0, first + grid.cols * 2);
        for (const node of grid.nodes.values()) node.remove();
        grid.nodes.clear();
        layoutGrid();
        scrollToIndex(anchor, 'start');
        renderGrid();
    }
    function scrollToIndex(index, where) {
        const rowTop = Math.floor(index / grid.cols) * (grid.cell + GAP);
        const gridTop = el.grid.getBoundingClientRect().top + window.scrollY;
        const headerH = el.header.offsetHeight;
        const top = gridTop + rowTop - headerH;
        if (where === 'start') {
            window.scrollTo(0, Math.max(0, top));
            return;
        }
        const bottom = top + grid.cell + headerH;
        if (top < window.scrollY) window.scrollTo(0, Math.max(0, top - 8));
        else if (bottom > window.scrollY + window.innerHeight) window.scrollTo(0, bottom - window.innerHeight + 8);
    }
    window.addEventListener('scroll', scheduleRender, { passive: true });
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (Math.abs((el.grid.clientWidth - GAP * (grid.cols - 1)) / grid.cols - grid.cell) > 0.5) relayout();
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
        navigate({ scope: 'all', folder: '', tags: [], q: '', kind: '', ...view });
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
                    icon('folder', 18), h('span', { class: 'drawer-label' }, node.name),
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
        el.drawer.replaceChildren(
            h('div', { class: 'drawer-head' },
                h('img', { src: '/icon.svg', alt: '', width: 28, height: 28 }),
                h('div', { class: 'drawer-lib' }, lib.name),
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
    }
    function openDrawer() {
        renderDrawer();
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
            optionGroup(t('type'), kinds, state.view.kind, (kind) => navigate({ ...state.view, kind })),
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
                        onClick: () => navigate({ scope: 'all', folder: '', tags: [name], q: '', kind: '' }),
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
    function fillSlide(slide, index, isCurrent) {
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
        const thumb = `/thumb/${row.id}?v=${row.v}`;
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
            full.src = `/preview/${row.id}?v=${row.v}`;
            zoomer.append(low, full);
        } else if (row.k === 'v') {
            if (isCurrent) {
                zoomer.appendChild(h('video', {
                    class: 'v-video', controls: true, playsInline: true, preload: 'metadata',
                    poster: thumb, src: `/file/${row.id}`,
                }));
            } else {
                zoomer.append(h('img', { class: 'v-img', alt: '', draggable: false, src: thumb }),
                    h('div', { class: 'v-play' }, icon('play', 34)));
            }
        } else {
            zoomer.appendChild(h('div', { class: 'v-file' },
                icon('file', 56),
                h('div', { class: 'v-file-name' }, `${row.n}.${row.e}`),
                row.k === 'a' && isCurrent && h('audio', { controls: true, preload: 'none', src: `/file/${row.id}` }),
                h('a', { class: 'btn-primary', href: `/file/${row.id}?dl=1`, download: `${row.n}.${row.e}` },
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
            viewer.slides.forEach((slide) => slide.replaceChildren());
            el.viewer.hidden = true;
            document.body.classList.remove('viewing');
            scrollToIndex(viewer.index, 'nearest');
            scheduleRender();
        });
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
    async function openInfoSheet() {
        const row = currentRow();
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
            onClick: () => navigate({ scope: 'all', folder: '', tags: [], q: '', kind: '', ...view }),
        }, icon(iconName, 14), label);
        const safeLink = /^https?:\/\//i.test(item.url);
        const rows = [
            h('div', { class: 'info-name' }, `${item.name}.${item.ext}`),
            infoRow(t('dimensions'), item.width && item.height ? `${item.width} × ${item.height}` : '—'),
            infoRow(t('size'), formatBytes(item.size)),
            item.duration > 0 && infoRow(t('duration'), formatDuration(item.duration)),
            infoRow(t('created'), formatDate(item.created)),
            infoRow(t('added'), formatDate(item.added)),
            item.star > 0 && infoRow(t('rating'), '★'.repeat(item.star)),
            item.folders.length > 0 && infoRow(t('folder'), h('div', { class: 'tag-wrap' },
                item.folders.map((f) => chipTo(f.name, { scope: 'folder', folder: f.id }, 'folder')))),
            item.tags.length > 0 && infoRow(t('tags'), h('div', { class: 'tag-wrap' },
                item.tags.map((tag) => chipTo(tag, { tags: [tag] }, 'tag')))),
            item.annotation && infoRow(t('note'), h('div', { class: 'info-note' }, item.annotation)),
            item.url && infoRow(t('link'), safeLink
                ? h('a', { class: 'info-link', href: item.url, target: '_blank', rel: 'noopener noreferrer' }, item.url)
                : h('span', { class: 'info-note' }, item.url)),
            h('div', { class: 'info-actions' },
                h('a', { class: 'btn-primary', href: `/file/${item.id}?dl=1`, download: `${item.name}.${item.ext}` },
                    icon('download', 18), t('download')),
                h('a', { class: 'btn-secondary', href: `/file/${item.id}`, target: '_blank', rel: 'noopener' },
                    icon('open', 18), t('openOriginal'))),
        ];
        body.replaceChildren(...rows.filter(Boolean));
    }

    // ───────────────────────── keep in sync with the desktop ─────────────────────────
    async function poll() {
        if (document.hidden || !state.lib) return;
        try {
            const ping = await api('/api/ping');
            setBanner('');
            if (ping.version !== state.version || ping.name !== state.lib.name) {
                const libraryChanged = ping.name !== state.lib.name;
                await loadLibrary();
                if (viewer.open) return;
                if (libraryChanged) navigate({ scope: 'all', folder: '', tags: [], q: '', kind: '' });
                await onRoute(false);
                toast(t('libraryChanged'));
            }
        } catch (err) {
            if (err.status !== 401) setBanner(err.status === 503 ? t('unavailable') : t('offline'));
        }
    }

    async function start() {
        buildSkeleton();
        buildViewer();
        if (history.state && history.state.depth) history.replaceState(null, '');
        try {
            await loadLibrary();
        } catch (err) {
            showLoadError(err);
            setTimeout(() => location.reload(), 5000);
            return;
        }
        await onRoute(false);
        setInterval(poll, 15000);
        document.addEventListener('visibilitychange', poll);
    }
    start();
})();
