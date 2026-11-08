"use strict";
// Stats-004A3: controlled resource-access audit for mission 2.
// Reads production mission, combat, progression, save and crafting code;
// does not change campaign economy. All farm iterations are assumed victories.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const game=read("game.js");
const start=game.indexOf("const PILOT_HERO_STATS="),end=game.indexOf("function hasLeaderSkill",start);
assert.ok(start>0&&end>start);
const src=["initiative-model.js","ability-data.js","combat-core.js",
  "auto-decision.js","enemy-decision.js","gear-data.js","progress-core.js",
  "save-core.js","progress-v3-core.js","mission-data.js","campaign-core.js","campaign-data.js"]
  .map(read).join("\n")+"\n"+game.slice(0,game.indexOf("const $="))+
  "\nlet progress;\n"+game.slice(start,end)+
  "\n({HEROES,CombatCore,AutoDecision,MissionData,CampaignData,CampaignCore,ProgressCore,SaveCore,GearData,setProgress:x=>{progress=x;},progressedHero,progressedEnemy})";
const api=vm.runInNewContext(src);
const {HEROES,CombatCore:C,AutoDecision:A,MissionData:M,CampaignData:CD,
 CampaignCore:CC,ProgressCore:P,SaveCore:S,GearData:G,setProgress,progressedHero,progressedEnemy}=api;
const allies=HEROES.filter(f=>f.side==="ally"),foes=HEROES.filter(f=>f.side==="enemy");
const ids=allies.map(h=>h.id);
assert.equal(ids.length,5);
function store(){const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};}
function firstWin(){
 const progress=S.load(allies,()=>store()).progress;
 assert.equal(progress.saveVersion,3);
 setProgress(progress);
 const b=C.createBattle([...allies.map(progressedHero),...foes.slice(0,2).map(progressedEnemy)],[],
  {leaderId:ids[0]});
 C.advanceToPlayerTurn(b);
 let n=0;
 while(b.active&&n++<300){
  const plan=A.chooseAction(b);
  assert.ok(plan);
  assert.equal(C.performAutoAction(b,plan),true);
 }
 assert.ok(n<300);
 assert.equal(b.winner,"ally","unmodified starting five-person roster should win mission 1");
 const stars=M.score("black-pass-ambush",b);
 const first=P.grantRepeatFarm(progress,"black-pass-ambush");
 const bonus=P.claimFirstClear(progress,"black-pass-ambush",b);
 assert.ok(first&&bonus,"first victory gives both baseline farm and first-clear bonus");
 assert.equal(first.currency,850);
 assert.equal(bonus.currency,500);
 assert.equal(progress.currency,1350);
 assert.equal(progress.accountXp,85);
 const campaign=CC.fresh();
 assert.equal(CC.recordResult(campaign,"black-pass-ambush",b).earned,stars);
 assert.equal(CD.available(CD.getMission("demo-mission-2"),campaign),true,
  "second mission unlocks on first victory, without a level gate");
 assert.equal(ids.every(id=>P.levelOf(progress,id)===1),true);
 return {progress,stars,actions:b.allyActions,first,bonus,
  unlockAccountLevel:P.accountLevel(progress)};
}
const initial=firstWin();
// Repeat victories are performed by the production battle engine, not
// assumed from a reward table. All five heroes remain at their initial level
// during farming, since upgrades are deliberately bought at the end.
function repeatVictory(p){
 setProgress(p);
 const b=C.createBattle([...allies.map(progressedHero),...foes.slice(0,2).map(progressedEnemy)],[],
  {leaderId:ids[0]});
 C.advanceToPlayerTurn(b);
 let steps=0;
 while(b.active&&steps++<300){
  const plan=A.chooseAction(b);
  assert.ok(plan);
  assert.equal(C.performAutoAction(b,plan),true);
 }
 assert.ok(steps<300);
 assert.equal(b.winner,"ally","repeat farm must be a genuine victory");
 return b;
}
// Audited progression: no test-resource button, no currency injection.
function upgradeAndEquip(p,level,gear){
 const used=JSON.parse(JSON.stringify(p));
 for(const id of ids){
  while(P.levelOf(used,id)<level){
   if(!P.upgrade(used,id))return null;
  }
 }
 if(gear==="G1"){
  for(const id of ids)for(const slot of G.SLOTS){
   const offered=P.itemOffer(used,id,slot.id);
   assert.equal(offered.length,1);
   if(!P.equipItem(used,id,offered[0].id))return null;
  }
 }
 return used;
}
function audit(level,gear,limit=300){
 const p=JSON.parse(JSON.stringify(initial.progress));
 const cost=P.missionEnergyCost("black-pass-ambush");
 const failedMaterials=[];
 for(let repeats=0;repeats<=limit;repeats++){
  const achieved=upgradeAndEquip(p,level,gear);
  if(achieved){
   return {level,gear,repeats,firstWins:1,totalMission1Wins:repeats+1,
    totalEnergySpent:repeats*cost,remainingEnergy:p.energy.value,accountLevel:P.accountLevel(p),
    currencyBeforePurchases:p.currency,currencyAfterPurchases:achieved.currency,
    materialsBeforePurchases:{...p.materials},
    materialsAfterPurchases:{...achieved.materials},
    levels:ids.map(id=>achieved.levels[id]),
    installed:ids.map(id=>P.gearInstalled(achieved,id)),
    expectedHeroLevelGateEnabled:false};
  }
  if(repeats<limit){
   assert.equal(P.spendEnergy(p,"black-pass-ambush",1,p.energy.updatedAt),
     true,"paid repeated campaign battle must have energy");
   const repeatBattle=repeatVictory(p);
   assert.equal(M.score("black-pass-ambush",repeatBattle),3);
   const farm=P.grantRepeatFarm(p,"black-pass-ambush");
   assert.ok(farm);
   assert.equal(farm.currency,850);
   assert.equal(farm.energy,cost);
   assert.equal(farm.materials.Gl,0);
  }
 }
 throw Error("budget not met with "+limit+" assumed farm wins");
}
const results=[
 audit(3,"none"),audit(3,"G1"),
 audit(12,"none"),audit(12,"G1")
];
for(const s of results){
 assert.equal(s.levels.every(x=>x===s.level),true);
 assert.equal(s.installed.every(x=>x===(s.gear==="G1"?6:0)),true);
 assert.equal(s.currencyAfterPurchases>=0,true);
}
assert.ok(results[0].repeats<=results[1].repeats);
assert.ok(results[2].repeats<=results[3].repeats);
const snapshot={
 firstMission:{stars:initial.stars,actions:initial.actions,
  farmCurrency:initial.first.currency,firstClearCurrency:initial.bonus.currency,
  unlocked:true,accountLevel:initial.unlockAccountLevel},
 repeatFarm:P.MISSION_GEAR_FARM["black-pass-ambush"],
 results,
 note:"All repeats executed as real AutoDecision victories at level 1, with actual energy spending and farm payouts, but only controlled five-person squad is tested. No regeneration, test resources or other missions. L12 is reachable because current vertical slice account level is informational, contrary to approved future account-level gate."
};
console.log("STATS004A3_PROGRESSION_JSON="+JSON.stringify(snapshot));
console.log("Stats-004A3: exact current mission 1 payout, real v3 G1 crafting, hero upgrades and mission 2 unlock verified");
