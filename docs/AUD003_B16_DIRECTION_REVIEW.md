# AUD003-B16.1–B16.2 — direction review and acceptance

25.11.2026 · **[В РАЗРАБОТКЕ / ПРЕДЛОЖЕНИЕ]** · owner started B16.1–B16.2. Working subdivision (not a recovered approved definition): B16.1 critical evidence review and focused diagnostic; B16.2 prepare owner playtest/decisions. No kit, number, role, canon or production integration approved by this command. Base 8fc16dc07f81eb18d2ab6e4d577604cef311667f. [B15.2D](AUD003_B15_2D_INTEGRATED_VALIDATION.md) #546 merged; selective CI 45665396785 and mobile lab 45665397027 successful. A/B remain open; C/D/E/III paused.

## B16.1 — test alternatives before blaming synergy
Prior independent G13 hard duel (20 seeds, reversed slots): Sava candidate full 20 wins, alternative without Ren 11, without both Ren/Nada 4. Independent waves 17/20. At G7 hard independent duel 0/20, rush 0/20. This is not proof Ren/Nada are overpowered: two synthetic roles inherit real hero stats, lab AI and enemy pressure are not production missions. Full B15 rejected.

New diagnostic (actual B15D engine, B14.6 + capped Sava, same pinned sources/calibration, no live changes):
- [Script](research/aud003-b16-pressure.js) and [data](research/aud003-b16-pressure-results.json): 480 completed V8 battles, 80 cells ×6 new seeds. G7/G13, duel/rush, full/alternative/independent plus existing abstract medic replacing one defender. Enemy durability (HP AND Protection) and raw attack independently scaled .8 or kept 1. No speed, defense formula, or actual hero stats modified. 4 unmodified-control equality checks pass against original engine. Same seed/scale within each matched cell, normal order. Initial medic squads reorder slots too, so not a clean comparison of replacement.
- [Holdout script](research/aud003-b16-pressure-holdout.js) / [data](research/aud003-b16-pressure-holdout-results.json): 288 completed battles, 24 cells ×12 fresh seeds, both slot orders reversed; each medic replaces only the relevant defender's original slot. Baseline and both80, 4 more control parity checks pass. Total 768 matrix battles plus 8 parity pairs. Executed in V8 from fetched exact sources; Node/CI replay separate. No claim of browser/human test.
- First pass, across 4 tier/scenario cells (24 battles per factor, wins):
| Squad | base | HP/Protection .8 | attack .8 | both .8 |
|---|---:|---:|---:|---:|
| full |22|24|24|24|
| without Ren |8|18|16|24|
| independent |0|4|3|15|
| medic + Art (no Liora) |0|0|0|3|
| medic + Liora (no Art) |3|7|5|17|
- Holdout across 4 cells (48 per factor): independent 1/48 →28/48, no-loss wins 0→0; medic+Art 0→11/48, no-loss 0→0; medic+Liora 2→32/48, no-loss 0→9. At full pressure neither medic solves independent viability. At reduced pressure G13 rush medic+Liora 4/12 versus independent 5/12; G7 rush 6/12 versus 2/12. Avoid claiming universal superiority. This is not a balance recommendation of −20% for enemies.
- Criticism: cell samples small, not randomized human policies, same fixture names with inherited gear, synthetic pressure factor, holdout changes order AND seed; no confidence intervals. First pass role replacement confounded by ordering, addressed in second pass only. Two-wave layout differs in simultaneous opposition, duration and enemy archetypes, not a controlled single-variable test. No basis to blame solely Ren/Nada or defense. No more blind retuning of the five heroes.

**Recommendation:** preserve B14.6 + Sava as leading candidate, scaled Art+Sava alternative only, B14 Liora/Ren/Nada for now. Develop an actual independent attacker with sustained output, medic with distinct sustain and breaker with genuinely different interruption role before re-evaluating hard 5v5. Existing abstract medic+Liora is worth testing, not a new canonical character. Compare protected burst vs sustained damage vs recovery; equal gear/skill/tier, same NPC action sequences/policy, separate durability/offense/number of simultaneous threats, distinct seed and fixed slots. Require at least two meaningfully different viable full squads in same hard cases (threshold still to be agreed; report W/Q/pool/length separately). No global nerf or difficulty reduction to manufacture success. Preserve special Ren/Nada relationship; no leaders Art/Sava. Ren powerful secondary effect contradiction unresolved. Trust is separate; do not integrate until accepted.

## B16.2 — owner direction check, not production sign-off
[Existing mobile laboratory](https://mryandexxx-spec.github.io/ashes-throne-prototype/lab-combat-2/) (B15.2D). No saved progress or rewards, diagnostic presentation only. Use landscape; choose Settings, same seed 7, ordinary order, Liora leadership off. Start with manual taps (not Auto). Use same settings across compared variants; Compare is automatic outcome only.

| Short route | Settings | Observe |
|---|---|---|
| 1. First tactical choice | B14.6 control, L2 G1, starter Ren+Art, rush, ordinary | Can read enemy's announced target; kill, weaken or cover is meaningful; does not require Nada. |
| 2. New Sava | G1, Ren/Art/Sava, rush, ordinary; compare control → B14.6+new Sava | Does signal alter the upcoming order? Explicit target/helper intuitive? Is powerful visibly distinct from basic? |
| 3. Art vs Liora | G7, full five, area or rush, ordinary; compare new Sava → Art+Sava conservative | Personal cover vs group defense clear? Is protection expenditure readable? Avoid double counting. |
| 4. Collection depth | G13, full five then without Ren/Nada, duel and waves, hard; same candidate | Not an approval gate that can be passed by a single win. Is failure understandable or just stats? |
For every run: inspect threat, bars and action target; select same seed repeat; check victory/defeat and restart. Verify no clipped controls or global horizontal scrolling. iPhone and visual playability not checked by assistant. No 3D/art approval. Human judgement: meaningful alternatives, desire to replay, role differentiation, clear causal feedback, no repetitive taps. If player finds decision unclear, fix mechanic/UX first rather than buff.

Owner choices still needed: Sava explicit joint attack vs coordination window; Art targeted Protection interception vs B14 control; Ren powerful A single target vs B secondary area (see B15 §1); final numbers after further validation. May accept a direction, not the complete package. No approval inferred from start or green CI. Hard alternate viability, NPC/gear scaling, boss immunity, iPhone/human/artistic and production parity remain open. No changes to main game, GDD, Combat Specification, save or canon. Next after direction: role kit and scenario refinement; then independent validation and explicit sign-off before staged production integration. C/D/E/III stay paused.
