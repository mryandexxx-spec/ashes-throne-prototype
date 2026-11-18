"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const names=["gear-data.js","progress-core.js","skill-core.js","star-core.js",
 "save-core.js","hero-collection-core.js","daily-core.js","login-core.js",
 "progress-v3-core.js","reward-policy-core.js","initiative-model.js",
 "battle-rng.js","combat-status-core.js","ability-data.js","network-data.js",
 "network-score-core.js","network-core.js","npc-enemy-data.js",
 "network-encounter-data.js","network-encounter-adapter.js",
 "network-live-economy.js","network-reward-core.js","network-pilot-session.js",
 "combat-core.js"];
const source=names.map(name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8")).join("\n");
const modules=()=>vm.runInNewContext(source+`
\n({NetworkData,NetworkCore,NetworkLiveEconomy,NetworkPilotSession,
NetworkRewardCore,ProgressV3Core,StarCore,NetworkEncounterAdapter,CombatCore})
\`);
const heroes=["kael","lyra","darin","medic-demo","test-area-damage",
 "ren","nada","liora","art","sava"].map(id=>({id,side:"ally"}));
const field=["gardens-over-abyss"];
const day=()=> "2026-11-18";
const clone=x=>JSON.parse(JSON.stringify(x));
const store=()=>{
 const map=new Map();
 return {map,getItem:key=>map.get(key)??null,setItem:(key,val)=>map.set(key,val)};
};
const lock=()=>fn=>Promise.resolve().then(fn);
const fighter=()=>({id:"ren",side:"ally",name:"Рен",hp:5000,atk:999,
 physicalAttack:999,physicalDefense:40,magicDefense:40,speed:950});
function bundle({heroId=null,materialId="Fe"}={}){
 const m=modules(),storage=store(),wallet=m.ProgressV3Core.stage(heroes,()=>storage,0);
 assert.ok(wallet&&["staged","existing"].includes(wallet.status));
 const source=m.NetworkData.LIVE_CATALOG.templates.find(x=>x.minInfluence===0&&
  (heroId?x.heroId===heroId:x.materialId===materialId));
 assert.ok(source);
 const catalog=m.NetworkData.buildCatalog({version:1,
  regions:m.NetworkData.LIVE_CATALOG.regions,templates:[source]});
 const credit=[];
 const session=m.NetworkPilotSession.create({
  live:true,catalog,heroes,storageProvider:()=>storage,exclusive:lock(),
  ownsLock:()=>true,now:()=>86400000,seed:()=>42,day,
  onCredit:(runtime,reward)=>credit.push({runtime,reward})
 });
 assert.ok(session);
 return {m,storage,session,credit,source};
}
const wallet=s=>JSON.parse(s.storage.getItem(s.m.ProgressV3Core.KEY));
async function fightOne(s,clueId){
 const {session,m}=s;
 assert.equal((await session.change("start",clueId)).ok,true);
 assert.equal((await session.change("prepare","survey")).ok,true);
 assert.equal((await session.change("approach","quiet")).ok,true);
 const run=m.NetworkEncounterAdapter.startBattle(session.read(),[fighter()],{combat:m.CombatCore});
 assert.ok(run,"real existing NPC adapter must generate a valid battle");
 const battle=run.battle;
 m.CombatCore.advanceToPlayerTurn(battle);
 for(let i=0;i<60&&battle.active;i++){
  if(battle.currentActor<0)m.CombatCore.advanceToPlayerTurn(battle);
  if(!battle.active)break;
  const enemy=battle.fighters.findIndex(f=>f.side==="enemy"&&f.hp>0);
  assert.ok(enemy>=0);
  assert.ok(m.CombatCore.chooseEnemy(battle,enemy));
  assert.ok(m.CombatCore.performPlayerAbility(battle,"basic"));
 }
 assert.equal(battle.winner,"ally");
 assert.equal((await session.complete(battle)).ok,true);
 assert.equal(session.read().active.phase,"result");
 assert.ok(session.read().active.score>=90);
 assert.equal((await session.change("finish")).ok,true);
}
test("NET-007 playable live catalog has targetable rewards on all seven gear materials and five main heroes",()=>{
 const m=modules();
 const cat=m.NetworkData.LIVE_CATALOG;
 assert.equal(cat.templates.length,36);
 assert.ok(m.NetworkData.validateCatalog(cat));
 assert.deepEqual([...new Set(cat.templates.filter(t=>t.type==="supply").map(t=>t.materialId))].sort(),
  ["Cl","Fa","Fe","Gl","Le","Th","Wo"]);
 assert.deepEqual([...new Set(cat.templates.filter(t=>t.type==="recruit-intel").map(t=>t.heroId))].sort(),
  ["art","liora","nada","ren","sava"]);
 assert.equal(cat.templates.filter(t=>t.minInfluence===0).length,12);
 assert.ok(cat.templates.every(t=>m.NetworkLiveEconomy.source(t.rewardRef)));
 assert.ok(cat.templates.every(t=>m.NetworkLiveEconomy.source(t.rewardRef).kind==="serial"));
 assert.ok(m.NetworkEncounterAdapter.validRegistry());
});
test("NET-007 manual battle pays once, and mastered simulation pays same base currency and materials",async()=>{
 const s=bundle();
 assert.equal((await s.session.open()).ok,true);
 assert.equal(s.session.isLive(),true);
 assert.equal(s.session.KEY,"ashes-throne.network.v1");
 const first=s.session.read();
 assert.equal(first.board.length,4);
 assert.equal(first.config.capacity,16);
 assert.equal(first.config.intervalMs,21600000);
 assert.equal(s.storage.getItem("ashes-throne.network.pilot.v1"),null);
 const matching=first.board.filter(c=>c.modifierId===first.board[0].modifierId);
 const best=matching.length>=2?matching:first.board.filter(c=>c.modifierId!==first.board[0].modifierId);
 assert.ok(best.length>=2,"four clues have at least one identical modifier pair");
 await fightOne(s,best[0].id);
 assert.equal(s.session.read().completed.length,1);
 assert.equal(s.session.pendingCount(),1);
 const firstCredit=await s.session.collect();
 assert.equal(firstCredit.ok,true,JSON.stringify(firstCredit));
 assert.equal(firstCredit.paid,1);
 assert.equal(firstCredit.currency,1000);
 assert.equal(firstCredit.materials,8);
 assert.equal(wallet(s).currency,1000);
 assert.equal(wallet(s).materials.Fe,8);
 assert.equal(wallet(s).networkLedger.claimedThrough,1);
 assert.equal((await s.session.collect()).paid,0,"double tap never pays twice");
 const available=s.session.read().board.find(c=>c.modifierId===best[0].modifierId);
 assert.ok(available,"second identical clue retained on board");
 assert.equal(s.session.canSimulate(available.id),true);
 assert.equal((await s.session.change("simulate",available.id)).ok,true);
 const second=s.session.read().completed.at(-1);
 assert.equal(second.kind,"simulated");assert.equal(second.score,0);
 const paid=await s.session.collect();
 assert.equal(paid.ok,true,JSON.stringify(paid));
 assert.equal(paid.paid,1);
 assert.equal(wallet(s).currency,2000);
 assert.equal(wallet(s).materials.Fe,16);
 assert.equal(wallet(s).networkLedger.claimedThrough,2);
 assert.equal(s.credit.length,2);
});
test("NET-007 7-star hero receives ordinary currency in place of shards without blocking serial ledger",async()=>{
 const s=bundle({heroId:"ren"});
 const current=wallet(s);
 current.heroStars.ren.rank=7;current.heroStars.ren.shards=0;
 s.storage.setItem(s.m.ProgressV3Core.KEY,JSON.stringify(current));
 assert.equal((await s.session.open()).ok,true);
 await fightOne(s,s.session.read().board[0].id);
 const claim=await s.session.collect();
 assert.equal(claim.ok,true,JSON.stringify(claim));
 assert.equal(wallet(s).currency,1480,"1000 base and 6 excess shards x80");
 assert.equal(wallet(s).heroStars.ren.shards,0);
 assert.equal(wallet(s).networkLedger.claimedThrough,1);
 assert.equal((await s.session.collect()).paid,0);
});
test("NET-007 abandoning a clue cannot award any resource",async()=>{
 const s=bundle();
 assert.equal((await s.session.open()).ok,true);
 assert.equal((await s.session.change("start",s.session.read().board[0].id)).ok,true);
 assert.equal((await s.session.change("abandon")).ok,true);
 assert.equal((await s.session.collect()).paid,0);
 assert.equal(wallet(s).currency,0);
 assert.equal(s.session.read().completed.length,0);
});
