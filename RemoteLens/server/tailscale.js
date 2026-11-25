'use strict';
/**
 * Optional Tailscale integration through its CLI.
 * `tailscale serve` publishes the local port inside the tailnet over HTTPS, so the server itself
 * only needs to listen on loopback: nothing is opened towards the local network.
 */
const { execFile } = require('child_process');
const fs = require('fs');

const CANDIDATES = process.platform === 'win32'
    ? ['tailscale', 'C:\\Program Files\\Tailscale\\tailscale.exe', 'C:\\Program Files (x86)\\Tailscale\\tailscale.exe']
    : ['tailscale', '/usr/local/bin/tailscale', '/opt/homebrew/bin/tailscale',
        '/Applications/Tailscale.app/Contents/MacOS/Tailscale', '/usr/bin/tailscale'];

let cachedExe;

function run(exe, args, timeout = 8000) {
    return new Promise((resolve, reject) => {
        execFile(exe, args, { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) reject(Object.assign(err, { stderr: String(stderr || '') }));
            else resolve(String(stdout));
        });
    });
}

async function findExe() {
    if (cachedExe !== undefined) return cachedExe;
    for (const candidate of CANDIDATES) {
        if (candidate.includes('/') || candidate.includes('\\')) {
            if (!fs.existsSync(candidate)) continue;
        }
        try {
            await run(candidate, ['version'], 4000);
            cachedExe = candidate;
            return cachedExe;
        } catch { /* try the next location */ }
    }
    cachedExe = null;
    return null;
}

/**
 * @returns {Promise<{installed:boolean, running:boolean, dnsName:string, ips:string[], https:boolean}>}
 */
async function status() {
    const none = { installed: false, running: false, dnsName: '', ips: [], https: false };
    const exe = await findExe();
    if (!exe) return none;
    try {
        const data = JSON.parse(await run(exe, ['status', '--json']));
        const self = data.Self || {};
        return {
            installed: true,
            running: data.BackendState === 'Running',
            dnsName: String(self.DNSName || '').replace(/\.$/, ''),
            ips: Array.isArray(self.TailscaleIPs) ? self.TailscaleIPs.filter((ip) => ip.includes('.')) : [],
            https: Array.isArray(data.CertDomains) && data.CertDomains.length > 0,
        };
    } catch {
        return { ...none, installed: true };
    }
}

/** Publish https://<machine>.<tailnet>.ts.net:<httpsPort> -> http://127.0.0.1:<targetPort>, tailnet only. */
async function serveOn(httpsPort, targetPort) {
    const exe = await findExe();
    if (!exe) throw new Error('tailscale not found');
    await run(exe, ['serve', '--bg', `--https=${httpsPort}`, `http://127.0.0.1:${targetPort}`], 15000);
}

async function serveOff(httpsPort) {
    const exe = await findExe();
    if (!exe) return;
    try {
        await run(exe, ['serve', `--https=${httpsPort}`, 'off'], 15000);
    } catch { /* nothing was published on that port */ }
}

module.exports = { status, serveOn, serveOff };
