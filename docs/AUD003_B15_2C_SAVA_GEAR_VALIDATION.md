# AUD003-B15.2C — Sava, CTB and real equipment

25.11.2026 · **[В РАЗРАБОТКЕ / ПРЕДЛОЖЕНИЕ]**. [B15.1 kits](AUD003_B15_HERO_KITS_COMBAT_2.0.md), [B15.2A Ren/Nada](AUD003_B15_2A_READ_MOVE_VALIDATION.md), [B15.2B Art/Liora](AUD003_B15_2B_DEFENSE_VALIDATION.md). Base main 68ec15ba4c345429d9cfcd699c65859e211597f7. Research only; no production/save/lore/roster changes.

## Actual adapter and item pipeline

B14.6 visible-threat actual CombatCore, existing CTB and damage pipeline; exact anchor patch, fail closed. Other heroes remain B14.6 (not integrated B15). Ren/Nada and Art/Liora candidate numbers were not accepted in prior slices. No extra engine. Eight configurations:
- ref: B14.6 hybrid strike on S; window: native S signal and old P coordination window (lab planner uses P when 2+ others).
- meter: B15 B and pure S signal; independent P 1.2× own ATK (lab comparator, not an approved skill).
- full: B .75–.92×, +50–75 meter to nearest other not-ready ally by actual effective speed/time-to-ready, no faction gate; S +250–300, cap950, no field aura, zero-gain rejected atomically; P .8–.9 own + .5–.6 helper ATK, explicit selected enemy and distinct living ally, CD3. Only one own turn. Helper may be ready; no helper CD/meter/status consumption, no full basic/status/personal damage bonus or chain. Secondary hit uses ordinary accuracy/crit/defense/Protection/HP; helper's existing weakening affects damage without spending charges. Worst-case two hits and two crit draws reserved before mutation. No retarget on primary kill. Secondary events root linkage and depth1; no secondary damage event trigger redispatch. One stored +50–80 meter boost on next legal S after useful assist; no stacking; cleared at death/wave.
- cap: full with helper raw damage limited to 1× Sava ATK **before critical/defense**; nopassive: full without stored bonus; nosignal: full with S disabled (ablation, not playable proposal); hybrid: full kit, alternative policy allows next-actor change as well as enemy-deadline crossing (name is historical, no new damage effect).
- Signal forecast uses native InitiativeModel on copies of alive combatants, after accounting for caster's spent threshold; no future RNG. Count immediate next change and crossing the nearest enemy deadline separately. Forecast is not proof of outcome: other actors may subsequently change initiative or kill. B15.2C direct actual deadline fixture supplements forecast: with signal Ren acts before the prepared foe and kills it; Nada lives. With B instead, prepared enemy kills Nada. Deterministic forced setup, not campaign evidence.
- Sava/Art no leaders. B14.6 reference retains its original Sava planner; window and candidate policies differ by kit. Not a pure coefficient ablation between reference and full. Among full/cap/nopassive/nosignal policy is shared except legal availability.

**Real gear:** GearData → ProgressV3Core.fresh/toRuntime → ProgressCore.itemOffer/equipItem/promoteGear → gearBonuses → HeroStatsCombatBridge.apply (as game.js). Build in memory with test wallet and owned heroes; actual item IDs, historical tiers, promotion bonuses, class, stars. No storage, rewards, or player wallet affected. Set lab progression level/stars; no claim about acquisition difficulty. G1/G7/G13 fully equipped current tiers, 6/42/78 installed items. Ordinary speed unchanged. Uneven Ren G13 with other heroes G1 at same L15/3★; noncanonical striker fixture inherits Ren profile and gear. NPC factory used, then scale HP/Protection/ATK for fixed pressure (not actual NPC gear or final endgame design).

| tier | hero/skill/stars | G | Ren ATK | Sava ATK | rush NPC scale |
|---|---|---|---:|---:|---:|
| early | 2/1/1 | 1 |33|21|1.08|
| mid |15/6/3|7|98|74|3.1|
| max |85/6/7|13|275|208|6.6|
| uneven |15/6/3|Ren13/others1|189|27|2.3|

## Evidence

[Initial matrix](research/aud003-b15-2c-results.json) 12,960 completed battles, 20 matched seeds/cell, 9 squads (including no-Sava control), two scenarios per squad, 2–5 allies, eight configurations, full basic-only. [Independent reversed-order holdout](research/aud003-b15-2c-holdout-results.json) 7,680 completed, six configurations, eight Sava squads, new seeds. Total **20,640** completed V8 battles against exact fetched sources, not counting smoke or contracts. All finished within 180 player commands; finite state checks, no illegal action or detected recursion. Exact source/runner blobs, seed lists and real gear bonuses in results. Final runner subsequently tightens helper index and adds tests; historical matrix runner hashes preserved. Reproduction: `node docs/research/aud003-b15-2c-sava.js 20 [holdout]`. W/Q wins/no-loss wins (not actual stars); pool remaining HP+Protection / starting maxima.

Rush, initial eight Sava squads, n160 per row/tier (excludes no-Sava control):

