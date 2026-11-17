/* GEAR-FINDER-003: read-only source registry for current deterministic v3 farm.
 * No new missions, drops, unlock rules or persistence changes. */
const GearSourceData=(()=>{
 "use strict";
 const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k);
 const record=o=>!!o&&typeof o==="object"&&!Array.isArray(o);
 const integer=n=>Number.isSafeInteger(n)&&n>=0;
 const EMPTY=Object.freeze([]);
 function catalogIssues(){
  if(typeof GearData==="undefined"||typeof ProgressCore==="undefined"||
     typeof MissionData==="undefined"||typeof CampaignData==="undefined")
   return ["Missing dependency"];
  const issues=[];
  const farm=ProgressCore.MISSION_GEAR_FARM;
  if(!record(farm))return ["Missing v3 farm data"];
  if(!CampaignData.catalogIsValid())issues.push("Invalid campaign prerequisites");
  const ids=MissionData.all().map(m=>m.id);
  for(const id of Object.keys(farm)){
   const mission=MissionData.get(id),entry=CampaignData.getMission(id),reward=farm[id];
   if(!mission||!entry||!ids.includes(id)){issues.push("Unknown farm mission: "+id);continue;}
   if(!record(reward)||!record(reward.materials)||!integer(reward.cost)||reward.cost===0||
      reward.cost!==ProgressCore.missionEnergyCost(id)||
      !integer(reward.currency)||!integer(reward.xp))
    issues.push("Invalid farm reward: "+id);
   if(!record(reward?.materials)||
      Object.keys(reward.materials).length!==GearData.MATERIALS.length||
      !GearData.MATERIALS.every(key=>own(reward.materials,key)&&integer(reward.materials[key])))
    issues.push("Invalid material set: "+id);
  }
  return issues;
 }
 function access(entry,campaign){
  if(!record(campaign)||!record(campaign.completed)||!record(campaign.bestStars))
   return {status:"unknown",stars:null,missingPrerequisites:EMPTY};
  const relevant=[entry.missionId,...entry.requiredMissionIds];
  if(relevant.some(id=>typeof campaign.completed[id]!=="boolean")||
     !Number.isInteger(campaign.bestStars[entry.missionId])||
     campaign.bestStars[entry.missionId]<0||campaign.bestStars[entry.missionId]>3||
     campaign.completed[entry.missionId]!== (campaign.bestStars[entry.missionId]>0))
   return {status:"unknown",stars:null,missingPrerequisites:EMPTY};
  const missing=entry.requiredMissionIds.filter(id=>!campaign.completed[id]);
  return {status:missing.length?"locked":campaign.completed[entry.missionId]?"repeat":"first-clear",
   stars:campaign.bestStars[entry.missionId],missingPrerequisites:Object.freeze(missing)};
 }
 function findSources(materialId,campaign=null,energy=null){
  if(typeof GearData==="undefined"||!GearData.MATERIALS.includes(materialId)||
     typeof ProgressCore==="undefined"||typeof MissionData==="undefined"||
     typeof CampaignData==="undefined")return EMPTY;
  const energyKnown=integer(energy);
  const entries=[];
  for(const mission of MissionData.all()){
   const reward=own(ProgressCore.MISSION_GEAR_FARM,mission.id)?
    ProgressCore.MISSION_GEAR_FARM[mission.id]:null;
   const entry=CampaignData.getMission(mission.id);
   const qty=reward?.materials?.[materialId];
   if(!entry||!integer(qty)||qty===0||!integer(reward.cost)||
      reward.cost!==ProgressCore.missionEnergyCost(mission.id))continue;
   const gate=access(entry,campaign);
   const unlocked=gate.status==="first-clear"||gate.status==="repeat";
   const firstClear=gate.status==="first-clear";
   const energyCost=firstClear?0:reward.cost; // v3 first-entry rule, not a new payout
   const simulationUnlocked=gate.status==="repeat"&&gate.stars===3;
   entries.push(Object.freeze({
    missionId:mission.id,title:mission.title,chapterId:entry.chapterId,
    materialId,quantity:qty,currencyPerVictory:reward.currency,
    nominalEnergyCost:reward.cost,energyCost,access:gate.status,
    bestStars:gate.stars,missingPrerequisites:gate.missingPrerequisites,
    manualUnlocked:unlocked,simulationUnlocked,
    canStartManual:unlocked&&energyKnown&&energy>=energyCost,
    canSimulate:simulationUnlocked&&energyKnown&&energy>=reward.cost
   }));
  }
  return Object.freeze(entries);
 }
 return Object.freeze({catalogIssues,findSources});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=GearSourceData;
