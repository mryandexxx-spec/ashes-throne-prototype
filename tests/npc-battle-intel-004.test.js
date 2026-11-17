"use strict";
/* NPCUX004: visible tactical hints must not alter rules or leak OPS-002 secrets. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Intel=require("../npc-battle-intel.js");
const Adapter=require("../npc-story-ops-adapter.js");
const Npc=require("../npc-enemy-data.js");
const Trials=require("../lore-campaign-trials.js");
const Signal=require("../signal-operation-core.js");
test("NPCUX004: six archetype roles and actual skill descriptions",()=>{
 for(const [id,label] of [
  ["npc-pass-guard","Защитник"],["npc-trail-interceptor","Ближний бой"],
  ["npc-ridge-slinger","Стрелок"],["npc-route-signaller","Поддержка"],
  ["npc-field-medic","Лекарь"],["npc-watch-captain","Защитник"]
 ]){
  const f=Npc.spawn(id,{instanceId:id+"-test"});
  assert.equal(Intel.role(f),label,id);
  const lines=Intel.abilities(f);
  assert.equal(lines.length,4,id);
  assert.ok(lines.every(x=>typeof x==="string"&&x.length>10));
 }
 const healer=Npc.spawn("npc-field-medic");
 assert.match(Intel.abilities(healer).join(" "),/Наложить повязку/);
 assert.match(Intel.abilities(healer).join(" "),/36 HP/);
 assert.match(Intel.abilities(healer).join(" "),/перезарядка 2/);
 assert.match(Intel.abilities(healer).join(" "),/сопротивление эффектам \+5/);
 const guard=Npc.spawn("npc-pass-guard");
 assert.match(Intel.abilities(guard).join(" "),/защита от 2 ударов/);
 assert.equal(Intel.role({id:"ren",side:"ally"}),null);
 assert.deepEqual(Intel.abilities({id:"ren",side:"ally"}),[]);
 assert.equal(Intel.marker({id:"ves",side:"enemy",hp:100},{}),null);
 assert.equal(Intel.marker(null,{}),null);
});
test("NPCUX004: only the living FS-04 instigator has first-target marker",()=>{
 const node="five-shadows:fs-04";
 const fighters=Adapter.story(node,Trials.encounter(node)).first;
 const objective=Adapter.storyObjective(node,
  Trials.data.getNode(node).requiredBattleObjective);
 const battle={tacticalObjective:objective,priorityCleared:false};
 const marked=fighters.find(x=>x.id===objective.priorityEnemyId);
 assert.ok(marked);
 assert.equal(Intel.marker(marked,battle),"first");
 assert.equal(Intel.markerLabel(Intel.marker(marked,battle)),"ПЕРВАЯ ЦЕЛЬ");
 for(const f of fighters.filter(x=>x!==marked))
  assert.equal(Intel.marker(f,battle),null);
 assert.equal(Intel.marker(marked,{...battle,priorityCleared:true}),null);
 assert.equal(Intel.marker({...marked,hp:0},battle),null);
});
test("NPCUX004: OPS-002's secret bearer never leaks without earned survey intel",()=>{
 const assault="quiet";
 for(const bearer of ["ves","shade"]){
  const hidden=Signal.chooseAssault(Signal.prepare(
   Signal.start(bearer,"intel-hidden-"+bearer),"extraction"),assault);
  const exposed=Signal.chooseAssault(Signal.prepare(
   Signal.start(bearer,"intel-survey-"+bearer),"survey"),assault);
  const plan=Signal.battlePlan(exposed),enemies=Adapter.operation("OPS-002",plan).first;
  assert.equal(Signal.intel(hidden).signalId,null);
  assert.equal(Signal.intel(exposed).signalId,bearer);
  for(const f of enemies){
   assert.equal(Intel.marker(f,{},Signal.intel(hidden).signalId),null,
    "hidden recon path must not mark either guard");
   const kind=Intel.marker(f,{},Signal.intel(exposed).signalId);
   assert.equal(kind,f.id===Adapter.operationId("OPS-002",bearer)?"signal":null);
  }
  assert.equal(Intel.marker(enemies[0],{},null),null);
  assert.equal(Intel.marker(enemies[0],{},"invalid"),null);
 }
});
test("NPCUX004: assault-focus hints only on objectives with a protected hero",()=>{
 for(const id of ["five-shadows:fs-02","five-shadows:fs-05","five-shadows:fs-06"]){
  const fighters=Adapter.story(id,Trials.encounter(id)).first;
  const hunter=fighters.find(x=>x.assaultFocus);
  assert.ok(hunter,id);
  const objective=Adapter.storyObjective(id,Trials.data.getNode(id).requiredBattleObjective);
  assert.equal(Intel.marker(hunter,{tacticalObjective:objective}),"hunter");
  assert.equal(Intel.marker(hunter,{}),null);
 }
});
test("NPCUX004: browser only reads current battle, never modifies combat or saves",()=>{
 const html=read("index.html"),game=read("game.js"),style=read("styles.css");
 const mod=html.indexOf('src="npc-battle-intel.js?v=0.3.176"');
 const npc=html.indexOf('src="npc-story-ops-adapter.js?v=0.3.176"');
 const script=html.indexOf('src="game.js?v=0.3.176"');
 assert.ok(npc>=0&&mod>npc&&mod<script);
 assert.match(html,/id="inspectNpcAbilities"/);
 assert.match(game,/SignalOperationCore\.intel\(signalProgress\.active\)/);
 assert.match(game,/NpcBattleIntel\.marker\(/);
 assert.match(game,/NpcBattleIntel\.abilities\(/);
 assert.match(style,/\.battle-screen \.arena-indicator\.must-first/);
 assert.match(html,/v0\.3\.176 · LOREACT4001/);
 assert.equal(JSON.parse(read("package.json")).version,"0.3.176");
 assert.equal(read("signal-operation-core.js").includes('const GUARDS=Object.freeze(["ves","shade"])'),true);
});