| Variant | Early W/Q/pool | Mid W/Q/pool | Max W/Q/pool | Uneven W/Q/pool |
|---|---|---|---|---|
| B14.6 ref |149/85/.556|160/134/.788|160/160/.950|120/120/.697|
| old window |125/46/.448|160/104/.711|160/160/.935|120/113/.687|
| pure meter + own P |145/80/.540|160/124/.774|160/160/.944|120/117/.690|
| full |148/83/.570|160/131/.784|160/160/.950|120/120/.699|
| cap |148/83/.570|160/131/.784|160/160/.950|120/120/.697|
| no passive |148/83/.570|160/130/.783|160/160/.950|120/120/.699|
| no S |148/83/.560|160/131/.783|160/160/.950|120/120/.699|
| full basic-only |131/46/.462|159/112/.696|160/160/.924|120/100/.666|

Independent rush (n160): ref early 152/78/.576, mid 160/137/.794; full early 152/78/.576, mid 160/143/.804; cap identical W/Q/pool for those tiers. No S early 152/76/.569, mid 160/140/.800. No passive early 152/78/.574, mid 160/142/.804. More liberal next-change policy early 152/81/.568, mid 160/142/.794, not a decisive win. Uneven rush cap W/Q120/120 both runs, same uncapped, pool within .002. Uneven support-only squads without Ren/striker both 0/20 W; pressure deliberately unmatched to their low gear, not evidence a given hero is broken. Uneven mixed holdout Q103/120 full/cap vs Q118 reference and no S — warn that using signal can cost damage/quality. No universal signal benefit.

Signal (full candidate, initial rush): early 56 legal S, 36 immediate next changes, 56 enemy crossings; mid 38/8/38; max 39/19/39; uneven 0. Selection policy specifically selects crossings, so 100% crossings are **not** a natural frequency estimate. Early basic bonus 387 uses, no observed immediate next changes in rush; mid 386, likewise. In mid mixed, 282 basic bonuses, 18 next changes, 22 enemy crossings. Passive earned 195 boosts and spent 56 in early rush; ablation shows almost no quality difference. Thus preserve optional deadline decision and improve role value later rather than inflate raw meter blindly.

Cap: actual uneven L15/3★ Ren ATK189, Sava27; 60% helper raw =113, capped27. In same-tier scenarios cap never engaged, identical results. Uneven rush initial and holdout each cap 120/160 landed assists, summed raw 4020 vs uncapped14340; W/Q unchanged. Uneven mixed initial cap 80/202, five 52/52. Raw cap greatly restrains exploit-like helper scaling without losing tested victories. Critical can exceed raw cap, explicitly not total damage cap. Full uncapped max rush 48/160 P skipped helper due primary kill, high overkill; max pressure too low. Full five current heroes vs five NPC all 20/20 W/Q per tier in initial, holdout likewise; no proof of challenging endgame. Four-ally alternative vs five NPC also included, total five scenario 40 per tier. Do not claim fairness, balance or fun from ceiling. 

## Decision for integrated B15.2D (proposal, not approved)
1. **Prefer explicit selected helper/target joint strike**, with cap at own ATK as tested guardrail candidate. It preserves comparable early/mid performance, stronger than old coordination window, easy to explain and trace; no extra turns, no hidden window, no chain. Keep B14 reference.
2. Keep pure S as meaningful deadline choice, not default opening. Actual deterministic rescue proven, aggregate marginal gain small and uneven mixed regression. Passive +50–80 not justified by W/Q yet; keep no-passive alternative, consider making passive help only actual consequential decision; don't just raise meter or use CD recovery. B bonus ancillary, not a free turn.
3. Carry **candidate rules** rather than full numeric packages from all three slices. Next B15.2D integrated real-core composition/pressure and progression (G1/G7/G13, uneven gear, 2→5 allies, genuinely matched 5v5, multiple waves, objectives/deadlines, permutations and holdout) with B14 controls, candidate selection/ablation, player-facing lab selectors and acceptance checklist. Tune NPC pressure separately; avoid optimizing win percentage alone. B16 owner acceptance before production integration. A/B gates remain open, C/D/E/III paused.

## Direct contracts and limitations

23 passing direct real-core assertions: cap/overflow; read-only forecast; zero-gain rejection; pure signal/CD; no faction basic bonus; ready meter preserved; explicit/helper legality; helper unchanged meter/CD/weakening; one secondary root; stored boost and consumption; primary kill/no retarget; dead/invalid helper; RNG reserve; actual G13/G1 ATK and raw cap; item counts/speed; wave/death cleanup; leader exclusions; actual rescue before prepared enemy turn; integer helper index. `node --test tests/aud003-b15-2c-sava.test.js` also executes one seed all initial/holdout cells and anchor mismatch rejection. Direct tests forced meters and disable RNG unless testing validation. No physical iPhone/browser/manual human or visual checks here. No full combined B15 engine, actual boss immunity, full waves matrix, production UI target selection, actual save progression/acquisition, or independent ally slot permutation. Root metadata is experimental, no production event schema. No claim of actual campaign stars; pressure synthetic, no confidence intervals; reversed enemies and new seeds combined not pure order effect. Test max/uneven indicate progression scaling challenge. The actual deadline microfixture is one constructed counterfactual, not aggregate effectiveness.
