/* ═══════════════════════════════════════════════════════════════════
   MACHINE WARS — tools/gis/sites.data.js

   The GIS site roster, as data. Single source of truth for every
   site's geography — same discipline as data/*.data.js: one
   `export default`, JSON-literal shape, no functions.

   Why a 3x3 tile mosaic: the spike (docs/v2/spike/) proved AWS
   Terrarium tiles at z15 (~4.6 m/px at this latitude) decode with zero
   deps and no auth. A 3x3 mosaic of 256px tiles is 768px wide, i.e.
   ~3567m at z15 — comfortably covers horizonExtentM (2400m) with
   margin for the mosaic center to drift off the middle tile.

   playableExtentM / horizonExtentM are deliberately two different
   numbers (see docs/v2/HANDOFF.md "the load-bearing finding"): real
   DEM relief inside ~400m reads as a smooth tilted plane (no cover, no
   ridges) — useless for combat layout. Beyond ~600m it reads as real
   structure. So the combat box is hand-authored floor; DEM drives only
   the visible ring out to horizonExtentM and the skyline.

   NOTE on source: ROADMAP-V2 §5.1 specifies Copernicus DEM GLO-30 as
   the primary Earth source. The P1 spike instead used AWS Terrarium
   tiles (Mapzen format, s3://elevation-tiles-prod) because they are
   zero-dep (Node zlib only, no GDAL/numpy/PIL) and proven end-to-end.
   Ported tooling here follows the spike. Swap `source` to Copernicus
   later without touching this schema if Terrarium coverage/resolution
   proves insufficient for a given site.
   ═══════════════════════════════════════════════════════════════════ */

export default {
    ghats: {
        // Agumbe / Kudremukh, Western Ghats — verified in the P1 spike.
        centerLatLon: [13.5178, 75.0906],
        bbox: [75.0785892, 13.5061220, 75.1026108, 13.5294780], // [west, south, east, north]
        zoom: 15,
        tileGrid: { cols: 3, rows: 3 }, // tiles around the center tile, dx/dy in [-1,1]
        playableExtentM: 400,
        horizonExtentM: 2400,
        biome: 'jungle',
        // Ground palette for build-albedo.mjs — graded from Western Ghats reference
        // photos (wet laterite soil + dense canopy leaf litter), not sampled imagery.
        // See docs/v2/HANDOFF.md P1.3 note: fetch-imagery.mjs (Sentinel-2) was deferred,
        // so this is the procedural stand-in until real albedo imagery is worth the cost.
        albedoPalette: {
            base: [58, 54, 34],       // damp earth/leaf-litter base
            speckle: [
                [72, 64, 38],  // dry leaf litter
                [40, 46, 28],  // moss/shadow
                [90, 78, 46],  // laterite soil highlight
                [30, 34, 22],  // deep shade
            ],
        },
        source: {
            provider: 'aws-terrain-tiles',
            format: 'terrarium',
            url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
            decode: '(R*256 + G + B/256) - 32768', // meters
            attribution: 'AWS Terrain Tiles (Mapzen terrarium format)',
        },
        notes: 'Opening site (P1). Spike-verified: relief 27.9m @ 400m window, ' +
            '50.3m @ 1200m window, 4.64 m/px at z15. See docs/v2/spike/README.md.',
    },
};
