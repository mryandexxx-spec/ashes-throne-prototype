# AUD003-B15.2B — Art / Liora defense real-core validation

25.11.2026 · **[В РАЗРАБОТКЕ / ПРЕДЛОЖЕНИЕ]**. [B15.1 kits](AUD003_B15_HERO_KITS_COMBAT_2.0.md) → [B15.2A](AUD003_B15_2A_READ_MOVE_VALIDATION.md) → B15.2B. Base main 9e6db7b2f2f310bdb301913ca2e47df641000b7d. Only research files and documentation, no production, canon, UI, rewards or saves changes.

## Implementation in isolated adapter

B14.6 actual CombatCore + real hero stats bridge, exact anchor replacement, fail closed. Ren/Nada and Sava remain B14.6 per B15.2A. Existing telegraph pressure and B14.6 reference preserved. Candidate:
- Art S: one targeted guard on another living ally, 2 recipient turns, transfer guard when recast, fraction .40–.50, cap .8–1.1× ATK. No HP transfer, no heal in baseline candidate. P actual announced threat, successful hit and status roll (reservation in native RNG budget); otherwise one weaken, does not reduce stronger existing weaken. Passive on actually executed prepared single P only, after target guard and Protection, at most .40–.50 residual HP damage / .6–.9× ATK / own current Protection. No reaction on own guard's same root; no AoE, miss, unprepared or downgraded B; one use until Art acts. Spent Protection equals prevented residual HP damage, so passive redistributes team pool rather than creates it.
- Liora S: two self guards, .35–.48, cap .9× ATK, taunt exactly two subsequent own turns, CD3. P: one group guard per living target, .30–.40 / .65–.9× ATK, 2 recipient turns, CD3. Passive: actual crossing of threshold 35–40%, after whole root, pick lowest surviving HP ratio, stable ID tie, one recipient, CD3. Native Liora passive disabled in candidate. Leader 0/5/10%, initial bonus granted once; death clamps remaining Protection, no repeat refill. No Art/Sava leader.
- Strongest single reduction per hit, only selected charge spent. Art guard excludes AoE; Liora group/self protect all damage types. Same-owner guard nonaccumulating; don't replace a stronger charge set. Candidate self guard expires after two subsequent own turns (lab choice; spec duration for self stance not explicit). Guard links cleaned on death/wave (wave clearing lab choice), HP/meter/CD native. B14 Liora-only ablation retains old Art reaction exactly before guard; candidate both uses residual-HP rule. No double reaction on same Art guard hit.
- Tactical policy uses visible prepared targets, health+Protection ratio, current guards, AoE readiness, no future RNG. Same policy applied to reference and candidates; original B14.6 policy separate control. Basic-only on both. All Liora squads place her first in every variant to match required leader slot. Area scenario is a synthetic NPC P (0.72× ATK to all allies), not new canon or production ability. Hold objective 8 ally actions; protected target Nada if present else first ally. No gear. Early hero L2/skill L1; trained L12/skill L6; 1★. Same pressure within tier; do not compare tiers as if identical opponents.

## Results

[Initial matrix](research/aud003-b15-2b-results.json): 9480 completed real-core battles (20 matched seeds/cell). [Independent reversed-NPC-order holdout/refinement](research/aud003-b15-2b-holdout-results.json): 6120, 20 new seeds/cell. Total 15600 completed; no invalid/nonfinite detected by existing lab validation; 160 player command bound. Includes eight squads (2/3/4/5 fighters) and three scenarios. Source blobs, runner version, seeds retained. V8 execution against exact source, Node CI separate. W/Q = wins/wins without fallen allies; not campaign stars. Pool = remaining HP+Protection divided by initial maxima.

Initial early, 160 battles per row per scenario (same 8 squads, no leader):

| Variant | Rush W/Q/pool | Hold W/Q/pool | Area W/Q/pool |
|---|---|---|---|
| B14.6 original policy |153/102/.591|159/159/.791|107/48/.411|
| B14.6 matched policy |156/108/.613|160/160/.800|122/84/.442|
| Art only candidate |146/95/.569|153/153/.783|120/73/.425|
| Art guard no reaction |146/91/.564|147/147/.786|121/66/.423|
| Liora only candidate |156/108/.606|160/160/.796|120/78/.432|
| Both candidate |146/95/.560|153/153/.778|118/68/.414|
| Both no Art reaction |146/89/.554|147/147/.781|119/56/.414|
| Both basic-only |131/58/.468|139/139/.725|101/15/.327|

Trained rush B14.6 matched 159/137/.772; both 159/119/.725; no reaction 158/116/.717. Trained area B14.6 156/124/.645; both 151/107/.593. Tactical policy improves B14 alone: early area Q48→84; do not attribute policy benefit to a kit. Both early area tactical vs basic +53 no-loss outcomes/160, +17 victories, but absolute performance inferior to matched reference.

Holdout early (rush n160; area n140 excludes 2-person squad; hold n160):

