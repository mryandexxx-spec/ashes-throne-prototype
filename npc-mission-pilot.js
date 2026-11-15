/* NPCMISSION002 — [PROPOSAL] one noncanonical campaign demo pilot.
 * The opt-in encounter uses existing tactical mechanics and never adds
 * river species to the Gardens or modifies player progression rules.
 */
const NpcMissionPilot=(()=>{
 "use strict";
 const ID="demo-mission-2";
 const roster=Object.freeze([
  Object.freeze({archetypeId:"npc-ridge-slinger",instanceId:"npc-m2-slinger",level:1,stars:1,gearTier:1,skillLevel:1,hp:75,protection:5}),
  Object.freeze({archetypeId:"npc-field-medic",instanceId:"npc-m2-medic",level:1,stars:1,gearTier:1,skillLevel:1,hp:55,protection:5})
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
  const fighters=entry.enemyIds.map(def=>{
   const base=NpcEnemyData.spawn(def.archetypeId,{
    instanceId:def.instanceId,level:def.level,stars:def.stars,
    gearTier:def.gearTier,skillLevel:def.skillLevel
   });
   // Explicit fixed training encounter stats, never a change to the
   // archetype's base values or scaling to the current player's squad.
   if(!base||!Number.isSafeInteger(def.hp)||def.hp<1||def.hp>base.hp||
      !Number.isSafeInteger(def.protection)||def.protection<0||
      def.protection>base.protection)return null;
   return {...base,hp:def.hp,protection:def.protection,
    maxProtection:def.protection};
  });
  if(fighters.some(f=>!f)||new Set(fighters.map(f=>f.id)).size!==fighters.length)return null;
  return fighters;
 }
 return Object.freeze({get,spawn});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NpcMissionPilot;
