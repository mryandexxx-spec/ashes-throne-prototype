"use strict";
/* NET-001: isolated contract and edge-case tests. Numbers here are TEST fixtures,
 * not approved game balance or canonical regional content. */
const test=require("node:test");
const assert=require("node:assert/strict");
const Data=require("../network-data.js"),Core=require("../network-core.js");
const copy=x=>JSON.parse(JSON.stringify(x));
const config=()=>({id:"net-001-test-only",capacity:2,intervalMs:1000,
 guaranteeAfter:3,focusWeight:1,masteryScore:3});
const regions=[
 {id:"gardens-over-abyss",name:"Сады над пропастью",unlockRef:null},
 {id:"test-region",name:"Только тест",unlockRef:"test-act"}
];
const supply=(name,overrides={})=>({
 id:name,revision:1,regionId:"gardens-over-abyss",type:"supply",weight:1,minInfluence:0,
 levels:[1,2],preparationIds:["survey","extraction"],
 approaches:[{id:"quiet",waves:1},{id:"cordon",waves:2}],
 modifierIds:["fog","guard"],materialId:"Fe",heroId:null,threatTag:null,
 rewardRef:"test-reward",encounterRef:"test-enemies",...overrides
});
const templateCatalog=()=>Data.buildCatalog({version:1,regions,templates:[
 supply("supply-one"),
 supply("trophies-one",{type:"trophies",materialId:"Le"}),
 supply("intel-one",{type:"recruit-intel",materialId:null,heroId:"ren"}),
 supply("threat-one",{type:"threat-trace",materialId:null,threatTag:"test-threat"}),
 supply("test-regional",{regionId:"test-region",materialId:"Gl"})
]});
const C=()=>templateCatalog();
const unlocked=["gardens-over-abyss"];
const created=(cfg=config(),seed=123,at=0,cat=C())=>Core.fresh(seed,at,cfg,cat);
const tick=(s,now,cat=C(),unlock=unlocked)=>Core.accrue(s,now,cat,unlock);
function memory(){
 const entries=new Map(),calls=[];
 let mode=null;
 const store={
  getItem(k){calls.push(["read",k]);if(mode==="read")throw Error("read refused");
   if(mode==="bad-readback"&&calls.some(x=>x[0]==="write"))return "changed";
   return entries.has(k)?entries.get(k):null;},
  setItem(k,v){calls.push(["write",k]);if(mode==="write")throw Error("quota");
   entries.set(k,v);if(mode==="after-write")throw Error("unknown commit");}
 };
 return {entries,calls,store,provider:()=>store,fail:x=>mode=x};
}
const commit=(s,m,owner=()=>true)=>Core.save(s,m.provider,owner);
function work(s,approach="quiet",score=3){
 let x=Core.start(s,s.board[0].id);
 x=Core.prepare(x,"survey");x=Core.approach(x,approach);
 const id=x.active.clue.id;
 const waves=approach==="quiet"?1:2;
 for(let i=0;i<waves;i++)x=Core.battleOutcome(x,id,i,true,i===waves-1?score:null);
 return Core.finish(x);
}
test("catalog validation: references, duplicate ids, bad phases/levels/weights",()=>{
 const c=C();
 assert.ok(c&&Data.validateCatalog(c));
 assert.equal(Data.CATALOG.templates.length,0,"NET-003 owns playable content");
 assert.ok(Data.validateCatalog(Data.CATALOG));
 assert.equal(Data.buildCatalog({...copy(c),templates:[...c.templates,c.templates[0]]}),null);
 for(const patch of [
  {regionId:"unknown"},{weight:0},{levels:[1,1]},{modifierIds:["fog","fog"]},
  {approaches:[{id:"quiet",waves:0}]},{type:"unknown"},
  {preparationIds:["survey","survey"]},{heroId:"__proto__"}
 ]){
  const broken=copy(c);Object.assign(broken.templates[0],patch);
  assert.equal(Data.buildCatalog(broken),null,JSON.stringify(patch));
 }
 const missingHero=copy(c);missingHero.templates[2].heroId=null;
 assert.equal(Data.validateCatalog(missingHero),false);
 const missingThreat=copy(c);missingThreat.templates[3].threatTag=null;
 assert.equal(Data.validateCatalog(missingThreat),false);
 assert.equal(Data.eligibleTemplates(c,["unknown"]),null);
 assert.equal(Data.eligibleTemplates(c,unlocked).length,4);
 assert.equal(Data.eligibleTemplates(c,[...unlocked,"test-region"]).length,5);
});
test("fresh profile is explicit, deterministic, and leaves all legacy keys untouched",()=>{
 const m=memory();m.entries.set("ashes-throne.progress.v3","SENTINEL");
 const initial=Core.load(m.provider,{seed:123,now:0,config:config(),catalog:C()});
 assert.equal(initial.status,"fresh");assert.equal(initial.blocked,false);
 assert.equal(initial.state.seed,123);assert.equal(initial.state.board.length,0);
 assert.equal(m.calls.filter(x=>x[0]==="write").length,0);
 assert.equal(m.entries.get("ashes-throne.progress.v3"),"SENTINEL");
 for(const bad of [-1,0x100000000,1.5,NaN])assert.equal(created(config(),bad),null);
 assert.equal(created({...config(),capacity:0}),null);
 assert.equal(created({...config(),intervalMs:0}),null);
 assert.equal(created({...config(),guaranteeAfter:0}),null);
 assert.equal(created({...config(),focusWeight:0}),null);
});
test("deterministic arrival, stored generated snapshots and reload stability",()=>{
 const cat=C(),s=created();
 const a=tick(s,1000,cat),b=tick(s,1000,cat);
 assert.deepEqual(a,b);
 assert.equal(s.board.length,0,"input state is pure");
 assert.equal(a.board.length,1);assert.equal(a.board[0].id,1);
 assert.equal(a.board[0].issuedAt,1000);
 assert.equal(a.nextClueId,2);
 const m=memory(),saved=commit(a,m);assert.equal(saved.ok,true);
 assert.equal(saved.state.revision,1);
 const reload=Core.load(m.provider,{config:config()});
 assert.equal(reload.status,"existing");
 assert.deepEqual(reload.state,saved.state);
 assert.deepEqual(tick(reload.state,1000),reload.state,"reload does not reroll");
 const altered=C();
 const changed=copy(altered);
 changed.templates[0].modifierIds=["new-synthetic-modifier"];
 assert.deepEqual(Core.load(m.provider,{config:config()}).state.board[0],
  a.board[0],"catalog update cannot change stored clue");
 const more=tick(reload.state,2200,Data.buildCatalog(changed));
 assert.equal(more.board.length,2);
});
test("clock rollback, short intervals, full board and long offline cap",()=>{
 const s=created();
 const first=tick(s,1000);
 assert.deepEqual(tick(first,999),first,"clock backwards: no rewards");
 assert.deepEqual(tick(first,1999),first,"not a complete interval");
 const full=tick(first,1000000);
 assert.equal(full.board.length,2);
 assert.equal(full.nextClueId,3);
 assert.equal(full.clockAt,1000000,"no backlog after full board");
 const after=tick(Core.start(full,full.board[0].id),1000001);
 assert.equal(after.board.length,1,"no instant refill after long offline");
 assert.equal(tick(after,1000999).board.length,1);
 assert.equal(tick(after,1001001).board.length,2);
 assert.equal(tick(s,-5),null);
});
test("directed order is guaranteed within K actual arrivals; full board counts zero",()=>{
 let s=created({...config(),capacity:6},123);
 s=Core.setOrder(s,{kind:"type",targetId:"recruit-intel"},C(),unlocked);
 assert.equal(s.order.misses,0);
 const output=[];
 for(let i=1;i<=6;i++){
  s=tick(s,i*1000);
  output.push(s.board.at(-1).type);
 }
 for(let i=0;i<output.length;i+=3)
  assert.ok(output.slice(i,i+3).includes("recruit-intel"),"guarantee on 3rd arrival");
 assert.equal(Core.setOrder(s,{kind:"type",targetId:"nonexistent"},C(),unlocked),null);
 assert.equal(Core.setOrder(s,{kind:"hero",targetId:"unknown"},C(),unlocked),null);
 assert.equal(Core.setOrder(s,{kind:"region",targetId:"test-region"},C(),unlocked),null);
 const unchanged=Core.setOrder(s,{kind:"type",targetId:"recruit-intel"},C(),unlocked);
 assert.deepEqual(unchanged.order,s.order,"repeated order must not reset pity");
 const full=tick(s,900000);
 assert.deepEqual(full.order,s.order,"full board cannot consume guarantee");
 for(const order of [
  {kind:"material",targetId:"Fe"},
  {kind:"hero",targetId:"ren"},
  {kind:"region",targetId:"test-region"}
 ]){
  let n=created({...config(),capacity:6});
  const open=order.kind==="region"?[...unlocked,"test-region"]:unlocked;
  n=Core.setOrder(n,order,C(),open);assert.ok(n);
  for(let step=1;step<=3;step++)n=tick(n,step*1000,C(),open);
  assert.ok(n.board.some(x=>
   order.kind==="material"?x.materialId===order.targetId:
    order.kind==="hero"?x.heroId===order.targetId:
     x.regionId===order.targetId));
 }
});
test("brief, preparation, approach, waves, result and completion are strict",()=>{
 const ready=tick(created(),2000),id=ready.board[0].id;
 const one=Core.start(ready,id);
 assert.equal(one.board.length,1);assert.equal(one.active.phase,"brief");
 assert.equal(Core.start(one,ready.board[1].id),null,"double start");
 assert.equal(Core.prepare(one,"unknown"),null);
 assert.equal(Core.approach(one,"quiet"),null);
 const prep=Core.prepare(one,"survey");
 assert.equal(prep.active.phase,"approach");
 assert.equal(Core.prepare(prep,"survey"),null);
 const battle=Core.approach(prep,"cordon");
 assert.equal(battle.active.phase,"battle");
 assert.equal(Core.battleOutcome(battle,id,1,true),null,"wrong wave");
 assert.equal(Core.battleOutcome(battle,id,0,true,3),null,"premature score");
 const wave2=Core.battleOutcome(battle,id,0,true);
 assert.equal(wave2.active.wave,1);
 assert.equal(Core.battleOutcome(wave2,id,0,true),null,"replayed battle result");
 const result=Core.battleOutcome(wave2,id,1,true,3);
 assert.equal(result.active.phase,"result");
 assert.equal(Core.abandon(result),null,"cannot abandon confirmed victory");
 const end=Core.finish(result);
 assert.equal(end.active,null);assert.equal(end.completed.length,1);
 assert.equal(end.completed[0].serial,1);
 assert.equal(end.completed[0].clueId,id);
 assert.equal(end.completed[0].status,"done");
 assert.equal(end.influence["gardens-over-abyss"],1);
 assert.equal(end.mastery[result.active.clue.templateId+"|"+result.active.clue.level],3);
 assert.equal(Core.isMastered(end,result.active.clue.templateId,result.active.clue.level),true);
 assert.equal(Core.finish(result).completed.length,1);
 assert.equal(Core.finish(end),null,"cannot pay twice");
 assert.equal(Core.battleOutcome(result,id,1,true,3),null);
 assert.ok(Core.validState(end));
});
test("mastery is per template AND level, and only manual success counts",()=>{
 const s=work(tick(created(),2000),"quiet",2);
 const done=s.completed[0];
 assert.equal(Core.isMastered(s,done.templateId,done.level),false);
 assert.equal(Core.isMastered(s,done.templateId,done.level+1),false);
 assert.equal(Core.isMastered(s,"not-a-template",done.level),false);
});
test("defeat and abandon return the full clue even when board refilled",()=>{
 let s=tick(created(),2000);
 const original=copy(s.board[0]);
 s=Core.approach(Core.prepare(Core.start(s,original.id),"survey"),"quiet");
 // One slot is freed on start. Refilling it makes the board full again.
 s=tick(s,3000);assert.equal(s.board.length,2);
 const lost=Core.battleOutcome(s,original.id,0,false);
 assert.equal(lost.active,null);assert.equal(lost.board.length,3);
 assert.deepEqual(lost.board.find(c=>c.id===original.id),original);
 assert.equal(Core.battleOutcome(lost,original.id,0,false),null);
 assert.equal(tick(lost,4000).board.length,3,"no arrivals on overflow");
 const after=Core.start(lost,original.id);
 assert.ok(after);assert.equal(after.board.length,2);
 assert.equal(after.active.clue.id,original.id);
 const abandoned=Core.abandon(after);
 assert.deepEqual(abandoned.board.find(c=>c.id===original.id),original);
 assert.equal(abandoned.completed.length,0);
 assert.equal(abandoned.mastery[original.templateId+"|"+original.level],undefined);
});
test("reload of active run preserves checkpoint and avoids free rerolls",()=>{
 const m=memory();
 let s=tick(created(),2000);
 s=Core.approach(Core.prepare(Core.start(s,s.board[0].id),"survey"),"cordon");
 const saved=commit(s,m);assert.equal(saved.ok,true);
 const restored=Core.load(m.provider,{config:config()});
 assert.equal(restored.state.active.phase,"battle");
 assert.equal(restored.state.active.wave,0);
 assert.deepEqual(restored.state.active.clue,s.active.clue);
 assert.equal(Core.start(restored.state,restored.state.board[0].id),null);
 const next=Core.battleOutcome(restored.state,s.active.clue.id,0,true);
 assert.equal(next.active.wave,1);
});
test("storage is fail-closed: stale revision, malformed, incompatible and unknown versions",()=>{
 const m=memory(),s=created();
 assert.equal(commit(s,m,()=>false).ok,false);
 assert.equal(commit(s,m,null).ok,false);
 let p=commit(s,m);assert.equal(p.ok,true);
 const second=commit(s,m);
 assert.equal(second.ok,false);assert.equal(second.reason,"stale-revision");
 assert.equal(Core.load(m.provider,{config:{...config(),id:"other"}}).reason,
  "incompatible-configuration");
 const before=m.entries.get(Core.KEY);
 m.entries.set(Core.KEY,"{broken");
 assert.equal(Core.load(m.provider,{config:config()}).blocked,true);
 assert.equal(commit(s,m).ok,false,"cannot overwrite corrupt save");
 m.entries.set(Core.KEY,JSON.stringify({...copy(p.state),version:100}));
 assert.equal(Core.load(m.provider,{config:config()}).blocked,true);
 m.entries.set(Core.KEY,JSON.stringify({...copy(p.state),extra:"future-schema"}));
 assert.equal(Core.load(m.provider,{config:config()}).blocked,true);
 m.entries.set(Core.KEY,before);
 assert.equal(Core.load(m.provider,{config:config()}).status,"existing");
 m.fail("read");assert.equal(Core.load(m.provider,{config:config()}).blocked,true);
});
test("write faults are blocked even if bytes may have landed; no silent retry",()=>{
 for(const mode of ["write","after-write","bad-readback"]){
  const m=memory();m.fail(mode);
  const result=commit(created(),m);
  assert.equal(result.ok,false);assert.equal(result.blocked,true,mode);
 }
 const m=memory();
 assert.equal(Core.load(()=>null,{seed:2,now:0,config:config(),catalog:C()}).blocked,true);
 assert.equal(Core.save(created(),()=>null,()=>true).ok,false);
});
test("invalid stored data cannot poison IDs, serials, pending queue or counters",()=>{
 const pristine=created(),c=tick(pristine,1000);
 const bads=[
  {...copy(c),nextClueId:1},
  {...copy(c),board:[c.board[0],c.board[0]]},
  {...copy(c),nextCompletionId:2},
  {...copy(c),clockAt:-1},
  {...copy(c),order:{kind:"hero",targetId:"ren",misses:3}},
  {...copy(c),active:{clue:c.board[0],phase:"result",preparation:null,approach:null,wave:1,score:3}},
  {...copy(c),mastery:{"__proto__|1":3}},
  {...copy(c),completed:[{serial:1,clueId:5,templateId:"test",level:1,
   regionId:"gardens-over-abyss",score:3,rewardRef:"test-reward",kind:"manual",status:"done"}]}
 ];
 for(const bad of bads)assert.equal(Core.validState(bad),false);
 assert.equal(tick({...copy(c),nextClueId:1},2000),null);
 assert.equal(Core.start({...copy(c),board:[]},1),null);
});
