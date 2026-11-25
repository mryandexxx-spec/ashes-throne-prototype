# CAM-002-B — глава II «За каменным ребром»
25.11.2026 · **[РЕАЛИЗОВАНО в main — техническая часть]** · [PR #519](https://github.com/mryandexxx-spec/ashes-throne-prototype/pull/519), squash `961d7c2dc17e655114ccbdc2d5b9b5d3c0f266af`, `v0.3.262 · CAM002B`. Owner accepted working direction 0.3 in private draft #81; art, geography, balance and final canon remain open. Do not copy hidden narrative into public GitHub.

## Implemented in main, owner playtest pending
- M1 remains on its existing proof key, ID, reward, encounter and art. II uses independent mission ID `main-cam-002-m1`, versioned proof and first-clear receipt.
- II unlocks after durable M1 victory AND receipt. Map has selectable second node, preserves M1 replay. II briefing and result use short visible text from the working direction; no mandatory dialogue or art placeholder presented as finished.
- II is a real defeat-all encounter with two existing NPC archetypes and new instance IDs; local provisional HP/attack/protection only. No guest Nada. New battle identity captured at entry and attached immutably to battle state; terminal proof rejects wrong/missing ID and inconsistent enemy survival. M1 APIs remain compatible.
- Selection, squad, battle, retry, result and map claim use exact mission ID; II first-clear grant of Nada 1★ goes through existing RewardPolicyCore and writer lock; preserves existing rank/shards; no new currency/XP/material rewards, no third chapter gameplay.
- Locked roster labels point to chapter II. Third chapter is explicitly shown as in preparation, not playable. First Play CTA behavior and OPS/network untouched.
- Candidate version updated in package.json/index.html, script cache keys. CI scope requires First Play and full Node for main-campaign-core changes.

## Verification and limits
- On fetched branch files, syntax compilation in an isolated V8 environment passed; all 8 scenarios in tests/main-campaign-002b.test.js passed in a lightweight mocked Node test harness. Not an actual npm test run, not browser QA.
- Browser script extended to exercise existing M1 plus II real manual victory, access gates, reload before reward, roster grant, repeat, and loss/retry on short landscape; Chromium/WebKit × 844×390, 932×430, 844×320. Final CI [45576519491](https://github.com/mryandexxx-spec/ashes-throne-prototype/actions/runs/45576519491): five applicable jobs green, all six browser combinations passed. Initial short-landscape pin overflow fixed; subsequent variable solo-win failure addressed with test-only seed 7 and actual lineup assertions. Production RNG unchanged.
- No direct git clone in local environment (GitHub DNS unavailable); connected GitHub contents/PR tools worked. No physical iPhone, visual acceptance, measured battle balance or Pages publication.
- SaveCore/game.js inspection found no explicit reset method/removeItem path for campaign proof; dev/debug paths beyond these files not fully audited. Keep proof keys independent; verify clean profile reset if a new reset path exists.
- Applied save-systems and game-ui-ux to existing browser runtime; no foreign engine APIs or new dependencies.

## Resume
1. Verify Pages publication and footer `v0.3.262 · CAM002B`; physical iPhone checklist: fresh Ren+Art, M1 proof and claim, II pin visible on short landscape, II defeat/retry, victory, reload before claiming Nada 1★, replay with three heroes.
2. CAM-002-B-ART: create two reviewable frames for shelter conflict and freed worker, with approved working narrative; no M1 art reuse. Verify screenshot readability and mobile performance. Final balance and novice playtest remain pending; two-tab claim and full debug/reset audit not separately confirmed.
3. Then chapter III separately; no OPS/network expansion or final-canon promotion.
