"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const html=read("index.html"),css=read("styles.css"),game=read("game.js");
const battle=html.split('<section id="battle"')[1]?.split("</section>")[0];
assert.ok(battle);
assert.match(battle,/<canvas id="renderCanvas"[^>]*><\/canvas>\s*<div id="arenaIndicators"/,
 "overheads must be inside full-screen arena directly after canvas");
assert.match(css,/\.battle-screen \.arena-indicators\s*\{[^}]*pointer-events:none/,
 "label overlay must not steal canvas taps");
assert.match(css,/\.battle-screen \.arena-indicator\s*\{[^}]*pointer-events:none/,
 "each fighter label must ignore pointer input");
assert.match(game,/radius:12,targetY:\.9/,"initial camera starts at former maximum zoom");
assert.match(game,/lowerRadiusLimit=12;arenaCamera.upperRadiusLimit=21/,"zoom limits unchanged");
assert.match(game,/Math\.min\(100,Math\.max\(0,\(h\.meter\|\|0\)\/10\)\)/,
 "initiative display uses real fighter meter, 0..1000");
assert.match(game,/renderArenaIndicators\(\)/);
assert.match(game,/positionArenaIndicators\(\)/);
assert.match(game,/Vector3\.Project\(/,"indicator positions follow 3D actors");
assert.match(game,/screen\.x\*cssWidth\/width/,"retina CSS projection corrected");
assert.match(html,/v0[.]3[.]75 · OPS002B/);
console.log("Combat-008C overhead HUD and unchanged zoom boundaries passed");
