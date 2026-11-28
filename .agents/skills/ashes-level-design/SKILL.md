---
name: ashes-level-design
description: Project-specific workflow for compact traversable Ashes Throne 3D campaign locations, navigation, scene authoring, visual and gameplay acceptance.
---
# Ashes Throne level design (research draft)
Status [ПРЕДЛОЖЕНИЕ]; does not approve any mechanic, art style, lore or economy.
Read MAP_3D_PLAN.md, MAP_3D_01_RESEARCH.md, current status, actual code and relevant approved world CURRENT first. Pair with ashes-babylonjs; performance-optimization for benchmarks; create-game-assets for provenance. Use existing campaign proof/receipt contracts rather than a new reward system.
## Method
1. Define player question, meaningful branch tradeoff, objective visibility, optional discovery and short return. Draw a blockout before detail. A branch that only adds walking is not meaningful. Test with novice without explanatory wall of text; inspect time to first meaningful choice and battle, wrong taps, backtracking, frustration.
2. Establish working player metrics (capsule/eye height, speed, approach, camera screen occupancy, ramp/slope/clearance). These are lab settings, not adopted balance. No jumps, free-action combat or joystick by default.
3. Author terrain in editable source. Separate ART, NAV, MARKERS; stable semantic IDs independent of scene object order and location. Export RH Y-up meters, validate transforms and winding, never derive all walkability from high-poly decorative art. Track source and generated outputs. Prefer prebaked nav data matched by version/hash; reject partial paths and illegal snaps. Avoid new editor/runtime engine unless evidence warrants it.
4. Iterate visible composition, silhouettes, landmarks, camera framing and occlusion, safe-area touch targets and routes. Art assets must suit approved canon and have individual license/source/hash. A pretty screenshot is not an interactive acceptance; no external game art in production.
5. Check path to each relevant marker; alternate branches, height, blocked destination, reconnect, replan and disposal. Test real tap on Chromium/WebKit; actual pinch and physical iPhone separate. Measure cold/warm transfer, frame times, memory; engine count is not heap proof. Capture rendered frames and review visually; green CI alone not sufficient.
6. Only after blockout pass produce modular art, import optimized GLBs, test performance and navigation parity. Separate character animation ownership and root motion from navigation. Update existing progression only after idempotent mission handoff/return and reload tests. Preserve current campaign until replacement passes.
## Evidence / sources
Project-owned adaptation, not copied external skill code. Read upstream [level-design](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/level-design/SKILL.md) for concepts; upstream [Apache-2.0](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/LICENSE) and NOTICE if ever vendoring. No Godot/Unity editor snippets, procedural generation, paid plugins or CLI installations implied. Game Development Studio plugin skills reviewed for provenance and visual evidence; local game-dev CLI not available in research environment. Project contract prevails.

## Required map QA
Read [ashes-map3d-qa](../ashes-map3d-qa/SKILL.md) before any map art/navigation/browser test. Exact candidate hash and matching NAV required; use shared runner, do not restart failed environment research.
