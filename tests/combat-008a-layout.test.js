"use strict";
// Combat-008A: structural contract. Functional battle scenarios remain in the
// existing headless UI tests; native Safari layout still needs device acceptance.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const html=read("index.html"),css=read("styles.css"),game=read("game.js");
const battle=html.split('<section id="battle"')[1]?.split("</section>")[0];
assert.ok(battle,"battle screen section exists");
assert.match(battle,/<div class="arena-wrap">\s*<canvas id="renderCanvas"/);
const required=[
 "battleMissionLabel","battleStatus","autoBattleBtn","autoSpeedBtn",
 "turnChip","battleMessage","battleReward","targetFighterHud","battleLog",
 "battleLogSummary","battleLogEntries","actionTitle","actionHint",
 "basicAbilityBtn","specialAbilityBtn","battleRetryBtn"
];
for(const id of required){
 assert.match(battle,new RegExp('id="'+id+'"'),id+" must be inside arena");
 assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id+" unique");
}
const canvasAt=battle.indexOf('id="renderCanvas"');
for(const id of required)assert.ok(battle.indexOf('id="'+id+'"')>canvasAt,id+" follows canvas as HUD");
assert.doesNotMatch(battle,/<details class="arena-roster">/,"redundant roster is removed");
assert.doesNotMatch(battle,/id="combatants"/,"fighter list is no longer in arena");
assert.match(battle,/<details class="combat-log"/,"combat log remains available");
assert.doesNotMatch(battle,/id="attackBtn"/,"separate attack action was removed");
assert.match(battle,/id="abilityTooltip"/,"ability hint exists");
assert.ok(battle.indexOf('id="battleLog"')>0,"combat log remains available");
assert.match(css,/\.battle-screen\.active\s*\{[^}]*position:fixed;inset:0/);
assert.match(css,/\.battle-screen \.arena-wrap\s*\{[^}]*position:absolute;inset:0/);
assert.match(css,/\.battle-screen #renderCanvas\s*\{[^}]*position:absolute;inset:0/);
assert.match(css,/body\.battle-mode\{[^}]*overflow:hidden/);
assert.match(css,/env\(safe-area-inset-(left|right)/);
assert.match(css,/\.battle-screen \.arena-hud\{[^}]*pointer-events:none/);
assert.match(game,/document\.body\.classList\.toggle\("battle-mode",id==="battle"\)/);
assert.ok(html.indexOf('id="buildVersion"')>html.indexOf("</section>",html.indexOf('<section id="battle"')),"footer stays outside battle");
assert.match(html,/v0\.3\.34 · PVS001B/);
console.log("Combat-008A fullscreen arena structure, in-arena HUD and version passed");
