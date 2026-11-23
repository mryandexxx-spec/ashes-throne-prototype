# Browser and mobile 3D regression matrix

**As checked in game `main`, 2026-11-23.** Refresh paths and selectors from current code. Run the smallest relevant set plus adjacent tests when the touched system spans multiple surfaces.

| User scenario / failure mode | Existing test / entry point | Required observation |
| --- | --- | --- |
| 5 actual GLBs in squad, one Engine, correct projection into each card, touch remove/re-add, return to another screen, Engine cleanup | `tests/squad-recover-browser.cjs` | Chromium + WebKit 844×390 and 932×430; no overflow or pageerror; engine released on exit |
| Battle re-entry, camera/formation, shared shadows not disposed | `tests/arena-fix-001-reentry-browser.cjs` | 3 consecutive battles in Chromium (844×390), formation positions, shadow material remains valid |
| WebKit simulated iPhone 13: tap into arena with Art, GLB load and re-entry | `tests/art-arena-mobile-browser.cjs` | Real Playwright touch events; battle active; no horizontal overflow; second entry works; **not physical iPhone** |
| Hero 3D dossier, UI and fallback | `tests/hero-card-browser.cjs` | Correct model/portrait, touch interaction, disposal/return; check 844×320 as narrow-height case when relevant |
| Asset integrity, clip list, WebP and model-cache registration | `tests/art-glb-001.test.js` (Art), relevant character tests | Loaded GLB contains expected skeleton, clips, declared extensions, manifest entry |
| Cached transfer/manifest revision/failure mode | `tests/asset-load-001.test.js` | File hashes and bytes match; cache allows only authorized assets; failed load signaled |
| Full user battle return, victory/defeat/restart | Relevant `tests/*browser.cjs` and `tests/full-loop-001.test.js` | No stuck engine, no stale actor references, no unintended combat changes |

## Commands / environment

- Node 22. `npm test` invokes syntax checks and Node tests; the historical full suite can have unrelated outdated test failures, so do not equate "targeted tests green" with "full suite green".
- Browser tests use Playwright; CI uses `.github/workflows/ci-selective.yml` and installs Playwright in a container for selected changes. For local runs, serve repository root via HTTP at `http://127.0.0.1:8765/` unless the test reads a configurable `GAME_ORIGIN`.
- Examples: `node --test tests/asset-load-001.test.js tests/art-glb-001.test.js`; `node tests/squad-recover-browser.cjs`; `node tests/arena-fix-001-reentry-browser.cjs`. These are **instructions**, not claims that they have run for this documentation PR.
- When CI selective only detects documentation changes it should skip WebGL jobs. For runtime PRs verify that its path selector picked the correct browser profile, or manually run an additional relevant test.
- Browser/WebKit simulated iPhone is not real iPhone Safari: report physical acceptance as untested unless explicitly verified on hardware.

## Device acceptance (when runtime/UI changes)

1. **Version gate:** first verify the build version and build code in the game's footer against the PR. If different, investigate Pages rollout/Safari cache instead of testing the wrong build.
2. iPhone Safari landscape (844×390 / 932×430 equivalents), then the shortest supported height; safe-area insets, game canvas and overlays, correct tap/swipe/pinch, text readability and no horizontal scroll.
3. Enter squad, observe 3D loading or portrait fallback, swap heroes and leader, leave and return.
4. Enter battle, select actions/targets, finish victory and defeat as applicable, exit/re-enter battle, re-open hero card.
5. Background/resume Safari and rotate portrait→landscape; verify canvas bounds and orientation prompt, no lost tap target, no restarted duplicate render loops.
6. Repeat on warm asset cache and with throttled/failed network if available. Capture build ID, screenshots, load/fps observations and errors; note every untested item explicitly.

## Test distinctions

**Code written** ≠ **Node passed** ≠ **browser Chromium passed** ≠ **browser WebKit passed** ≠ **physical iPhone Safari passed** ≠ **owner accepted**. In PR notes report each separately.
