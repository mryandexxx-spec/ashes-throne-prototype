---
name: ashes-babylonjs
description: >
  Project-specific Babylon.js 9.33.2 practices for the Ashes Throne mobile browser RPG.
  Use for any GLB/model loading or cleanup, arena/squad/hero-card 3D lifecycle,
  skeletal animations, GPU resources, model cache, FPS/thermal optimization,
  iPhone Safari WebGL behavior, or browser 3D regression tests.
  Pair with performance-optimization for profiling or create-game-assets for the source asset pipeline.
---

# Ashes Throne — Babylon.js / mobile WebGL

**Scope:** a development skill, not a new feature or GDD. Based on the code in the game repository's `main` as inspected 2026-11-23. **Before editing, re-read current code**; concrete identifiers and contracts below may change. No game rule, art/canon, dependency, engine or save-schema change is authorized by using this skill.

## Entry checklist

1. Read `docs/AI_WORKFLOW.md`, `docs/PROJECT_STATUS.md`, `docs/TECHNICAL_STATUS.md`, `docs/AI_SKILLS.md`, latest approved GDD / Combat Specification and relevant files in current `main`. TDD 1.0 is historical, not a description of today's runtime.
2. Identify the target surface **before** changing code:
   - **Arena:** `game.js`, `arena-stage-view.js`, `arena-vis-001.js`, `battle-animation.js`, `*-glb-runtime.js`. The arena has an established Engine/Scene and combat animation clock; do not add an actor-owned Engine or independent animation loop.
   - **Squad:** `squad-stage-3d.js`. One disposable Engine/Scene for the whole roster of up to five visible GLBs, sequential imports, <=24 FPS render cap, cleanup when hidden.
   - **Hero dossier:** `ren-card-3d.js`. Separate Engine/Scene while the 3D card is active; dispose on exit; retain portrait fallback.
   - **Assets/cache:** `asset-manifest.js`, `model-cache-client.js` (`AssetLoader`), `model-cache-sw.js`, asset registrations. Network/device cache and decoded GPU objects are **different** layers.
3. Write down ownership: which screen/scene creates the Engine, Scene, imported meshes, skeletons, animation groups, materials/textures, event listeners, and observers; who disposes each; what survives re-entry.
4. Choose a focused change with baseline measurements and a corresponding existing regression test. Do not alter mechanics, battle timing, camera framing or approved visual style as an incidental optimization.

## GLB import and async lifetime

- Use existing `RenGlbRuntime.ensureLoader()` and Babylon `SceneLoader.ImportMeshAsync` conventions; loader is a Babylon 9.33.2 CDN dependency in this project. Use the manifest's existing asset URL/path and model registry; don't invent names or add a second CDN loader.
- Validate the intended scene and model anchors **before** importing. After each awaited loader/import, check whether navigation has changed or the Scene was disposed. Current adapters support boolean-or-method `scene.isDisposed`.
- `squad-stage-3d.js` uses an **epoch/token**: stale imports must dispose their returned meshes/animation groups and must not mark a later screen entry as failed. `ren-card-3d.js` uses a loading token. Combat runtimes use `disposed` flags and dispose late resolved instances. Preserve and test these protections.
- Confirm actual geometry, finite bounds, scale, facing, anchor placement, required clip names and pick metadata **before** hiding the procedural/portrait fallback. Existing examples: `RenGlbRuntime.load` and `NadaGlbRuntime.load`.
- A failed, absent, invalid or slow GLB must not strand the gameplay flow: retain the existing playable procedural fighter or portrait and report the failure. Do not promise that cleanup or cancellation physically aborts network transfer unless the API actually supports it.
- Asset progress in `AssetLoader` is based on downloaded **bytes**, not time estimates. `model-cache-sw.js` caches registered heavy same-origin assets by hash revision; it does **not** cache HTML/JS, third-party URLs, saves, or partial Range responses. Do not bypass its manifest, duplicate downloads or confuse persistent network cache with VRAM residency.

## Cleanup and GPU ownership

