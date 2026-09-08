# Yuyan garden architecture assets

These four GLB files are original procedural Blender meshes made for the personal homepage. No third-party model or texture is used.

## Build and export

```sh
/private/tmp/yuyan-blender-mount/Blender.app/Contents/MacOS/Blender --background --python tools/build_architecture.py
```

Blender source scene: `/tmp/yuyan-garden-architecture.blend`.
Assets use Blender Z-up while authoring, are centered at the origin, and face -Y. The exporter writes glTF Y-up. Each GLB has one explicitly merged building mesh with preserved per-face material slots plus one `snow_<building>_winter` node. The winter nodes carry `hide_by_default_in_web=true`; the homepage should traverse names beginning with `snow_` and set `visible=false` until winter is selected.

## Measured output

| GLB | Bounding size (W × D × H m) | Vertices | Triangles | Material slots | File size |
|---|---:|---:|---:|---:|---:|
| `research.glb` | 9.21 × 6.71 × 10.77 | 25,930 | 48,302 | 7 | 1347.0 KiB |
| `writing.glb` | 6.27 × 8.99 × 7.22 | 18,329 | 34,482 | 7 | 916.0 KiB |
| `about.glb` | 5.54 × 6.26 × 4.77 | 11,574 | 22,060 | 6 | 535.4 KiB |
| `projects.glb` | 6.27 × 6.06 × 4.81 | 11,482 | 21,880 | 7 | 539.5 KiB |

Combined main-building triangles: **126,724**; seasonal snow nodes add **1,504** triangles (**128,228** including winter geometry). Combined GLB bytes: **3337.8 KiB**.

### Material and draw-call note

The meshes use the shared procedural palette `roof_slate`, `roof_rib`, `wood_cinnabar`, `wood_dark`, `wall_cream`, `stone`, `stone_dark`, and `snow`. The material-slot count in the table is the upper bound for the main building draw groups; the snow node adds one winter-only group. There are no external image textures.

The roof surface is a curved shell with raised corner eaves. Tile courses span each full slope and radial ribs run from each eave toward the ridge on both sides, so the visible roof is covered across the full plane rather than carrying a small repeated patch.

### Design mapping

- `research.glb`: 3-storey 重檐歇山主阁, 9×6 class footprint, layered eaves and ridge ornaments.
- `writing.glb`: elongated 2-storey 藏书楼, 6×8 class footprint, Y-axis ridge and repeated side lattice.
- `about.glb`: open 5×5 临水水榭, eight-post frame, bench/table interior, fine railings.
- `projects.glb`: 1-storey 6×5 偏殿, broad double eaves and compact courtyard façade.
