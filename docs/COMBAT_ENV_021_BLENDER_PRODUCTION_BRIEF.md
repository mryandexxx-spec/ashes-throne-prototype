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


## 7. Production progress update — 2026-11-10

- **[РЕАЛИЗОВАНО / ПРОВЕРЕНО]** GitHub Actions now installs Blender 4.0.2 on Ubuntu with Mesa EGL, Xvfb and NumPy. [Verified run 42761543909](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42761543909) completed successfully: actual Blender execution and GLB/PNG/.blend artifact generation. This was a **primitive pipeline smoke test**, not artwork.
- **[В РАЗРАБОТКЕ]** The PR now contains `tools/env021-build-geology.py`, which authors one closed, substantial cliff-and-shelf volume using Blender and fuses a real CC0 photogrammetry rock through Blender's voxel remesher. The script's source is an **exact pinned GitHub commit** (`ec9775db9e89348546c567b18bc625ea6f0b78de`) from rejected art experiment PR #208, file `assets/env021/PolyCliff01.glb`; provenance is Poly Haven Coastal Cliff 02 CC0. That prior experiment was **art-rejected**; only its verified source geometry is reused.
- **[ЕЩЁ НЕ ПРОВЕРЕНО]** Successful CI run of the new geological sculpt, visual silhouette quality, actual game camera and HUD, production PBR/LOD/mobile performance, runtime import. The Blender sculpt is a clay WIP; it must not be presented as final art.
- Output `scene.glb` is a *source prototype artifact in Actions*, not an in-game asset. Do not claim main contains it or deploy it.
- The GitHub Actions runner resolves the earlier Blender access blocker, but does not make Blender available in the assistant's container.


## 8. Art Pass 001 rejected after actual Blender image review

