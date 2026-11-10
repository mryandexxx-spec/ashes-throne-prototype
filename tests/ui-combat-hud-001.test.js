"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("styles.css"),html=read("index.html"),game=read("game.js");
const start=css.indexOf("/* UI-COMBAT-HUD-001"),art=css.slice(start);
test("UIHUD001 is a contained bronze-graphite skin over existing 3D battle",()=>{
 assert.ok(start>0);
 for(const text of [".battle-top",".action-panel",".ability-slot .ability-btn",
  ".battle-top>.target-fighter-hud",".arena-utility .combat-log",
  ".fighter-inspect-panel",".battle-message",".battle-reward"])
  assert.ok(art.includes(text),text+" styled");
 assert.doesNotMatch(art,/url\(/);
 assert.doesNotMatch(art,/position:\s*(fixed|absolute)|pointer-events:|touch-action:|z-index:|grid-template-columns:|width:\s*\d|height:\s*\d|blur\(/);
 assert.match(css, /\.battle-screen #renderCanvas\{position:absolute;inset:0/);
 assert.match(css, /\.battle-screen \.arena-hud\{position:absolute;z-index:2;pointer-events:none\}/);
 assert.match(css, /body\.battle-mode\{overflow:hidden;height:100dvh\}/);
});
test("UIHUD001 retains the action buttons, focus, disabled and auto states",()=>{
 for(const id of ["battle","renderCanvas","arenaIndicators","targetFighterHud","battleStatus",
  "autoBattleBtn","autoSpeedBtn","turnChip","abilityOptions","basicAbilityBtn",
  "specialAbilityBtn","powerfulAbilitySlot","powerfulAbilityBtn","abilityTooltip",
  "battleRetryBtn","battleLog","battleReward","battleMessage","fighterInspect","inspectClose"])
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 assert.match(art, /#autoBattleBtn\[aria-pressed="true"\]/);
 assert.match(art, /\.ability-slot \.ability-btn\.selected/);
 assert.match(art, /\.ability-slot \.ability-btn:disabled/);
 assert.match(art, /\.ability-slot \.ability-btn:focus-visible/);
 assert.match(art, /\.arena-utility \.combat-log summary:focus-visible/);
 assert.match(game, /setAutoBattle\(/);
 assert.match(game, /function syncBattleUI\(\)/);
 assert.match(game, /#battleRetryBtn"\)\.addEventListener\("click"/);
});
test("UIHUD001 does not replace 3D interactions or inspection lifecycle",()=>{
 assert.match(html,/class="screen battle-screen" aria-label="Полноэкранная боевая арена"/);
 assert.match(game, /#fighterInspect/);
 assert.match(game, /#autoSpeedBtn/);
 assert.match(game, /#abilityTooltip/);
 assert.match(css, /\.battle-screen \.arena-indicators\{/);
 assert.match(css, /\.battle-screen \.fighter-inspect\[hidden\]\{display:none!important\}/);
 assert.match(css, /\.battle-screen \.ability-slot\[hidden\]\{display:none!important\}/);
 assert.match(css, /\.battle-screen \.ability-tooltip\[hidden\]\{display:none!important\}/);
});
test("UIHUD001 is motion-conscious and version is synchronized",()=>{
 assert.match(art, /@media\(prefers-reduced-motion:reduce\)/);
 assert.match(art, /\.arena-protection span/);
 assert.equal(JSON.parse(read("package.json")).version,"0.3.103");
 assert.match(html,/v0\.3\.103 · UIHUD001/);
});
