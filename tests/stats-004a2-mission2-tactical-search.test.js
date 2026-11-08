"use strict";
// Stats-004A2 bounded, reproducible tactical search. Real source and real engine.
// A search failing to find a solution is NOT proof of mathematical impossibility.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const game=read("game.js");
const begin=game.indexOf("const PILOT_HERO_STATS="),end=game.indexOf("function hasLeaderSkill",begin);
assert.ok(begin>0&&end>begin);
const source=["gear-data.js","progress-core.js","save-core.js","progress-v3-core.js",
 "initiative-model.js","ability-data.js","combat-core.js","auto-decision.js",
 "enemy-decision.js","mission-data.js"].map(read).join("\n")
 +"\n"+game.slice(0,game.indexOf("const $="))
 +"\nlet progress;\n"+game.slice(begin,end)
 +"\n({HEROES,GearData,ProgressCore,SaveCore,CombatCore,AbilityData,AutoDecision,MissionData,"
 +"setProgress:p=>{progress=p;},progressedHero,progressedEnemy})";
const {HEROES,GearData:G,ProgressCore:P,SaveCore:S,CombatCore:C,AbilityData:Abilities,
 AutoDecision:A,MissionData:M,setProgress,progressedHero,progressedEnemy}=vm.runInNewContext(source);
