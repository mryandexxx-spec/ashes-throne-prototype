# AUD003-B13.3 — тактическая глубина, роли, доверие и контрмеры
25.11.2026 · **[ПРЕДЛОЖЕНИЕ / В РАЗРАБОТКЕ]**. B13.2 PR #533 merged 92f3ffac, CI #45630785425 success; current V11 blob 68dfc45f8a409f8f7c9ac1362e32ad61414cc5bc unchanged. Read B13.2, HERO_TRUST_DESIGN_0.1, research 0.3, relevant V11 source; continue research workflow and previously read RPG skill. No production, GDD, save or lore changes. No new fictional biography.

## Method
Two successive experiments, 6180 + 2880 = 9060 simulated battles executed in V8 using actual V11 source and research-only stable tie adapter from B13.2. Separate Node runners and exact JSON cell aggregates: aud003-b13-tactical-depth{,-v2}.js and corresponding -results.json. Run under Node to reproduce (not separately executed under Node here). First study seeds 124000–130000, second 132000, 20–40 per cell. W/Q: wins / wins meeting proxy (assault HP>=35%, hold escort>=90, intercept HP>=70%). Not approved star thresholds or player experience. Paired seeds do not guarantee matching subsequent random draws. No production parity. V11 source not altered. Role replacement changes selected action kind to direct hit with same multiplier and cooldown: replaces a support opportunity, not a pure effect ablation. Art/Liora etc tested as existing research kits, role placeholders are not canonical recruits.

## Iteration 1 — role opportunity, not rarity or power
A/B/C/D (V11 teams 0,1,2,6), mixed threats, harder assault/hold/intercept (enemy attack .9, speed x1.1; hold t42, intercept t34), 4 teams x20:
| Role removed/replaced | Assault W/Q | Hold W/Q | Mean escort HP | Intercept W/Q |
|---|---:|---:|---:|---:|
| base |20/7|80/80|114.93|80/79|
| mark |13/6|80/72|109.70|80/79|
| guard |20/7|80/78|113.69|80/80|
| disrupt |22/7|80/50|85.16|80/80|
| heal |26/7|80/80|114.72|80/79|
| coordination |16/0|80/73|108.47|80/80|

Mark and coordination matter in certain contexts. Guard scarcely chosen; replacing heal with attacks can help in an over-punishing assault, not proof that healing is useless. In hold, removing disrupt reduces high-quality outcomes; prevented damage rises via guard (0.92→21.66) and kills of preparing enemies increase (0.79→0.97 per battle). Good evidence for alternative response paths, but the easier hold/intercept saturate wins and often Q. Intercept still 80/80 without disrupt because direct damage/kill can satisfy goal; intercept currently insufficiently discriminating. Assault at hard setting only 1 of 4 teams approaches viable win target. Do not compensate by forcing an imbalanced mandatory roster.

Smaller teams 2–4, normal conditions: basic vs tactical 100 cases each. Assault W/Q 100/79 vs 100/99. Hold 100/0 vs 100/93, mean escort HP 58.86 vs 103.45 (combat team HP .75 vs .69; meaningful sacrifice), intercept 80/80 vs 100/100. This suggests useful early demonstration of protection and coordination, not actual newbie competence. Basic still includes Nada's marking basic and damage threshold can interrupt. Team 8 fails basic intercept but succeeds tactical; not necessarily a tutorial defect, must make the cause visible.

## Trust — reject the passive stat shortcut
All five current sidegrades applied together vs none, 120 paired cases per mode at equal gear-like modifiers:
| Mode | No trust W/Q | Sidegrades W/Q |
|---|---:|---:|
| hard assault |34/6|30/8|
| hard hold |120/120|120/120|
| hard intercept |120/118|120/120|
With HP and atk x1.15 (proxy gear, not full stat pipeline) and greedy enemies, assault 120/79→120/71, hold 120/115→120/120, intercept 120/120 both. Gear and policy change together between the two blocks; don't attribute differences between blocks solely to gear. Inside each block matched. Individual trust results recorded separately. Current sidegrades neither reliable growth nor clearly attractive specialization; don't approve them as final. Prior +8% damage shortcut already rejected. Trust I must be fully functional, no hidden penalty, consent separate from combat power. Candidate long-term personal track in HERO_TRUST remains proposal.

