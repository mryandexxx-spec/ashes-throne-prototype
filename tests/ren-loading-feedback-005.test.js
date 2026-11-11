const __BUILD_VERSION_FOR_TESTS=require("../package.json").version;
"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const html=read("index.html"),css=read("styles.css"),game=read("game.js");
const runtime=read("ren-glb-runtime.js"),card=read("ren-card-3d.js"),logic=require("../ren-glb-runtime.js");
test("REN-LOAD-005: build footer and asset cache-busters are synchronized",()=>{
 assert.equal(JSON.parse(read("package.json")).version,`${__BUILD_VERSION_FOR_TESTS}`);
 assert.match(html,/v\d+\.\d+\.\d+ · UIHUD001.*RENLOAD005/);
 for(const asset of ["styles.css","game.js","ren-glb-runtime.js","ren-card-3d.js"])
  assert.ok(html.includes(asset+`?v=${__BUILD_VERSION_FOR_TESTS}`),asset);
});
test("REN-LOAD-005: card has noninteractive overlay, live text and progress",()=>{
 assert.match(html,/id="renCardLoadIndicator"[^>]*hidden/);
 assert.match(html,/id="renCardLoadingText"/);
 assert.doesNotMatch(html,/id="renCardLoadingProgress"/);
 assert.match(card,/loading\("Загружаем Рена…"/);
 assert.match(card,/endLoading\(\)/);
 assert.match(card,/loading\("Загружаем Рена…"/);
 assert.match(css,/ren-loading-indicator[^\{]*\{[^}]*pointer-events:none/);
 assert.match(css,/prefers-reduced-motion:reduce[^}]*ren-loading-spinner/);
 assert.match(html,/id="renCard3DStatus" role="status" aria-live="polite"/);
});
test("REN-LOAD-005: battle HUD renders loading/progress/ready/error states without overlaying input",()=>{
 assert.match(html,/id="renModelBattleStatus"[^>]*hidden role="status"/);
 assert.doesNotMatch(html,/id="renModelBattleProgress"/);
 assert.match(game,/info\.dataset\.status=kind/);
 assert.match(runtime,/ImportMeshAsync/);
 assert.match(runtime,/onStatus\("ready"/);
 assert.match(runtime,/onStatus\("error"/);
 assert.match(css,/#renModelBattleStatus[^\{]*\{[^}]*pointer-events:none/);
 assert.match(css,/#renModelBattleStatus\[data-status="ready"\]/);
 assert.match(css,/#renModelBattleStatus\[data-status="error"\]/);
 assert.doesNotMatch(card,/localStorage|sessionStorage|CombatCore\.|ProgressCore\./);
 assert.doesNotMatch(runtime,/localStorage|sessionStorage|CombatCore\.|ProgressCore\./);
});
