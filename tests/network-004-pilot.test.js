"use strict";
/* NET-004 [ПРЕДЛОЖЕНИЕ]: test-key-only network pilot lifecycle and real CombatCore. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const file=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Core=require("../network-core.js");
const Pilot=require("../network-pilot-session.js");
const Adapter=require("../network-encounter-adapter.js");
const Combat=vm.runInNewContext([
 "initiative-model.js","battle-rng.js","combat-status-core.js",
 "ability-data.js","network-score-core.js","combat-core.js"
].map(file).join("\n")+"\nCombatCore");
const key=Pilot.KEY;
const hero=()=>({id:"network-test-hero",name:"Пробный герой",side:"ally",
 hp:5000,atk:999,physicalAttack:999,physicalDefense:20,magicDefense:20,speed:950});
function store(){
 const map=new Map(),writes=[];let mode=null;
 const local={getItem(k){if(mode==="read")throw Error("read error");
  return map.has(k)?map.get(k):null;},
  setItem(k,v){writes.push([k,v]);map.set(k,v);
   if(mode==="write-after")throw Error("ambiguous write");
   if(mode==="readback")map.set(k,"corrupt");}};
 return {map,writes,local,setMode:x=>mode=x};
}
function factory(memory,opts={}){
 let owner=opts.owner??true;
 const pilot=Pilot.create({storageProvider:()=>memory.local,
  exclusive:opts.exclusive??(async cb=>cb()),ownsLock:()=>owner,
  now:()=>opts.now??10000,seed:()=>opts.seed??12345});
 return {pilot,setOwner:x=>owner=x};
}
function win(battle){
 Combat.advanceToPlayerTurn(battle);
 for(let n=0;n<50&&battle.active;n++){
  if(battle.currentActor<0)Combat.advanceToPlayerTurn(battle);
  if(!battle.active)break;
  const i=battle.fighters.findIndex(f=>f.side==="enemy"&&f.hp>0);
  assert.ok(i>=0);
  assert.equal(Combat.chooseEnemy(battle,i),true);
  assert.equal(Combat.performPlayerAbility(battle,"basic"),true);
 }
 assert.equal(battle.winner,"ally");return battle;
}
async function selected(pilot,{approach="quiet",prepare="survey"}={}){
 const available=pilot.read().board;
 assert.ok(available.length);
 assert.equal((await pilot.change("start",available[0].id)).ok,true);
 assert.equal((await pilot.change("prepare",prepare)).ok,true);
 assert.equal((await pilot.change("approach",approach)).ok,true);
 return pilot.read();
}
test("NET-004 isolated storage: 3 pilot clues, no economy/network.v1 mutations",async()=>{
 const m=store();m.map.set(Core.KEY,"PRODUCTION_SENTINEL");
 m.map.set("ashes-throne.progress.v3","WALLET_SENTINEL");
 const {pilot}=factory(m);
 assert.equal(Pilot.KEY,"ashes-throne.network.pilot.v1");
 assert.ok(pilot);
 assert.equal((await pilot.open()).ok,true);
 assert.equal(pilot.read().board.length,3);
 assert.equal(pilot.read().active,null);
 assert.equal(pilot.isReady(),true);
 assert.ok(m.writes.every(([k])=>k===key));
 assert.equal(m.map.get(Core.KEY),"PRODUCTION_SENTINEL");
 assert.equal(m.map.get("ashes-throne.progress.v3"),"WALLET_SENTINEL");
 const before=m.writes.length;
 assert.equal((await pilot.open()).ok,true);
 assert.equal(m.writes.length,before,"open twice no duplicate arrivals");
 assert.equal((await pilot.change("refresh")).ok,true);
 assert.equal(m.writes.length,before,"capacity/full board produces no new writes");
 const copy=pilot.read();copy.board.splice(0);
 assert.equal(pilot.read().board.length,3,"external object cannot mutate saved state");
});
test("NET-004 one-wave real battle -> persisted result -> finish; no money",async()=>{
 const m=store(),{pilot}=factory(m);await pilot.open();
 const active=await selected(pilot);
 assert.equal(active.active.phase,"battle");
 const saved=JSON.parse(m.map.get(key));
 assert.equal(saved.revision,active.revision,"checkpoint persisted before combat");
 const run=Adapter.startBattle(pilot.read(),[hero()],{combat:Combat});
 assert.ok(run);
 assert.equal(run.battle.networkBinding.revision,active.revision);
 assert.equal((await pilot.complete(run.battle)).code,"INVALID_BATTLE_OUTCOME",
  "unfinished combat cannot be credited");
 win(run.battle);
 const result=await pilot.complete(run.battle);
 assert.equal(result.ok,true);
 assert.equal(pilot.read().active.phase,"result");
 assert.ok(pilot.read().active.score>=60&&pilot.read().active.score<=100,
  "real S1 score, without any economy payouts");
 assert.equal(pilot.read().active.waveSummaries.length,1);
 assert.equal((await pilot.complete(run.battle)).code,"INVALID_BATTLE_OUTCOME",
  "one battle cannot be accepted twice");
 assert.equal((await pilot.change("finish")).ok,true);
 const complete=pilot.read();
 assert.equal(complete.active,null);
 assert.equal(complete.completed.length,1);
 assert.equal(complete.completed[0].kind,"manual");
 assert.equal(complete.completed[0].rewardRef.startsWith("net-proposal-no-payout-"),true);
 assert.ok(m.writes.every(([k])=>k===key));
 assert.equal(m.map.has("ashes-throne.progress.v3"),false);
 assert.equal((await pilot.change("finish")).ok,false);
});
test("NET-004 multiwave checkpoints: reload resumes correct wave and no fake rewards",async()=>{
 const m=store(),first=factory(m).pilot;await first.open();
 await selected(first,{approach:"cordon",prepare:"cover"});
 const freshHero=()=>({...hero(),protection:25,maxProtection:25});
 const one=Adapter.startBattle(first.read(),[freshHero()],{combat:Combat});
 assert.equal(one.battle.totalWaves,1,"each encounter is an independent CombatCore battle");
 assert.equal(one.battle.pendingWaves.length,0);
 win(one.battle);
 const veteran=one.battle.fighters.find(f=>f.side==="ally");
 // Surviving wounded combatants retain these values in the old battle object,
 // but the next encounter must start from the roster's full baseline instead.
 veteran.hp=1;
 veteran.protection=0;
 veteran.specialCooldown=4;
 veteran.powerfulCooldown=3;
 veteran.effects.testWound={stacks:2};
 assert.equal((await first.complete(one.battle)).ok,true);
 assert.equal(first.read().completed.length,0,"wave one is not a completed operation");
 assert.equal(first.read().active.phase,"battle");
 assert.equal(first.read().active.wave,1);
 const second=factory(m).pilot;
 assert.equal((await second.open()).ok,true);
 const next=Adapter.startBattle(second.read(),[freshHero()],{combat:Combat});
 assert.equal(next.plan.binding.wave,1);
 assert.equal(next.battle.totalWaves,1,"second encounter is a new battle, not an internal wave");
 assert.equal(next.battle.pendingWaves.length,0);
 assert.notEqual(next.plan.binding.seed,one.plan.binding.seed);
 assert.notEqual(next.battle,one.battle);
 const rested=next.battle.fighters.find(f=>f.side==="ally");
 assert.equal(rested.hp,5000,"full HP restored for encounter two");
 assert.equal(rested.maxHp,5000);
 assert.equal(rested.protection,25,"protection restored between encounters");
 assert.equal(rested.specialCooldown,0,"special cooldown reset");
 assert.equal(rested.powerfulCooldown,0,"powerful cooldown reset");
 assert.deepEqual(Object.keys(rested.effects),[],"no prior status effects");
 assert.equal(veteran.hp,1,"previous battle object is untouched");
 assert.equal((await second.complete(one.battle)).ok,false);
 win(next.battle);
 assert.equal((await second.complete(next.battle)).ok,true);
 assert.equal(second.read().active.phase,"result");
 const third=factory(m).pilot;
 await third.open();
 assert.equal(third.read().active.phase,"result","reload keeps unpaid result");
 assert.equal((await third.change("finish")).ok,true);
 assert.equal(third.read().completed.length,1);
 assert.equal(m.map.has(Core.KEY),false);
 assert.equal(m.map.has("ashes-throne.progress.v3"),false);
});
test("NET-004 abandonment and defeat restore complete original clue",async()=>{
 const m=store(),p=factory(m).pilot;await p.open();
 const s=await selected(p,{approach:"quiet"});
 const old=s.active.clue;
 assert.equal((await p.change("abandon")).ok,true);
 assert.deepEqual(p.read().board.find(c=>c.id===old.id),old);
 const started=await selected(p);
 const run=Adapter.startBattle(started,[hero()],{combat:Combat});
 run.battle.fighters.find(f=>f.side==="ally").hp=0;
 Combat.advanceToPlayerTurn(run.battle);
 assert.equal(run.battle.winner,"enemy");
 assert.equal((await p.complete(run.battle)).ok,true);
 assert.equal(p.read().active,null);
 assert.equal(p.read().completed.length,0);
 assert.ok(p.read().board.some(c=>c.id===started.active.clue.id));
});
test("NET-004 fail closed on lock denial, corrupt pilot data, stale and uncertain writes",async()=>{
 const a=store();
 assert.equal((await factory(a,{owner:false}).pilot.open()).code,"WALLET_WRITER_NOT_OWNED");
 assert.equal(a.map.size,0);
 const b=store();b.map.set(key,"{broken");
 const broken=factory(b).pilot;
 assert.equal((await broken.open()).code,"LOAD_FAILED");
 assert.equal(b.map.get(key),"{broken");
 assert.equal((await broken.change("refresh")).code,"SESSION_BLOCKED_RELOAD_REQUIRED");
 const m=store(),first=factory(m).pilot,second=factory(m).pilot;
 await first.open();await second.open();
 const clue=first.read().board[0];
 assert.equal((await first.change("start",clue.id)).ok,true);
 assert.equal((await second.change("start",clue.id)).code,"SAVE_FAILED");
 assert.equal(second.isBlocked(),true);
 assert.equal((await second.change("start",clue.id)).code,"SESSION_BLOCKED_RELOAD_REQUIRED");
 const c=store(),p=factory(c).pilot;await p.open();
 c.setMode("write-after");
 assert.equal((await p.change("start",p.read().board[0].id)).code,"SAVE_FAILED");
 assert.equal(p.isBlocked(),true);
 assert.equal((await p.change("refresh")).code,"SESSION_BLOCKED_RELOAD_REQUIRED");
});
test("NET-004 feature gated, correct script order and build/cache version",()=>{
 const html=file("index.html"),js=file("game.js"),pkg=JSON.parse(file("package.json"));
 assert.ok(html.includes('id="buildVersion">Прототип · v'+pkg.version+' · ARENAENV005'));
 assert.ok(html.includes('class="hq-station hq-station-operations" data-screen="network"'));
 const scripts=["network-data.js","network-score-core.js","network-core.js","network-encounter-data.js",
 "network-encounter-adapter.js","network-pilot-session.js","network-pilot-ui.js","network-navigation.js","game.js"];
 const indices=scripts.map(name=>html.indexOf('src="'+name+'?v='+pkg.version+'"'));
 assert.ok(indices.every(n=>n>0));
 assert.deepEqual(indices,indices.slice().sort((a,b)=>a-b));
 assert.ok(js.includes('networkPilot=1(?:&|$)'));
 assert.ok(js.includes('NetworkPilotSession.create('));
 assert.ok(js.includes('networkSquadSlots=slots.slice(0,MAX_SQUAD)'));
 assert.ok(js.includes('leaderId:squadSlots()[0]'));
 assert.ok(js.includes('networkPilot.complete(terminalBattle)'));
 assert.ok(js.includes('NetworkEncounterAdapter.startBattle(active,selectedParty()'));
 assert.ok(!html.includes('data-screen="network" class="hq-station"'));
 assert.ok(file("network-pilot-ui.js").includes("Пробный режим без наград"));
});
