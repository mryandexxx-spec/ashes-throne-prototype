# Babylon.js runtime ownership and asset lifecycle — project map

**Source checked:** game `main`, 2026-11-23. This is a *read-and-verify map*, not a guarantee of leak freedom; review the current code again when working.

| Surface | Entry / owner | Load and animation | Exit / cleanup contract |
| --- | --- | --- | --- |
| Battle arena | `game.js` `initBabylon`, `renderBattleFrame`, `startBattleRendering`, `stopBattleRendering` | `RenGlbRuntime`, `NadaGlbRuntime`, `LioraGlbRuntime`, `SavaGlbRuntime`, `ArtGlbRuntime`, `NpcGlbRuntime` in shared Scene | Reuse scene/camera and GPU resources on battle re-entry; dispose per-participant runtimes when removed, stop offscreen frame loop; do not destroy shared shadow material |
| Squad selection | `squad-stage-3d.js` `SquadStage3D` | `ensureLoader` + sequential `ImportMeshAsync`, native idles; one Engine/Scene for up to five | `dispose` on hide: bump epoch, stop/dispose animation groups, model holders, Scene/Engine, disconnect ResizeObserver; late import cleans itself |
| Hero detail | `ren-card-3d.js` `RenCard3D` | Own Engine/Scene only while visible; imported rig and native idle or safe fallback | `dispose` increments loading token, stops render, disposes Scene/Engine and ResizeObserver; portrait remains |
| Model download/cache | `asset-manifest.js`, `AssetLoader`, `model-cache-sw.js` | Manifest SHA revisions, CacheStorage, actual byte progress, service-worker/direct fallback | Storage cache is independent of imported scene/GPU lifetime; deletion/revision changes require manifest validation |

## Known concrete code patterns

### Async import: race-safe disposal
- Squad: `importHero(id,requestEpoch)` checks current epoch, visible screen and Scene before AND after awaits; `clearResult` releases imported results that arrive late. Its `failed`/loading state should not be poisoned by a previous entry.
- Ren/Nada combat: `create(...)` has `disposed`, `instance`, `ready` and cleanup on late fulfillment. `sceneDisposed` supports boolean `isDisposed` in Babylon v9.
- Card: `loadingToken` invalidates async work across screen changes.
- Guard against *all* failed import branches: missing loader, corrupt GLB, no visible geometry, bad bounds, missing clip, disposed Scene. Show fallback, not a blank hero or frozen button.

### Animation: one owner for time
`game.js` calls `BattleAnimation.tick`, reads `BattleAnimation.activity`, and invokes per-model update. `NadaGlbRuntime.sample` stops previous `AnimationGroup`, starts/pauses target then `goToFrame` for the normalized progress, restoring horizontal hips. `RenGlbRuntime` combines sourced choreography/pose sampling. The actual model must be checked for required clips, skeleton names, foot position, facing and action contact point.

### Ownership hazards to test
- `mesh.dispose(false,true)` is used by current squad/model cleanup; it is **not** universally safe when textures or materials are shared. Inspect references and ownership before copying.
- Battle shadow/ground material sharing already has a dedicated regression (`tests/arena-fix-001-reentry-browser.cjs`): three battle entries should not leave shadows as hard squares or silently dispose shared material.
- No separate Engine per fighter in squad or arena. Separate screen-owned Engine is legitimate for dossier but only while visible.
- `model-cache-sw.js` only intercepts manifest-listed same-origin assets; its revisioned cached bytes are not decoded meshes/textures in WebGL. Asset load progress is actual network bytes. Changes to GLB bytes require consistent manifest SHA and size.

## Focused measurements for future PRs

Collect what is accessible *before and after*, with device/browser and scenario labels:
- Asset: file bytes, transferred bytes/time (cold versus cache), SceneLoader readiness duration, retained animations/clips.
- Frame: sampled frame-time in ms (median and worst-case/p95 if measured); CPU versus GPU only when measurable; avoid assigning causes based on FPS alone.
- GPU lifecycle: active `BABYLON.EngineStore.Instances`, scene/mesh/material/texture/skeleton/animation-group counts after first entry, after exit and after repeated entry. Counts can stay stable for deliberately reused arena resources; they should return to baseline for disposed squad/card engines.
- Recovery: navigation during slow GLB import, unavailable CDN/GLB, WebGL failure, tab hidden/resumed, context loss if test environment supports it.
- Screenshot-based quality: facing, foot placement, hero scale and formation slot, idle vs attack without duplicate root motion, tap targets and overlays.

**Interpretation:** size or count changes alone do not demonstrate real device thermal impact or absence of GPU leaks. Distinguish browser automation from physical iPhone Safari.