- Distinguish **hide/pause**, **remove one actor**, **leave a screen** and **dispose the whole Scene**. Never dispose a shared arena Scene or resource just because a participant model is removed; never keep a disposable squad/card Engine alive offscreen.
- Stop and dispose imported `AnimationGroup` instances before releasing their targets. Dispose the model root/imported meshes, skeletons and imported transform nodes as owned; ensure error branches and late imports clean up too. Use existing cleanup helpers as a guide, not a blind copy.
- `mesh.dispose(false, true)` can recursively dispose material/texture resources; only use it for *exclusively owned* resources. If a mesh shares a material/texture with arena shadows, other models or overlays, do **not** dispose that shared object. Explicitly track ownership before changing cleanup flags. Scene-owned resources can be released on actual Scene teardown.
- Detach/stop relevant render callbacks, observers, UI listeners and timers. The squad disconnects its ResizeObserver and disposes Engine/Scene; the hero card stops its loop and disconnects its observer; arena reuses one render callback and must stop rendering when hidden. Beware listeners registered more than once on battle re-entry.
- Test at least two consecutive entries/exits. Check EngineStore instances, scene counts, mesh/material/texture counts, stuck callbacks and duplicated observers (measure rather than assume they are leaks).

## Animation and combat rules

- Preserve `BattleAnimation` as the source for attack/hit/death activity and normalized progress. Per-character GLB adapters sample the animation groups using `start / pause / goToFrame` from that clock; do **not** start a second combat timer or let idle and action groups fight over the same rig.
- Look up actual clip names from the current model and maps (`CLIPS` / `AnimationProfiles`), not assumptions. `RenGlbRuntime` uses e.g. `Idle_4` and `Double_Combo_Attack`; `NadaGlbRuntime` uses `Idle_11` and `Archery_Shot_3`. Keep validated required clips when optimizing GLB.
- Prevent duplicate root motion: the combat approach/retreat is owned by `BattleAnimation`. Current Nada adapter resets `mixamorig:Hips` horizontal offsets when sampling; Ren has choreography calibration tied to the actual rig. Do not introduce vertical bobbing, sliding or wrong starting facing.
- A model's native idle can run in the roster/dossier, but respect `prefers-reduced-motion`; never combine the native Mixamo clips with an incompatible legacy retarget on the same rig. Keep the animation source and fallback observable/testable.
- Loading or animation polish must not change damage, target selection, action order, combat clock or completion/restart semantics.

## Mobile performance and Safari

- Measure **first load** and **warm-cache/re-entry** separately: GLB bytes/download time, decode/scene readiness, frame-time distribution, memory/resource counts, visible visual quality and battery/thermal observations *if physical device measurements exist*. Do not advertise lower heat or FPS gains without measurements.
- Optimize assets with the existing `tools/optimize-hero-glb.mjs` workflow when relevant; it uses glTF-Transform, WebP texture conversion, resampling/dedup/prune and `KHR_mesh_quantization` while keeping animation clips. Inspect the exact model and approved per-asset settings; do not make its settings a universal standard or silently replace original assets. Validate the optimized GLB with `tests/art-glb-001.test.js` or an equivalent relevant asset contract and real WebGL visual comparison.
- Check render-loop ownership and `ArenaVis001` adaptive resolution. Never fix a slow mobile device by blindly adding another scene, duplicated GLB or more lights/shadows/postprocessing.
- iPhone Safari landscape is the primary platform: verify 844×390, 932×430 and tight 844×320 layouts; safe areas, touch/pinch and cancellation, orientation/visualViewport resize, active vs background tab, return to roster and repeated battle start/end. Arena resize code deliberately waits for settled layout and resets orientation state; preserve that behavior.
- Browser WebKit in Playwright **is not a physical iPhone**. Be explicit about emulation versus device acceptance. `visibilitychange`, WebGL context loss/recovery and tab resume need concrete scenario checks; if not exercised, report as unverified rather than claiming support.

## Verification gate

Pick the relevant test set from [browser regression matrix](references/browser-regressions.md), and follow [runtime ownership map](references/runtime-ownership.md).
For code changes run targeted Node tests + Chromium/WebKit browser scenarios where they apply; CI selective may skip unrelated jobs, so manually request the relevant suite if the selector misses it. Include screenshots/console errors, re-entry and failed-load path. Before PR, record exactly what ran; distinguish static inspection, automated tests, browser emulation, physical iPhone and owner approval.

**Do not:** silently upgrade Babylon.js, replace the browser's static delivery with a bundler, overwrite GDD rules, add magic assets to fix logic, introduce gameplay changes, or claim that a skill makes the app faster by itself.

## MAP-3D specific QA
Mandatory: read [ashes-map3d-qa](../ashes-map3d-qa/SKILL.md) before every map preview/browser test. For isolated map previews use the repository-local Babylon and loader, not the production CDN path described above. Reuse proven runner; separate art import from candidate navigation and mobile acceptance.
