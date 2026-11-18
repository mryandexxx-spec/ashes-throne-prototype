"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const files=["gear-data.js","progress-core.js","skill-core.js","star-core.js",
 "save-core.js","hero-collection-core.js","progress-v3-core.js",
 "reward-policy-core.js","initiative-model.js","battle-rng.js","combat-status-core.js",
 "ability-data.js","network-data.js","network-score-core.js","network-core.js",
 "npc-enemy-data.js","network-encounter-data.js","network-encounter-adapter.js",
 "weekly-threat-core.js","combat-core.js"];
const code=files.map(x=>fs.readFileSync(path.join(__dirname,"..",x),"utf8")).join("\n");
const m=()=>vm.runInNewContext(code+`\n({WeeklyThreatCore,NetworkCore,NetworkData,ProgressV3Core,CombatCore,NetworkEncounterAdapter})`);
const heroes=["kael","lyra","darin","medic-demo","test-area-damage","ren","nada","liora","art","sava"].map(id=>({id,side:"ally"}));
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const fighter=()=>({id:"ren",side:"ally",name:"Рен",hp:12000,atk:1500,
 physicalAttack:1500,physicalDefense:350,magicDefense:350,speed:950});
const firstMonday=Date.UTC(2026,10,16,11,0,0);
function setup(){
 const mod=m(),storage=store(),onCredit=[],time={now:firstMonday};
 assert.equal(mod.ProgressV3Core.stage(heroes,()=>storage,0).status,"staged");
 const net=mod.NetworkCore.fresh(123,firstMonday,
  {id:"net-007-balanced-b1",capacity:16,intervalMs:21600000,
   guaranteeAfter:3,focusWeight:4,masteryScore:90},mod.NetworkData.LIVE_CATALOG);
 assert.ok(mod.NetworkCore.validState(net));
 net.threatIntel["2026-11-16"]=2;
 storage.setItem(mod.NetworkCore.KEY,JSON.stringify(net));
 const session=mod.WeeklyThreatCore.create({
  storageProvider:()=>storage,exclusive:fn=>Promise.resolve().then(fn),
  ownsLock:()=>true,now:()=>time.now,day:()=>new Date(time.now).toISOString().slice(0,10),
  heroes,onCredit:(wallet,reward)=>onCredit.push({wallet,reward})
 });
 assert.ok(session);
 return {mod,storage,time,session,onCredit};
}
function wallet(s){return JSON.parse(s.storage.getItem(s.mod.ProgressV3Core.KEY));}
async function win(s){
 assert.equal((await s.session.begin("survey")).ok,true);
 const current=s.session.read();
 const run=s.mod.WeeklyThreatCore.startBattle(current,[fighter()],s.mod.CombatCore);
 assert.ok(run);
 assert.equal(run.plan.binding.intel,2);
 assert.ok(run.plan.first[0].hp<run.plan.first[1].hp*4);
 const battle=run.battle;
 s.mod.CombatCore.advanceToPlayerTurn(battle);
 for(let i=0;i<90&&battle.active;i++){
  if(battle.currentActor<0)s.mod.CombatCore.advanceToPlayerTurn(battle);
  if(!battle.active)break;
  const enemy=battle.fighters.findIndex(x=>x.side==="enemy"&&x.hp>0);
  assert.ok(enemy>=0,"enemy still alive");
  assert.ok(s.mod.CombatCore.chooseEnemy(battle,enemy));
  assert.ok(s.mod.CombatCore.performPlayerAbility(battle,"basic"));
 }
 assert.equal(battle.winner,"ally","test party must win with actual CombatCore");
 const r=await s.session.finish(battle);
 assert.equal(r.ok,true,JSON.stringify(r));
 assert.ok(r.score>=90,"first priority target and no casualties earn a high S1");
 return r;
}
test("NET-008A week identity and rotation use UTC Monday, not locale",()=>{
 const {WeeklyThreatCore:W}=m();
 assert.equal(W.weekId(W.weekStart(Date.UTC(2026,10,15,23,59))),"2026-11-09");
 assert.equal(W.weekId(W.weekStart(Date.UTC(2026,10,16,0,0))),"2026-11-16");
 assert.notEqual(W.variant(W.weekStart(firstMonday)).id,
  W.variant(W.weekStart(firstMonday+7*86400000)).id);
});
test("NET-008A true CombatCore result pays each earned tier once and restores from reload",async()=>{
 const s=setup();
 assert.equal((await s.session.open()).ok,true);
 await win(s);
 assert.equal(s.session.read().active,null);
 assert.equal(s.session.pending().length,3);
 const r=await s.session.collect();
 assert.equal(r.ok,true,JSON.stringify(r));
 assert.equal(r.count,3);
 assert.equal(r.currency,10000);
 assert.equal(wallet(s).currency,10000);
 assert.equal(wallet(s).materials.Gl,30);
 assert.equal(wallet(s).networkLedger.claimedThrough,0);
 assert.equal((await s.session.collect()).count,0);
 const again=s.mod.WeeklyThreatCore.create({
  storageProvider:()=>s.storage,exclusive:fn=>Promise.resolve().then(fn),
  ownsLock:()=>true,now:()=>s.time.now,day:()=> "2026-11-16",
  heroes,onCredit:()=>{}
 });
 assert.equal((await again.open()).ok,true);
 assert.equal(again.read().bestScore,s.session.read().bestScore);
 assert.equal(again.pending().length,0);
 assert.equal(s.onCredit.length,3);
});
test("NET-008A preparation changes enemy properties and retry never pays for abandonment",async()=>{
 const s=setup();await s.session.open();
 await s.session.begin("survey");
 const survey=s.mod.WeeklyThreatCore.plan(s.session.read());
 assert.equal(survey.first[0].hp,Math.round(s.mod.WeeklyThreatCore.plan(s.session.read()).first[0].hp));
 assert.equal((await s.session.abandon()).ok,true);
 await s.session.begin("cover");
 const cover=s.mod.WeeklyThreatCore.plan(s.session.read());
 assert.ok(survey.first[0].hp<cover.first[0].hp);
 assert.ok(cover.first[1].physicalAttack<survey.first[1].physicalAttack);
 assert.equal(s.session.read().attempts,2);
 assert.equal((await s.session.collect()).count,0);
 assert.equal(wallet(s).currency,0);
});
test("NET-008A preserves an unpaid victory across week rotation; backward time cannot mint a week",async()=>{
 const s=setup();await s.session.open();await win(s);
 s.time.now=Date.UTC(2026,10,23,0,1);
 assert.equal((await s.session.open()).ok,true);
 assert.equal(s.session.read().bestScore,0);
 assert.equal(s.session.read().history.length,1);
 assert.equal(s.session.pending().length,3);
 assert.equal((await s.session.collect()).count,3);
 assert.equal((await s.session.collect()).count,0);
 const old=s.session.read();
 s.time.now=firstMonday;
 assert.equal((await s.session.begin("survey")).code,"CLOCK_ROLLBACK");
 assert.equal(s.session.isReady(),false);
 assert.equal(s.session.read().weekStart,old.weekStart);
});
test("NET-008A prevents fabricated result and pays no reward before a real victory",async()=>{
 const s=setup();await s.session.open();
 assert.equal((await s.session.begin("cover")).ok,true);
 assert.equal((await s.session.finish({winner:"ally",active:false})).code,"INVALID_BATTLE_RESULT");
 assert.equal((await s.session.collect()).count,0);
 assert.equal(wallet(s).currency,0);
});


