const __BUILD_VERSION_FOR_TESTS=require("../package.json").version;
"use strict";
// Combat-008D introduced the selected-target card. ARENA-UI-003 replaced it:
// the target is shown on the scene (cursor + red ring), the acting hero
// bottom-left, the controls in the upper and lower HUD rows.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const html=read("index.html"),styles=read("styles.css"),game=read("game.js");
const battle=html.split('<section id="battle"')[1]?.split("</section>")[0];
assert.ok(battle);
for(const id of ["targetFighterHud","targetFighterSide","targetFighterLevel",
  "targetFighterName","targetFighterHp","targetFighterStats","targetFighterHealthFill"])
 assert.doesNotMatch(html,new RegExp('id="'+id+'"'),id+" removed with the target card");
assert.doesNotMatch(game,/function renderTargetFighterHud\(\)/);
// The selected target is still derived from the real selection and side of the pending ability.
assert.match(game,/h\.side==="enemy"&&state\.fighters\[state\.selectedEnemy\]\?\.id===h\.id/);
assert.match(game,/arena-focus-cursor \$\{support&&h\.side==="ally"\?"available":"locked"\}/);
assert.match(game,/state\.selectedAlly/);
// Acting hero: one block bottom-left, from state.currentActor.
for(const id of ["activeHero","activeHeroPortrait","activeHeroName"]){
 assert.match(battle,new RegExp('id="'+id+'"'),id);
 assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id+" unique");
}
assert.match(game,/const actor=state\.active\?fighters\[state\.currentActor\]:null;/);
assert.match(game,/renderActiveHero\(actor\);/);
// Controls: menu, log, Автобой/1× top-left (ARENA-ART-004G), queue under them, hero bottom-left.
const top=battle.indexOf('class="battle-top arena-hud"');
const queue=battle.indexOf('class="battle-queue arena-hud"');
const hero=battle.indexOf('class="battle-hero arena-hud"');
assert.ok(top>=0&&queue>top&&hero>queue,"top row, queue, hero row in order");
assert.ok(battle.indexOf('id="autoBattleBtn"')>top&&battle.indexOf('id="autoSpeedBtn"')<queue,"autoplay controls in the top row");
assert.doesNotMatch(battle,/class="battle-top-controls/);
assert.doesNotMatch(battle,/class="arena-roster"/);
assert.doesNotMatch(battle,/id="combatants"/);
assert.doesNotMatch(game,/function renderCombatants\(\)/,"unused roster renderer removed");
assert.match(styles,/#battle\.battle-screen \.battle-hero\{[^}]*bottom:max\(/);
assert.match(styles,/#battle\.battle-screen \.battle-queue\{[^}]*top:calc\(max\(/);
assert.ok(html.includes(`v${__BUILD_VERSION_FOR_TESTS} · `),"current build footer");
console.log("Combat-008D → ARENA-UI-003 target on scene, acting hero and control rows passed");
