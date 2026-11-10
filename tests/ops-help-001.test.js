"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,".."),read=f=>fs.readFileSync(path.join(root,f),"utf8");
const html=read("index.html"),css=read("styles.css"),game=read("game.js");
const op=require("../operation-core.js"),signal=require("../signal-operation-core.js");
const pkg=JSON.parse(read("package.json"));
function screen(id,end){
 const start=html.indexOf('<section id="'+id+'"');
 assert.ok(start>=0,id+" screen exists");
 const finish=html.indexOf('<section id="'+end+'"',start);
 assert.ok(finish>start,id+" bounds found");
 return html.slice(start,finish);
}
const overview=screen("operations","operationResult");
const local=screen("signalOperations","signalOperationResult");
test("OPS-HELP-001: two native closed-by-default help disclosures are reachable",()=>{
 assert.match(overview,/<details class="ops-guide" id="opsGuide"/);
 assert.match(local,/<details class="ops-guide" id="signalGuide"/);
 for(const source of [overview,local]){
  assert.equal((source.match(/<details\b/g)||[]).length,1);
  assert.equal((source.match(/<\/details>/g)||[]).length,1);
  assert.equal((source.match(/<summary>/g)||[]).length,1);
  assert.ok(source.indexOf("<summary>")<source.indexOf("</summary>"));
  assert.doesNotMatch(source,/<details[^>]*\bopen(?:\s|=|>)/);
 }
 assert.ok(overview.indexOf('id="opsGuide"')<overview.indexOf('class="sig-operation-entry"'));
 assert.ok(local.indexOf('id="signalGuide"')<local.indexOf('class="ops-layout"'));
 assert.match(overview,/Два курьера/);
 assert.match(overview,/Тревожный сигнал/);
 assert.match(local,/Подсказка: как остановить тревогу/);
});
test("help text covers actual operation choices without invented rewards or persistence",()=>{
 assert.deepEqual(op.availableOrders(op.start("A","help-op")),["register","block","extract"]);
 const opText=overview.slice(overview.indexOf('id="opsGuide"'),overview.indexOf("</details>"));
 for(const term of ["Сверить реестр","Проследить курьеров","Подготовить отход",
  "перекрыть развилку","две волны","сопоставь знаки","тихое проникновение",
  "связного","одной массовой атакой","Окружение","с первого хода","без экономических наград"])
   assert.ok(opText.toLowerCase().includes(term.toLowerCase()),term);
 const signalText=local.slice(local.indexOf('id="signalGuide"'),local.indexOf("</details>"));
 for(const term of ["Разведка","подготовка отхода","Тихий штурм",
  "первым погибнет другой страж","одним действием","Окружение",
  "две волны","скрытность потеряна","Энергия не тратится"])
   assert.ok(signalText.includes(term),term);
 const run=signal.chooseAssault(signal.prepare(signal.start("shade","help-signal"),"survey"),"quiet");
 assert.equal(signal.battlePlan(run).kind,"singleWave");
 assert.deepEqual(Array.from(signal.finalChoices({...run,phase:"final",battleResult:"ally",
  firstLoss:"shade",outcome:"clean"})),["cover","ledger","leave"]);
 const cordon=signal.chooseAssault(signal.prepare(signal.start("ves","help-cordon"),"extraction"),"cordon");
 assert.equal(signal.battlePlan(cordon).kind,"twoWaves");
});
test("help is touch-friendly, preserves existing handlers and aligns version",()=>{
 assert.match(css,/\.ops-guide>summary\{[^}]*min-height:44px/);
 assert.match(css,/\.ops-guide-columns\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:620px\)\{\.ops-guide-columns\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/@media\(orientation:landscape\) and \(max-height:540px\)/);
 assert.ok(game.includes('if(id==="operations")renderOperations()'));
 assert.ok(game.includes('if(id==="signalOperations")renderSignalOperations()'));
 assert.ok(html.includes('data-screen="signalOperations"'));
 assert.ok(html.includes('data-ops-order=')===false,"buttons are built dynamically as before");
 assert.equal(pkg.version,"0.3.86");
 assert.ok(html.includes('id="buildVersion">Прототип · v0.3.86 · ROSTER002 + OPSHELP + RENPLAY'));
 assert.ok(html.includes('src="signal-operation-core.js"'));
});
