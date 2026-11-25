'use strict';
/**
 * Preview converter that runs inside the plugin window (Chromium + Electron).
 * Produces a downsized WebP/JPEG so a phone does not have to pull multi-megabyte originals,
 * and makes HEIC / RAW viewable in browsers that cannot decode them.
 * Exposed as window.RemoteLensPreview.make and injected into the server core.
 */
(function () {
    const fs = require('fs');

    const CHROMIUM = new Set(['jpg', 'jpeg', 'jfif', 'png', 'webp', 'avif', 'bmp', 'ico']);
    const WEBP_QUALITY = 0.82;
    const JPEG_QUALITY = 86;
    const MAX_SOURCE_BYTES = 80 * 1024 * 1024;

    function targetSize(width, height, maxEdge) {
        const ratio = Math.min(1, maxEdge / Math.max(width, height));
        return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
    }

    async function viaCanvas(file, maxEdge) {
        const stat = await fs.promises.stat(file);
        if (stat.size > MAX_SOURCE_BYTES) return null;
        const bitmap = await createImageBitmap(new Blob([await fs.promises.readFile(file)]));
        try {
            const size = targetSize(bitmap.width, bitmap.height, maxEdge);
            const canvas = new OffscreenCanvas(size.width, size.height);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bitmap, 0, 0, size.width, size.height);
            const blob = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
            return { buffer: Buffer.from(await blob.arrayBuffer()), type: 'image/webp' };
        } finally {
            bitmap.close();
        }
    }

    /** Formats Chromium cannot decode (HEIC, RAW, TIFF, PSD…): ask the OS thumbnailer. */
    async function viaSystem(file, maxEdge) {
        let nativeImage;
        try {
            nativeImage = require('electron').nativeImage;
        } catch {
            return null;
        }
        if (!nativeImage || typeof nativeImage.createThumbnailFromPath !== 'function') return null;
        const image = await nativeImage.createThumbnailFromPath(file, { width: maxEdge, height: maxEdge });
        if (!image || image.isEmpty()) return null;
        const got = image.getSize();
        // A tiny result means the OS only had a generic file icon, not a real rendering.
        if (Math.max(got.width, got.height) < Math.min(maxEdge, 256)) return null;
        return { buffer: image.toJPEG(JPEG_QUALITY), type: 'image/jpeg' };
    }

    /**
     * @param {{file:string, ext:string, maxEdge:number}} source
     * @returns {Promise<{buffer:Buffer, type:string}|null>}
     */
    async function make(source) {
        if (CHROMIUM.has(source.ext)) return viaCanvas(source.file, source.maxEdge);
        return viaSystem(source.file, source.maxEdge);
    }

    window.RemoteLensPreview = { make };
})();
