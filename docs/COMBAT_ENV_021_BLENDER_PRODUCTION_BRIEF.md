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

## 14. Pass 005: actual game WebGL integration diagnostic — not yet visible

**[ПРОВЕРЕНО — BUILD PASS, ART НЕ УТВЕРЖДЁН]** [Blender run 42786337831](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42786337831) produced the Pass005 scene.blend, a 3,107,012-byte scene.glb and true clay-default/far PNG. The gap improved, but the near shelf still resembles a flat slab and geology is inadequate. The two sculpt meshes remain unwelded, over-split and not watertight; no mobile optimization.

**[ПРОВЕРЕНО — GAME PREVIEW PARTIAL / ВИЗУАЛЬНО ОТКЛОНЕНО]** Added tests/fixtures/env021-glb-full-game.html: a narrowly scoped glTF 2.0 GLB reader imports the **actual Blender binary** into a real combat Babylon Scene in the older PR branch, turns off ENV017 scenery, and retains the full HUD and six active game fighters. It reflects glTF Z into Babylon's left-handed axis, flips triangle winding, computes normals and marks scenery non-pickable. **This is a temporary QA reader, not a production asset loader.** CI [run 42788577239](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42788577239) produced screenshots at both camera radii: real combat actors and controls were visible; the model did not paint. The old test wrongly marked success merely on mesh count.

**[ПРОВЕРЕНО — ACTIVE BUT STILL NO SCENERY]** Added a separate fast diagnostic workflow .github/workflows/env021-webgl-preview.yml, which reuses the SHA-validated GLB artifact rather than rerunning Blender. [Diagnostic 42789299031](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42789299031) confirmed both candidate mesh bounds are in the view frustum, but neither was in the active mesh list during the initial test. [Diagnostic 42789717166](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42789717166) forced scene.render() after asynchronous injection: both meshes became active and the job passed, **but the actual screenshot was still a flat backdrop without rock**. [Diagnostic 42790031198](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42790031198) confirmed the screenshot was taken after import (visible QA marker), both materials and meshes reported ready with one submesh, and the absent rock remained a genuine rendering defect, not a screenshot timing issue.

**[В РАЗРАБОТКЕ]** Next isolated fixture update uses vivid unlit materials and an independent Babylon cube at camera center to determine whether the defect lies in the imported triangles or the rendering of newly created scene geometry at all. No claim of solved GLB integration. Do not merge this PR into current main; its base still predates the approved ENV022/UIHERO002 work. Build a fresh integration PR from current main only after art and actual WebGL visibility are accepted.

## 15. GLB compacting and actual post-import raster blocker

**[ПРОВЕРЕНО]** Pass005 raw GLB from run 42786337831 has 2 meshes, 108,502 split vertex records, 44,818 triangles and 3,107,012 bytes. A stand-alone pure-Python geometric weld of identical position coordinates (with recomputed normals) yields **23,180 vertices, unchanged 44,818 triangles, bounds and total face area preserved exactly**, and **827,184 bytes** (SHA-256: 3ca5b85eca3c03b350b83892f2743e3ff5f1ee18387fa50cb4ff6e0e100b2174). This is a geometry-only proof, **not a game-ready / watertight mesh**; no final source model has been merged or deployed.

**[ПРОВЕРЕНО — РЕАЛЬНЫЙ РЕНДЕР НЕ РАБОТАЕТ]** Fast WebGL diagnostic [42790031198](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42790031198): after the GLB is imported, both candidate meshes are enabled, in frustum, material-ready, and active in Babylon; visible QA overlay proves screenshot occurs after import. Screenshots still show no terrain. To isolate the issue, the probe added an emissive yellow independent Babylon cube and unlit red/cyan materials to GLB; [42790835240](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42790835240) confirms **yellow cube is visible and imported GLB is not**. Therefore the failure is genuinely inside custom GLB geometry upload/draw, not a global browser/Canvas/scene render issue.

