# R2/C1 — native comparison baseline [В РАЗРАБОТКЕ]
26.11.2026. Working 0.3 accepted, private #83 merged 2b702f56, game #576 merged 576e1e00, CI 45888831302 green. Prior R1 commander advantage is the hypothesis to test, not a balance result. RPG skill applied. No changes to native runtime, art, live wallet or story. Native CombatCore, existing stat bridge + fresh gear/stars, Nada via actual direct grant (research profile), explicit level/skill fixtures (not actual production progression runs), existing NPC archetypes and opt-in treeR1 hit/crit; no invented counterfactual prevention. Six operation contexts, three profiles, three policies (rush negative control; reactive and protect), 12 predetermined seeds (six development/six new split), 1944 operation runs; five adventure variants (direct, hold4/6/8/10) × 3 profiles × 3 policies × 12 seeds = 540. Same enemy pack for both routes. Paired runs, heuristic policies, samples not independent players. High pressure NPC levels are stress fixtures, not proposed world difficulty. Count actual legal personal opportunities, uses, redirects, transferred protection, terminal roster, actions, goals and bag outcome; count event batches once after each real ally action. Native hold can occur before all enemies defeated check; derive bag from actual remaining enemies. Neither technique used for adventure. No mandatory special use. V8 native script executed, 2484 runs, zero rush mismatch, invariant pass. Node CI pending. Runner design/aud003-tree-r2c.js, tests/aud003-tree-r2c.test.js. 
## Actual C1 output
Operations, two tactical policies only, n=72 per build per context. Fields win/all alive / mean total ally HP / actions / personal uses / redirects / transferred protection. Values rounded; mean HP includes losses and dead allies.
| context | base | guardian | commander |
|---|---|---|---|
| escort4 | 1/.31 /236.89 /25.67 /0 /0 /0 | 1/.69 /275.82 /27.17 /1.86 /1.47 /0 | 1/.53 /274.36 /26.57 /1 /0 /41.06 |
| escort20 | .17/0 /136.92 /20.94 /0 /0 /0 | .38/.06 /153.78 /27.24 /2.50 /2.26 /0 | .31/0 /150.36 /24.72 /1 /0 /40 |
| waves8 | 1/1 /356.74 /31.38 /0 /0 /0 | 1/1 /358.29 /31.58 /1.85 /1.58 /0 | 1/1 /361.71 /31.78 /1.39 /0 /38.21 |
| support8 | 1/1 /310.24 /27.96 /0 /0 /0 | 1/1 /312.50 /28.35 /.39 /.19 /0 | 1/1 /336.67 /29.06 /1.53 /0 /39.64 |
| duo8 | .78/.78 /154.19 /11.33 /0 /0 /0 | 1/1 /201.99 /13.64 /2.06 /1.31 /0 | 1/1 /185.93 /13.21 /1 /0 /36 |
| duo20 | .17/.17 /135.83 /8.64 /0 /0 /0 | .58/.58 /154.58 /13.78 /1.99 /1.50 /0 | .50/.50 /147.50 /11.96 /1 /0 /36 |
Split results (n216 per build per split): development success/all alive base .69/.54 guardian .87/.75 commander .81/.67; second split base .69/.55 guardian .79/.70 commander .79/.67. No evidence of commander universally dominating guardian; guardian shines in telegraphed single-target pressure. Commander higher remaining HP in support8. Note base faster partially because early loss ends fight; do not conclude speed advantage from unconditional average alone. Terminal HP must be read with remaining protection, deaths and wins. C2 needs conditional-on-success action cost and paired comparisons (and fresh unseen seeds, both C1 splits now inspected). Do not buff guardian just because R1 showed weakness.
Adventure n36 per variant/profile, all 540 eligible and both alive. Means actions and recovered/left counts:
| route | starter | pilot | team6 |
|---|---|---|---|
| direct |10.86,36/0|10.81,36/0|9.97,36/0|
| hold4 |4,0/36|4,0/36|4,0/36|
| hold6 |6,0/36|6,0/36|6,0/36|
| hold8 |8,1/35|8,1/35|8,4/32|
| hold10 |9.81,16/20|9.81,18/18|9.64,25/11|
All pass without a forced special; at NPC L1 no meaningful risk difference in these policies. Hold4/6 guarantee loss of bag under tested policies, hold10 close to direct, too little safety tradeoff. Need C2 stress the mission with genuinely distinct outcomes and measure survival/HP conditional on success; don't artificially add an arbitrary gate or money rewards. Prefer test enemy compositions and difficulty before global changes. Held-out fresh seeds and scripted edge cases (both alive, held tie, loss) before D. No player sample, browser, physical iPhone or blocking/staging yet. No production balance changes. 
