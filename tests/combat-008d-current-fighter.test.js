"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const html=read("index.html"),styles=read("styles.css"),game=read("game.js");
const battle=html.split('<section id="battle"')[1]?.split("</section>")[0];
assert.ok(battle);
for(const id of ["targetFighterHud","targetFighterSide","targetFighterLevel",
  "targetFighterName","targetFighterHp","targetFighterStats","targetFighterHealthFill"]){
 assert.match(battle,new RegExp('id="'+id+'"'),id+" inside the arena");
 assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id+" unique");
}
assert.match(styles,/\.battle-screen \.target-fighter-hud\s*\{[^}]*top:calc\(/);
assert.match(styles,/\.battle-screen \.target-fighter-hud\s*\{[^}]*right:max\(/);
assert.match(styles,/pointer-events:none/);
assert.match(game,/state\.fighters\[state\.currentActor\]/);
assert.match(game,/Number\.isInteger\(target\.level\)/);
assert.match(game,/CombatCore\.abilityTargetSide\(state,selectedAbility\)/);
assert.match(game,/state\.selectedAlly/);
assert.match(game,/state\.selectedEnemy/);
assert.match(game,/function renderTargetFighterHud\(\)/);
// The target HUD is now the third child of the upper row; controls live below.
const top=battle.indexOf('class="battle-top arena-hud"');
const target=battle.indexOf('id="targetFighterHud"');
const topEnd=battle.indexOf('</div>\n        <div class="battle-top-controls arena-hud"',top);
const controls=battle.indexOf('class="battle-top-controls arena-hud"');
assert.ok(top>=0&&target>top&&controls>target,"target is in upper row, controls below");
assert.match(battle,/class="battle-top-controls arena-hud"/);
assert.doesNotMatch(battle,/class="arena-roster"/);
assert.doesNotMatch(battle,/id="combatants"/);
assert.doesNotMatch(game,/function renderCombatants\(\)/,"unused roster renderer removed");
assert.match(styles,/\.battle-screen \.battle-top>\.target-fighter-hud\s*\{[^}]*position:relative/);
assert.match(styles,/\.battle-screen \.battle-top-controls\.arena-hud\s*\{[^}]*position:absolute/);
assert.match(html,/v0\.3\.40 · GEAR002C/);
console.log("Combat-008D selected-target panel structure and version passed");