**[НЕ РЕШЕНО]** Probe next welded duplicated Blender positions on the JavaScript side and rebuilt 16-bit indices (23,180 vertices total). [42791312782](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42791312782) passes active-mesh assertions and reports WebGL Uint32 index support, but the actual images still show cube + fighters with absent rock. Thus **UINT32 index size was not the sole cause**. The temporary QA fixture has no right to certify visual integration merely from active meshes, and full game art remains blocked. Do not merge PR or publish scene. Remaining work: inspect actual buffer and submesh draw / GPU error path, solve camera scene geometry drawing, then run an image-pixel gate rather than marker-only DOM assertions; only then refine sculpt and production topology. PR #221 is based on older game code and should not be merged into current main.


## 16. Art Pass 005 — fixed actual WebGL visibility, 2026-11-10

**[РЕАЛИЗОВАНО — QA GLB visibility; ART НЕ УТВЕРЖДЁН]** The working branch `art/env021-blender-production-prep` has been synchronized with current `main` (`7585233324443fa8aae1f656b50a27c1448805e2`) in merge commit `da0c89547fff049c576e1fa9706380f3cc19841d`. The merge preserved all ten ENV021 experimental files and did not modify `main` or merge PR #221.

The failure in sections 14–15 was isolated to the **temporary hand-written GLB importer**, not the Blender export. Strict GPU framebuffer A/B testing showed **zero pixels attributable to either imported terrain mesh** even though both meshes were material-ready, submitted four draws, had valid indices and normals and tens of thousands of nondegenerate triangles. The same framebuffer test detected the Babylon control cube (>1,800 changed pixels). Artificial scale, elevation, color and normal experiments did not solve the custom importer.

