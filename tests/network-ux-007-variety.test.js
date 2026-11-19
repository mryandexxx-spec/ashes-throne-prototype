"use strict";
/* NET-UX-007: six distinct live encounter patterns, no new combat/economy rules. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const Data=require("../network-data.js"),Core=require("../network-core.js");
const Encounters=require("../network-encounter-data.js");
const Adapter=require("../network-encounter-adapter.js");
const Npcs=require("../npc-enemy-data.js");
const Economy=require("../network-live-economy.js");
const config=require("../network-pilot-session.js").LIVE_CONFIG;
const combat=vm.runInNewContext([
 "initiative-model.js","battle-rng.js","combat-status-core.js",
 "ability-data.js","network-score-core.js","combat-core.js"
].map(name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8")).join("\n")+"\nCombatCore");
const clone=x=>JSON.parse(JSON.stringify(x));
const location=["gardens-over-abyss"];
function ready(template,approach="quiet",preparation="survey"){
 const catalog=Data.buildCatalog({version:1,regions:Data.LIVE_CATALOG.regions,
  templates:[template]});
 let state=Core.fresh(787,0,config,catalog);
 assert.ok(state);
 state.influence[template.regionId]=template.minInfluence;
 state=Core.accrue(state,config.intervalMs,catalog,location);
 assert.ok(state&&state.board.length===1);
 state=Core.start(state,state.board[0].id);
 state=Core.prepare(state,preparation);
 state=Core.approach(state,approach);
 assert.ok(Core.validState(state));
 return state;
}
const hero=()=>({id:"netux007-hero",side:"ally",name:"Test ally",hp:40000,maxHp:40000,
 physicalAttack:7000,atk:7000,magicAttack:7000,physicalDefense:2000,
 magicDefense:2000,speed:950});
function win(battle){
 combat.advanceToPlayerTurn(battle);
 for(let turn=0;turn<90&&battle.active;turn++){
  if(battle.currentActor<0)combat.advanceToPlayerTurn(battle);
  if(!battle.active)break;
  const target=battle.fighters.findIndex(f=>f.side==="enemy"&&f.hp>0);
  assert.ok(target>=0);
  assert.ok(combat.chooseEnemy(battle,target));
  assert.ok(combat.performPlayerAbility(battle,"basic"));
 }
 assert.equal(battle.winner,"ally");
 return battle;
}
test("NET-UX-007: 36 sources and exact economic targets unchanged, every new encounter validates",()=>{
 const cat=Data.LIVE_CATALOG;
 assert.equal(cat.templates.length,36);
 assert.ok(Data.validateCatalog(cat));
 assert.ok(Adapter.validRegistry());
 assert.ok(cat.templates.every(t=>t.revision===2&&t.encounterRef.endsWith("-v2")));
 assert.ok(cat.templates.every(t=>Economy.source(t.rewardRef)?.kind==="serial"));
 assert.equal(cat.templates.filter(t=>t.type==="supply").length,21);
 assert.equal(cat.templates.filter(t=>t.type==="recruit-intel").length,15);
 assert.deepEqual([...new Set(cat.templates.map(t=>t.levels[0]))],[1,20,45]);
 assert.ok(cat.templates.every(t=>t.approaches.length===2&&
  t.approaches[0].waves===1&&t.approaches[1].waves===2));
 assert.ok(cat.templates.every(t=>t.preparationIds.join(",")==="survey,cover"));
});
test("NET-UX-007: all six archetype mixes appear across material and hero clues",()=>{
 const signatures=new Set(),titles=new Set();
 for(const template of Data.LIVE_CATALOG.templates){
  const def=Encounters.REGISTRY[template.encounterRef];
  const brief=Encounters.brief(template.encounterRef);
  assert.ok(brief&&brief.title&&brief.context&&brief.tactic&&brief.success);
  assert.ok(brief.quiet&&brief.cordon);
  assert.ok(def&&Adapter.validDefinition(def));
  const quiet=def.formations.quiet,cordon=def.formations.cordon;
  assert.equal(quiet.length,1);
  assert.equal(cordon.length,2);
  assert.equal(quiet.flat().length,2,"no extra opponents in short route");
  assert.equal(cordon.flat().length,3,"no extra opponents in two-stage route");
  assert.notEqual(JSON.stringify(quiet),JSON.stringify(cordon));
  const units=quiet.flat().concat(cordon.flat());
  assert.ok(units.every(id=>Npcs.get(id)?.originRegionId==="gardens-over-abyss"));
  signatures.add(JSON.stringify(def.formations));
  titles.add(brief.title);
  for(const prep of ["survey","cover"])for(const route of ["quiet","cordon"]){
   const state=ready(template,route,prep),plan=Adapter.plan(state);
   assert.ok(plan,template.id+":"+route+":"+prep);
   assert.equal(plan.first.length,def.formations[route][0].length);
   assert.deepEqual(plan.first.map(f=>f.archetypeId),
    def.formations[route][0]);
   assert.equal(plan.totalNetworkWaves,route==="quiet"?1:2);
   assert.equal(plan.intel.priorityEnemyId!==null,prep==="survey");
   assert.deepEqual(Adapter.plan(state),plan,"stable encounter after reload");
  }
 }
 assert.equal(titles.size,6);
 assert.equal(signatures.size,6);
});
test("NET-UX-007: previously issued revision 1 clues and mid-operation checkpoints still play",()=>{
 for(const template of Data.LIVE_CATALOG.templates){
  const old=clone(template);
  old.revision=1;old.encounterRef="encounter-"+template.id;
  const state=ready(old,"cordon","cover");
  const definition=Encounters.REGISTRY[old.encounterRef];
  assert.ok(definition&&Adapter.validDefinition(definition));
  assert.equal(Encounters.brief(old.encounterRef),null);
  assert.equal(state.active.clue.templateRevision,1);
  assert.ok(Adapter.plan(state));
  const first=definition.formations.cordon[0];
  assert.deepEqual(Adapter.plan(state).first.map(f=>f.archetypeId),first);
 }
 const old=clone(Data.LIVE_CATALOG.templates[0]);
 old.revision=1;old.encounterRef="encounter-"+old.id;
 const original=ready(old,"cordon","survey"),db=new Map();
 const storage={getItem:k=>db.get(k)??null,setItem:(k,v)=>db.set(k,v)};
 const saved=Core.save(original,()=>storage,()=>true);
 assert.ok(saved.ok);
 const restored=Core.load(()=>storage,{config});
 assert.equal(restored.blocked,false);
 assert.deepEqual(Adapter.plan(saved.state),Adapter.plan(restored.state));
 const attempt=Adapter.startBattle(restored.state,[hero()],{combat});
 assert.ok(attempt);
 const next=Adapter.complete(restored.state,win(attempt.battle));
 assert.equal(next.active.phase,"battle");
 assert.equal(next.active.wave,1);
 const checkpoint=Core.save(next,()=>storage,()=>true);
 const reloaded=Core.load(()=>storage,{config});
 assert.ok(checkpoint.ok&&!reloaded.blocked);
 assert.deepEqual(Adapter.plan(reloaded.state),Adapter.plan(checkpoint.state));
 const finale=Adapter.startBattle(reloaded.state,[hero()],{combat});
 const finished=Adapter.complete(reloaded.state,win(finale.battle));
 assert.equal(finished.active.phase,"result");
 const settled=Core.finish(finished);
 assert.equal(settled.completed.length,1);
 assert.equal(settled.completed[0].encounterRef,old.encounterRef);
});
test("NET-UX-007: two revised encounters, full checkpoint, defeat retry and one completion",()=>{
 const a=Data.LIVE_CATALOG.templates.find(t=>t.heroId==="ren"&&t.levels[0]===1);
 const b=Data.LIVE_CATALOG.templates.find(t=>t.materialId==="Fe"&&t.levels[0]===1);
 assert.notEqual(Encounters.brief(a.encounterRef).title,Encounters.brief(b.encounterRef).title);
 for(const t of [a,b]){
  let s=ready(t,"cordon","survey");
  const run=Adapter.startBattle(s,[hero()],{combat});
  assert.ok(run);
  s=Adapter.complete(s,win(run.battle));
  assert.equal(s.active.phase,"battle");
  assert.equal(s.active.wave,1);
  assert.equal(s.completed.length,0,"first battle never pays");
  const second=Adapter.startBattle(s,[hero()],{combat});
  assert.ok(second);
  assert.equal(second.plan.binding.wave,1);
  assert.equal(second.battle.fighters.find(f=>f.side==="ally").hp,40000,
   "second battle starts from clean roster");
  const result=Adapter.complete(s,win(second.battle));
  assert.equal(result.active.phase,"result");
  assert.equal(result.completed.length,0);
  const end=Core.finish(result);
  assert.equal(end.completed.length,1);
  assert.equal(end.completed[0].rewardRef,t.rewardRef);
  assert.equal(Core.finish(result).completed.length,1,"same report deterministic");
  assert.equal(Adapter.complete(result,second.battle),null,"cannot settle twice");
  const fail=ready(t,"quiet","cover");
  const bad=Adapter.startBattle(fail,[hero()],{combat});
  bad.battle.fighters.find(f=>f.side==="ally").hp=0;
  combat.advanceToPlayerTurn(bad.battle);
  assert.equal(bad.battle.winner,"enemy");
  const retry=Adapter.complete(fail,bad.battle);
  assert.equal(retry.active,null);
  assert.equal(retry.board.length,1);
  assert.equal(retry.completed.length,0);
  assert.equal(retry.board[0].encounterRef,t.encounterRef);
 }
});

test("NET-UX-007: mastered rev1 saved board can still simulate after rev2 rollout",async()=>{
 const original=clone(Data.LIVE_CATALOG.templates[0]);
 original.revision=1;original.encounterRef="encounter-"+original.id;
 const oldCatalog=Data.buildCatalog({version:1,regions:Data.LIVE_CATALOG.regions,
  templates:[original]});
 let state=Core.fresh(787,0,config,oldCatalog);
 state=Core.accrue(state,4*config.intervalMs,oldCatalog,location);
 assert.equal(state.board.length,4);
 state=Core.approach(Core.prepare(Core.start(state,state.board[0].id),"survey"),"quiet");
 const start=Adapter.startBattle(state,[hero()],{combat});
 assert.ok(start);
 const finished=Adapter.complete(state,win(start.battle));
 state=Core.finish(finished);
 assert.equal(state.completed.length,1);
 assert.ok(Core.isMastered(state,original,state.completed[0]?.approach||"quiet")||
  Core.isMastered(state,state.board[0],"quiet"));
 const db=new Map(),storage={getItem:k=>db.get(k)??null,
  setItem:(k,v)=>db.set(k,v)};
 assert.ok(Core.save(state,()=>storage,()=>true).ok);
 const Session=require("../network-pilot-session.js");
 const session=Session.create({live:true,storageProvider:()=>storage,
  exclusive:fn=>Promise.resolve().then(fn),ownsLock:()=>true,
  now:()=>4*config.intervalMs,seed:()=>787});
 assert.ok(session);
 assert.equal((await session.open()).ok,true);
 const clueId=session.read().board[0].id;
 assert.equal(session.read().board[0].templateRevision,1);
 assert.equal(session.canSimulate(clueId),true,"old mastery stays useful");
 assert.equal((await session.change("simulate",clueId)).ok,true);
 assert.equal(session.read().completed.length,2);
 assert.equal(db.get("ashes-throne.progress.v3"),undefined,"no wallet write");
 assert.equal(session.canSimulate(999999),false,"no fabricated clue");
});
