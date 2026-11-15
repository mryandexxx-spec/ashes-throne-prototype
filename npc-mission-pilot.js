/* NPCMISSION003 — [PROPOSAL] opt-in, noncanonical PvE demo encounters.
 * Keep the second demo mission fixed; add one two-wave third mission.
 * No global NPC changes, no save migrations or story-world encounters.
 */
const NpcMissionPilot=(()=>{
 "use strict";
 const unit=(archetypeId,instanceId,hp,protection)=>Object.freeze({
  archetypeId,instanceId,level:1,stars:1,gearTier:1,skillLevel:1,hp,protection
 });
 const plans=Object.freeze({
  "demo-mission-2":Object.freeze({
   missionId:"demo-mission-2",difficulty:"light",
   label:"Учебный бой · выбор цели",
   encounterTag:"noncanonical-demo-training",
   enemyIds:Object.freeze([
    unit("npc-ridge-slinger","npc-m2-slinger",75,5),
    unit("npc-field-medic","npc-m2-medic",55,5)
   ]),
   futureWaves:Object.freeze([])
  }),
  "demo-mission-3":Object.freeze({
   missionId:"demo-mission-3",difficulty:"light",
   label:"Учебный бой · две волны · приоритет поддержки",
   encounterTag:"noncanonical-demo-training",
   enemyIds:Object.freeze([
    unit("npc-trail-interceptor","npc-m3-interceptor",55,5),
    unit("npc-route-signaller","npc-m3-signaller",35,4)
   ]),
   futureWaves:Object.freeze([Object.freeze([
    unit("npc-pass-guard","npc-m3-guard",55,8),
    unit("npc-ridge-slinger","npc-m3-slinger",45,3),
    unit("npc-field-medic","npc-m3-medic",35,3)
   ])])
  })
 });
 function get(id){return Object.prototype.hasOwnProperty.call(plans,id)?plans[id]:null;}
 function createUnit(def){
  const base=NpcEnemyData.spawn(def.archetypeId,{
   instanceId:def.instanceId,level:def.level,stars:def.stars,
   gearTier:def.gearTier,skillLevel:def.skillLevel
  });
  // Fixed, mission-only test stats: no dynamic player power scaling.
  if(!base||!Number.isSafeInteger(def.hp)||def.hp<1||def.hp>base.hp||
     !Number.isSafeInteger(def.protection)||def.protection<0||
     def.protection>base.protection)return null;
  return {...base,hp:def.hp,protection:def.protection,maxProtection:def.protection};
 }
 function allDefinitions(plan){return plan.enemyIds.concat(...plan.futureWaves);}
 function validateUnique(plan){
  const defs=allDefinitions(plan);
  return new Set(defs.map(x=>x.instanceId)).size===defs.length;
 }
 function spawn(id){
  const plan=get(id);
  if(!plan||typeof NpcEnemyData==="undefined"||!validateUnique(plan))return null;
  const fighters=plan.enemyIds.map(createUnit);
  return fighters.some(f=>!f)?null:fighters;
 }
 function spawnWaves(id){
  const plan=get(id);
  if(!plan||typeof NpcEnemyData==="undefined"||!validateUnique(plan))return null;
  const waves=plan.futureWaves.map(wave=>wave.map(createUnit));
  return waves.some(wave=>wave.some(f=>!f))?null:waves;
 }
 function visuals(){
  if(typeof NpcEnemyData==="undefined")return [];
  // One reserved low-poly capsule per opt-in encounter ID, all waves included.
  // Ordinary sessions never call this and allocate no extra Babylon assets.
  return Object.values(plans).flatMap(plan=>allDefinitions(plan).map(createUnit)).filter(Boolean);
 }
 return Object.freeze({get,spawn,spawnWaves,visuals});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NpcMissionPilot;