**[ПРОВЕРЕНО]** Using the **official Babylon.js 9.33.2 glTF loader** (matched to the pinned runtime engine) in the real full-HUD battle QA fixture made the exact Pass005 GLB visible without modifying the original mesh or gameplay camera. [GitHub WebGL run #42806839216](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42806839216) passed both camera radii under headless Chromium software WebGL:
- radius 12: **126,213 changed pixels**, of which 92,592 were attributable to the near red clay mesh and 32,884 to the far cyan clay mesh;
- radius 19: **95,204 changed pixels**, of which 59,246 were attributable to the near red clay mesh and 35,359 to the far cyan clay mesh.

The native loader's world bounds show the custom importer made an incorrect handedness/scene-root transformation: the terrain appeared on the opposite side of both the X and Z axes compared with the official glTF import. The old custom parser was removed from `tests/fixtures/env021-glb-full-game.html` in favor of the pinned standard loader and a mandatory image-pixel difference gate. This loader runs **only in QA**; it is not added to `index.html`, not published to `main`, and not production-ready GLB asset integration.

**[ЕЩЁ НЕ УТВЕРЖДЕНО]** Art Pass 005 remains a clay sculpt, with an overly slab-like near shelf and unfinished cliff geology. Photogrammetry is not welded, mesh topology is not watertight, UV/PBR and LOD/mobile optimization are incomplete. Before production import, inspect the new real Babylon screenshots, refine and approve the composition, repair and optimize the meshes, measure load/draw/performance cost and test on physical iPhone Safari. PR #221 remains Draft and must not be merged without the owner's explicit approval. Any earlier assertion that the branch still lacks the newer `main` is superseded by the synchronization above.

**[ПРОВЕРЕНО ПОСЛЕ УДАЛЕНИЯ РУЧНОГО ИМПОРТЁРА]** Clean native-only fixture in commit `35fa5f6799edb070a7869bded1ee385c83456b1a` passed [fast WebGL raster CI #42807245072](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42807245072), [full Blender export + full-game preview #42807244846](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42807244846), and [combat regression #42807245255](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42807245255). These are CI/software-WebGL checks, not physical iPhone Safari or artistic acceptance.


## 17. Art Pass 006 — composition correction for real Babylon camera (2026-11-10)

**[ПРОВЕРЕНО — ART ЕЩЁ НЕ УТВЕРЖДЁН]** Inspection of actual `clay-default/far.png` and `webgl-12/19.png` from [Pass005 Blender run #42807244846](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42807244846) revealed a major mismatch. The *native Babylon* game camera renders Pass005 with the near cliff occupying the **right** of frame and the opposite wall on the **left**, opposite the earlier Blender reference-camera composition. The actual game image reads as a flat red playing slab and a turquoise block; the physical chasm is narrow and poorly legible. Therefore the prior Blender camera is not a valid art-approval substitute even though the GLB raster gate passes.

**[РЕАЛИЗОВАНО В DRAFT PR]** `tools/env021-art-pass-006.py` preserves Pass005 and introduces a new, deliberately unapproved iteration. The sculpt's X/Y authoring basis is rotated 180 degrees to compensate for the validated native glTF scene-root orientation; the Blender reference camera is reversed for Pass006 accordingly. Changes to the near landmass outside the fighter footprint add irregular outer erosion, broad stratified cliff relief and narrow runoff gullies, without adding loose props. `tools/env021-blender-pipeline.py` supports reproducible `sculpt6` export using Blender 4.0.2 and CPU Cycles. The real game itself, published ENV022 backdrop, fighter logic and camera are not changed.

**[ПРОВЕРЕНО]** [Pass006 Blender + actual WebGL run #42809428678](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42809428678) built a two-mesh GLB (3,116,448 bytes), clay PNG at both radii, and full-HUD native Babylon GLB previews at radii 12/19; each stage passed. Actual reviewed screenshots now place the near red shelf **on the left** and cyan far wall **on the right**, while all fighters remain on the shelf. [Combat regression #42809428670](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42809428670) and independent fast Pass005 GLB diagnostic #42809428625 passed. Native game-camera orientation mismatch is corrected for this art iteration, **not** accepted as finished geology.

**[АРТ-КРИТИКА]** The actual Pass006 WebGL diagnostic image still shows a broad, smooth, monolithic top. Unlit red/cyan clay is helpful for raster verification but hides actual rock relief. The following CI update introduces a **neutral lit art-review mode** for two real-camera HUD screenshots, while retaining the colored A/B pixel validation as a separate technical gate. Never infer rock quality from the high-contrast diagnostic colors alone. Await inspection of the neutral-lit images before choosing further sculpt or topology/UV/bake work. Pass006 remains `ART_PASS_006_UNREVIEWED` in the manifest.

**[ОСТАЁТСЯ]** Photogrammetry and near shelf are joined but not watertight/welded; source-license manifest, UV, texture bake, LOD and mobile performance are incomplete. There is no deployment or real iPhone Safari verification. PR #221 stays Draft, no merge without owner authorization.


**[ПРОВЕРЕНО — НЕЙТРАЛЬНЫЙ ИГРОВОЙ РЕНДЕР]** [Full Blender/GLB/WebGL art-review #42809903922](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42809903922) passed all export, real Babylon and neutral-lit 844×390 screenshot steps; [Node regression #42809903976](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42809903976) and [independent GLB raster regression #42809903905](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42809903905) passed. The artifact includes `art-review-12.png`, `art-review-19.png` alongside original neutral Cycles previews and color diagnostic screenshots. Both actual neutral-lit images were inspected.

**[АРТ-КРИТИКА ПО ФАКТИЧЕСКИМ PNG, PASS006 НЕ ПРИНЯТ]** Camera orientation and continuity of the walkable fighter shelf are materially better. However, the near mass still fills most of the screen as a pale continuous, very broad plateau, rather than an eroded narrow shelf above an abyss. Sculpted erosion mainly affects the outermost left silhouette; it does not create readable bedrock structure near the rim, while the opposing bank is a smooth detached wall/block with limited depth cues. The void is still a vertical strip, especially at radius 12, rather than a vast open gorge. Neither neutral-lit camera image qualifies as art approval. Distinct far-haze, layered silhouettes and readable cliff fracture hierarchy are needed *before* mobile topology, PBR or UV work.

**[РЕКОМЕНДАЦИЯ / НЕ КАНОН]** Next isolated Pass007 should prioritize camera-readable composition and geological silhouette, not more high-frequency mesh noise: reshape the near playing shelf beyond six fighter bases without reducing their unobstructed footprint, make the rim more discontinuous, expose chasm air/background, create a recessed stepped opposite bank with lower contrast and a distance cue. Keep the native-loader neutral-lit and colored A/B WebGL gates in the workflow. Never deploy or merge without a new visually acceptable preview and owner review.

## 18. Art Pass 007 — silhouette-first proposal (2026-11-10)

**[В РАЗРАБОТКЕ — NOT ART APPROVED]** After reviewing the real neutral-lit Pass006 images, a separate `tools/env021-art-pass-007.py` was added to the existing Draft PR #221. Unlike high-frequency noise polish, this iteration reduces the near landward shelf extent (left side roughly -8.1 to -5.7 in sculpt coordinates), pulls the broken rim toward the protected six-fighter footprint (mean ~5.15 to ~4.35), adds three asymmetric large recessed bays, and introduces directional stepped cliff strata and runoff channels. The opposing bank is moved back (~18.5 to ~21 local units) and shaped with larger, irregular upper ridge and more strongly tiered face, preserving the empty air gap.

The six established fighter reference slots (s=±2.45, a=-1.9/0/1.9) are protected by a procedural assertion checking horizontal margin and near-flatness on the standing footprint. It is an authoring geometry safeguard, **not** proof of touch-target functionality or good composition. `tools/env021-blender-pipeline.py` now exposes `sculpt7` and native-glTF-oriented Cycles views; `.github/workflows/env021-blender.yml` builds and previews it in both real game camera radii, including neutral lit WebGL. Pass005/006 scripts are retained for comparison.

**[ПРОВЕРЕНО ЧАСТИЧНО]** [Node combat regression #42811099262](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42811099262) and [fast pinned old-GLB diagnostic #42811099230](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42811099230) succeeded. Important: the fast diagnostic reuses an older GLB and **does not prove Pass007**. [Full sculpt7 Blender export and new WebGL cameras #42811099240](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42811099240) must pass and its actual PNG images must be inspected before the art proposal is accepted. The run was still in Blender installation at the time of this note; do not label it verified until confirmed.

**[ОСТАЁТСЯ]** Neutral-lit visual art critique at 844×390 radii 12/19, real fighting footprint visual check, sculpt topology/CC0 scan welding, UV, PBR, LOD, mobile memory/time measurements, physical iPhone Safari and owner sign-off. PR #221 must remain Draft; no main or world canon change.


### Pass007 verified export and neutral-lit art review

**[ПРОВЕРЕНО — BUILD / WEBGL PASS, ART НЕ ПРИНЯТ]** The first Pass007 [run #42811525742](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42811525742) successfully generated the new Blender 4.0.2 source, two Cycles PNGs and a 3,135,552-byte scene.glb with two sculpt meshes, but its CI workflow failed **after successful WebGL pixel rendering** because the QA fixture classified any `pass` query except `006` as `005`. This was a test identity mismatch, not a geometry or GPU failure. In `tests/fixtures/env021-glb-full-game.html`, passing `pass=007` is now explicitly supported.

**[ПРОВЕРЕНО — ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ]** Full fresh Blender → GLB → real Babylon WebGL run [#42811983680](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42811983680) succeeded, including both colored raster assertions and neutral-lit 844×390 full-HUD camera screenshots at radius 12 and 19. Artifacts: `env021-blender-42811983680` (source.blend, scene.glb, manifest, clay-default/far.png, webgl-12/19.png, art-review-12/19.png). [Combat regression #42811983477](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42811983477) and [legacy pinned GLB diagnostic #42811983486](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42811983486) passed; remember the latter reuses Pass005, not the new shape.

**[ХУДОЖЕСТВЕННАЯ ОЦЕНКА ПО РЕАЛЬНЫМ PNG]** Compared with Pass006, the near playing shelf now occupies materially less horizontal space, the opposite bank is separated by more visible background/chasm, and both teams and full HUD remain legible in the live-game test. This is a genuine composition improvement. However, the player's standing area is still a large smooth continuous pale slab; fractures are mainly visible on cliff sides and not as a natural erosion pattern of the surrounding terrain. The opposing wall still reads as an extruded boxy/scalloped curtain, lacking multiple depth-separated geological formations and atmospherically recessed layers. The screenshot does not yet communicate a convincing vast open gorge. **Pass007 remains ART NOT APPROVED and cannot go to main.**

**[СЛЕДУЮЩИЙ GATE — ПРЕДЛОЖЕНИЕ]** Do not polish textures on this morphology. Iterate a more natural set of separated rock masses / distant ridge silhouette while preserving fighters' safe standing zones, then review neutral-lit gameplay screenshots before selecting a final sculpt. After art acceptance, fix non-watertight topology and actual CC0 scan integration, UV/bake, LOD and mobile performance. No iPhone Safari test or owner acceptance is claimed.


## 19. Art Pass 008 — three separated rock shoulders and revised camera placement (2026-11-10)

**[ПРОВЕРЕНО — ТЕХНИЧЕСКИ УСПЕШНО / ART НЕ ПРИНЯТ]** Pass007 neutral-lit review demonstrated that a single far cliff remained an extruded curtain. New `tools/env021-art-pass-008.py` preserves the six fighter-safe standing positions and the existing near shelf, and replaces the continuous far bank with three geographically separated, irregularly eroded distant rock shoulders of staggered heights and scene-space depths. These disconnected surfaces intentionally share one Blender mesh object so the narrow two-mesh GLB QA fixture keeps working. This is still an experimental clay composition, not topologically connected geometry or mobile-ready art.

`tools/env021-blender-pipeline.py` now supports `sculpt8` with native-glTF camera reference and CPU Cycles; the Blender GitHub Actions workflow builds this pass and captures **actual** Babylon WebGL renders at camera radii 12 and 19, both unlit raster checks and neutral-lit art-review screens. The test fixture recognises `pass=008`. Existing Pass005–007 authoring scripts are preserved for comparison. No live gameplay source, fighter logic or published ENV022 scenery was changed.

**First visual test:** [Blender/WebGL #42817220026](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42817220026) passed and exported two meshes (3,196,708 bytes). Actual game and Cycles images showed that nearly all three far shoulders were beyond the right border at the default radius, leaving excessive empty gray backdrop; the near platform still read as a pale slab. This variant is **art rejected**, despite green technical CI.

**Revised visual test:** Brought the three far shoulders from nominal sculpt depths 20/24.2/29 to 13.8/16.4/20, raised their crests modestly, and strengthened broad erosion on the *outer* near shelf beyond the six fighter positions. [Fresh full Blender/GLB/Babylon CI #42817767600](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42817767600) **passed** with source.blend, scene.glb (3,187,216 bytes), both 844×390 Cycles screenshots, both full-game colored WebGL screenshots and both neutral-lit art-review screenshots. [Node combat regression #42817767945](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42817767945) and [pinned old-GLB diagnostic #42817767659](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/42817767659) also passed. The latter still reuses the earlier Pass005 GLB and is not independent Pass008 geometric evidence.

**[ХУДОЖЕСТВЕННЫЙ ВЕРДИКТ ПО РЕАЛЬНЫМ PNG]** The corrected shoulders are now visible on the right at both camera radii; distinct front/behind rock crests and a larger empty chasm area appear. Eroded cuts on the near-left boundary have become much more readable. Yet the foreground central fighting zone is still a broad, flat-looking cream plateau, the opposing formations resemble separate staged rock pieces instead of a continuous geological landscape, and atmospheric depth is largely absent. This is an improvement relative to the first Pass008 render, **not** artistic acceptance or proof of a convincing finished abyss.

**[РИСКИ / ОСТАЁТСЯ]** The near object contains an unwelded CC0 rock scan and non-manifold duplicated seams; far shoulders are open 2.5D surfaces and not closed watertight volumes. There is no final color/material hierarchy, bake, UV/LOD, verified mobile device resource budget, actual iPhone Safari test, or deployment. Keep ENV022 in production. Further art work should strengthen large-scale geological coherence and naturally eroded ledge-to-wall transitions before texture/LOD optimization; owner acceptance and PR merge are separate gates.
