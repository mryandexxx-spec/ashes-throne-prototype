"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const html=read("index.html"),styles=read("styles.css"),game=read("game.js");
const battle=html.split('<section id="battle"')[1]?.split("</section>")[0];
assert.ok(battle);
for(const id of ["currentFighterHud","currentFighterSide","currentFighterLevel",
  "currentFighterName","currentFighterHp","currentFighterStats","currentFighterHealthFill"]){
 assert.match(battle,new RegExp('id="'+id+'"'),id+" inside the arena");
 assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id+" unique");
}
assert.match(styles,/\.battle-screen \.current-fighter-hud\s*\{[^}]*top:calc\(/);
assert.match(styles,/\.battle-screen \.current-fighter-hud\s*\{[^}]*right:max\(/);
assert.match(styles,/pointer-events:none/);
assert.match(game,/state\.fighters\[state\.currentActor\]/);
assert.match(game,/Number\.isInteger\(actor\.level\)/);
assert.match(game,/function renderCurrentFighterHud\(\)/);
assert.match(html,/v0\.3\.8 · CBA008D/);
console.log("Combat-008D in-arena current-fighter panel structure and version passed");
