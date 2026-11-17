"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["gear-data.js","progress-core.js","save-core.js","progress-v3-core.js",
 "mission-data.js","campaign-data.js","campaign-core.js","gear-source-data.js",
 "gear-planning-core.js"];
const code=scripts.map(name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8")).join("\n");
const {G,P,V,M,CD,CC,S,F}=vm.runInNewContext(code+
 "\n({G:GearData,P:ProgressCore,V:ProgressV3Core,M:MissionData,CD:CampaignData,CC:CampaignCore,S:GearSourceData,F:GearPlanningCore})");
const roster=["kael","lyra","darin","medic-demo","test-area-damage","ren","nada","liora"]
 .map(id=>({id,side:"ally",hp:125,atk:26,speed:120}));
const fresh=()=>{
 const p=V.toRuntime(V.fresh(roster,12345),roster);
 assert.ok(p);return p;
};
const rich=()=>{const p=fresh();p.currency=1_000_000;
 for(const id of G.MATERIALS)p.materials[id]=1_000_000;
 return p;};
const copy=x=>JSON.parse(JSON.stringify(x));
function fill(p,heroId){
 for(const slot of G.SLOTS){
  const offer=P.itemOffer(p,heroId,slot.id)[0];assert.ok(offer);
  assert.equal(P.equipItem(p,heroId,offer.id),true);
 }
}

test("GEAR-FINDER sources are strictly linked to real missions and v3 farm tables",()=>{
 assert.deepEqual(copy(S.catalogIssues()),[]);
 assert.equal(CD.catalogIsValid(),true);
 for(const id of G.MATERIALS){
  const actual=S.findSources(id);
  const expected=M.all().filter(m=>(P.MISSION_GEAR_FARM[m.id]?.materials[id]||0)>0);
  assert.deepEqual(Array.from(actual,x=>x.missionId),Array.from(expected,x=>x.id));
  for(const src of actual){
   const reward=P.MISSION_GEAR_FARM[src.missionId];
   assert.equal(src.quantity,reward.materials[id]);
   assert.equal(src.nominalEnergyCost,reward.cost);
   assert.equal(src.nominalEnergyCost,P.missionEnergyCost(src.missionId));
   assert.equal(src.currencyPerVictory,reward.currency);
   assert.equal(src.title,M.get(src.missionId).title);
   assert.equal(src.access,"unknown","without campaign state, never fabricate unlock");
   assert.equal(src.canSimulate,false);
   assert.ok(Object.isFrozen(src));
  }
 }
 assert.deepEqual(Array.from(S.findSources("invalid")),[]);
 assert.deepEqual(Array.from(S.findSources("__proto__")),[]);
 assert.deepEqual(Array.from(S.findSources("Gl"),x=>x.missionId),["demo-mission-2"]);
 assert.deepEqual(Array.from(S.findSources("Wo"),x=>x.missionId),["black-pass-ambush"]);
});

test("GEAR-FINDER first win is free and grants materials; repeats cost energy; 3★ unlocks sim",()=>{
 const campaign=CC.fresh(),progress=fresh();
 const start=S.findSources("Fe",campaign,progress.energy.value);
 const first=start.find(x=>x.missionId==="black-pass-ambush");
 const second=start.find(x=>x.missionId==="demo-mission-2");
 assert.equal(first.access,"first-clear");
 assert.equal(first.energyCost,0);
 assert.equal(first.canStartManual,true);
 assert.equal(first.simulationUnlocked,false);
 assert.equal(first.canSimulate,false);
 assert.equal(second.access,"locked");
 assert.deepEqual(Array.from(second.missingPrerequisites),["black-pass-ambush"]);
 assert.equal(second.canStartManual,false);
 // Current game grants repeat-farm materials also on the first victorious attempt.
 const awarded=P.grantRepeatFarm(progress,first.missionId);
 assert.equal(awarded.materials.Fe,first.quantity);
 campaign.completed["black-pass-ambush"]=true;
 campaign.bestStars["black-pass-ambush"]=1;
 const repeats=S.findSources("Fe",campaign,0);
 const previous=repeats.find(x=>x.missionId==="black-pass-ambush");
 assert.equal(previous.access,"repeat");
 assert.equal(previous.energyCost,10);
 assert.equal(previous.canStartManual,false,"insufficient energy");
 assert.equal(previous.simulationUnlocked,false,"1-star manual retry still supported");
 assert.equal(S.findSources("Fe",campaign,10).find(x=>x.missionId==="black-pass-ambush").canStartManual,true);
 const nowSecond=S.findSources("Fe",campaign,240).find(x=>x.missionId==="demo-mission-2");
 assert.equal(nowSecond.access,"first-clear");
 assert.equal(nowSecond.energyCost,0);
 assert.equal(nowSecond.canStartManual,true);
 campaign.bestStars["black-pass-ambush"]=3;
 const eligible=S.findSources("Fe",campaign,10).find(x=>x.missionId==="black-pass-ambush");
 assert.equal(eligible.simulationUnlocked,true);
 assert.equal(eligible.canSimulate,true);
 assert.equal(S.findSources("Fe",campaign,9).find(x=>x.missionId==="black-pass-ambush").canSimulate,false);
});

test("GEAR-FINDER slot plan reports actual G recipe, wallet and shortages without mutations",()=>{
 const p=fresh(),c=CC.fresh(),before=JSON.stringify(p),beforeCampaign=JSON.stringify(c);
 const item=P.itemOffer(p,"ren","weapon")[0];
 const goal=F.plan(p,"ren","weapon",c);
 assert.ok(goal);
 assert.equal(goal.tier,1);
 assert.equal(goal.itemId,item.id);
 assert.equal(goal.itemName,item.name);
 assert.equal(goal.status,"missing");
 assert.equal(goal.currency.have,0);
 assert.equal(goal.currency.need,item.currency);
 assert.equal(goal.currency.missing,item.currency);
 assert.equal(goal.canCraft,false);
 assert.deepEqual(copy(Object.fromEntries(goal.materials.map(x=>[x.id,x.need]))),copy(item.ingredients));
 for(const row of goal.materials){
  assert.equal(row.have,0);
  assert.equal(row.missing,row.need);
  const ids=S.findSources(row.id,c,p.energy.value).map(x=>x.missionId);
  assert.deepEqual(Array.from(row.sources,x=>x.missionId),Array.from(ids));
  for(const src of row.sources){
   assert.equal(src.runsForDeficit,Math.ceil(row.missing/src.quantity));
   assert.equal(src.nominalEnergyForDeficit,src.runsForDeficit*src.nominalEnergyCost);
  }
 }
 assert.equal(JSON.stringify(p),before);
 assert.equal(JSON.stringify(c),beforeCampaign);
 assert.ok(Object.isFrozen(goal));
 assert.equal(F.plan(p,"unknown","weapon"),null);
 assert.equal(F.plan(p,"ren","none"),null);
 assert.equal(F.plan({...p,saveVersion:2},"ren","weapon"),null);
 assert.deepEqual(Array.from(F.findSources("Gl",{saveVersion:2})),[]);
});

test("GEAR-FINDER slot plan becomes ready then installed; does not double-count a filled slot",()=>{
 const p=rich(),campaign=CC.fresh(),item=P.itemOffer(p,"nada","head")[0];
 const before=F.plan(p,"nada","head",campaign);
 assert.equal(before.status,"ready");
 assert.equal(before.canCraft,true);
 assert.equal(before.currency.need,item.currency);
 assert.equal(P.equipItem(p,"nada",item.id),true);
 const after=F.plan(p,"nada","head",campaign);
 assert.equal(after.status,"installed");
 assert.equal(after.canCraft,false);
 assert.equal(after.currency.need,0);
 assert.ok(after.materials.every(row=>row.need===0&&row.missing===0));
 assert.equal(F.planTier(p,"nada").installed,1);
 assert.equal(P.equipItem(p,"nada",item.id),false);
});

test("GEAR-FINDER full tier sums only empty slots; scarcity is not counted independently per slot",()=>{
 const p=fresh();
 const goals=G.SLOTS.map(slot=>P.itemOffer(p,"kael",slot.id)[0]);
 const plan=F.planTier(p,"kael",CC.fresh());
 const expectedCost=goals.reduce((sum,x)=>sum+x.currency,0);
 const totals=Object.fromEntries(G.MATERIALS.map(id=>[
  id,goals.reduce((sum,item)=>sum+(item.ingredients[id]||0),0)]));
 assert.equal(plan.currency.need,expectedCost);
 assert.equal(plan.installed,0);
 assert.equal(plan.totalSlots,6);
 assert.equal(plan.status,"missing");
 assert.deepEqual(copy(Object.fromEntries(plan.materials.map(row=>[row.id,row.need]))),
  copy(Object.fromEntries(Object.entries(totals).filter(([,n])=>n>0))));
 // Having enough for each individual slot need not suffice for all six at once.
 for(const id of G.MATERIALS)
  p.materials[id]=Math.max(...goals.map(item=>item.ingredients[id]||0));
 p.currency=Math.max(...goals.map(item=>item.currency));
 assert.ok(G.SLOTS.every(slot=>F.plan(p,"kael",slot.id).status==="ready"));
 assert.equal(F.planTier(p,"kael").status,"missing");
 assert.ok(F.planTier(p,"kael").currency.missing>0);
});

test("GEAR-FINDER all five classes, high tiers and completed G13 remain deterministic",()=>{
 for(const hero of roster.slice(0,5)){
  const p=rich(),id=hero.id;
  for(let tier=1;tier<=13;tier++){
   assert.equal(p.gear[id].tier,tier);
   const current=F.planTier(p,id);
   assert.equal(current.status,"ready");
   assert.equal(current.slots.length,6);
   for(const goal of current.slots){
    assert.equal(goal.tier,tier);
    assert.equal(goal.status,"ready");
    assert.equal(goal.canCraft,true);
   }
   fill(p,id);
   const completed=F.planTier(p,id);
   assert.equal(completed.status,"complete");
   assert.equal(completed.installed,6);
   assert.equal(completed.currency.need,0);
   assert.equal(completed.materials.length,0);
   if(tier<13){
    assert.equal(completed.promotion.to,tier+1);
    assert.equal(P.promoteGear(p,id).to,tier+1);
   }else{
    assert.equal(completed.promotion,null);
    assert.equal(F.plan(p,id,"weapon").status,"installed");
   }
  }
 }
});

test("GEAR-FINDER corrupted progress is never presented as a craftable goal",()=>{
 const p=fresh(),campaign=CC.fresh();
 for(const bad of [
  data=>{data.currency=Infinity;},
  data=>{data.materials.Fe=-1;},
  data=>{data.classes.ren="not-class";},
  data=>{data.gear.ren.slots[0]="different-item";},
  data=>{data.gear.ren.mode="other";}
 ]){
  const corrupted=copy(p);bad(corrupted);
  assert.equal(F.plan(corrupted,"ren","weapon",campaign),null);
 }
});