| Variant | Rush W/Q/pool | Hold W/Q/pool | Area W/Q/pool |
|---|---|---|---|
| B14.6 |152/106/.627|159/159/.817|133/95/.532|
| Both |149/97/.576|158/158/.792|127/70/.496|
| Both no reaction |145/93/.567|157/157/.792|126/70/.498|
| Stronger Art guard .50–.60 / 1.1–1.4× ATK |149/99/.584|158/158/.794|122/70/.497|
| Art modest targeted recovery .35× ATK |151/102/.592|158/158/.799|121/72/.501|
| Earlier Liora passive 45–50% |149/97/.576|158/158/.792|127/70/.496|

Holdout trained rush B14.6 159/140/.788 vs both 159/128/.746, recovery 159/130/.755. Recovery helps rush but area W falls 127→121 in early holdout. Not a universal improvement. Art local lethal prevention counts are per-step counterfactual, not proved battle wins. E.g. recovery early rush 86 reactions, 933 residual HP prevented and exactly 933 own Protection spent; 3 local lethal reactions; 912 Protection restored on S. Passive triggered in trained initial only twice across 480 both tactical battles; earlier threshold raises trained holdout rush triggers 0→7 but no W/Q gain. Cannot interpret rarity alone as useless: threshold crossing and policy, kill timing, guard already present matter.

### Composition and leadership

- Starter Ren/Art early rush initial B14 16/20 W, 8/20 Q, pool .297; candidate 12/20, 3/20, .223. Independent holdout 12/6/.231 vs 9/1/.114, no reaction 5/0/.027, recovery 11/2/.129. This rush is deliberately hard, not live chapter I. **Do not ship candidate Art as tested.**
- Ren/Art/Liora early rush initial ref 20/20 Q, both 18/20; holdout 20/20 vs 17/20, recovery 20/20 but area 20/20 vs 11/20 Q. No immortality observed; full five roster always 20/20 W/Q in tested cells and high pool (.937 rush, .800 area initial both); B14 also ceiling (.943/.817). Five allies vs three enemies makes this weak proof of real endgame balance. Need matched 5v5/pressure and waves before gate.
- Art/Nada/Sava early rush initial reference 20/20 W but 0 Q, candidate 14/20 W and 0 Q; Liora/Nada/Sava 20/20 W but 0 Q. Support-only not fixed. Different role fixture striker/medic and larger squads not real roster expansion.
- Leader comparison **same five Liora squads**, early area: both 94/66/.549 (n100), +5 94/69/.553, +10 96/70/.557, reference +10 96/77/.585. Trained rush Q89→93 for 5% or 10%; 10% slightly more pool (.816 vs .812). Holdout same squads area early 93/66/.565→96/69/.576 with +10. No evidence leader needs increase; keep 10 as test candidate vs 0/5, not approval. Leader death clamp contract passes.

## Contract validation

23 direct actual CombatCore command assertions in runner, one-seed complete matrix and anchor rejection in tests/aud003-b15-2b-defense.test.js. Test fixture explicitly fixes current actor/meter and disables RNG for controlled cases, not organic battles: self target rejection; other-only guard; group recipients; strongest single charge; transfer; expiration; CD; exact Protection payment; once per Art cycle; unprepared/area/no same-root duplicate; taunt scope & duration; threshold crossing and single AoE recipient; Art prepared/fallback; leader death; owner death; wave cleanup; capped restoration no HP. All 23 passed in V8. Run `node --test tests/aud003-b15-2b-defense.test.js`; matrix `node docs/research/aud003-b15-2b-defense.js 20 [holdout]`.

## Decision / self-critique

[ПРЕДЛОЖЕНИЕ] Keep **role distinction and bounded primitives** (personal guard / prepared residual Protection reaction vs group/taunt / single post-root emergency guard). Don't approve whole numeric candidate: both early and trained performance deteriorates compared with B14.6, especially starter and area. B14 Art recovery creates effective pool and legacy reactive blocks twice its cost, so candidate's lower pool is partly structurally expected; not isolated coefficient effect. Art recovery .35× ATK is the most promising rush variant tested, not a final solution; no resurrection/HP transfer. Need test actual pressure/target policy rather than raising every cap; stronger guard and earlier threshold not convincingly better. Separate leader and group defense tuning; preserve nonstack rule. Carry B14 control and candidate variants to integrated phase, **not production**. Next B15.2C Sava targeted signal/assist and real gear pipeline; then integrated roster/5v5, actual waves, difficulty/policy retest before B16.

Limits: no real equipment or max level/rank, actual boss immunity, full multi-wave matrix, human/physical iPhone, UX/artistic approval. Holdout uses reversed enemy order + new seeds together, not a factorial order-only study. Experimental area is synthetic, early 2 vs 3 very hard. No matched full-size enemy squad, no live progression validation. Test fixtures forced turns, not a proof of real CTB ordering; native CTB not changed. No raw per-root full trace retained in aggregates; per-step counters do not prove meaningful choices. Candidate Art S retains native insurance-kind shell for validation; its native event label is not a production UI implementation. A/B gates open, C/D/E/III paused.
