"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const html=read("index.html"),css=read("styles.css"),game=read("game.js");
const battle=html.split('<section id="battle"')[1]?.split("</section>")[0];
assert.ok(battle);
assert.doesNotMatch(battle,/id="attackBtn"/);
for(const id of ["basicAbilityBtn","specialAbilityBtn","basicAbilitySlot","specialAbilitySlot",
 "abilityTooltip","abilityTooltipTitle","abilityTooltipText","battleRetryBtn"])
 assert.ok(battle.includes('id="'+id+'"'),id+" must appear in arena");
assert.match(game,/function pressAbility\(abilityId\)/);
assert.match(game,/function applyManualAbility\(abilityId\)/);
assert.match(game,/CombatCore\.performPlayerAbility\(state,abilityId\)/);
assert.match(game,/if\(side==="ally"&&selectedAbility==="special"\)applyManualAbility\("special"\)/);
assert.match(game,/arena-focus-cursor/);
assert.match(game,/function showAbilityTooltip\(abilityId\)/);
assert.match(css,/\.battle-screen \.arena-focus-cursor/);
assert.match(css,/\.battle-screen \.ability-tooltip/);
assert.match(html,/v0[.]3[.]81 · OPSHELP/);
console.log("Combat-009 direct ability, ally focus and tooltip structural checks passed");