test("NET-008A only a verified manual live clue earns weekly intelligence; no retroactive legacy credit",()=>{
 const {NetworkData:Data,NetworkCore:Core,NetworkEncounterAdapter:Adapter,CombatCore:Combat}=m();
 const template=Data.LIVE_CATALOG.templates.find(t=>t.minInfluence===0&&
  t.type==="supply"&&t.materialId==="Fe");
 assert.ok(template&&template.threatTag==="weekly-gardens");
 const cat=Data.buildCatalog({version:1,regions:Data.LIVE_CATALOG.regions,
  templates:[template]});
 const config={id:"net-008a-intel",capacity:4,intervalMs:1000,
  guaranteeAfter:3,focusWeight:1,masteryScore:90};
 let initial=Core.fresh(3456,0,config,cat);
 initial=Core.accrue(initial,4000,cat,["gardens-over-abyss"]);
 assert.ok(initial&&initial.board.length===4);
 const target=initial.board[0];
 let current=Core.start(initial,target.id);
 current=Core.prepare(current,"survey");
 current=Core.approach(current,"quiet");
 const run=Adapter.startBattle(current,[fighter()],{combat:Combat});
 assert.ok(run);
 const battle=run.battle;
 Combat.advanceToPlayerTurn(battle);
 for(let i=0;i<70&&battle.active;i++){
  if(battle.currentActor<0)Combat.advanceToPlayerTurn(battle);
  if(!battle.active)break;
  const index=battle.fighters.findIndex(x=>x.side==="enemy"&&x.hp>0);
  assert.ok(Combat.chooseEnemy(battle,index));
  assert.ok(Combat.performPlayerAbility(battle,"basic"));
 }
 assert.equal(battle.winner,"ally");
 const finished=Adapter.complete(current,battle);
 assert.ok(finished?.active?.waveSummaries?.length===1);
 const week="2026-11-16";
 const paid=Core.finish(finished,week);
 assert.equal(paid.threatIntel[week],1);
 assert.equal(Core.validState(paid),true);
 const legacy=Core.battleOutcome(current,target.id,0,true);
 const noCredit=legacy?Core.finish(legacy,week):null;
 assert.equal(noCredit?.threatIntel?.[week],undefined,
  "unverified legacy outcomes cannot generate weekly intel");
});


test("NET-008A real CombatCore loss clears active checkpoint and never credits the wallet",async()=>{
 const s=setup();
 assert.equal((await s.session.open()).ok,true);
 assert.equal((await s.session.begin("cover")).ok,true);
 const weak={id:"ren",side:"ally",name:"Тестовый слабый герой",hp:1,atk:1,
  physicalAttack:1,physicalDefense:0,magicDefense:0,speed:65};
 const run=s.mod.WeeklyThreatCore.startBattle(s.session.read(),[weak],s.mod.CombatCore);
 assert.ok(run?.battle);
 const battle=run.battle;
 s.mod.CombatCore.advanceToPlayerTurn(battle);
 for(let i=0;i<90&&battle.active;i++){
  if(battle.currentActor<0)s.mod.CombatCore.advanceToPlayerTurn(battle);
  if(!battle.active)break;
  const target=battle.fighters.findIndex(x=>x.side==="enemy"&&x.hp>0);
  assert.ok(s.mod.CombatCore.chooseEnemy(battle,target));
  assert.ok(s.mod.CombatCore.performPlayerAbility(battle,"basic"));
 }
 assert.equal(battle.winner,"enemy");
 const result=await s.session.finish(battle);
 assert.equal(result.ok,true);
 assert.equal(result.win,false);
 assert.equal(s.session.read().active,null);
 assert.equal(s.session.read().bestScore,0);
 assert.deepEqual(s.session.pending(),[]);
 assert.equal((await s.session.collect()).count,0);
 assert.equal(wallet(s).currency,0);
});
