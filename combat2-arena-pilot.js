/* B17.3B2 — explicit noncanonical arena fixtures. No storage, rewards or live party mutation. */
const Combat2ArenaPilot=(()=>{
"use strict";
const scenarios=Object.freeze({
 full:"Пять на пять",waves:"Две волны",tempo:"Сава и Рен",boss:"Старший дозора · сопротивление",loss:"Тяжёлое поражение",armored:"Глава II · усиленный перехватчик",threats:"Две подготовленные угрозы"
});
const tiers=Object.freeze({early:"G1 · L2",mid:"G7 · L15",max:"G13 · L85",uneven:"Неравный отряд · G1/G7/G13"});
function setup({scenario="full",tier="early",seed=7}={}){
 if(!Object.hasOwn(scenarios,scenario)||!Object.hasOwn(tiers,tier)||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error("Неизвестная тестовая встреча");
 const chosenTier=tier==="uneven"?"mid":tier;
 const heroTiers=tier==="uneven"?{ren:"max",art:"mid",nada:"early",liora:"mid",sava:"early"}:{};
 const preset=scenario==="armored"||scenario==="threats"?"starter":scenario==="boss"||scenario==="loss"?"full":scenario;
 const result=Combat2HUD.buildSetup({preset,tier:chosenTier,seed,heroTiers,hard:scenario==="loss"});
 const heroes=result.lineup.filter(f=>f.side==="ally");
 let enemies=result.lineup.filter(f=>f.side==="enemy"),waves=result.waves;
 if(scenario==="armored"||scenario==="threats"){
  // B1 exact proposed NPC fixtures; no scaling to player. Real starter roster (no equipped items),
  // Ren L2 / Art L1, same as actual first session. This scenario intentionally ignores tier.
  const roster=StarCore.PLAYABLE.map(id=>({id,side:"ally"}));
  const progress=ProgressV3Core.toRuntime(ProgressV3Core.fresh(roster,100),roster);
  progress.levels.ren=2;
  for(let i=0;i<heroes.length;i++){
   const h=heroes[i],level=h.id==="art"?1:2,g=ProgressCore.gearBonuses(progress,h.id);
   heroes[i]={...HeroStatsCombatBridge.apply({id:h.id,side:"ally",name:h.name,tags:h.tags,skillLevels:{basic:1,special:1,powerful:1,passive:1}},{level,stars:1,gearPercent:g,gearStats:g.stats},HeroStatsProfiles[h.id],HeroStatsCore),gearTier:1};
  }
  if(scenario==="armored")enemies=MainCampaignCore.enemiesFor(MainCampaignCore.II_ID,NpcEnemyData).map((f,i)=>i===0?f:{...f,hp:75,protection:20,maxProtection:20,physicalAttack:34,atk:34});
  else enemies=["npc-trail-interceptor","npc-ridge-slinger"].map((id,i)=>NpcEnemyData.spawn(id,{instanceId:"c2-threat-"+i}));
  waves=[];
 }else if(scenario==="boss"){
  // A durable existing archetype with high, not absolute, debuff resistance.
  // No new boss immunity contract; this is a resistance/priority fixture, not a campaign boss.
  const captain=enemies.find(f=>f.archetypeId==="npc-watch-captain");
  const guard=enemies.find(f=>f.archetypeId==="npc-pass-guard");
  enemies=[{...captain,name:"Старший дозора · испытание",hp:captain.hp*3,protection:captain.protection*2,maxProtection:captain.protection*2,debuffResistance:80},guard];
  waves=[];
 }else if(scenario==="loss"){
  // Explicit extreme fixture to verify defeat/retry; no adaptive enemy scaling.
  enemies=enemies.map(f=>({...f,hp:f.hp*3,protection:f.protection*3,maxProtection:f.protection*3,physicalAttack:f.physicalAttack*5,atk:f.atk*5}));
 }
 return {lineup:[...heroes,...enemies],waves,options:result.options,scenario,tier,label:scenarios[scenario]};
}
return Object.freeze({scenarios,tiers,setup});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=Combat2ArenaPilot;
