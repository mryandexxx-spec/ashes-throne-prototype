/* NPCCHALLENGE004 — [PROPOSAL] opt-in T-01 / N-01 NPC trial rosters.
 * A separate, reward-free training preview. Existing challenge IDs, scoring,
 * daily tasks, saves, progression and normal non-NPC opponents are untouched.
 */
const NpcChallengePilot=(()=>{
 "use strict";
 const unit=(archetypeId,instanceId,hp,protection)=>Object.freeze({
  archetypeId,instanceId,hp,protection,
  level:1,stars:1,gearTier:1,skillLevel:1
 });
 const catalog=Object.freeze({
  "T-01":Object.freeze({
   id:"T-01",kind:"tactical",label:"NPC-ПРОБА · первая цель",
   encounterTag:"noncanonical-demo-training",
   enemyIds:Object.freeze([
    unit("npc-route-signaller","npc-t01-signaller",55,6),
    unit("npc-trail-interceptor","npc-t01-interceptor",66,8)
   ]),
   priorityId:"npc-t01-signaller",futureWaves:Object.freeze([])
  }),
  "N-01":Object.freeze({
   id:"N-01",kind:"onslaught",label:"NPC-ПРОБА · две волны",
   encounterTag:"noncanonical-demo-training",
   enemyIds:Object.freeze([
    unit("npc-pass-guard","npc-n01-guard",68,12),
    unit("npc-field-medic","npc-n01-medic",50,5)
   ]),
   priorityId:null,
   futureWaves:Object.freeze([Object.freeze([
    unit("npc-ridge-slinger","npc-n01-slinger",65,5)
   ])])
  })
 });
 const get=id=>Object.prototype.hasOwnProperty.call(catalog,id)?catalog[id]:null;
 const definitions=p=>[...p.enemyIds,...p.futureWaves.flat()];
 function make(def){
  if(typeof NpcEnemyData==="undefined")return null;
  const base=NpcEnemyData.spawn(def.archetypeId,{
   instanceId:def.instanceId,level:def.level,stars:def.stars,
   gearTier:def.gearTier,skillLevel:def.skillLevel
  });
  if(!base||!Number.isSafeInteger(def.hp)||def.hp<1||def.hp>base.hp||
     !Number.isSafeInteger(def.protection)||def.protection<0||
     def.protection>base.protection)return null;
  return {...base,hp:def.hp,protection:def.protection,
   maxProtection:def.protection};
 }
 function valid(plan){
  const all=definitions(plan);
  const ids=all.map(e=>e.instanceId);
  return new Set(ids).size===ids.length&&
   (plan.priorityId===null||ids.includes(plan.priorityId));
 }
 function spawn(id){
  const plan=get(id);
  if(!plan||!valid(plan))return null;
  const items=plan.enemyIds.map(make);
  return items.some(x=>!x)?null:items;
 }
 function spawnWaves(id){
  const plan=get(id);
  if(!plan||!valid(plan))return null;
  const waves=plan.futureWaves.map(w=>w.map(make));
  return waves.some(w=>w.some(x=>!x))?null:waves;
 }
 function trackerTargets(id){
  const plan=get(id);
  if(!plan||!valid(plan))return null;
  return Object.freeze({
   enemyIds:Object.freeze(definitions(plan).map(x=>x.instanceId)),
   priorityId:plan.priorityId
  });
 }
 function visuals(){
  if(typeof NpcEnemyData==="undefined")return [];
  return Object.values(catalog).flatMap(p=>definitions(p).map(make)).filter(Boolean);
 }
 return Object.freeze({get,spawn,spawnWaves,trackerTargets,visuals});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NpcChallengePilot;
