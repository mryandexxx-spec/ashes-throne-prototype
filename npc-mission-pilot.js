/* NPCMISSION002 — [PROPOSAL] one noncanonical campaign demo pilot.
 * The opt-in encounter uses existing tactical mechanics and never adds
 * river species to the Gardens or modifies player progression rules.
 */
const NpcMissionPilot=(()=>{
 "use strict";
 const ID="demo-mission-2";
 const roster=Object.freeze([
  Object.freeze({archetypeId:"npc-ridge-slinger",instanceId:"npc-m2-slinger",level:1,stars:1,gearTier:1,skillLevel:1}),
  Object.freeze({archetypeId:"npc-field-medic",instanceId:"npc-m2-medic",level:1,stars:1,gearTier:1,skillLevel:1})
 ]);
 const plan=Object.freeze({
  missionId:ID,difficulty:"light",label:"Учебный бой · выбор цели",
  // No enemy species/country affiliation implies moral alignment.
  encounterTag:"noncanonical-demo-training",enemyIds:roster
 });
 function get(id){return id===ID?plan:null;}
 function spawn(id){
  const entry=get(id);
  if(!entry||typeof NpcEnemyData==="undefined")return null;
  const fighters=entry.enemyIds.map(def=>NpcEnemyData.spawn(def.archetypeId,{
   instanceId:def.instanceId,level:def.level,stars:def.stars,
   gearTier:def.gearTier,skillLevel:def.skillLevel
  }));
  if(fighters.some(f=>!f)||new Set(fighters.map(f=>f.id)).size!==fighters.length)return null;
  return fighters;
 }
 return Object.freeze({get,spawn});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NpcMissionPilot;