**[ПРОВЕРЕНО, ХУДОЖЕСТВЕННО ОТКЛОНЕНО]** [Blender Actions run #42762179833](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42762179833) produced a real source blend (6 MB), GLB (7.5 MB / 110382 triangles), and two 844×390 clay renders. Actual PNGs were downloaded and inspected. A coarse rock wall fills almost the entire frame at both camera radii; neither walkable shelf, open abyss nor distant bank reads. This is a failed composition and must not be integrated in Babylon.

## 9. Art Pass 002 corrective modeling

**[В РАЗРАБОТКЕ]** New Python script tools/env021-art-pass-002.py uses Babylon fighter positions as scale reference; reduces the near landmass, shapes continuous broken descending cliff, adds a genuinely separate asymmetrical distant opposite bank, and restrains source Poly Haven CC0 relief to a small fused section. The GLB export excludes REF_ fighter size/reference markers; clay preview retains them to judge scale. Blender preview camera now matches Babylon vertical FOV .8 radians.

Acceptance gates: first verify the actual new Blender Actions run and inspect screenshots. A usable 844×390 composition must show the combat shelf, abyss edge and open void, and an opposing bank. Check at both radius 12/19. Then evaluate inside real Babylon with combat HUD, followed by Safari testing. The temporary ENV022 background remains in the live game until the model passes art review. No canon changes.


## 10. Art Pass 002 crash and isolation

**[ОШИБКА ВЫЯВЛЕНА]** [Run 42773067390](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42773067390) passed node checks but Blender 4.0.2 crashed with exit code 139 (segmentation fault) before output screenshots. No Art Pass 002 model was successfully rendered or exported in this run.

The follow-up isolates the riskiest mesh-fusion stage: voxel remesh and decimate are temporarily disabled in tools/env021-art-pass-002.py, while the CC0 scan remains one Blender object with the near shelf but is **not topologically welded**. Debug progress markers are emitted before each modeling stage to pinpoint any remaining crash. This is an art-composition render pass only, not mobile-ready geometry. After the silhouette is evaluated, real topology repair, scan fusion, UV/baking and LOD remain required.


## 11. Art Pass 002 actual screenshots / critique, 2026-11-10

**[ПРОВЕРЕНО, ХУДОЖЕСТВЕННО ОТКЛОНЕНО]** [successful Blender run #42774054527](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42774054527) produced source.blend, scene.glb (1,267,268 bytes), clay-default.png, and clay-far.png. Both PNGs were downloaded and visually inspected. Actual mesh has two exported meshes; fighter markers are visible only in the Blender PNG, not in exported scene.glb.

- Unlike Art Pass 001 six fighter markers and the rock ledge are visible; the far bank is separate. However, the foreground rock reads as an oversized flat runway with an unrealistically regular edge. Chasm reads only as a narrow dark band along the right side; the distant bank looks like an angular block. This still does **not** meet target art direction.
- **[В РАЗРАБОТКЕ]** tools/env021-art-pass-003.py reduces shelf width from ~23 to ~14 units around the fixed fighter positions, pushes the broken rim closer to the rightmost enemy reference, brings distant bank closer while retaining empty chasm, and introduces broad terrain and cliff-face weathering. Sculpt remains clay WIP without topological fusion/texture baking.
- Do not bake final textures, merge PR into main, or integrate GLB in Babylon until a genuinely accepted clay silhouette has been reviewed at both camera radii.

## 12. Art Pass 003: verified render; fourth sculpture in progress

**[ПРОВЕРЕНО — ТЕХНИЧЕСКИЙ PASS, АРТ ОТКЛОНЁН]** GitHub Blender Actions [#42777677544](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42777677544) succeeded in CPU Cycles; examined both actual 844×390 clay-default and clay-far PNGs, source.blend, and scene.glb (1,290,884 bytes; 2 meshes, geometry-only markers excluded). The fighting formation fits and a distinct opposing face is visible, but the shelf is still an overly flat continuous gray slab, cliff faces are smooth and the void is not a convincing geological chasm. Avoid false art acceptance.

**[В РАЗРАБОТКЕ]** Art Pass 004 at tools/env021-art-pass-004.py introduces broad landward uplift beyond the fighting footprint, nonstraight rim with erosion recesses, higher-density stratified descending gorge face, and a broken opposing ridge with less regular top. Sculpt is deliberately still clay, temporary licensed scan is unwelded, no final PBR, LOD or in-game import. Evaluate new true Blender renders before changing anything in live Babylon. Keep ENV022 working as currently accepted.

## 13. Pass 004 visual verdict and Pass 005 intervention (2026-11-10)

**[ПРОВЕРЕНО / АРТ ОТКЛОНЁН]** [Blender run 42779216220](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42779216220) completed. Actual downloaded `clay-default.png`, `clay-far.png` and GLB reviewed. Both angles are valid Cycles clay previews, but the left slope dominates the camera and an overscaled, almost planar far cliff intrudes from the right, making the gap look like a narrow corridor rather than a deep open abyss. Do not transfer to runtime.

- GLB: **2 sculpt meshes**, 2,919,348 bytes, manifest mode `ART_PASS_004_UNREVIEWED`. Independent mesh inspection with Trimesh: near 82,128 vertices / 34,294 triangles; far 20,565 vertices / 6,860 triangles. **Neither is watertight.** In particular, the photogrammetry relief is joined but not topologically fused. The export is an inspectable clay proposal only.
- **[В РАЗРАБОТКЕ]** New `tools/env021-art-pass-005.py` reduces landward uplift (~2.8 to ~0.95), shortens the left-side intrusion, opens up the chasm by placing the far bank from ~14 to ~18.5 scene units beyond the cliff, lowers and narrows its skyline and irregularizes large rim curves with localized cuts. Do not mistake these numeric adjustments for art acceptance: they must be evaluated in the actual render.
- CPU Cycles is now configured for **both** default and far views (previously far for Pass 004 could fall through to Workbench). See [Pass 005 Blender run 42786171644](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42786171644). Until its images have been inspected, Pass 005 is not reviewed.
- After acceptable composition: repair/connect near surface geometry and scan, UV/bake and make low-poly/LOD derivatives; then Babylon WebGL with full HUD, then on-device Safari. The already accepted ENV022 2D backdrop remains active in `main` throughout.
