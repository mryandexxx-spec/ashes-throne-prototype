# ENV021 — Blender-authored coherent canyon: production brief

**Status:** [ПРЕДЛОЖЕНИЕ / ПОДГОТОВКА], 2026-11-10. No Blender geometry, tested export, or accepted art is claimed in this document. **Do not merge as an arena implementation.**

## 1. Baseline and objective

- Base: `main` commit `1a359c1460903b44340704d0aa90231e722d3929`, version 0.3.89. The existing ENV017/ENV010 scene remains untouched.
- Previously rejected: ENV013–016, ENV018/019/020. Passing Node/WebGL tests did not imply art acceptance.
- Goal: a visually **single, geological landmass** with a natural combat shelf; very deep empty gorge opening toward screen-right, distant asymmetric opposite bank, no compulsory visible bottom or water.
- **Lore boundaries:** experimental arena is not a mapped part of Gardens over the Abyss. Consult private `WORLD_STATUS.md` and `regions/gardens-over-abyss/CURRENT.md`; do not assert rock type, river, settlement, ancient architecture, climate or new geography as canonical.
- Keep the camera and fighter positions defined by the game, and evaluate in the actual full HUD (844×390) at `radius=12` and `radius=19`, plus pinch limit 21. Do not modify combat/UI/HQ/roster.

## 2. Authored-form workflow (not a procedural mesh rework)

1. Export a read-only reference of the actual game camera, fighter foot points, combat boundaries and HUD masks. Place these as locked references in the Blender working scene; do not approximate them from a pretty render.
2. Sculpt **one primary continuous landward volume and shelf**; the shelf is a local erosion/structural ledge, not an oval floating slab. The apparent screen-left wall must remain subordinate to the readable right-hand void.
3. Sculpt a geologically coherent and distant opposite wall with a different outline and depth; keep it disconnected across the chasm, not fused to the fighting ledge.
4. Select photo-scanned source meshes for **material and selected surface relief**, not independent rock stacks. Adapt geometry and eliminate visible transitions. Preserve directional strata, major fracture families, runoff and talus relationships. No noise/shards used to rescue a bad silhouette.
5. Review gray/clay renders **before textures** at game camera normal/far and full HUD. Any left wing, cave ceiling, enormous ramp, polygonal curtain, or unclear emptiness is an art failure and is not fixed by extra textures.
6. Author UVs and bake high-detail surface information to a low-/medium-poly LOD (albedo, normal, ORM/roughness as actually supported). Export a single documented GLB with separate semantic near / mid / far meshes if required for materials and culling. “Visually one” does not demand one object or one material.
7. Load via Babylon-compatible glTF loader. Note that `combat-environment-010.js` uses a **restricted custom GLB reader**; arbitrary sourced GLB/Blender exports MUST NOT be assumed compatible with it. Choose and verify the actual loader contract before runtime integration.
8. Keep all scenic meshes non-pickable/non-colliding, scene-owned and disposed on lifecycle exit. Ensure fallback on failed asset fetch. Compare before/after with genuine WebGL markers, no stale fixture.

## 3. Verified candidate inputs (NOT DOWNLOADED / NOT INTEGRATED)

| Candidate | Intended role | Source, rights | Caution |
|---|---|---|---|
| Poly Haven Namaqualand Cliff 02 | Potential cliff scan; evaluate geology and usable surface first | https://polyhaven.com/models/nature/rocks-stone ; site CC0 https://polyhaven.com/license | Individual source model and download format need explicit inspection |
| Poly Haven Rock Moss Set 02 | Sparse small fragments/talus only, not primary chasm form | https://polyhaven.com/a/rock_moss_set_02 ; CC0 | Moss and 58K-triangle scan must be reduced and should not dictate region climate |
| Poly Haven Rock Face | PBR reference / potential baked cliff material | https://polyhaven.com/a/rock_face ; CC0 | Texturing cannot conceal unconvincing geometry |
| ambientCG Rock063 | Existing CC0 rock material already used in ENV010 | https://ambientcg.com/view?id=Rock063 ; https://docs.ambientcg.com/license/ | Existing 512px maps may not be sufficient for near shelf; test scale |
 
**Asset provenance:** Before use, record exact asset URL, downloadable file variant, license, author if known, size, number of triangles, texture channels, SHA-256 and redistribution decision. No external files were downloaded in this preparation stage. CC0 allows commercial use, but does not replace individual quality checks.

## 4. Art acceptance gates

- **Gate 0 — Blocker:** a working Blender executable and the chosen source asset bytes must actually be available. This assistant's execution container currently has neither; official Blender Linux binary download failed because outbound DNS/network access is unavailable. Do NOT claim to have modeled with Blender.
- **Gate 1 — Shape:** show gray shaded Blender view **and genuine game Babylon WebGL screenshots** at radii 12 and 19, full HUD at 844×390, with screenshots visibly tied to the candidate build ID.
- **Gate 2 — Surface:** inspect large-scale stratification, sculpt continuity, seam concealment, normal directions, UV stretching and scale of sourced relief.
- **Gate 3 — Functional:** verify no interference with target selection, single-touch gestures, pinch 12–21, auto/manual actions, battle completion, restart, renderer ownership and resource disposal. Run `npm test` and Chromium WebGL test. Browser screenshots do not count as actual iPhone tests.
- **Gate 4 — Mobile:** owner review on physical iPhone Safari (landscape, safe area, load time, frame pacing, heat and repeated fights). Numeric budgets are to be measured, not invented.
- **Gate 5 — Approval:** only owner can accept art and approve merging the specific PR.

## 5. Repository handling

- `assets/env021/` will contain **only optimized game-ready licensed derivatives** after successful production, not raw multi-GB scans.
- Blender source, sources/license manifest, reproducible export procedure and screenshot evidence will be kept distinct from runtime code.
- First artifact to review is a real **clay silhouette**; do not batch many unapproved rock variants. One authored candidate, one objective art critique.
- The private worldbuilding repository is read-only for ENV021. No canon changes.

## 6. Known execution gap on 2026-11-10

`blender` is not installed in this tool container. Attempted official 4.5.15 Linux x64 download failed; outbound DNS resolution unavailable. Source 3D files cannot be fetched in this runtime. This preparatory PR is **not a completed Blender scene**. Resume modeling only when a capable Blender execution environment and source files are accessible; do not replace the missing sculpt with a purely scripted polygon ribbon.
