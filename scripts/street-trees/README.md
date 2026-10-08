# Poly Haven street trees

The three CC0 sources and authors are recorded in `public/assets/CREDITS.md`.
Raw 1K glTF downloads, binary buffers, textures and the separate leaf alpha maps
live in the ignored `downloads/tree-review/<id>/` folders. Retain these to regenerate assets.

Install offline build tools separately from game dependencies:

```powershell
npm install --prefix downloads/tree-review/tools @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0 sharp@0.35.5
node scripts/street-trees/optimize.mjs
node scripts/street-trees/check.mjs
```

`optimize.mjs` centres the trunk base on its collider, scales the trees to 6 / 4.8 / 7 metres,
reduces trunk/branch geometry, fits textured quads to disconnected source leaves,
samples 8,000 leaf cards uniformly across each canopy and embeds the alpha mask into
the leaf colour map. WebP textures are at most 1K. Geometry uses ordinary glTF accessors,
so the game needs no external mesh decoder. Assets total approximately 7 MiB,
with around 22,000 triangles per tree, down from 1.6–3.9 million per source.

The game keeps three shared materials per tree and instances trees by street chunk.
At 45 metres the leaf count halves, with slightly enlarged cards to retain coverage.
Siêu nhẹ always uses that cheaper level. Trunk colliders and deterministic placement
remain in `CityLayout`; missing models use the existing procedural fallback.

Check the game from the same street camera before/after. Renderer counters include
vehicles, shadows, other city models and post-processing, so they are whole-frame counts.

## Validation — 2026-10-08

- Production build passed; 275 tests across 46 files passed.
- `check.mjs` passed for all three embedded GLBs.
- Medium quality street camera: old models about 1,519 calls / 3.22M triangles;
  mixed models with LOD about 1,525 calls / 4.16M triangles. NPC traffic is live,
  so these are approximate frame samples, not an FPS benchmark.
- Layout: 53 Tree Small, 23 Island, 8 Jacaranda trees; all keep their trunk colliders.
- Browser showed no JavaScript errors during the street run. Existing legacy city
  assets still emit `KHR_materials_pbrSpecularGlossiness` loader warnings.
- Before/after screenshots are saved in this chat's visualization folder.
- Siêu nhẹ also rendered correctly: approximately 777 calls / 2.36M triangles at
  the same street camera, without JavaScript errors.