const allies=HEROES.filter(f=>f.side==="ally"),foes=HEROES.filter(f=>f.side==="enemy");
assert.equal(M.get("demo-mission-2").stars[2].conditions.find(c=>c.type==="max-ally-actions").limit,9);
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
function newBattle(party,level,gear){
 const p=S.load(allies,()=>store()).progress;
 assert.equal(p.saveVersion,3);
 for(const id of party)p.levels[id]=level;
 p.currency=1000000;
 for(const id of G.MATERIALS)p.materials[id]=10000;
 if(gear!=="none")for(const id of party){
  for(const tier of (gear==="G1"?[1]:[1,2,3])){
   for(const slot of G.SLOTS){
    const offered=P.itemOffer(p,id,slot.id);
    assert.equal(offered.length,1);
    assert.equal(offered[0].tier,tier);
    assert.equal(P.equipItem(p,id,offered[0].id),true);
   }
   if(tier!==(gear==="G1"?1:3))
    assert.equal(P.promoteGear(p,id)?.to,tier+1);
  }
 }
 setProgress(p);
 const heroes=party.map(id=>progressedHero(allies.find(h=>h.id===id)));
 const enemies=foes.map(progressedEnemy);
 const b=C.createBattle([...heroes,...enemies],[],{leaderId:party[0]});
 C.advanceToPlayerTurn(b);
 return b;
}
// Clone the battle preserving makeFighter's read/write effect aliases. Plain
// JSON cloning would silently break guardHits/weakenAttacks getters and setters.
function clone(b){
 const fighters=b.fighters.map(f=>{
  const effects=Object.assign(Object.create(null),Object.fromEntries(
   Object.entries(f.effects).map(([k,v])=>[k,{...v}])));
  const next={...f,effects};
  for(const name of ["guardHits","weakenAttacks"]){
   const desc=Object.getOwnPropertyDescriptor(f,name);
   if(desc?.get&&desc?.set)
    Object.defineProperty(next,name,{...desc,configurable:false});
  }
  return next;
 });
 return {...b,fighters,events:b.events.map(e=>({...e})),
  pendingWaves:b.pendingWaves.map(w=>w.map(x=>({...x})))};
}
function snapshot(b){
 return JSON.stringify({
  turn:b.turn,allyActions:b.allyActions,currentActor:b.currentActor,
  selectedEnemy:b.selectedEnemy,selectedAlly:b.selectedAlly,active:b.active,winner:b.winner,
  fighters:b.fighters.map(f=>({
   id:f.id,hp:f.hp,protection:f.protection,meter:f.meter,
   specialCooldown:f.specialCooldown,powerfulCooldown:f.powerfulCooldown,
   guardHits:f.guardHits,weakenAttacks:f.weakenAttacks
  }))
 });
}
function candidates(b){
 if(!b.active)return [];
 const actor=b.fighters[b.currentActor];
 assert.equal(actor.side,"ally");
 const out=[];
 for(const abilityId of ["basic","special","powerful"]){
  if(!C.abilityReady(b,abilityId))continue;
  const def=Abilities.get(actor,abilityId);
  if(!def)continue;
  const targetIndices=def.target==="enemy"||def.target==="all-enemies"
   ?b.fighters.flatMap((f,i)=>f.side==="enemy"&&f.hp>0?[i]:[])
   :def.target==="ally"?b.fighters.flatMap((f,i)=>
    f.side==="ally"&&f.hp>0?[i]:[])
   :[b.currentActor];
  for(const target of targetIndices){
   // A healing action at full HP (or redundant guard) only wastes turns.
   if(def.kind==="heal"){
    const h=b.fighters[target];
    if(def.target==="ally"&&h.hp>=h.maxHp)continue;
    if(def.target==="all-allies"&&b.fighters.every(f=>
      f.side!=="ally"||f.hp===0||f.hp>=f.maxHp))continue;
   }
   out.push({actor:actor.id,ability:abilityId,target,
    targetId:b.fighters[target].id});
  }
 }
 return out;
}
function step(b,move){
 const copy=clone(b);
 if(!C.performActorAbility(copy,move.ability,move.target))return null;
 assert.equal(copy.allyActions,b.allyActions+1);
 return copy;
}
// Invariant: branching must not change the parent or its effects.
{
 const b=newBattle(["kael","lyra","darin"],3,"none");
 const before=snapshot(b),c=clone(b);
 assert.equal(snapshot(c),before);
 const moves=candidates(c);
 assert.ok(moves.length>0);
 assert.ok(step(c,moves[0]));
 assert.equal(snapshot(b),before);
 assert.equal(snapshot(c),before);
}
// Dedupe includes initiative, HP/Protection, cooldown, status: no unsafe
// merging of states that may have different future action options.
function key(b){
 return JSON.stringify([b.currentActor,b.active,b.winner,b.allyActions,
  b.fighters.map(f=>[f.id,f.hp,f.protection??null,
   Math.round(f.meter*1e8)/1e8,f.specialCooldown,f.powerfulCooldown,
   f.guardHits,f.weakenAttacks])]);
}
const enemyInitial=foes.reduce((s,f)=>s+f.hp,0);
function score(node){
 const b=node.b;
 const enemyRemaining=b.fighters.filter(f=>f.side==="enemy")
  .reduce((s,f)=>s+f.hp,0);
 const lostAllies=b.fighters.filter(f=>f.side==="ally"&&f.hp===0).length;
 const living=b.fighters.filter(f=>f.side==="ally"&&f.hp>0)
  .reduce((s,f)=>s+f.hp+(f.protection||0),0);
 if(b.winner==="ally")return 100000-lostAllies*30000+living/10;
 return (enemyInitial-enemyRemaining)*10-lostAllies*20000+
  living/10+ b.fighters.filter(f=>f.side==="enemy"&&f.weakenAttacks>0).length*10;
}
function beamSearch(party,level,gear,beamWidth=180,maxActions=12){
 const base=newBattle(party,level,gear);
 let layer=[{b:base,path:[]}],expanded=0,created=0;
 let fastestWin=null,fastestPerfect=null,best=null;
 const stats=[];
 for(let depth=1;depth<=maxActions&&layer.length;depth++){
  const next=new Map(),wins=[];
  for(const node of layer){
   if(!node.b.active)continue;
   for(const move of candidates(node.b)){
    expanded++;
    const b=step(node.b,move);
    if(!b)continue;
    created++;
    const n={b,path:[...node.path,move]};
    const deaths=b.fighters.filter(f=>f.side==="ally"&&f.hp===0).length;
    if(b.winner==="ally"){
      wins.push(n);
      if(!fastestWin)fastestWin=n;
      if(deaths===0&&!fastestPerfect)fastestPerfect=n;
    }
    // 3-star needs zero casualties, so preserve only no-casualty candidates
    // while looking for a perfect victory. Others remain counted in wins.
    if(b.active&&deaths===0){
      const k=key(b);
      const old=next.get(k);
      if(!old||score(n)>score(old))next.set(k,n);
    }
   }
  }
  const ordered=[...next.values()].sort((a,b)=>score(b)-score(a));
  layer=ordered.slice(0,beamWidth);
  stats.push({depth,generated:created,wins:wins.length,kept:layer.length,
   bestRemainingEnemyHP:layer.length?layer[0].b.fighters.filter(f=>f.side==="enemy")
      .reduce((s,f)=>s+f.hp,0):null});
  if(fastestPerfect)break;
 }
 const resultNode=fastestPerfect||fastestWin||layer[0]||best;
 function summarizeNode(node){
  if(!node)return null;
  return {winner:node.b.winner,actions:node.b.allyActions,
   stars:M.score("demo-mission-2",node.b),
   deaths:node.b.fighters.filter(f=>f.side==="ally"&&f.hp===0).length,
   remainingEnemies:node.b.fighters.filter(f=>f.side==="enemy")
      .reduce((s,f)=>s+f.hp,0),
   remainingHP:node.b.fighters.filter(f=>f.side==="ally"&&f.hp>0)
      .reduce((s,f)=>s+f.hp,0),
   path:node.path.map(m=>({actor:m.actor,ability:m.ability,target:m.targetId}))};
 }
 // Replay a representative path from a completely fresh initial battle.
 if(resultNode){
  const replay=newBattle(party,level,gear);
  for(const move of resultNode.path){
   assert.equal(replay.fighters[replay.currentActor].id,move.actor);
   const target=replay.fighters.findIndex(f=>f.id===move.targetId);
   assert.ok(target>=0);
   assert.equal(C.performActorAbility(replay,move.ability,target),true);
  }
  assert.equal(snapshot(replay),snapshot(resultNode.b),
   "tactical search witness must replay via the actual combat engine");
 }
 return {party,level,gear,beamWidth,maxActions,expanded,created,
  foundPerfectByLimit:!!fastestPerfect&&fastestPerfect.b.allyActions<=9,
  firstWin:summarizeNode(fastestWin),
  firstZeroCasualtyWin:summarizeNode(fastestPerfect),
  representative:summarizeNode(resultNode),
  steps:stats};
}
const scenarios=[
 {party:["kael","lyra","darin","medic-demo","test-area-damage"],level:12,gear:"G3"},
 {party:["kael","lyra","darin"],level:12,gear:"G3"},
 {party:["kael","lyra","darin","medic-demo","test-area-damage"],level:3,gear:"G1"},
 {party:["kael","lyra","darin","medic-demo","test-area-damage"],level:1,gear:"none"}
];
const report=scenarios.map(s=>beamSearch(s.party,s.level,s.gear));
assert.equal(report.length,scenarios.length);
for(const row of report)assert.ok(row.created>0);
console.log("STATS004A2_TACTICAL_JSON="+JSON.stringify({version:JSON.parse(read("package.json")).version,
 mission:"demo-mission-2",limit:9,
 method:"bounded beam search of real legal player abilities and live deterministic enemy replies; incomplete search cannot prove impossibility",
 scenarios:report}));
console.log("Stats-004A2: real battle tactics and replay validation passed");
