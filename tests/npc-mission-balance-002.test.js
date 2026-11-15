"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const {NpcMissionPilot:P,NpcEnemyData:N,HeroStatsProfiles:Profiles,
 HeroStatsCore:Stats,HeroStatsCombatBridge:Bridge,
 CombatCore:C,AbilityData:A,AutoDecision:Auto,MissionData:M}=vm.runInNewContext([
 "initiative-model.js","battle-rng.js","combat-status-core.js",
 "ability-data.js","skill-core.js","hero-stats-core.js","hero-stats-profiles.js",
 "hero-stats-combat-bridge.js","combat-core.js","enemy-decision.js",
 "auto-decision.js","npc-enemy-data.js","npc-mission-pilot.js","mission-data.js"
].map(read).join("\n")+"\n({NpcMissionPilot,NpcEnemyData,HeroStatsProfiles,HeroStatsCore,HeroStatsCombatBridge,CombatCore,AbilityData,AutoDecision,MissionData})");
const IDS=["ren","nada","liora","art","sava"];
function hero(id,level=1){
 const h={id,name:id,side:"ally",role:id,glyph:"☆"};
 const p=Bridge.apply(h,{level,stars:1,gearPercent:{hp:0,atk:0},gearStats:{}},Profiles[id],Stats);
 return {...p,skillLevels:{basic:1,special:1,powerful:1,passive:1,leader:1}};
}
function run(ids,level,seed,strategy="focus-healer"){
 const squad=ids.map(id=>hero(id,level));
 const enemies=P.spawn("demo-mission-2");
 assert.ok(enemies&&enemies.length===2);
 const b=C.createBattle([...squad,...enemies],[],{
  leaderId:squad[0].id,rngSeed:seed,hitChecks:true,critChecks:true,
  penetrationChecks:true,statusChecks:true
 });
 C.advanceToPlayerTurn(b);
 let steps=0,heals=0,weakens=0;
 while(b.active&&steps<150){
  if(b.currentActor<0)C.advanceToPlayerTurn(b);
  if(!b.active)break;
  const actor=b.fighters[b.currentActor];
  assert.equal(actor.side,"ally","turn engine should return only player actors");
  const living=b.fighters.map((f,i)=>({f,i})).filter(x=>x.f.side==="enemy"&&x.f.hp>0);
  if(!living.length)break;
  let plan;
  if(strategy==="auto")plan=Auto.chooseAction(b);
  else{
   const target=living.find(x=>x.f.archetypeId===(strategy==="focus-attacker"?"npc-ridge-slinger":"npc-field-medic"))??living[0];
   const strong=["powerful","special"].find(id=>{
    if(!C.abilityReady(b,id))return false;
    const ability=A.get(actor,id);
    return ability?.kind==="damage"&&["enemy","all-enemies"].includes(ability.target);
   });
   plan={abilityId:strong||"basic",targetIndex:target.i};
  }
  assert.equal(C.performAutoAction(b,plan),true,"ability must be executable and turn advance");
  heals+=b.events.filter(e=>e.type==="heal"&&e.actorId.startsWith("npc-")).length;
  weakens+=b.events.filter(e=>e.type==="effect"&&e.effect==="weaken").length;
  steps++;
 }
 assert.ok(steps<150,"no endless combat");
 assert.ok(!b.active,"battle must finish");
 const stars=M.score("demo-mission-2",b);
 return {strategy,ids:ids.join(","),level,seed,won:b.winner==="ally",stars,
  actions:b.allyActions,alliesAlive:b.fighters.filter(f=>f.side==="ally"&&f.hp>0).length,
  hp:b.fighters.filter(f=>f.side==="ally"&&f.hp>0).reduce((sum,f)=>sum+f.hp,0),
  heals,weakens};
}
test("NPCMISSION002: mission-specific config does not change current campaigns or save rules",()=>{
 const plan=P.get("demo-mission-2");
 assert.equal(plan.missionId,"demo-mission-2");
 assert.equal(plan.difficulty,"light");
 assert.equal(P.get("black-pass-ambush"),null);
 assert.equal(P.get("demo-mission-3"),null);
 assert.equal(plan.enemyIds.length,2);
 assert.equal(new Set(plan.enemyIds.map(e=>e.instanceId)).size,2);
 const f=P.spawn("demo-mission-2"),again=P.spawn("demo-mission-2");
 assert.deepEqual(f.map(e=>e.archetypeId),["npc-ridge-slinger","npc-field-medic"]);
 assert.ok(f.every(x=>x.side==="enemy"&&x.speciesId==="human"&&x.originRegionId==="gardens-over-abyss"));
 assert.notEqual(f[0],again[0]);
 assert.equal(f[0].level,1);
 assert.equal(f[1].npcAbilities.special.healAmount,36);
 assert.equal(f[0].hp,75);
 assert.equal(f[0].protection,5);
 assert.equal(f[1].hp,55);
 assert.equal(f[1].protection,5);
 assert.equal(N.get("npc-field-medic").stats.hp,103,
  "only this mission is tuned; the archetype remains unchanged");
 assert.equal(N.get("npc-ridge-slinger").stats.hp,88);
 assert.equal(M.get("demo-mission-2").stars.length,3);
 assert.equal(M.get("demo-mission-2").stars[2].conditions.at(-1).limit,9);
});
test("NPCMISSION002: opt-in is only demo-mission-2 and 3D instances match IDs",()=>{
 const game=read("game.js"),html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.match(game,/npcMissionPilot=1/);
 assert.match(game,/battleIsCampaign&&activeMissionId==="demo-mission-2"&&NPC_MISSION_PILOT_ENABLED/);
 assert.match(game,/const COMBAT_VISUALS=HEROES.concat\(NPC_PILOT_VISUALS.filter\(Boolean\),NPC_MISSION_VISUALS\)/);
 assert.match(game,/NPC_MISSION_VISUALS=NPC_MISSION_PILOT_ENABLED/);
 assert.match(game,/const ENEMIES=HEROES.filter\(h=>h.side==="enemy"\)/);
 assert.match(game,/activeMissionId==="demo-mission-2"\?ENEMIES:ENEMIES.slice\(0,2\)/);
 assert.match(html,/npc-mission-pilot\.js\?v=0\.3\.165/);
 assert.equal(pkg.version,"0.3.165");
 assert.match(html,/v0\.3\.165 · NPCMISSION002/);
 assert.equal((game.match(/side:"enemy",glyph:/g)||[]).length,5);
});
test("NPCMISSION002: practical combat matrix for actual Gardens hero stats (L1, L3, L8)",()=>{
 const cases=[
  {ids:IDS,level:1},
  {ids:IDS,level:3},
  {ids:["ren","nada","sava"],level:3},
  {ids:["ren","liora","art"],level:3},
  {ids:["ren","nada","liora","art"],level:8}
 ];
 const results=[];
 for(const c of cases)for(const seed of [1,17,71]){
  for(const strategy of ["focus-healer","focus-attacker","auto"]){
   results.push(run(c.ids,c.level,seed,strategy));
  }
 }
 const full=results.filter(x=>x.ids===IDS.join(",")&&x.level===1);
 assert.ok(full.some(x=>x.won),"starter five must be able to beat the pilot");
 assert.ok(full.some(x=>x.stars===3),"third star must be achievable at reachable L1");
 assert.ok(full.every(x=>x.stars>=2),"the five-hero starter roster should survive");
 const smart=full.filter(x=>x.strategy==="focus-healer");
 const naive=full.filter(x=>x.strategy==="focus-attacker");
 assert.ok(smart.reduce((n,r)=>n+r.actions,0)<naive.reduce((n,r)=>n+r.actions,0),
  "focusing the medic must save actions over ignoring treatment");
 const winRate=results.filter(x=>x.won).length/results.length;
 console.log("NPCMISSION002_BALANCE="+JSON.stringify({
  scenarios:results.length,winRate:Number(winRate.toFixed(3)),
  summary:Object.fromEntries(cases.map(c=>{
   const key=c.ids.join(",")+"@L"+c.level;
   const group=results.filter(x=>x.ids===c.ids.join(",")&&x.level===c.level);
   return [key,{wins:group.filter(x=>x.won).length,attempts:group.length,
    bestStars:Math.max(...group.map(x=>x.stars)),
    meanAllyActions:Number((group.reduce((a,v)=>a+v.actions,0)/group.length).toFixed(1)),
    maxHeals:Math.max(...group.map(x=>x.heals))}];
  })),
  sample:results.filter(x=>x.ids===IDS.join(",")&&x.level===1)
 }),"NPCMISSION002_BALANCE_END");
});
