'use strict';
/** Address classification: decides who may talk to the server at all (before any token check). */
const os = require('os');

function normalize(address) {
    const a = String(address || '').toLowerCase();
    const zone = a.indexOf('%');
    const bare = zone === -1 ? a : a.slice(0, zone);
    return bare.startsWith('::ffff:') && bare.includes('.') ? bare.slice(7) : bare;
}

function v4Parts(address) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address);
    if (!m) return null;
    const parts = m.slice(1).map(Number);
    return parts.every((n) => n <= 255) ? parts : null;
}

function isLoopback(address) {
    const a = normalize(address);
    const p = v4Parts(a);
    return p ? p[0] === 127 : a === '::1';
}

/** Tailscale hands out 100.64.0.0/10 (CGNAT range) and fd7a:115c:a1e0::/48. */
function isTailscale(address) {
    const a = normalize(address);
    const p = v4Parts(a);
    if (p) return p[0] === 100 && p[1] >= 64 && p[1] <= 127;
    return a.startsWith('fd7a:115c:a1e0:');
}

function isPrivateLan(address) {
    const a = normalize(address);
    const p = v4Parts(a);
    if (p) {
        return p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
            (p[0] === 192 && p[1] === 168) || (p[0] === 169 && p[1] === 254);
    }
    if (isTailscale(a)) return false;
    return /^f[cd][0-9a-f]{2}:/.test(a) || /^fe[89ab][0-9a-f]:/.test(a);
}

/**
 * @returns {'loopback'|'tailscale'|'lan'|'public'}
 */
function classify(address) {
    if (isLoopback(address)) return 'loopback';
    if (isTailscale(address)) return 'tailscale';
    if (isPrivateLan(address)) return 'lan';
    return 'public';
}

function isAllowed(address, { allowLan }) {
    const zone = classify(address);
    return zone === 'loopback' || zone === 'tailscale' || (zone === 'lan' && Boolean(allowLan));
}

/** IPv4 addresses of this machine, split by zone. */
function localAddresses() {
    const out = { tailscale: [], lan: [] };
    for (const list of Object.values(os.networkInterfaces())) {
        for (const info of list || []) {
            if (info.internal || info.family !== 'IPv4') continue;
            const zone = classify(info.address);
            if (zone === 'tailscale') out.tailscale.push(info.address);
            else if (zone === 'lan' && !info.address.startsWith('169.254.')) out.lan.push(info.address);
        }
    }
    return out;
}

module.exports = { normalize, classify, isAllowed, isLoopback, isTailscale, isPrivateLan, localAddresses };
