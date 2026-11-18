"use strict";
/* NET-003: all encounters are isolated [ПРЕДЛОЖЕНИЕ] fixtures, never live. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const Data=require("../network-data.js");
const Network=require("../network-core.js");
const Encounters=require("../network-encounter-data.js");
const Adapter=require("../network-encounter-adapter.js");
const NPC=require("../npc-enemy-data.js");
const C=vm.runInNewContext([
 "initiative-model.js","battle-rng.js","combat-status-core.js",
 "ability-data.js","combat-core.js"
].map(read).join("\n")+"\nCombatCore");
const cat=Data.PROPOSAL_CATALOG;
const config=()=>({id:"net-003-test-only",capacity:3,intervalMs:1000,
 guaranteeAfter:3,focusWeight:1,masteryScore:3});
const copy=x=>JSON.parse(JSON.stringify(x));
function ready(templateId="net-route-watch",approach="quiet",preparation="survey"){
 const t=cat.templates.find(t=>t.id===templateId);
 assert.ok(t);
 const single=Data.buildCatalog({version:1,regions:cat.regions,templates:[t]});
 let state=Network.fresh(12345,0,config(),single);
 state=Network.accrue(state,1000,single,["gardens-over-abyss"]);
 assert.equal(state.board.length,1);
 state=Network.start(state,state.board[0].id);
 state=Network.prepare(state,preparation);
 state=Network.approach(state,approach);
 assert.ok(Network.validState(state));
 return state;
}
const hero=()=>({id:"npc-test-hero",name:"Test hero",side:"ally",
 hp:5000,atk:999,physicalAttack:999,physicalDefense:30,
 magicDefense:30,speed:950});
function win(battle){
 C.advanceToPlayerTurn(battle);
 for(let turn=0;turn<50&&battle.active;turn++){
  if(battle.currentActor<0)C.advanceToPlayerTurn(battle);
  if(!battle.active)break;
  const i=battle.fighters.findIndex(f=>f.side==="enemy"&&f.hp>0);
  assert.ok(i>=0);
  assert.equal(C.chooseEnemy(battle,i),true);
  assert.equal(C.performPlayerAbility(battle,"basic"),true);
 }
 assert.equal(battle.active,false);
 assert.equal(battle.winner,"ally");
 return battle;
}
function lose(battle){
 battle.fighters.find(f=>f.side==="ally").hp=0;
 C.advanceToPlayerTurn(battle);
 assert.equal(battle.active,false);
 assert.equal(battle.winner,"enemy");
 return battle;
}
test("NET-003 proposal-only, three canonical-region settings, no production sources",()=>{
 assert.ok(Data.validateCatalog(cat));
 assert.equal(Data.CATALOG.templates.length,0);
 assert.equal(cat.templates.length,3);
 assert.ok(Adapter.validRegistry());
 assert.deepEqual(cat.templates.map(t=>t.type),["supply","trophies","threat-trace"]);
 assert.ok(cat.templates.every(t=>t.regionId==="gardens-over-abyss"&&
  t.rewardRef.startsWith("net-proposal-no-payout-")&&
  t.heroId===null&&t.materialId===null));
 assert.ok(Object.values(Encounters.REGISTRY).every(def=>
  Object.values(def.formations).flat(2).every(id=>
   NPC.get(id)?.originRegionId==="gardens-over-abyss"&&
   NPC.get(id)?.speciesId==="human")));
 assert.ok(!read("index.html").includes("network-encounter-adapter.js"));
 assert.ok(!read("game.js").includes("NetworkEncounterAdapter"));
 assert.ok(!read("network-encounter-adapter.js").includes("localStorage"));
});
test("NET-003 every template/choice/modifier makes valid, uniquely identified waves",()=>{
 for(const template of cat.templates)for(const prep of template.preparationIds)
 for(const approach of template.approaches){
  const state=ready(template.id,approach.id,prep);
  let current=state;
  for(let wave=0;wave<approach.waves;wave++){
   const p=Adapter.plan(current);
   assert.ok(p,template.id+":"+prep+":"+approach.id+":"+wave);
   assert.equal(p.first.length>0,true);
   assert.equal(p.futureWaves.length,0);
   assert.equal(p.binding.wave,wave);
   assert.equal(p.totalNetworkWaves,approach.waves);
   assert.equal(p.intel.priorityEnemyId!==null,prep==="survey");
   assert.equal(p.options.rngSeed>>>0,p.options.rngSeed);
   assert.ok(p.first.every(f=>f.side==="enemy"&&NPC.get(f.archetypeId)&&
    f.hp>0&&f.atk===f.physicalAttack&&f.maxProtection===f.protection));
   assert.equal(new Set(p.first.map(f=>f.id)).size,p.first.length);
   assert.deepEqual(Adapter.plan(current),p);
   const run=Adapter.startBattle(current,[hero()],{combat:C});
   assert.ok(run);
   assert.equal(run.battle.totalWaves,1);
   win(run.battle);
   const next=Adapter.complete(current,run.battle,
    wave===approach.waves-1?3:null);
   assert.ok(next);
   assert.equal(Adapter.complete(next,run.battle,3),null,"duplicate wave");
   current=next;
  }
  assert.equal(current.active.phase,"result");
  const done=Network.finish(current);
  assert.equal(done.completed.length,1);
  assert.equal(done.completed[0].templateId,template.id);
  assert.equal(done.completed[0].rewardRef,template.rewardRef);
  assert.equal(done.completed[0].score,3);
  assert.equal(done.influence["gardens-over-abyss"],1);
 }
});
test("NET-003 defeat, abandonment, duplicate result and wrong-run binding",()=>{
 const state=ready("net-lost-cargo","cordon","cover");
 const start=Adapter.startBattle(state,[hero()],{combat:C});
 assert.ok(start);
 assert.equal(Adapter.complete(state,start.battle,3),null,"running battle is not a victory");
 const defeat=Adapter.complete(state,lose(start.battle));
 assert.ok(defeat);
 assert.equal(defeat.active,null);
 assert.equal(defeat.completed.length,0);
 assert.equal(defeat.board[0].id,state.active.clue.id);
 assert.deepEqual(defeat.board[0],state.active.clue);
 assert.equal(Adapter.complete(defeat,start.battle),null);
 const again=Network.approach(Network.prepare(Network.start(defeat,
  defeat.board[0].id),"cover"),"cordon");
 assert.deepEqual(Adapter.plan(again),Adapter.plan(state),"restart has same seeded wave");
 assert.equal(Adapter.complete(again,start.battle),null,"defeat cannot turn to victory");
 const stale=Adapter.startBattle(again,[hero()],{combat:C});
 win(stale.battle);
 const after=Adapter.complete(again,stale.battle);
 assert.ok(after&&after.active.wave===1);
 assert.equal(Adapter.complete(after,stale.battle,3),null,"old wave rejected");
 assert.equal(Adapter.complete(after,start.battle,3),null,"old loss rejected");
 assert.equal(Network.finish(after),null,"intermediate wave cannot pay");
});
test("NET-003 rejects forged or malformed combat results and arbitrary scores",()=>{
 const s=ready();
 const start=Adapter.startBattle(s,[hero()],{combat:C});
 const broken=copy(start.battle);
 broken.active=false;broken.winner="ally";
 assert.equal(Adapter.complete(s,broken,3),null,"must actually defeat enemies");
 assert.equal(Adapter.complete(s,start.battle,3),null,"cannot settle unfinished battle");
 win(start.battle);
 assert.equal(Adapter.complete(s,start.battle),null,"final score required");
 for(const score of [-1,1.5,101,NaN,"3"])
  assert.equal(Adapter.complete(s,start.battle,score),null);
 const good=Adapter.complete(s,start.battle,0);
 assert.ok(good&&good.active.phase==="result");
 const forged=copy(start.battle);
 forged.networkBinding.wave++;
 assert.equal(Adapter.complete(s,forged,3),null);
 const more=copy(start.battle);
 more.totalWaves=2;
 assert.equal(Adapter.complete(s,more,3),null);
 const changed=copy(start.battle);
 changed.fighters.find(f=>f.side==="enemy").id="not-the-clue";
 assert.equal(Adapter.complete(s,changed,3),null);
 const other=ready("net-watch-trace");
 assert.equal(Adapter.complete(other,start.battle,3),null);
});
test("NET-003 validates version-pinned snapshots and blocks corrupt data",()=>{
 const s=ready(),t=s.active.clue;
 assert.equal(Adapter.plan({...s,active:{...s.active,phase:"brief"}}),null);
 for(const patch of [
  {templateRevision:t.templateRevision+1},{encounterRef:"unknown-ref"},
  {rewardRef:"replaced-source"},{type:"trophies"},{regionId:"test-region"},
  {modifierId:"never-authorized"},{level:999},
  {preparationIds:["cover","survey"]},{approaches:[{id:"quiet",waves:1}]}
 ]){
  const altered=copy(s);
  Object.assign(altered.active.clue,patch);
  assert.equal(Adapter.plan(altered),null,JSON.stringify(patch));
 }
 const wrong=copy(Encounters.REGISTRY);
 const key=t.encounterRef;
 wrong[key]={template:wrong[key].template,
  formations:{quiet:[["npc-nonexistent"]],cordon:[["npc-pass-guard"],["npc-ridge-slinger"]]}};
 assert.equal(Adapter.validRegistry(wrong),false);
 assert.equal(Adapter.plan(s,{registry:wrong}),null);
 assert.equal(Adapter.startBattle(s,[],{combat:C}),null);
 assert.equal(Adapter.startBattle(s,[hero(),hero()],{combat:C}),null);
 assert.equal(Adapter.startBattle(s,[{...hero(),side:"enemy"}],{combat:C}),null);
 assert.equal(Adapter.startBattle(s,[hero()],{combat:{createBattle(){throw Error("broken");}}}),null);
});
test("NET-003 saved mid-battle checkpoint restores the SAME wave and seed",()=>{
 const state=ready("net-watch-trace","cordon","survey");
 const db=new Map();
 const storage={getItem:k=>db.has(k)?db.get(k):null,setItem:(k,v)=>db.set(k,v)};
 const saved=Network.save(state,()=>storage,()=>true);
 assert.equal(saved.ok,true);
 const reloaded=Network.load(()=>storage,{config:config()});
 assert.equal(reloaded.blocked,false);
 assert.equal(reloaded.state.active.phase,"battle");
 assert.deepEqual(Adapter.plan(reloaded.state),Adapter.plan(saved.state));
 const original=Adapter.startBattle(reloaded.state,[hero()],{combat:C});
 const resumed=Adapter.startBattle(reloaded.state,[hero()],{combat:C});
 assert.deepEqual(original.battle.networkBinding,resumed.battle.networkBinding);
 win(resumed.battle);
 const second=Adapter.complete(reloaded.state,resumed.battle);
 assert.ok(second&&second.active.wave===1);
 const nextSaved=Network.save(second,()=>storage,()=>true);
 assert.equal(nextSaved.ok,true);
 const nextLoad=Network.load(()=>storage,{config:config()});
 assert.deepEqual(Adapter.plan(nextLoad.state),Adapter.plan(nextSaved.state));
 assert.notDeepEqual(Adapter.plan(nextLoad.state).binding,original.plan.binding);
 assert.equal(Adapter.complete(nextLoad.state,resumed.battle,3),null);
 const last=Adapter.startBattle(nextLoad.state,[hero()],{combat:C});
 win(last.battle);
 const completed=Adapter.complete(nextLoad.state,last.battle,3);
 assert.equal(Network.finish(completed).completed.length,1);
 assert.equal(db.has("ashes-throne.progress.v3"),false,"no wallet write");
});
