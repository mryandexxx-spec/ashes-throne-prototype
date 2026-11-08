"use strict";
// Stats-004A: quantitative baseline from CURRENT campaign sources, no gameplay edits.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const game=read("game.js");
const begin=game.indexOf("const PILOT_HERO_STATS=");
const end=game.indexOf("function hasLeaderSkill",begin);
assert.ok(begin>0&&end>begin);
const source=["gear-data.js","progress-core.js","save-core.js","progress-v3-core.js",
 "initiative-model.js","ability-data.js","combat-core.js",
 "auto-decision.js","enemy-decision.js","mission-data.js"].map(read).join("\n")
 +"\n"+game.slice(0,game.indexOf("const $="))
 +"\nlet progress;\n"+game.slice(begin,end)
 +"\n({HEROES,GearData,ProgressCore,SaveCore,CombatCore,AutoDecision,MissionData,"
 +"setProgress:p=>{progress=p;},progressedHero,progressedEnemy})";
const {HEROES,GearData:G,ProgressCore:P,SaveCore:S,CombatCore:C,
 AutoDecision:A,MissionData:M,setProgress,progressedHero,progressedEnemy}=vm.runInNewContext(source);
// Freeze the original five combatants for longitudinal baseline comparisons.
const allies=HEROES.filter(f=>f.side==="ally"&&f.id!=="ren");
const foes=HEROES.filter(f=>f.side==="enemy");
const ids=allies.map(f=>f.id);
assert.deepEqual(Array.from(ids),["kael","lyra","darin","medic-demo","test-area-damage"]);
const groups=[
 ["kael"],["kael","lyra","darin"],["darin","lyra","kael"],ids
];
const missions=["black-pass-ambush","demo-mission-2","demo-mission-3"];
const scenarios=[
 {level:1,gear:"none"},
 {level:3,gear:"none"},
 {level:3,gear:"G1"},
 {level:12,gear:"none"},
 {level:12,gear:"G1"},
 {level:12,gear:"G3"}
];
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
function prepare(party,level,gear){
 const p=S.load(allies,()=>store()).progress;
 assert.ok(p&&p.saveVersion===3);
 for(const id of party)p.levels[id]=level;
 p.currency=1000000;
 for(const k of G.MATERIALS)p.materials[k]=10000;
 if(gear!=="none")for(const id of party){
  const tiers=gear==="G1"?[1]:[1,2,3];
  for(const tier of tiers){
   for(const slot of G.SLOTS){
    const offer=P.itemOffer(p,id,slot.id);
    assert.equal(offer.length,1,id+" tier "+tier+" slot "+slot.id);
    assert.equal(offer[0].tier,tier);
    assert.equal(P.equipItem(p,id,offer[0].id),true,
      id+" item "+offer[0].id+" equip at level "+level);
   }
   if(tier!==tiers.at(-1))
    assert.equal(P.promoteGear(p,id)?.to,tier+1);
  }
 }
 setProgress(p);
 return p;
}
function battle(missionId,party,level,gear,policy){
 prepare(party,level,gear);
 const units=party.map(id=>{
  const h=allies.find(f=>f.id===id);assert.ok(h);
  return progressedHero(h);
 });
 const first=(missionId==="demo-mission-2"?foes:foes.slice(0,2)).map(progressedEnemy);
 const waves=(M.get(missionId).futureEnemyWaves||[]).map(w=>w.map(id=>{
  const template=foes.find(f=>f.id===id);assert.ok(template);
  return progressedEnemy(template);
 }));
 const b=C.createBattle([...units,...first],waves,{leaderId:party[0]});
 for(const field of ["rng","hitChecks","critChecks","statusChecks","penetrationChecks"])
  assert.equal(Object.hasOwn(b,field),false,"real campaign does not enable "+field);
 const initialHP=units.reduce((s,f)=>s+f.hp,0);
 const initialProtection=units.reduce((s,f)=>s+(f.protection||0),0);
 C.advanceToPlayerTurn(b);
 let actions=0;
 while(b.active&&actions++<900){
  assert.equal(b.fighters[b.currentActor]?.side,"ally");
  if(policy==="tactical-auto"){
   const planned=A.chooseAction(b);
   assert.ok(planned);
   assert.equal(C.performAutoAction(b,planned),true);
  }else{
   const opponents=b.fighters.map((f,i)=>({f,i}))
    .filter(x=>x.f.side==="enemy"&&x.f.hp>0)
    .sort((x,y)=>x.f.hp-y.f.hp||x.i-y.i);
   assert.ok(opponents.length);
   assert.equal(C.chooseEnemy(b,opponents[0].i),true);
   assert.equal(C.performPlayerAbility(b,"basic"),true);
  }
 }
 assert.ok(actions<900,"battle must finish");
 assert.equal(b.active,false);
 const survivors=b.fighters.filter(f=>f.side==="ally"&&f.hp>0);
 const result={
  winner:b.winner,stars:M.score(missionId,b),
  deaths:party.length-survivors.length,
  allyActions:b.allyActions,
  turns:b.turn-1,
  remainingHP:survivors.reduce((s,f)=>s+f.hp,0),
  remainingProtection:survivors.reduce((s,f)=>s+(f.protection||0),0),
  initialHP,initialProtection,wave:b.wave
 };
 assert.equal(result.winner==="ally",result.stars>0);
 if(result.winner==="ally")assert.equal(result.wave,b.totalWaves,
  "victory requires clearing every wave");
 else assert.ok(result.wave<=b.totalWaves,
  "defeat may end before later waves begin");
 assert.ok(result.allyActions>=0);
 assert.ok(result.remainingHP>=0&&result.remainingHP<=initialHP);
 assert.ok(result.remainingProtection>=0&&result.remainingProtection<=initialProtection);
 return result;
}
const cases=[];
for(const mission of missions)for(const party of groups)
for(const {level,gear} of scenarios)for(const policy of ["tactical-auto","focused-basic"]){
 const result=battle(mission,party,level,gear,policy);
 assert.deepEqual(battle(mission,party,level,gear,policy),result,
  "current campaign must be deterministic");
 cases.push({mission,party:party.join("+"),size:party.length,level,gear,policy,result});
}
assert.equal(cases.length,144);
const mean=(xs,property)=>Number((xs.reduce((n,x)=>n+x.result[property],0)/xs.length).toFixed(2));
function summary(rows){
 return {cases:rows.length,wins:rows.filter(x=>x.result.winner==="ally").length,
  threeStars:rows.filter(x=>x.result.stars===3).length,
  stars:rows.reduce((s,x)=>s+x.result.stars,0),
  deaths:rows.reduce((s,x)=>s+x.result.deaths,0),
  avgAllyActions:mean(rows,"allyActions"),avgTurns:mean(rows,"turns"),
  avgRemainingHP:mean(rows,"remainingHP"),
  avgRemainingProtection:mean(rows,"remainingProtection")};
}
const summarize=(k,values)=>Object.fromEntries(values.map(v=>
 [String(v),summary(cases.filter(c=>c[k]===v))]));
const result={
 version:JSON.parse(read("package.json")).version,
 base:"current-main",count:cases.length,repeats:cases.length,
 missions:summarize("mission",missions),
 sizes:summarize("size",[1,3,5]),
 levels:summarize("level",[1,3,12]),
 gear:summarize("gear",["none","G1","G3"]),
 policy:summarize("policy",["tactical-auto","focused-basic"]),
 cross:Object.fromEntries(missions.map(id=>[id,Object.fromEntries(
  ["none","G1","G3"].map(g=>[g,summary(cases.filter(x=>x.mission===id&&x.gear===g))]))])),
 cases
};
console.log("STATS004A_BASELINE_JSON="+JSON.stringify(result));
console.log("Stats-004A: 144 current campaign cases x 2 deterministic replays, 3 missions, levels 1/3/12 and G1/G3 gear passed");
