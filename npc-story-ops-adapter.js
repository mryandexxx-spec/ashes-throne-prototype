/* NPCPVE002 — compatibility adapter for noncanonical Five Shadows and OPS-001/002.
 * Combatants use the existing NPC archetypes and short-lived Babylon visuals.
 * Story objectives and OPS-002 save/event identities retain their old meaning.
 * No literary canon, permanent NPC, or save-schema changes. Numbers provisional.
 */
const NpcStoryOpsAdapter=(()=>{
 "use strict";
 const Data=typeof NpcEnemyData!=="undefined"?NpcEnemyData:require("./npc-enemy-data.js");
 // Role choices are game-only proposals; archetypes are not fictional factions.
 const STORY=Object.freeze({
  "five-shadows:fs-01":{ves:"npc-pass-guard",shade:"npc-trail-interceptor"},
  "five-shadows:fs-02":{ves:"npc-pass-guard",shade:"npc-trail-interceptor",
   "ves-2":"npc-route-signaller"},
  "five-shadows:fs-03":{ves:"npc-pass-guard",shade:"npc-ridge-slinger",
   "ves-2":"npc-field-medic","shade-2":"npc-trail-interceptor"},
  "five-shadows:fs-04":{ves:"npc-pass-guard",shade:"npc-route-signaller",
   "ves-2":"npc-trail-interceptor"},
  "five-shadows:fs-05":{ves:"npc-pass-guard",shade:"npc-watch-captain",
   "ves-2":"npc-pass-guard"},
  "five-shadows:fs-06":{ves:"npc-pass-guard",shade:"npc-trail-interceptor",
   "ves-2":"npc-ridge-slinger"}
 });
 const RESCUE=Object.freeze([
  {id:"ves",name:"Дозорный 1",hp:150,atk:22},
  {id:"shade",name:"Преследователь",hp:225,atk:60,assaultFocus:true},
  {id:"ves-2",name:"Дозорный 2",hp:150,atk:22}
 ]);
 const copy=entries=>entries.map(e=>({...e}));
 function unit(archetypeId,id,entry){
  const base=Data.spawn(archetypeId,{instanceId:id});
  if(!base||!entry||typeof entry.name!=="string"||!entry.name.trim()||
     !Number.isSafeInteger(entry.hp)||entry.hp<1||entry.hp>400||
     !Number.isSafeInteger(entry.atk)||entry.atk<1||entry.atk>120)
   throw Error("NPCPVE002_BAD_UNIT");
  // Keep the previous battle's scenario HP/ATK; new class, skills and AI
  // are an explicitly provisional balance change, scoped to this encounter.
  return {...base,name:entry.name,hp:entry.hp,atk:entry.atk,
   physicalAttack:entry.atk,protection:0,maxProtection:0,
   ...(entry.assaultFocus?{assaultFocus:true}:{})};
 }
 function storyId(nodeId,legacyId){
  if(!Object.prototype.hasOwnProperty.call(STORY,nodeId)||
     !Object.prototype.hasOwnProperty.call(STORY[nodeId],legacyId))
   throw Error("NPCPVE002_UNKNOWN_STORY_ENEMY");
  const chapter=nodeId.split(":")[1].replace("-","");
  return "npc-"+chapter+"-"+legacyId;
 }
 function story(nodeId,encounter){
  const mapping=STORY[nodeId];
  if(!mapping||!encounter||!Array.isArray(encounter.waves)||
     (nodeId==="five-shadows:fs-05")!==(encounter.enemies===null))
   throw Error("NPCPVE002_STORY_PLAN_MISMATCH");
  const first=nodeId==="five-shadows:fs-05"?copy(RESCUE):encounter.enemies;
  if(!Array.isArray(first)||!first.length||encounter.waves.some(w=>!Array.isArray(w)||!w.length))
   throw Error("NPCPVE002_INVALID_STORY_WAVES");
  const all=[...first,...encounter.waves.flat()];
  if(new Set(all.map(e=>e.id)).size!==all.length||
     all.length!==Object.keys(mapping).length||
     all.some(e=>!Object.prototype.hasOwnProperty.call(mapping,e.id)))
   throw Error("NPCPVE002_STORY_IDS_CHANGED");
  const make=e=>unit(mapping[e.id],storyId(nodeId,e.id),e);
  return {first:first.map(make),waves:encounter.waves.map(w=>w.map(make))};
 }
 function storyObjective(nodeId,objective){
  if(!objective||typeof objective!=="object")return objective;
  // FS-04 requires the marked instigator to fall FIRST. The CombatCore
  // checks fighter IDs, so the objective must follow the new instance ID.
  if(objective.kind==="priority-first")
   return {...objective,priorityEnemyId:storyId(nodeId,objective.priorityEnemyId)};
  return {...objective};
 }
 const OPERATIONS=Object.freeze({
  "OPS-001":Object.freeze({
   first:Object.freeze([
    {archetype:"npc-route-signaller",legacyId:"ves",name:"Курьер 1",hp:90,atk:18},
    {archetype:"npc-trail-interceptor",legacyId:"shade",name:"Курьер 2",hp:78,atk:22}
   ]),
   reserve:Object.freeze({archetype:"npc-pass-guard",legacyId:"ves-2",
    name:"Прикрывающий",hp:90,atk:18})
  }),
  "OPS-002":Object.freeze({
   first:Object.freeze([
    {archetype:"npc-route-signaller",legacyId:"ves",name:"Сигнальщик поста",hp:90,atk:18},
    {archetype:"npc-pass-guard",legacyId:"shade",name:"Страж поста",hp:78,atk:22}
   ]),
   reserve:Object.freeze({archetype:"npc-trail-interceptor",legacyId:"ves-2",
    name:"Подкрепление",hp:90,atk:18})
  })
 });
 function operationId(op,legacyId){
  if(!OPERATIONS[op]||!["ves","shade","ves-2"].includes(legacyId))
   throw Error("NPCPVE002_UNKNOWN_OPERATION_ID");
  return "npc-"+op.toLowerCase().replace("-","")+"-"+legacyId;
 }
 function operation(op,plan){
  if(!OPERATIONS[op]||!plan||!["singleWave","twoWaves"].includes(plan.kind))
   throw Error("NPCPVE002_BAD_OPERATION_PLAN");
  const config=OPERATIONS[op];
  const spawn=entry=>unit(entry.archetype,operationId(op,entry.legacyId),entry);
  return {first:config.first.map(spawn),
   waves:plan.kind==="twoWaves"?[[spawn(config.reserve)]]:[]};
 }
 function signalGuardName(legacyId){
  const spec=OPERATIONS["OPS-002"].first.find(e=>e.legacyId===legacyId);
  return spec?.name||null;
 }
 // SignalOperationCore v1 MUST continue tracking ves/shade in its run data.
 // Translate only death target IDs at the combat event boundary, keeping
 // atomic ability groups and event order (incl. simultaneous kills) intact.
 function signalEvents(events){
  if(!Array.isArray(events))return events;
  const aliases=new Map(OPERATIONS["OPS-002"].first.map(entry=>
   [operationId("OPS-002",entry.legacyId),entry.legacyId]));
  return events.map(event=>event&&event.type==="death"&&aliases.has(event.targetId)?
   {...event,targetId:aliases.get(event.targetId)}:event);
 }
 return Object.freeze({story,storyId,storyObjective,operation,operationId,
  signalEvents,signalGuardName});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NpcStoryOpsAdapter;
