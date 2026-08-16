/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — version.js (cache busting)

   ⚠ GENERATED FILE — do not edit by hand.
   Regenerate with: node tools/gen-version.mjs
   (tools/deploy.mjs runs it automatically before every deploy.)

   /assets/* is served `immutable, max-age=1y` (see _headers). That is
   the right policy for bandwidth, but it means a returning visitor keeps
   whatever copy their browser already has — overwriting a model or
   texture in place ships an update those visitors never see, because a
   browser does not even revalidate an immutable response until it
   expires.

   So asset URLs carry this build id as a ?v= query string. The bytes are
   identical but the URL is a distinct cache key, so a changed id makes
   clients refetch while unchanged deploys keep hitting cache.

   BUILD_ID is a sha256 over the path + bytes of every file under
   assets/, so it changes if and only if the assets change. A code-only
   deploy keeps the same id and clients keep their cached models.

   HTML and JS are `no-cache`, so a fresh page load always sees the
   current id and therefore the current assets.
   ═══════════════════════════════════════════════════════════════════ */
export const BUILD_ID = '2026-08-16-a553e7c4dba4';

// Append the build id to an asset URL, preserving any existing query.
export function withVersion(url) {
    if (!url) return url;
    // Leave data:/blob: URLs alone — they carry their own payload and a
    // query string would corrupt them.
    if (/^(data|blob):/i.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${encodeURIComponent(BUILD_ID)}`;
}
