/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — version.js (cache busting)

   /assets/* and /vendor/* are served `immutable, max-age=1y` (see
   _headers). That is the right policy for bandwidth, but it means a
   returning visitor keeps whatever copy their browser already has —
   overwriting a model or texture in place at the same path ships an
   update that those visitors never see, because the browser does not
   even revalidate an immutable response until it expires.

   Rather than rename every asset on each deploy, stamp a build id onto
   asset URLs as a query string. The bytes are identical, but the URL
   is a distinct cache key, so a new BUILD_ID makes every client fetch
   fresh copies while unchanged deploys keep hitting cache.

   HTML and JS are already `no-cache`, so a fresh page load always sees
   the current BUILD_ID and therefore the current assets.

   ── Bump this on any deploy that changes a file under assets/ or
   vendor/ in place. ──────────────────────────────────────────────── */
export const BUILD_ID = '2026-08-15-1';

// Append the build id to an asset URL, preserving any existing query.
export function withVersion(url) {
    if (!url) return url;
    // Leave data:/blob: URLs alone — they carry their own payload and a
    // query string would corrupt them.
    if (/^(data|blob):/i.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${encodeURIComponent(BUILD_ID)}`;
}
