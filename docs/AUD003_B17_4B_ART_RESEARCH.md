# B17.4B — Art skill progression research [ПРЕДЛОЖЕНИЕ]
26.11.2026. Actual core from main 68df73ba, no runtime changes.
## Method
48 matched setups: full, waves, boss (resistance fixture), loss × G1/G7/G13/uneven × seeds 7/19/41. All six Art special/passive skill levels, all other inputs fixed; actual equipped hero stats, actual battle executor and AutoDecision. Compared baseline, A (special restore .65/.68/.71/.74/.77/.80 ATK; passive cap .85/.88/.91/.94/.97/1 ATK), B (same special; passive 40/42/44/46/48/50% incoming damage, cap fixed .85 ATK). 864 variant/level/setup cells, plus repeated baseline comparisons, all terminate in V8 connector runtime. Reproducer: node tools/aud003-b17-4b-art-research.js (Node execution not yet verified; runner is research, not imported by game). Baseline and L1 match; no imported RPG skill formula.
## Measured totals
| Level | Baseline restore/block | A restore/block | B restore/block |
|---|---|---|---|
|1|990/297|990/297|990/297|
|2|990/297|1032/303|1032/298|
|3|990/297|1082/314|1082/300|
|4|990/297|1123/324|1123/302|
|5|990/297|1173/330|1173/303|
|6|990/297|1223/341|1223/305|
Every cell: 36/48 wins, 1282 ally actions total, 32 special uses and 7 passive reactions across 48 runs. A L6: restore changes in 21/48 runs (+233 total, 23.5%); passive block changes in 6/48 (+44, 14.8%). B L6 passive changes only 1/48 (+8, 2.7%). A cap is more frequently binding than assumed in this sample; B rejected in this sample, not universally. No win/turn change here. Baseline L1–6 identical per totals: costs without effect are not acceptable as final progression.
## Critique and next gate
A is preferred candidate, not approved balance. Low reaction count is a substantial limitation: auto prioritizes cancelling prepared threats; passive only reacts to resolved prepared threats aimed at others. Existing boss fixture has no preparation contract (only ridge slinger and trail interceptor prepare). A successful resistance fixture does not validate boss phase immunity. Do not silently add immunity or a preparation phase to every captain. Need deliberate same-state choices (attack / cover / cancel), isolated special vs passive upgrade effects, Protection resource caps, uneven target and Art gear, repeated/overlapping threats, and a real boss phase contract before approval. Also assess Art AI against manual alternatives without interpreting rare reactions as intrinsically bad. Do not increase mitigation percentage or frequency solely to improve use statistics. L1→6 in early gear is a counterfactual isolation, not an attainable early progression path; level 6 requires hero level 12. Both skills upgraded together here, so aggregate changes cannot be fully attributed independently. No mobile or human acceptance. 
## Status
#558 merged 68df73ba; selective smoke 45781549464 and native arena 45781549329 success; main verified. Score subgate implemented. No default enable or canonical change. Ren P single-target recommendation still requires owner decision. Boss phase contract, focused progression/choice tests, route receipts/reward parity, tactical/human/iPhone/Pages and final acceptance open. C/D/E/III remain paused.
