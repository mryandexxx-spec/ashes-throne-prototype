# AUD003-B15.2D — integrated Combat 2.0 and acceptance lab

25.11.2026 · **[В РАЗРАБОТКЕ / ПРЕДЛОЖЕНИЕ]**. Base main a97787611bb1172b28c1390d8860e802e023220c. [B15.1](AUD003_B15_HERO_KITS_COMBAT_2.0.md) → [B15.2A](AUD003_B15_2A_READ_MOVE_VALIDATION.md) → [B15.2B](AUD003_B15_2B_DEFENSE_VALIDATION.md) → [B15.2C](AUD003_B15_2C_SAVA_GEAR_VALIDATION.md) → D. Skills RPG + game-ui-ux consulted; latest GDD/Combat Specification prevail. No production abilities, economy, saves, canon, roster, campaign or 3D changes. B16 is owner review; do not close A/B or start C/D/E/III until acceptance gates satisfied.

## 1. One actual core, pinned lab

[Integrated lab](../lab-combat-2/index.html) / [Pages](https://mryandexxx-spec.github.io/ashes-throne-prototype/lab-combat-2/). Separate static site, no Babylon, no storage, no network reward. Source snapshot pinned to base commit, exact original blob IDs; separate parts snapshot holds prior three tested research adapters. This isolates the lab from subsequent changes to live game. Engine composes prior patch stages and applies one composed ability wrapper, fails closed on mismatched anchors. Actual CombatCore, InitiativeModel, gear catalog and ProgressCore item purchase/promotion/Bridge, not a toy engine. A prototype composition bug was found: both defense and signal slices had local b15grant names; collision corrupted guards and signals. Namespaced defense functions before composing, validated all guard fields after every real command, rejected malformed counters. Discarded invalid preliminary runs; matrices below follow correction. Wave cleanup and unique wave IDs, assists do not spend helper turn/CD, actual Sava target legality. No production API changed.

Variants:
- **ref** B14.6 control, common Art/Liora matched policy, B14 Ren/Nada and Sava hybrid S.
- **legacy** current ability definitions with same telegraph experiment (not exact published mission behavior), without B14 hybrid, shared or reaction; role fixtures noncanonical.
- **full** complete B15 candidate, scoped +10 sharing, both defense kits, capped new Sava.
- **bridge** B14 Ren/Nada damage & passive numbers, preserves Art/Liora direct damage curves, B15 defense semantics + .35× Art ATK restoration, scoped +10, capped new Sava.
- **recover** bridge + .65× Art ATK restoration. **bridge-noshare** ablation.
- **sava** B14 control except explicit Sava P assist cap 1× own ATK before crit/defense, pure S, bounded passive. **recover-nopassive** tests passive ablation on recovery variant.
- **scaled** recover with per-hit guard cap max(original ATK cap, .45× owner maxProtection), reaction cap max(original, .35× Art maxProtection), still spends actual own Protection 1:1, restoration max(.65× ATK,.30× Art maxProtection) limited to missing target Protection, no HP heal. **scaled-group** additionally Liora P two charges from L4; all expiry, nonstack and root bounds preserved.
- **art-only** new scaled Art + capped new Sava, B14 Liora and Ren/Nada, scoped +10 sharing. **liora-only** new scaled Liora (L4 two charges) + capped new Sava, B14 Art reaction/recovery, scoped +10 sharing. Not a one-variable comparison against ref: compare with sava and recognize scoped share also differs. Neither Art nor Sava leader. Liora leader +10 is candidate only.

## 2. Pressure methodology

Four progression contexts: L2/skill1/1★ fully G1; L15/skill6/3★ fully G7; L85/skill6/7★ fully G13; uneven L15/3★ Ren G13 and others G1. Same item/promotion pipeline as live game; in-memory owned heroes + wallet fixture, not actual acquisition economy. Eight squads of 2–5; two 5-hero alternatives use role fixtures (striker with Ren stat profile/gear, breaker with Art; not real unlocks). In uneven, striker inherits Ren G13; no Ren/striker means low-gear team against reference-calibrated pressure.

NPC archetypes from actual factory, size equals number of allies for duel/rush/area/hold/priority. 5v5 = five actual enemy instances; waves 3 then 4 for full party; same allies HP/Protection, initiative, cooldown persist. Experimental guard/boost references cleaned at wave start. Area first slinger P becomes synthetic .72× all-enemies; no new production NPC kit. Hold eight ally actions (protect Nada if present else first ally); priority medic first. Prepared single threats via B14.6; actual boss phase/immune case still not tested. Different objectives use scenario-specific pressure factors, identical for variants.

First pressure pilot 1024 discarded due max gear ceiling; no claim that 100% wins means balance. Final [calibration](../lab-combat-2/calibration.json) 1152 reference-only battles, 8 seeds per cell, 9 grid points, target W~82%, Q~55%, pool~.52 and penalize excessive commands. HP/Protection scale .75× pressure, attack scale pressure× tier factor (1.35/1.45/2.65/1.65); this separates durability from offense. No modification of core defense formula or speeds. Selected pressure:
| tier | 2 allies | 3 | 4 | 5 |
|---|---:|---:|---:|---:|
| early |1.512|1.512|1.242|1.242|
| mid |6.355|6.355|6.355|6.355|
| max |19.8|16.5|19.8|19.8|
| uneven |6.9|6.9|5.75|3.91|

Hard rush/duel/area = base, waves .88, hold 1.18, priority .9; normal .78× and support-hold normal additional .70. Freeze before candidate comparison. Calibration deliberately imperfect: eight seeds, discrete grid, tier/size-specific, some ceilings or excessive loss; not accepted story difficulty. These are synthetic test numbers, not live NPC progression. Never compare tiers as if same opponents.

## 3. Evidence and self-critique

- [Initial](research/aud003-b15-2d-results.json) 13,680 actual completed fights (20 seeds/cell, 19 squad/scenario cells, 4 tiers, 7 variants, two basic-only controls).
- [Independent holdout/refinement](research/aud003-b15-2d-holdout-results.json) 14,960 (new seeds + both slot orders reversed, 17 cells, 9 variants and two basic controls; changes together not factorial).
- [Normal/slot/leader follow-up](research/aud003-b15-2d-followup-results.json) 8,160 (new seeds, normal, separate ally/enemy/both reversal, same Liora-first order leadership).
- **36,800 main trials + 1,152 final calibration = 37,952 completed fights**, V8 against pinned actual sources. Initial and holdout exact source and engine blob provenance retained. Earlier discarded calibration/invalid pilot not included. All finished <=240 player commands, finite/legal state checks, bounded assist depth. No confidence intervals; descriptive paired cells, not population estimates. W/Q = wins / wins without fallen allies, not campaign stars. Pool = remaining HP+Protection / initial max.

Initial hard aggregate per tier n=380, mixed objectives/compositions (not all 5v5):

| Variant | early W/Q/pool | mid W/Q/pool | max W/Q/pool | uneven W/Q/pool |
|---|---|---|---|---|
| legacy + prep |282/96/.400|155/61/.204|167/88/.264|340/110/.603|
| B14.6 |334/139/.598|209/104/.340|228/126/.390|340/159/.680|
| B15 full |299/97/.486|84/23/.126|105/34/.176|338/61/.499|
| bridge |305/108/.519|143/59/.223|165/71/.273|340/76/.553|
| recover |308/117/.542|155/63/.242|172/73/.284|340/76/.556|
| new Sava |334/135/.590|204/105/.335|219/129/.379|340/110/.643|
| bridge no share |305/107/.523|136/58/.213|160/69/.270|340/76/.549|

**Do not ship full B15.** Mid W84 vs209, max105 vs228. Lower coefficients plus guard caps, expiry, reaction resource accounting and tactical policy differ; cannot attribute all difference to one value. Uneven Q falls despite W ceiling; cap protects raw assist but does not guarantee team survivability.

Independent hard n340/tier:
| Variant | early W/Q/pool | mid W/Q/pool | max W/Q/pool | uneven W/Q/pool |
|---|---|---|---|---|
| ref |316/146/.646|208/81/.379|234/115/.440|320/142/.680|
| recover |300/125/.585|169/62/.277|186/71/.325|319/23/.548|
| scaled |300/125/.585|183/71/.304|198/78/.351|319/23/.551|
| scaled-group |300/125/.585|184/71/.310|198/78/.353|319/41/.553|
| new Sava |317/144/.631|209/88/.384|236/115/.440|320/97/.644|
| Art + Sava |300/132/.604|210/90/.379|237/112/.429|319/101/.637|
| Liora + Sava |317/130/.617|183/76/.313|204/85/.357|319/44/.560|

At L85 actual Art ATK134/Protection381, Liora122/399 vs early27/51 and25/53. ATK-only guard caps scale poorly vs offensive progression. Protection cap refinement improves mid/max over recover, but adding second group charge L4 does not rescue broad result. **Keep B14 Liora for leading candidate**, separate defense progression investigation. Scaled Art with B14 Liora close to reference at mid/max; early still worse and uneven no-loss gap. B15 guard resource semantics retain appeal, not numerical approval. Sava explicit helper cap competitive except uneven Q; passive removal not compelling. Retain B14.6 Ren/Nada synergy and scoped sharing candidate (zero slightly worse mid/max in initial; confounded by other changes, no final share).

### Actual 5v5, waves, alternatives

Independent hard, 20 per cell, max:
| Variant | full duel W/Q/pool | full area W/Q/pool | full waves W/Q/pool | independent duel W/Q/pool |
|---|---|---|---|---|
| ref |20/8/.695|17/2/.357|20/19/.800|4/0/.084|
| new Sava |20/6/.641|17/2/.354|20/20/.772|4/0/.078|
| Art + Sava |20/5/.640|20/6/.437|20/19/.734|3/0/.059|
| scaled-group |19/3/.574|10/0/.211|20/13/.680|0/0/0|

Early starter hard independent ref20/20 W/Q, Art+Sava20/19; initial hard ref20/19, recover18/15. Initial early rush starter ref15/6, full4/2, recover8/6. Normal starter at early follow-up 20/20 all listed variants; at mid 20/20, max Art+Sava20/20 ref20/19. Normal support hold early all20/20, mid ref20/20 Art+Sava14/14, max19/19 vs16/16. Uneven low-gear support hold0/20 all. Do not assume every support roster wins a damage-oriented battle. Normal full 5 and wave ceiling at early. At max normal independent duel ref15/4, Sava14/2, Art+Sava13/2; waves ref20/19, Sava20/20, Art+Sava20/19. **Hard viable alternatives gate not met**: independent team fails mid/max hard; current fixtures inherit profiles, not a substitute for roster expansion. Strong imenic synergy, pressure and fixture roles jointly affect this; investigate alternative attacker/support rather than nerf Ren/Nada blindly.

Normal n220/tier (same 11 cells) early Sava tactical220/202/.800 vs basic220/97/.685; mid207/147/.653 vs127/32/.313; max212/171/.715 vs119/48/.329. Tactical advantage strongly visible; not proof of human enjoyment or that any one new skill caused it. Uneven Sava tactical200/98/.772 vs basic200/60/.705; ref tactical200/133/.804. Normal mixed objectives need actual player review. Hard same seeds order-only Art+Sava max full W17→19 ally reverse,19 enemy reverse,20 both; Q5→4/10/5. Max independent W0→2/1/2. Stable slot tie break intentional; this quantifies sensitivity, not perfect parity. Liora +10 leadership same Liora-first, max area Sava W17/5 Q→18/6, pool .359→.388; Art+Sava17/4 both, .345→.357. No compelling evidence to increase aura; remains open.

## 4. Lab acceptance and next decision

Default **new Sava**, early full 5v5 normal, seed 7. Settings choose ref/new Sava/Art+Sava/other negative candidates, four progression contexts, eight squads, six scenarios, hard/normal, seed, ally/enemy permutation and optional Liora leader. Select target and ally by tap, then ability; Sava helper preview explicitly named, signal preview actual gain and enemy deadline crossing. HP/Protection/initiative bars, marks, guard charges+duration, prepared enemy/taunt, CD, projected next three *if no new effects*, event journal and cumulative guard metrics. Auto step and autoplay via same executor, compare same seed via tactical policy, restart. No persisted state or rewards. Lightweight diagnostic UI, not final artistic 3D arena.

Suggested manual checks (not claimed performed; adjust seed or pressure to reach situation):
| Hero | Four situations to observe |
|---|---|
| Ren | starter B vs P on weak target; with Nada mark amplification; marked dangerous enemy; no Nada independent combat |
| Nada | single mark vs two; P with several enemies; three-mark mitigation vs killing enemy; marked foe dies/next wave |
| Art | other-only cover in starter; P on actual announced threat; Protection spend and no double-save; AoE or exhausted Protection |
| Liora | self taunt single threat; group guard in area; no taunt redirect AoE; group shield vs own survival |
| Sava | signal pushes ally before dangerous enemy; zero gain disabled; P selected helper with G13/G1 and cap; first hit kill/next wave clears boost |
Play 2→3→4→5 normal; compare hard only after seeing rules. Manual targeting, same seed restart, defeat/recovery, visible prepared targets, ability descriptions, no horizontal page scrolling, no unsafe-area clipping. Device acceptance and artistic judgement by human mandatory.

**Recommendation for B16 direction review, not production sign-off:** use B14.6 plus new Sava as principal option; compare scaled Art + Sava, retain B14 Liora and B14 Ren/Nada as control until group guard/role alternatives improved. Keep full B15 as failed comparison, do not integrate whole kit. Decision for owner: is explicit joint attack preferable to old coordination? Does targeted cover/Protection spending feel distinct from Liora? Which branch warrants next focused tuning? Exact Ren P, mark sharing, Liora leader, new Liora group defense, passive Sava, role expansion not accepted. Hard alternative viability and human/physical iPhone gates open. Browser smoke is separate from physical-device verification; no claim of final 3D/UI/artistic quality. Boss immunity, actual NPC gear scaling, real campaign pacing, and all stage/loot integration remain outside this lab. Source snapshots intentionally do not auto-update with main.

## Reproduction
`node --test tests/aud003-b15-2d-integrated.test.js` checks composition guard/signal separation, legal explicit assist, no extra turn, real item counts, leader exclusions, equal size, wave cleanup, deterministic trace, anchor drift, one-seed 3 matrices. `node tests/aud003-b15-2d-lab-browser.cjs` in Playwright 1.56.1 container with local static server on 8765 verifies taps, comparison, waves, terminal/restart, landscape/portrait layout in Chromium and WebKit; screenshots artifact. Actual CI result belongs to PR, not inferred from source. 
