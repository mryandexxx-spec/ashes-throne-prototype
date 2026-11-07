/* Progress-VS-001A: intentionally reset old Progress-001 demo resources.
   New economic rewards and claimed mission IDs live together in one record. */
const SaveCore=(()=>{
 "use strict";
 const KEY="ashes-throne.progress.v2";
 const VERSION=2;
 const plain=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
 const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 function validate(data,heroes){
  if(!plain(data)||data.version!==VERSION||!plain(data.levels)||!Array.isArray(data.claimedMissions))
   return null;
  if(!Number.isSafeInteger(data.currency)||data.currency<0||
     !Number.isSafeInteger(data.accountXp)||data.accountXp<0)return null;
  const ids=heroes.filter(h=>h.side==="ally").map(h=>h.id);
  if(Object.keys(data.levels).some(id=>!ids.includes(id)))return null;
  const levels={};
  for(const id of ids){
   const level=own(data.levels,id)?data.levels[id]:1;
   if(!Number.isInteger(level)||level<1||level>ProgressCore.MAX_LEVEL)return null;
   levels[id]=level;
  }
  const claims=data.claimedMissions;
  const known=Object.keys(ProgressCore.FIRST_CLEAR_REWARDS);
  if(claims.some(id=>typeof id!=="string"||!known.includes(id))||new Set(claims).size!==claims.length)return null;
  // Optional fields preserve v2 profiles created by VS-001A without resetting them.
  if(data.gearMaterials!==undefined&&(!Number.isSafeInteger(data.gearMaterials)||data.gearMaterials<0))return null;
  if(data.gear!==undefined&&!plain(data.gear))return null;
  if(data.gear&&Object.keys(data.gear).some(id=>!ids.includes(id)))return null;
  const gear={};
  for(const id of ids){
   const g=data.gear?.[id]??ProgressCore.freshGear();
   if(!plain(g)||!Number.isInteger(g.tier)||g.tier<1||g.tier>3)return null;
   // Old VS-001B progress used a consecutive slot count. Convert in place
   // without changing total purchased items or currencies.
   let slots;
   if(Number.isInteger(g.slots)&&g.slots>=0&&g.slots<=ProgressCore.SLOT_COUNT)
    slots=Array.from({length:ProgressCore.SLOT_COUNT},(_,slot)=>slot<g.slots);
   else if(Array.isArray(g.slots)&&g.slots.length===ProgressCore.SLOT_COUNT&&
      g.slots.every(value=>typeof value==="boolean"))
    slots=g.slots.slice();
   else return null;
   // Gear-002B: a full set at G1/G2 is now valid while awaiting paid promotion.
   gear[id]={tier:g.tier,slots};
  }
  // VS-001A profiles already claimed first clears before C existed.
  // Credit their one-time C drops exactly once when upgrading the saved v2 shape.
  const retroactiveC=claims.reduce((sum,id)=>sum+(ProgressCore.FIRST_CLEAR_REWARDS[id].material||0),0);
  // Existing v2 players receive a full initial pool of energy when VS-001C loads.
  if(data.energy!==undefined&&(!plain(data.energy)||
     !Number.isSafeInteger(data.energy.value)||data.energy.value<0||
     data.energy.value>ProgressCore.ENERGY_MAX||
     !Number.isSafeInteger(data.energy.updatedAt)||data.energy.updatedAt<0))return null;
  const energy=data.energy?{value:data.energy.value,updatedAt:data.energy.updatedAt}:ProgressCore.freshEnergy();
  const progress={accountXp:data.accountXp,currency:data.currency,
   gearMaterials:data.gearMaterials??retroactiveC,energy,
   levels,gear,claimedMissions:claims.slice()};
  // VS-UNBLOCK: higher hero / G levels than account level remain valid in test saves.
  return progress;
 }
 function load(heroes,getStorage){
  const fallback=ProgressCore.createProgress(heroes);
  try{
   const storage=getStorage();if(!storage)return {progress:fallback,available:false,fresh:true};
   const raw=storage.getItem(KEY);
   const restored=raw===null?null:validate(JSON.parse(raw),heroes);
   return {progress:restored||fallback,available:true,fresh:!restored};
  }catch(error){return {progress:fallback,available:false,fresh:true};}
 }
 function save(progress,getStorage){
  try{
   const storage=getStorage();if(!storage)return false;
   storage.setItem(KEY,JSON.stringify({version:VERSION,accountXp:progress.accountXp,
    currency:progress.currency,gearMaterials:progress.gearMaterials,energy:progress.energy,levels:progress.levels,
    gear:progress.gear,claimedMissions:progress.claimedMissions}));
   return true;
  }catch(error){return false;}
 }
 return Object.freeze({KEY,VERSION,validate,load,save});
})();
