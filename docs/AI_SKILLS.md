# Selected AI game-development skills — Ashes Throne

**Status:** [ПРЕДЛОЖЕНИЕ]. Repository instructions for AI coding agents only; no game code or gameplay changes.

Six original skill documents and their references were copied from [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) on 2026-11-23. Licensed Apache-2.0: see [LICENSE](../.agents/skills/LICENSE) and [NOTICE](../.agents/skills/NOTICE). Files were not modified. Do not assume repository skills auto-load in ChatGPT web; a compatible coding agent may discover `.agents/skills/`.

## Skill selection
- `game-ui-ux` — mobile layout, safe areas, touch, screen flows. Check `docs/UI_DESIGN_SYSTEM.md` and `docs/UI_MIGRATION_PLAN.md`.
- `performance-optimization` — measure GLB load/frame time, GPU/CPU, Babylon scene lifecycle and memory before making targeted changes.
- `create-game-assets` — coherent icon families, provenance, independently replaceable assets. Compare art with approved world canon in the private world repository, starting with `WORLD_STATUS.md`.
- `rpg` — analyze existing progression, equipment and battle rules. Its example curves/formulas are NOT adopted.
- `game-feel` — responsiveness, hit feedback, animations; preserve actual turn rules and `prefers-reduced-motion`.
- `save-systems` — audit save/load/rollback/migrations of existing browser storage. Do NOT use Godot file-rename recipes in `localStorage`.

## Mandatory precedence
First read `docs/AI_WORKFLOW.md`, `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, `docs/TECHNICAL_STATUS.md`, latest approved GDD, Combat Specification and relevant current code. Follow approved owner decisions, canonical world source for fiction, existing tests and interfaces. This upstream library supports 12 engines but **does not provide a Babylon.js-specific skill**. Godot/Unity/three.js/Python snippets are concepts, not code to paste into the browser game.

Only read the one or two relevant skills for a task, and their relative `references/` documents when needed. Never automatically change game mechanics, balance, data schema, characters, UI design system or engine dependencies because an upstream skill suggests it.

## Verification for future changes
Use task-specific Node regression tests, Chromium/WebKit at 844×390, 932×430 and 844×320 when UI changes, plus actual iPhone Safari acceptance separately. Check touch, safe-area, no horizontal overflow, victory/defeat/restart and return flows where relevant. For performance provide baseline/after measurements, not visual guesses. For save changes test failed writes, rollback, reload and version handling with the real SaveCore. Follow branch → tests → PR workflow. State separately code changes, automatic tests, browser checks, physical-device checks and owner approval.

This integration adds instructions and licensed text only; no `package.json`, `index.html`, gameplay JavaScript, 3D models or styles are changed.
