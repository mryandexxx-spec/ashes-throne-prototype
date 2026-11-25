# AUD003-B13.2 — скорость, инициатива и защита
**[ПРЕДЛОЖЕНИЕ / В РАЗРАБОТКЕ]**, 25.11.2026. B13.1 PR #532 merged c5f8309a, CI #45615578888 success. B13.2 is research only, no production, GDD, lore or save changes. Source V11 blob 68dfc45f8a409f8f7c9ac1362e32ad61414cc5bc. Read B13.1, B12, ROADMAP/PROJECT_STATUS, AI_WORKFLOW and RPG skill; use measured outcomes rather than copied formulas.

## Design and evidence
Three successive independent-seed sweeps executed in V8 on the actual V11 research core: 3260 + 2480 + 2220 = 7960 battles. Runners and exact cell aggregates in docs/research/aud003-b13-initiative{,-v2,-v3}.js and corresponding -results.json. Run each with Node. W/Q = wins / wins meeting mode-specific proxy quality (assault HP >=35%, hold escort >=90, intercept HP >=70%); not human experience. Samples 20 or 30 per cell, seed offsets 104000–122000; paired seeds do not ensure paired draws after different actions. Not independent engine, no production parity. First turn metric counts enemy actions before first ally, not number of hits.

### Iteration 1 — isolate opening burst, compression and protection
SpeedScale=.65 vs 1 preserves speed order, reduces rate difference; starting Protection=.15 HP vs none; opening=.8 multiplies first enemy turn attack stat (including buff/AI choice; charge resolution later unaffected). This is not a pure damage-only ablation. All combinations here are one-sided scenario adapters, not approved stats.
| Assault, 3 teams x20 | Normal W/Q | Fast W/Q | Fast + reversed enemy list W/Q |
|---|---:|---:|---:|
| baseline |45/27|24/8|8/0|
| compression |45/25|29/7|7/0|
| protection |47/39|39/17|0/0|
| opening |60/36|44/25|19/14|
| compression + protection |53/42|44/19|2/0|
| compression + opening |60/36|44/27|20/14|
| all |58/49|48/29|22/3|

Fast enemies get three actions before first ally (normal one); compression does not change this. Strongest combined case still fails composition B and permutation. Hold/intercept 60/60 wins across tested configurations and enemy policies, so blanket protection would make those tests even easier. Small rosters forced against fast rush, even all changes: 57/100 tactical wins, 11 quality, 24/100 basic. Seeded initiative ties alone did not solve order: 29/60 normal-order fast vs 11/60 reversed; slot tie 29 vs 14. Reject globally mandatory Protection or compression as primary fix.

### Iteration 2 — causal AI order and opportunity to act
Test source-only copy in runner, not V11 itself: stable target ordering by side, role ID, duplicate ordinal in equal-score picks, signal/assist and threat weakest-target estimate. Initiative seeded in both branches. Equal score target order is a mechanism, not a change to speed. Not a production identity contract; lexical role order can bias outcomes. For runtime prefer immutable instance ID and documented seeded tie; explicit formation mechanics may intentionally affect outcomes. No assertion of universal permutation invariance.
| Fast assault 3x20 | W/Q normal order | W/Q reversed | Enemy actions before ally |
|---|---:|---:|---:|
| baseline |24/9|8/0|3|
| stable |17/0|17/0|3|
| stable + initial ally meter 80/1000 |21/0|21/0|1|
| stable + 140/1000 |25/0|25/0|0|
| stable +140 + opening .8 |32/8|32/8|0|
At normal speed stable 30/0 both orders versus baseline 42/24 vs 6/0. Equal aggregates at both speeds indicate strong causal evidence for score tie dependence in this test, not per-seed proof or universal symmetry. Guaranteeing first ally action does NOT make rush good. Readiness shift also changes objective-clock budget, distorts speed progression; don't adopt globally. Cross-mode stable hold/intercept 60/60 quality, but insufficient challenge. Reject hiding the issue by reordering lists.

### Iteration 3 — change encounter structure instead of erasing speed
Same stable tie adapter, no readiness boost or opening Protection. Rush = 3 raiders + charger + guard; mixed = guard, charger, healer, 2 raiders; slowThreat = guard, charger, healer, charger, raider. Attack multiplier .78 existing vs .68 candidate. Fast = enemy speed x1.1.
| Fast assault 3x30 | W/Q at .78 | W/Q at .68 | Enemy actions before ally |
|---|---:|---:|---:|
| rush |26/0|76/16|3|
| mixed |86/28|90/64|2|
| slowThreat |90/89|90/90|1|
Mixed .68 fast W/Q by teams 30/29, 30/5, 30/30: B still poor quality. SlowThreat .78 may be too easy (normal 90/90 quality), but is a useful telegraph candidate, not a final encounter. At x1.1 enemies, ally speed .9/1/1.1 vs greedy: mixed 32/90, 90/90, 89/90 wins; slowThreat 78/90,90/90,90/90. Speed still materially matters, especially a penalty to slower compositions; no need to abolish it. Changing roster structure also changes enemy AI and utility, not just speed; does not isolate individual raider skills.
Small roster early guard/charger (2) or guard/charger/healer/raider (3–4), no blanket bonuses: all five teams 150/150 wins at both speeds and both player policies; fast quality basic 98/150 vs tactical 125/150. Ren/Art fast both 30/30 wins, Q 29 vs 30; four-hero team 7 basic Q0 vs tactical Q6. Early candidate may be too forgiving, and small roster case uses a separate tailored opponent, not the same difficulty as rush. No claim of newbie success or human choice.

## Self-critique, recommendation and gate
The previous Protection hypothesis was partly misleading because it depended on slot order and target choice. More useful than adding another universal buff is to remove accidental ordering in research AI, control encounter burst through composition/skill cadence, retain speed progression and telegraph dangerous actions so the player has meaningful responses. Candidate early opponents should be understandable, not guaranteed loss or trivial auto. Consider distinct encounter tiers: early guard/charger, mixed midgame, concentrated rush as optional stress/advanced threat only if fair counters exist. Do not adopt these exact NPC counts or stats as canon.
Reject a global opening buff, universal initiative compression and first-turn privilege as defaults; optional encounter-specific readiness remains a hypothesis, explicitly telegraphed if ever adopted. Need prove stable ID tie-break per-seed for all modes, duplicate identities and ally permutations, rollout/AI lookahead consistent with rules; current V2/V3 source patch affects only greedy/tactical tie paths, not rollout. Need independent role utility and trust ablation (B13.3), assess alternatives guard/interrupt/kill and danger visibility, test AI policies and difficulty across gear and all roster sizes; no >=2 robust assault compositions demonstrated for rush. Q proxies inconsistent by mode by design; no engagement inference. No human playtest, physical iPhone or FP→I→II→Nada A gate. B13.2 research slice completed, B and A gates remain open. B13.3 tactical depth, B13.4 manual/UX, B13.5 synthesis only when sufficient; C/D/E and chapter III paused.
