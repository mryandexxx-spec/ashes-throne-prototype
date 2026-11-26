# R2/C2 — validation and candidate encounter [В РАЗРАБОТКЕ]
26.11.2026. C1 #577 merged dadcd4c0, selective CI 45889446312 success; job logs confirm native matrix actually executed. Prior result 2484 runs. C2 additional 1674 development route runs (coarse 1350 + fine 324) and fresh validation 1296 operation + 360 route runs, total C2 3330, C1+C2 5814. V8 native engine, not simulated damage formula. Reproduce validation with node tests/aud003-tree-r2c-validation.test.js; add --sweep for development sweep. Normal selective CI runs validation only, not repeated development sweep. No live code, art or balance changes. 
## Decision: no change to signature abilities
Both distinct at current mechanics: guardian reactive redirect/guard (single target pressure), commander redistributes finite existing Protection + guard (resource management). Do not buff/nerf on R1 mean HP alone. Fresh seed split [3001,3011,3019,3037,3041,3049,3061,3067,3079,3083,3089,3109], not reused from C1 or development sweep. Two reactive policies sometimes choose identical actions, runs aren't independent players; report paired results and conditional action cost rather than inferential statistics. 
Fresh results, n72 per cell: success/all alive, total HP/remaining Protection, mean actions conditional on success:
| context | base | guardian | commander |
|---|---|---|---|
| escort4 | .94/.17,230.21/49.63,26.22 |1/.61,271.11/36.40,27.22|1/.56,270.58/23.79,26.65|
| escort20 |.17/0,139.99/37.63,29.17|.36/0,140.61/4.53,31.92|.32/0,148.82/1.17,30.78|
| waves8 |1/1,353.14/69.68,31.75|1/1,355.04/53.06,32.40|1/1,360.51/49.64,32.40|
| support8 |1/1,310.19/71.60,28.44|1/1,312.38/70.94,28.78|1/1,338.17/42.63,29.67|
| duo8 |.89/.89,153.50/47.22,12.41|1/1,196.08/17.01,13.96|.99/.99,182.39/13.42,13.51|
| duo20 |.14/.14,135.81/41.22,12.60|.60/.60,149.94/8.31,15.70|.39/.39,145.46/3.54,14.14|
Paired wins guardian-only/commander-only: escort20 7/4, duo20 17/2, duo8 1/0. Guardian redirects 1.47/run duo20, commander transfers 36; both pay actions. On support8 commander has higher actual HP but lower protection and slower wins; combined HP+Protection is NOT superior, so avoid claiming unconditional superiority. Base wins faster/retains protection in safe waves; neither specialization grants a passive stat boost (C1 rush negative control). Both branch effects are actual native events. Recommendation: preserve existing cooldown 2 and effects, no global tuning now; human policy may differ, needs real playtest.
## Adventure: candidate level 7 / hold eight ally actions
Development sweep same actual enemy pack as C1, levels 4/6/8/10/12 + fine 7/8, hold 6/7/8/9/10 as specified in runner. Level 4 near universal success; L6 starter direct 17/18, L8 starter 11/18 and pilot 11/18; L7 starter 11/18, pilot 17/18, team6 18/18. Hold8 all 54/54 for L7. Candidate locked before fresh validation, no further tuning based on validation. Levels are stress/encounter fixture values, not approved story-level or global scaling. No need for grind or mandatory special; current two NPC archetypes are mechanics candidates, visual enemy depiction must fit scenario.
Fresh candidate:
| profile | direct successes / mean actions on wins | hold8 successes / mean actions | hold8 recovered/left |
|---|---|---|---|
| starter |31/36,12.26|36/36,8|0/36|
| pilot |35/36,11.94|36/36,8|0/36|
| team6 |36/36,11.14|36/36,8|0/36|
| team12 |36/36,10.44|36/36,8|1/35|
| team20 |36/36,9.19|36/36,7.94|15/21|
Direct starter rush 11/12; reactive 10/12, protect 10/12. Starter mean terminal HP direct 144.72 vs hold 172.14, protection 41.31 vs 38.97. Direct always recovered on verified success; 16 advanced hold wins recovered by actual no-living-enemy terminal state. Thus two meaningful options, no guaranteed recovery through safe path at starter, no false penalty if actual early win. Route UI explicitly both heroes alive; 8 actions counted by native allyActions, not rounds or seconds; communicate objective without claiming an actual measured evacuation duration. Strong late profile variants are explicit fixtures, not proof players will reach those levels in this story. 
## D handoff
Candidate recommendation, not approved production difficulty. Freeze mechanics for D; implement mission-specific wrapper actual native outcome and both heroes alive, no forced special/skill threshold, actual chapter II receipt gate, optional no energy candidate. First outcome atomically durable (no separate lab save). Distinguish held with live enemies vs eliminated; proof rejects inactive false, missing/dead hero, early held, enemy win. Tied held and no enemies -> recovered. No fictional or client boolean proof; classifier research fixtures do not authorize actual progress. Do not copy entire private story to public docs, use approved visible scene data only. Real story/UX/3D resource lifecycle/skip/reload/abandon/defeat/retry/atomic write tests, screenshots and physical iPhone remain open. No new runtime or art in C. If user accepts candidate, D is next after CI; no claim final balance before real player and visual evaluation.