## Iteration 2 — actual countermeasure windows
Nine deterministic controlled snapshots (not played full turns). Constructed active Art, known target HP, pending enemy charge, legal responses; directly resolve ONLY original pending attacks using L.act, deliberately exclude ordinary follow-up actions, CD/meter advancement and expiry. Earlier fixture that assumed interrupted actor skipped its turn failed; corrected by explicitly isolating damage resolution; interrupt does NOT delete enemy's next ordinary turn. Results are local causal evidence, not forecast of whole battle. Damage variance held at 1.
| Situation | Ordinary hit: target HP after | Guard | Disrupt |
|---|---:|---:|---:|
| one strong attack, escort 115 HP |71.48|97.73|115|
| low-health attacker, 20 HP |115|97.73|115|
| interrupt on CD, escort 42 HP |0 (loss)|24.73|unavailable|
| two strong threats, escort 80 HP |0 (loss)|19.20|36.48|
| two strong threats, existing shelter |0|24.45|36.48|
| two strong threats, candidate shelter |0|38.89|36.48|
| two weak threats, candidate shelter, escort 65 HP |26.31|65|45.66|
| two weak threats, existing shelter |26.31|45.66|45.66|

On ordinary combat ally guard can trigger counter (in fixture Ren retaliates); escort cannot. A kill can be more economical than consuming special cooldown. Disrupt dominates single heavy preparation when available and not lethal; guard preserves life when interrupt unavailable; guard only wins on prevention in specific multi-hit scenarios when pool retained. Candidate Art shelter: 1.75x base cover (current 1.2x), same expiry, retain remainder across hits, no counter; not a general Protection layer. Candidate Sava tempo: 400 meter vs base250/current300, same damage cost, cap950, no chain. Candidate changes are opt-in source adapter in runner, not V11 feature. Combined Art/Sava candidate vs existing pair in 2880 complete battles, different seed block. Assault at .78: base132/41 out of160, existing132/37, candidate132/37; at .9: base42/7, existing35/9, candidate35/9. Hold 160/159 across both difficulties and all variants; intercept 160/157–160. Candidate barely alters overall outcomes because tactical policy often doesn't use guard and Sava's recipient selection/cap wastes extra meter; cannot claim causal effect of each candidate individually in this combined batch. It is not acceptable to merely keep increasing coefficients. No limits in first experiment; second raw records retain limits.

## Design recommendation (not approved)
1. Preserve three understandable responses: eliminate weakened attacker (standard attack, preserves CD), interrupt a single dangerous preparation, protect a threatened unit when interrupt is unavailable or several hits threaten. Target, estimated threat, relative order, duration and cooldown must be visible BEFORE commitment. Do not require exact damage arithmetic; use clear danger/target and state. No mandatory cinematic stop or separate tutorial text wall.
2. Differentiation is about action windows, not five varieties of damage. Ren finishing exposed targets; Art reactive point protection; Nada marks/observation and interrupts; Liora multi-ally protection; Sava coordinating opportunities. These are candidate gameplay roles from prior work, not new canon. Avoid making all these heroes mandatory or trust specialization required for counters. Other roster roles/alternative kits can solve same objective by different means. Healing and sustained defenses need situations with recoverable pressure instead of pure burst.
3. Keep the pool shelter as an explicit candidate for a controlled manual trial, NOT an approved trust bonus. Show amount left and expiry, no repeated retaliation; compare size vs duration separately, including normal attack spam and interactions with shield/armor, expiration, wave transition and non-stacking. Sava extra meter rejected as default until recipient opportunity/actual turn advancement measured, not just amount. Test a more understandable ally selection and compare single tap/automatic vs explicit choice; don't add an extra tap on every move without evidence.
4. A coherent role must be useful at trust I; high trust offers a recognizably different playstyle with bounded upside/trade-off. Do not confuse trust with passive global attack, mandatory farming, or UI showing a perk never selected. No final numerical tier changes. Keep independent recruitment and narrative consent.
5. Rework stress encounters rather than simply tuning hero power. Early 2–4 teams hold objective demonstrates skill differences; long fight and mixed-threat design need distinct counter/kill windows and nontrivial loss/quality, including at least two independent viable squads. Still no evidence for 2+ robust hard assault compositions under all stress profiles.

## Gate and continuation
B13.3 mathematical/fixture research slice done; B13.4 must actually inspect the playable lab and perform manual scenarios or browser-supported interactions. Direct fixture snapshots are not real player playtests; UI preview/physical iPhone, actual FP→I→II→Nada (A) and human engagement remain unverified. B13.5 synthesis only after evidence, identify any unclosed gate; C/D/E/chapter III remain paused. For B13.4 assess single telegraph, interrupt CD, low-health threat, simultaneous threats, scope of guard, and Sava receiver/readiness, evaluate novice comprehension and time/taps. If lab cannot load, record exact blocker; do not pretend to have played. Next chat starts with PROJECT_STATUS/ROADMAP, this report, B12 and source main.