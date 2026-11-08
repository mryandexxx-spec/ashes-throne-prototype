"use strict";
// Regression: Protection is the top bar, HP below it, initiative last.
// Both numeric resources and their semantics remain unchanged.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const game=fs.readFileSync(path.join(__dirname,"..","game.js"),"utf8");
const start=game.indexOf('return `<div class="arena-indicator ');
const end=game.indexOf('</div>`;',start);
assert.ok(start>0&&end>start,"arena fighter template exists");
const render=game.slice(start,end);
const shield=render.indexOf("${protectionLine}");
const hp=render.indexOf('class="arena-health"');
const meter=render.indexOf('class="arena-initiative"');
assert.ok(shield>=0&&shield<hp&&hp<meter,
 "Protection must display above HP; initiative remains under both");
assert.match(game,/BATTLE_SPEED_SAVE_KEY="ashes-throne\.battle-speed\.v1"/);
assert.match(game,/restoreBattleSpeed\(\);/);
const resetStart=game.indexOf("function resetBattle(){");
const resetEnd=game.indexOf("\n}",resetStart);
assert.ok(resetStart>0&&resetEnd>resetStart);
assert.doesNotMatch(game.slice(resetStart,resetEnd),/BattleSpeed\.reset\(/,
 "restart must not discard the selected speed");
console.log("UI-001: Protection above HP and speed not reset between battles");
