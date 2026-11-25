# AUD003-B15.2A — Ren/Nada real-core validation

25.11.2026 · **[В РАЗРАБОТКЕ / ПРЕДЛОЖЕНИЕ]**. First experimental slice of B15.2, not a balance approval or change to production. Reference: [B15.1](AUD003_B15_HERO_KITS_COMBAT_2.0.md), [B14.6](AUD003_B14_6_INTERACTIVE_LAB.md), base main 7a421b8213075cab3c98cf32689a4cfb64fc332a.

## Method and evidence
- Exact real CombatCore and real stat bridge, B14.6 visible-threat adapter. Same-pressure reference B14.6, NOT live production. In-memory patch with exact once-only anchors; unchanged production files. Art/Liora/Sava and enemy rules remain B14.6, not B15.1 full kits. No reward or save writes.
- 4320 battles, 9 squads, rush/mixed, 20 matched seeds per cell, early L2/skill L1/1★ versus trained L12/skill L6/1★. Pressure .90/.72 early, 1.12/.90 trained. 1680 independent-seed refinement battles, six squads, same per-tier pressure. Separate seed streams. Full matrix and source blob provenance: [initial](research/aud003-b15-2a-results.json), [refinement](research/aud003-b15-2a-refine-results.json). Reproduce: `node docs/research/aud003-b15-2a-read-move.js 20` or append `refine`. Executed in V8 against exact fetched source; Node CI targeted tests separate.
- W = victory, Q = victory without fallen allies (NOT campaign stars), pool = remaining HP+Protection divided by initial maxima, predicted = read-move-predicted events per battle (NOT prevented attacks or unique decisions). Counts include automated turns; damage events not measured as meaningful choices. Each battle completed within 160 player commands, no invalid/NaN detected by lab validation. This is 6000 completed experimental runs, excluding preliminary smoke and contracts.
- Real-core controlled fixture (checks disabled for deterministic comparison): Ren powerful 40 unmarked vs 53 with 4 stacks; fixture striker basic 26 vs 29, no-share 26; enemy powerful 34 vs 24 with four marks, spends three, one remains, CD3 in both, action not denied. Direct controlled tests and smoke in tests/aud003-b15-2a-read-move.test.js. Ten definition/state contracts and one refinement definition check; not complete battle regression.

## Results
Initial matrix rush, 180 battles per cell, nine squads:

| tier | variant | W | Q | mean pool | predicted/battle |
|---|---|---:|---:|---:|---:|
| early | B14.6 |173|103|.555|.689|
| early | B15 |170|97|.532|.717|
| early | B15 no sharing |162|95|.515|.722|
| early | B15 three-stack low damage CD3 |166|98|.523|.811|
| early | B15 Ren 12% per stack |170|97|.532|.717|
| early | B15 basic-only |158|23|.430|.033|
| trained | B14.6 |180|119|.699|1.350|
| trained | B15 |179|115|.640|.589|
| trained | B15 no sharing |179|115|.631|.528|
| trained | B15 three-stack low damage CD3 |179|112|.629|.922|
| trained | B15 Ren 12% per stack |179|115|.640|.589|
| trained | B15 basic-only |168|87|.551|.022|

Independent refinement rush, 120 battles per cell (different squad subset; compare only within table):

| tier | variant | W | Q | mean pool | predicted/battle |
|---|---|---:|---:|---:|---:|
| early | B14.6 |116|64|.500|1.050|
| early | B15 |113|54|.469|1.083|
| trained | B14.6 |120|76|.685|2.058|
| trained | B15 |119|71|.596|.917|
| trained | B15 low damage three stacks CD3 |119|69|.594|1.367|
| trained | B15 three stacks from skill L5/CD2 |119|71|.603|.958|
| trained | B15 two stacks/CD1 from L5 |119|71|.596|.975|

Mixed is at ceiling: initial all tactical cells 180/180 W/Q; basic-only already 180/180 W and 178–180 Q. Do NOT use mixed to claim tactical depth. In early rush Ren/Art 14/20 W 6/20 Q under B15 (B14 16/7), Ren/Art/Nada 20/19, Ren/Liora/Nada 20/12, Ren/Art/Sava 20/19, striker/Art/Nada 20/12, striker/Art/Sava 20/18, striker/medic/breaker 20/11, Art/Nada/Sava 19/0, Liora/Nada/Sava 17/0. Independent holdout reproduces support-only casualty problem. No mandatory Ren: striker alternatives plausible, but fixtures not playable heroes and full B15 roles not implemented.

## Decision for next research iteration (not owner-approved balance)
1. **Do not accept B15 Ren/Nada numerical package wholesale.** B14.6 remains control. Keep native read-move contract (up to 4 marks, 3 consumed, dangerous action mitigated rather than denied), Ren L4 slow, special Ren synergy, region passives direction and optional teammate benefit. Exact values TBD.
2. Team sharing +10% on primary direct root is the better *candidate* than 0 on first matrix; effect not uniform, compare B14 +12% scope separately. 12% Ren per stack did not rescue aggregate performance in this matrix; don't increase blindly.
3. Low-damage triple-stack CD3 not recommended as default: more predictions but lower pool and worse support-only matchups. Adaptive 3 stacks/CD2 and CD1 from L5 did not recover B14.6 trained quality. Preserve B14.6 controls and investigate effect timing + tactical policy instead of iterating tiny numbers. Three-stack variant used actual low-damage hit, NOT zero-damage ability.
4. Tactical versus basic improvement in rush is real for this lab, but current kit does not fix support-only compositions. Mixed ceiling remains. Preserve different squad purposes; no assumption that 3 supports should win all difficult assault encounters.
5. Next B15.2B: Art/Liora distinct defense (targeted charge vs group/taunt and bounded passive, timing, resource conservation, death/expiry, equal pressure), then B15.2C Sava signal/assist + real gear, and integration/composition retest before B16. Carry B14 Ren/Nada as reference and re-evaluate when other kits and policy are changed; no production integration before acceptance.

## Limits / remaining
No human/physical iPhone, UI, artistic validation, wave/boss, actual item equipment, complete fairness/permutation or exact effect-attribution check here. Initial and trained tiers use different NPC pressure so absolute cross-tier comparisons are invalid; matched comparisons within a tier are valid. No confidence intervals; seed pairs share scenario, not independent population observations, aggregate counts descriptive. Cannot infer individual parameter causes from bundled B14→B15; only explicit variant comparisons isolate their limited change. B14 shared scope differs from candidate. B14 planner used unchanged, not tuned for candidate: prediction rates may reflect policy, cooldown, kill timing and resistance. B15.2A is not full B15.2, A/B gates open. C/D/E/III paused.
