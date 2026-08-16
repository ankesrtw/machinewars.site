# GIS feasibility spike — 2026-08-16

**Throwaway proof-of-concept code, kept for reference. Not part of the build.**
The real tooling goes in `tools/gis/` (task P1.2). Port from these; don't import them.

Both scripts decode [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
(Mapzen "terrarium" format) using **only Node's built-in `zlib`** — no GDAL, no numpy,
no npm dependencies. Elevation is `(R*256 + G + B/256) - 32768` meters.

| File | What it does |
|---|---|
| `single-tile-spike.mjs` | Decodes one 256×256 tile, prints min/max/relief + an ASCII heightmap. |
| `terrarium-decode-spike.mjs` | Mosaics a 3×3 tile grid, extracts an arbitrary metre-extent window around a lat/lon, prints relief + ASCII preview. **This is the one to port.** |

Both expect tiles already downloaded next to them (`agumbe.png`, `t_<dx>_<dy>.png`) —
fetching is P1.2's job. Tile URL:
`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`

## What it proved

Agumbe, Western Ghats (13.5178N, 75.0906E), z15 = **4.64 m/px**:

| Window | Relief | Reads as |
|---|---|---|
| 400m (arena) | **27.9m** | One smooth tilted plane — no cover, no ridges |
| 1200m (horizon) | **50.3m** | Real structure — ridges, valleys, recognisable landscape |

**Conclusion:** real DEM is useless inside ~400m and valuable beyond ~600m. This is what
drove the "authored floor + real horizon" decision — see `../HANDOFF.md`.

Those two relief numbers are the **regression test** for the ported tooling: same input,
same numbers.
