"use strict";
/* NPCPVE002: noncanonical story/OPS NPCs, objective mapping and save compatibility. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const N=require("../npc-enemy-data.js");
const A=require("../npc-story-ops-adapter.js");
const Trials=require("../lore-campaign-trials.js");
const OPS1=require("../operation-core.js"),OPS2=require("../signal-operation-core.js");
const C=vm.runInNewContext(
 ["initiative-model.js","ability-data.js","combat-core.js"].map(read).join("\n")+"\nCombatCore");
const ids=Trials.data.catalog().nodes.map(x=>x.id);
const hero=()=>({id:"npc-test-hero",name:"Тестовый герой",side:"ally",
 hp:1000,atk:999,speed:950,physicalAttack:999,physicalDefense:20,magicDefense:20});
function clear(first,waves=[],objective=null){
 const b=C.createBattle([hero(),...first],waves,
  objective?{tacticalObjective:objective}:{});
 C.advanceToPlayerTurn(b);
 for(let i=0;i<30&&b.active;i++){
  const target=b.fighters.findIndex(e=>e.side==="enemy"&&e.hp>0);
  assert.ok(target>=0,"living target available");
  assert.equal(C.chooseEnemy(b,target),true);
  assert.equal(C.performPlayerAbility(b,"basic"),true);
 }
 return b;
}
test("NPCPVE002: all six FS gates have unique real NPCs and stable wave counts",()=>{
 assert.equal(ids.length,6);
 for(const id of ids){
  const trial=Trials.encounter(id),enc=A.story(id,trial);
  const all=[...enc.first,...enc.waves.flat()];
  assert.equal(enc.waves.length,trial.waves.length,id);
  assert.equal(enc.first.length,id.endsWith("fs-05")?3:trial.enemies.length,id);
  assert.equal(new Set(all.map(x=>x.id)).size,all.length,id);
  assert.ok(all.every(e=>e.id.startsWith("npc-")&&
   e.archetypeId.startsWith("npc-")&&e.factionId===null&&
   e.speciesId==="human"&&e.side==="enemy"&&e.hp>0&&
   e.atk===e.physicalAttack&&e.npcAbilities.special),id);
  assert.equal(JSON.stringify(A.story(id,trial)),JSON.stringify(enc),"deterministic replay "+id);
 }
 assert.equal(Trials.data.catalogIsValid(),true);
});
test("NPCPVE002: FS-04 objective targets new NPC ID, fails wrong-first and accepts priority-first",()=>{
 const id="five-shadows:fs-04",enc=A.story(id,Trials.encounter(id));
 const original=Trials.data.getNode(id).requiredBattleObjective;
 assert.equal(original.priorityEnemyId,"shade","source narrative rule unchanged");
 const objective=A.storyObjective(id,original);
 assert.equal(objective.kind,"priority-first");
 assert.equal(objective.priorityEnemyId,A.storyId(id,"shade"));
 assert.ok(enc.first.some(e=>e.id===objective.priorityEnemyId));
 const wrong=C.createBattle([hero(),...enc.first],[],{tacticalObjective:objective});
 C.advanceToPlayerTurn(wrong);
 assert.equal(C.chooseEnemy(wrong,wrong.fighters.findIndex(e=>e.id===A.storyId(id,"ves"))),true);
 assert.equal(C.performPlayerAbility(wrong,"basic"),true);
 assert.equal(wrong.winner,"enemy","wrong first kill must not unlock story");
 const first=enc.first.find(x=>x.id===objective.priorityEnemyId);
 const order=[first,...enc.first.filter(x=>x.id!==first.id)];
 const b=clear(order,[],objective);
 assert.equal(b.winner,"ally");
 assert.equal(b.priorityCleared,true);
 assert.equal(b.tacticalOutcome,"priority-victory");
 assert.equal(original.priorityEnemyId,"shade","never modify frozen story objective");
});
test("NPCPVE002: FS-02/05/06 preserve protected ally, hold and hunter behavior",()=>{
 for(const [id,allyName,hold] of [
  ["five-shadows:fs-02","nada",null],
  ["five-shadows:fs-05","ren",12],
  ["five-shadows:fs-06","nada",8]]){
  const obj=A.storyObjective(id,Trials.data.getNode(id).requiredBattleObjective);
  assert.equal(obj.protectAllyId,allyName);
  if(hold!==null)assert.equal(obj.allyActionsToHold,hold);
 }
 const trial=Trials.encounter("five-shadows:fs-05"),b=A.story("five-shadows:fs-05",trial);
 const hunter=b.first.find(e=>e.id===A.storyId("five-shadows:fs-05","shade"));
 assert.ok(hunter);
 assert.equal(hunter.archetypeId,"npc-watch-captain");
 assert.equal(hunter.name,"Преследователь");
 assert.equal(hunter.hp,225);assert.equal(hunter.atk,60);
 assert.equal(hunter.assaultFocus,true);
 const waves=A.story("five-shadows:fs-03",Trials.encounter("five-shadows:fs-03"));
 assert.equal(waves.waves.length,1);
 assert.equal(clear(waves.first,waves.waves).winner,"ally","two-wave NPC battle completes");
});
test("NPCPVE002: OPS-001 preserves north/south/junction and checkpoint logic",()=>{
 let a=OPS1.start("A","npc-ops1-one");
 a=OPS1.order(OPS1.order(a,"register"),"observe");
 a=OPS1.intercept(a,"north");
 let p=OPS1.battlePlan(a),foes=A.operation("OPS-001",p);
 assert.equal(p.kind,"singleWave");assert.equal(foes.waves.length,0);
 assert.ok(foes.first.every(x=>x.archetypeId.startsWith("npc-")));
 let b=clear(foes.first,foes.waves);
 assert.equal(OPS1.battleEnded(a,a.runId,b).phase,"final");
 let r=OPS1.start("A","npc-ops1-two");
 r=OPS1.order(OPS1.order(r,"block"),"extract");
 r=OPS1.intercept(r,"junction");
 p=OPS1.battlePlan(r);foes=A.operation("OPS-001",p);
 assert.equal(foes.waves.length,1);
 b=clear(foes.first,foes.waves);
 assert.equal(b.wave,2);
 assert.equal(OPS1.battleEnded(r,r.runId,b).phase,"final");
 assert.equal(OPS1.KEY,"ashes-throne.operations.v1");
});
test("NPCPVE002: OPS-002 tracks NPC deaths as old guard IDs, in action order",()=>{
 let r=OPS2.start("ves","npc-ops2-one");
 r=OPS2.chooseAssault(OPS2.prepare(r,"survey"),"quiet");
 const plan=OPS2.battlePlan(r),enc=A.operation("OPS-002",plan);
 const [a,b]=enc.first;
 assert.equal(A.signalGuardName("ves"),a.name);
 assert.equal(A.signalGuardName("shade"),b.name);
 assert.notEqual(a.id,"ves");assert.notEqual(b.id,"shade");
 const simultaneous=A.signalEvents([{type:"ability",actorId:"npc-test-hero",abilityId:"basic"},
  {type:"death",targetId:b.id},{type:"death",targetId:a.id}]);
 assert.equal(simultaneous[1].targetId,"shade");assert.equal(simultaneous[2].targetId,"ves");
 let tracker=OPS2.capture(OPS2.startTracker(r),simultaneous,1);
 assert.equal(tracker.firstLoss,"both");
 let complete=OPS2.battleEnded(r,r.runId,
  {active:false,winner:"ally",wave:1,totalWaves:1},tracker);
 assert.equal(complete.outcome,"clean");
 tracker=OPS2.capture(OPS2.startTracker(r),
  A.signalEvents([{type:"ability",actorId:"npc-test-hero"},
   {type:"death",targetId:b.id}]),1);
 tracker=OPS2.capture(tracker,
  A.signalEvents([{type:"ability",actorId:"npc-test-hero"},
   {type:"death",targetId:a.id}]),2);
 complete=OPS2.battleEnded(r,r.runId,
  {active:false,winner:"ally",wave:1,totalWaves:1},tracker);
 assert.equal(complete.outcome,"alerted");
 assert.equal(A.signalEvents([{type:"death",targetId:"ves"}])[0].targetId,"ves",
  "previous guard events remain compatible");
 assert.equal(OPS2.KEY,"ashes-throne.signal-operation.v1");
});
test("NPCPVE002: OPS-002 cordon remains two waves without clean signal outcome",()=>{
 let r=OPS2.start("shade","npc-ops2-cordon");
 r=OPS2.chooseAssault(OPS2.prepare(r,"extraction"),"cordon");
 const p=OPS2.battlePlan(r),enc=A.operation("OPS-002",p);
 assert.equal(enc.waves.length,1);
 assert.equal(enc.waves[0].length,1);
 assert.equal(clear(enc.first,enc.waves).wave,2);
 const tracker=OPS2.capture(OPS2.startTracker(r),
  A.signalEvents([{type:"ability",actorId:"hero"},
    {type:"death",targetId:enc.first[0].id},
    {type:"death",targetId:enc.first[1].id}]),1);
 assert.equal(OPS2.battleEnded(r,r.runId,
  {active:false,winner:"ally",wave:2,totalWaves:2},tracker).outcome,"loud");
});
test("NPCPVE002: scene UI loads adapter first; no new save paths or permanent meshes",()=>{
 const game=read("game.js"),html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.176");
 assert.ok(html.includes('id="buildVersion">Прототип · v0.3.176 · LOREACT4001'));
 const npcScript='src="npc-story-ops-adapter.js?v='+pkg.version+'"';
 assert.ok(html.includes(npcScript));
 assert.ok(html.indexOf(npcScript)<html.indexOf('src="game.js?v='+pkg.version+'"'));
 assert.ok(game.includes('NpcStoryOpsAdapter.story(loreRequiredContext.nodeId,trial).first'));
 assert.ok(game.includes('NpcStoryOpsAdapter.story(loreRequiredContext.nodeId,trial).waves'));
 assert.ok(game.includes('NpcStoryOpsAdapter.storyObjective(loreRequiredContext.nodeId,loreRequiredContext.battleObjective)'));
 assert.ok(game.includes('NpcStoryOpsAdapter.operation("OPS-001",plan)'));
 assert.ok(game.includes('NpcStoryOpsAdapter.operation("OPS-002",plan)'));
 assert.ok(game.includes('NpcStoryOpsAdapter.signalEvents(state.events||[])'));
 assert.ok(game.includes("ensureEncounterNpcVisuals([...lineup,...waves.flat()])"));
 assert.ok(game.includes("clearEncounterNpcVisuals()"));
 for(const file of ["combat-core.js","lore-campaign-trials.js","signal-operation-core.js",
 "operation-core.js"])assert.ok(!read(file).includes("NPCPVE002"));
 assert.ok(!read("npc-story-ops-adapter.js").includes("localStorage"));
});
