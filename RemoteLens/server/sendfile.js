'use strict';
/** Static file responses with conditional requests and single-range support (needed for video seeking). */
const fs = require('fs');
const fsp = fs.promises;

const MIME = {
    html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8', webmanifest: 'application/manifest+json; charset=utf-8',
    svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon',
    heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff', jxl: 'image/jxl',
    dng: 'image/x-adobe-dng', psd: 'image/vnd.adobe.photoshop',
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
    avi: 'video/x-msvideo', ts: 'video/mp2t', '3gp': 'video/3gpp',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', flac: 'audio/flac',
    ogg: 'audio/ogg', opus: 'audio/ogg', amr: 'audio/amr',
    pdf: 'application/pdf', txt: 'text/plain; charset=utf-8',
};

function mimeOf(ext) {
    return MIME[String(ext || '').toLowerCase()] || 'application/octet-stream';
}

function contentDisposition(kind, filename) {
    const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** Parse a single `bytes=a-b` range. Returns null when absent/unsupported, false when unsatisfiable. */
function parseRange(header, size) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
    if (!m || (m[1] === '' && m[2] === '')) return null;
    let start;
    let end;
    if (m[1] === '') {
        const suffix = Number(m[2]);
        if (suffix === 0) return false;
        start = Math.max(0, size - suffix);
        end = size - 1;
    } else {
        start = Number(m[1]);
        end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    }
    if (start > end || start >= size) return false;
    return { start, end };
}

/**
 * @param {object} opts {type, cacheControl, download: filename|undefined, inlineName, extraHeaders}
 * @returns {Promise<boolean>} false when the file does not exist (nothing was written)
 */
async function sendFile(req, res, file, opts = {}) {
    let stat;
    try {
        stat = await fsp.stat(file);
    } catch (err) {
        if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return false;
        throw err;
    }
    if (!stat.isFile()) return false;

    const etag = `"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
    const headers = {
        'Content-Type': opts.type || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Cache-Control': opts.cacheControl || 'private, max-age=3600',
        ETag: etag,
        'Last-Modified': stat.mtime.toUTCString(),
        ...(opts.extraHeaders || {}),
    };
    if (opts.download) headers['Content-Disposition'] = contentDisposition('attachment', opts.download);
    else if (opts.inlineName) headers['Content-Disposition'] = contentDisposition('inline', opts.inlineName);

    if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, headers);
        res.end();
        return true;
    }

    const range = parseRange(req.headers.range, stat.size);
    if (range === false) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}` });
        res.end();
        return true;
    }
    const start = range ? range.start : 0;
    const end = range ? range.end : stat.size - 1;
    headers['Content-Length'] = stat.size === 0 ? 0 : end - start + 1;
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD' || stat.size === 0) {
        res.end();
        return true;
    }
    await new Promise((resolve) => {
        const stream = fs.createReadStream(file, { start, end });
        stream.on('error', () => {
            res.destroy();
            resolve();
        });
        res.on('close', () => {
            stream.destroy();
            resolve();
        });
        stream.pipe(res);
    });
    return true;
}

/**
 * Image type from the file's first bytes. Eagle names every thumbnail `*_thumbnail.png`
 * although the content is usually WebP, so the extension cannot be trusted.
 */
async function sniffImageType(file, fallback) {
    let handle;
    try {
        handle = await fsp.open(file, 'r');
        const { buffer, bytesRead } = await handle.read(Buffer.alloc(12), 0, 12, 0);
        if (bytesRead >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
        if (bytesRead >= 8 && buffer.readUInt32BE(0) === 0x89504e47) return 'image/png';
        if (bytesRead >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
        if (bytesRead >= 6 && buffer.toString('latin1', 0, 3) === 'GIF') return 'image/gif';
        return fallback;
    } catch (err) {
        if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null;
        throw err;
    } finally {
        if (handle) await handle.close();
    }
}

module.exports = { sendFile, mimeOf, parseRange, sniffImageType };
