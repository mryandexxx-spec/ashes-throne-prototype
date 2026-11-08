/* Gear-003A1: opt-in, UNWIRED v2 -> v3 reset-preview/staging contract.
   Does not run during game startup. Never alters the original v2 save. */
const ProgressV3Core=(()=>{
 "use strict";
 const KEY="ashes-throne.progress.v3", VERSION=3, SOURCE_KEY="ashes-throne.progress.v2";
 const SLOTS=Object.freeze(["weapon","torso","head","hands","feet","utility"]);
 const MATERIALS=Object.freeze(["Fe","Le","Cl","Wo","Fa","Th","Gl"]);
 // TEST-ONLY roles, explicitly approved for the vertical slice; not lore.
 const TEST_CLASSES=Object.freeze({
  kael:"tank",lyra:"ranged",darin:"melee","medic-demo":"support","test-area-damage":"mage"
 });
 const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
 const object=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
 const nonneg=x=>Number.isSafeInteger(x)&&x>=0;
 function allyIds(heroes){
  if(!Array.isArray(heroes))return null;
  const ids=heroes.filter(h=>object(h)&&h.side==="ally").map(h=>h.id);
  if(ids.some(id=>typeof id!=="string"||!own(TEST_CLASSES,id))||new Set(ids).size!==ids.length||!ids.length)
   return null;
  return ids;
 }
 function cleanHero(id){
  return {classId:TEST_CLASSES[id],level:1,gear:{tier:1,installedByTier:{"1":Array(SLOTS.length).fill(null)}}};
 }
 function fromV2(data,heroes){
  const ids=allyIds(heroes);
  if(!ids||typeof SaveCore==="undefined"||typeof ProgressCore==="undefined")return null;
  // The old validator normalizes numerical slots and checks all persisted costs.
  const old=SaveCore.validate(data,heroes);
  if(!old)return null;
  const next={
   version:VERSION,
   accountXp:old.accountXp,
   currency:old.currency,
   legacyC:old.gearMaterials, // account-level C stays in the wallet; no exchange
   energy:{value:old.energy.value,updatedAt:old.energy.updatedAt},
   claimedMissions:old.claimedMissions.slice(),
   heroes:Object.fromEntries(ids.map(id=>[id,cleanHero(id)])),
   materials:Object.fromEntries(MATERIALS.map(id=>[id,0])),
   migration:{strategy:"clean-heroes-v1",sourceVersion:2}
  };
  return validate(next,heroes);
 }
 function fresh(heroes,now=Date.now()){
  const ids=allyIds(heroes);
  if(!ids||!nonneg(now))return null;
  return validate({
   version:VERSION,accountXp:0,currency:0,legacyC:0,
   energy:{value:ProgressCore.ENERGY_MAX,updatedAt:now},
   claimedMissions:[],
   heroes:Object.fromEntries(ids.map(id=>[id,cleanHero(id)])),
   materials:Object.fromEntries(MATERIALS.map(id=>[id,0])),
   migration:{strategy:"clean-heroes-v1",sourceVersion:null}
  },heroes);
 }
 function validate(data,heroes){
  const ids=allyIds(heroes);
  if(!ids||!object(data)||data.version!==VERSION||
     !nonneg(data.accountXp)||!nonneg(data.currency)||!nonneg(data.legacyC)||
     !object(data.energy)||!Number.isSafeInteger(data.energy.value)||
     data.energy.value<0||data.energy.value>ProgressCore.ENERGY_MAX||
     !nonneg(data.energy.updatedAt)||!Array.isArray(data.claimedMissions)||
     !object(data.heroes)||!object(data.materials)||!object(data.migration))
   return null;
  if(data.migration.strategy!=="clean-heroes-v1"||
     (data.migration.sourceVersion!==2&&data.migration.sourceVersion!==null))return null;
  const known=Object.keys(ProgressCore.FIRST_CLEAR_REWARDS);
  if(data.claimedMissions.some(id=>typeof id!=="string"||!known.includes(id))||
     new Set(data.claimedMissions).size!==data.claimedMissions.length)return null;
  if(Object.keys(data.heroes).length!==ids.length||ids.some(id=>!own(data.heroes,id)))return null;
  for(const id of ids){
   const hero=data.heroes[id],gear=hero?.gear;
   if(!object(hero)||hero.classId!==TEST_CLASSES[id]||hero.level!==1||
      !object(gear)||gear.tier!==1||!object(gear.installedByTier)||
      Object.keys(gear.installedByTier).length!==1||
      !Array.isArray(gear.installedByTier["1"])||
      gear.installedByTier["1"].length!==SLOTS.length||
      !gear.installedByTier["1"].every(x=>x===null))return null;
  }
  if(Object.keys(data.materials).length!==MATERIALS.length||
     MATERIALS.some(id=>!own(data.materials,id)||!nonneg(data.materials[id])))return null;
  // Defensive copy: callers cannot change the validated profile via source data.
  return JSON.parse(JSON.stringify(data));
 }
 function stage(heroes,getStorage,now=Date.now()){
  if(!allyIds(heroes))return {status:"blocked",reason:"unknown-hero-ids"};
  let storage;
  try{storage=getStorage();if(!storage)return {status:"blocked",reason:"storage-unavailable"};}
  catch(_){return {status:"blocked",reason:"storage-unavailable"};}
  let raw3,raw2;
  try{raw3=storage.getItem(KEY);}catch(_){return {status:"blocked",reason:"read-v3-failed"};}
  if(raw3!==null){
   let parsed;try{parsed=JSON.parse(raw3);}catch(_){return {status:"blocked",reason:"invalid-v3"};}
   const valid=validateActive(parsed,heroes);
   return valid?{status:"existing",profile:valid}:{status:"blocked",reason:"invalid-v3"};
  }
  try{raw2=storage.getItem(SOURCE_KEY);}catch(_){return {status:"blocked",reason:"read-v2-failed"};}
  let candidate;
  if(raw2===null)candidate=fresh(heroes,now);
  else {
   let old;try{old=JSON.parse(raw2);}catch(_){return {status:"blocked",reason:"invalid-v2"};}
   candidate=fromV2(old,heroes);
  }
  if(!candidate)return {status:"blocked",reason:"invalid-v2"};
  const encoded=JSON.stringify(candidate);
  try{
   // Writes to a new key only. The v2 contents remain an untouched backup.
   storage.setItem(KEY,encoded);
   const check=storage.getItem(KEY);
   if(check!==encoded)return {status:"blocked",reason:"v3-write-verification-failed"};
   if(!validate(JSON.parse(check),heroes))return {status:"blocked",reason:"invalid-v3"};
  }catch(_){return {status:"blocked",reason:"v3-write-failed"};}
  return {status:"staged",profile:candidate};
 }
 // A2 active profiles: G1 may contain concrete item entries while A1 validate()
 // continues to validate only the clean reset contract for backwards tests.
 function validateActive(data,heroes){
  const ids=allyIds(heroes);
  if(!ids||!object(data)||data.version!==VERSION||
     !nonneg(data.accountXp)||!nonneg(data.currency)||!nonneg(data.legacyC)||
     !object(data.energy)||!Number.isSafeInteger(data.energy.value)||
     data.energy.value<0||data.energy.value>ProgressCore.ENERGY_MAX||
     !nonneg(data.energy.updatedAt)||!Array.isArray(data.claimedMissions)||
     !object(data.heroes)||!object(data.materials)||!object(data.migration)||
     !nonneg(data.revision??0))return null;
  if(data.migration.strategy!=="clean-heroes-v1"||
     (data.migration.sourceVersion!==2&&data.migration.sourceVersion!==null))return null;
  const known=Object.keys(ProgressCore.FIRST_CLEAR_REWARDS);
  if(data.claimedMissions.some(x=>typeof x!=="string"||!known.includes(x))||
     new Set(data.claimedMissions).size!==data.claimedMissions.length)return null;
  if(Object.keys(data.heroes).length!==ids.length||ids.some(id=>!own(data.heroes,id)))return null;
  for(const id of ids){
   const hero=data.heroes[id],gear=hero?.gear;
   if(!object(hero)||hero.classId!==TEST_CLASSES[id]||
      !Number.isInteger(hero.level)||hero.level<1||hero.level>ProgressCore.MAX_LEVEL||
      !object(gear)||![1,2,3].includes(gear.tier)||!object(gear.installedByTier))
    return null;
   const keys=Object.keys(gear.installedByTier).sort();
   const expected=Array.from({length:gear.tier},(_,i)=>String(i+1));
   if(JSON.stringify(keys)!==JSON.stringify(expected))return null;
   for(let tier=1;tier<=gear.tier;tier++){
    const slots=gear.installedByTier[String(tier)];
    if(!Array.isArray(slots)||slots.length!==SLOTS.length)return null;
    for(let i=0;i<SLOTS.length;i++){
     const entry=slots[i];
     if(entry===null){
      // Past stages must be complete before promotion.
      if(tier<gear.tier)return null;
      continue;
     }
     if(!object(entry)||entry.kind!=="item"||typeof entry.itemId!=="string"||
        typeof GearData==="undefined")return null;
     const item=GearData.get(entry.itemId);
     if(!item||item.tier!==tier||item.slotId!==SLOTS[i]||
        !item.allowedClasses.includes(hero.classId))return null;
    }
   }
  }
  if(Object.keys(data.materials).length!==MATERIALS.length||
     MATERIALS.some(id=>!own(data.materials,id)||!nonneg(data.materials[id])))return null;
  if(data.daily!==undefined&&(typeof DailyCore==="undefined"||!DailyCore.valid(data.daily)))return null;
  if(data.login!==undefined&&(typeof LoginCore==="undefined"||!LoginCore.valid(data.login)))return null;
  if(data.skillLevels!==undefined&&
    (typeof SkillCore==="undefined"||!SkillCore.validLevels(data.skillLevels)))return null;
  if(data.skillMaterials!==undefined&&
    (typeof SkillCore==="undefined"||!SkillCore.validMaterials(data.skillMaterials)))return null;
  return JSON.parse(JSON.stringify(data));
 }
 function toRuntime(data,heroes){
  const source=validateActive(data,heroes);
  if(!source)return null;
  const ids=allyIds(heroes);
  return {
   saveVersion:3,saveRevision:source.revision??0,
   accountXp:source.accountXp,currency:source.currency,
   gearMaterials:source.legacyC,
   energy:source.energy,claimedMissions:source.claimedMissions,
   materials:source.materials,
   daily:source.daily,
   login:source.login,
   skillLevels:source.skillLevels,
   skillMaterials:source.skillMaterials,
   classes:Object.fromEntries(ids.map(id=>[id,source.heroes[id].classId])),
   levels:Object.fromEntries(ids.map(id=>[id,source.heroes[id].level])),
   gear:Object.fromEntries(ids.map(id=>{
    const gear=source.heroes[id].gear;
    return [id,{
     tier:gear.tier,mode:"itemized",
     slots:gear.installedByTier[String(gear.tier)].map(x=>x?.itemId??null),
     history:Object.fromEntries(Array.from({length:gear.tier-1},(_,i)=>{
      const tier=String(i+1);return [tier,gear.installedByTier[tier].map(x=>x?.itemId??null)];
     }))
    }];
   })),
   migration:source.migration
  };
 }
 function fromRuntime(p){
  if(!object(p)||p.saveVersion!==3||!object(p.levels)||!object(p.gear)||
     !object(p.materials)||!object(p.classes)||!object(p.energy))return null;
  const ids=Object.keys(TEST_CLASSES);
  if(ids.some(id=>!own(p.levels,id)||!own(p.gear,id)||p.classes[id]!==TEST_CLASSES[id]))
   return null;
  const source={
   version:3,revision:p.saveRevision??0,
   accountXp:p.accountXp,currency:p.currency,legacyC:p.gearMaterials,
   energy:p.energy,claimedMissions:p.claimedMissions,
   materials:p.materials,
   ...(p.daily!==undefined?{daily:p.daily}:{}),
   ...(p.login!==undefined?{login:p.login}:{}),
   ...(p.skillLevels!==undefined?{skillLevels:p.skillLevels}:{}),
   ...(p.skillMaterials!==undefined?{skillMaterials:p.skillMaterials}:{}),
   migration:p.migration??{strategy:"clean-heroes-v1",sourceVersion:null},
   heroes:Object.fromEntries(ids.map(id=>[id,{
    classId:p.classes[id],level:p.levels[id],
    gear:{tier:p.gear[id].tier,installedByTier:Object.fromEntries(
     Array.from({length:p.gear[id].tier},(_,i)=>{
      const tier=String(i+1);
      const entries=i+1===p.gear[id].tier?p.gear[id].slots:(p.gear[id].history?.[tier]||[]);
      return [tier,Array.isArray(entries)?entries.map(x=>x===null?null:{kind:"item",itemId:x}):[]];
     })
    )}
   }]))
  };
  return validateActive(source,ids.map(id=>({id,side:"ally"})));
 }
 function persist(p,getStorage){
  if(!p||p.saveVersion!==3)return false;
  const candidate=fromRuntime(p);
  if(!candidate)return false;
  try{
   const storage=getStorage();if(!storage)return false;
   // Refuse overwrite of a stale or corrupted profile from another tab.
   const raw=storage.getItem(KEY);if(raw===null)return false;
   const old=JSON.parse(raw),known=validateActive(old,Object.keys(TEST_CLASSES).map(id=>({id,side:"ally"})));
   if(!known||(known.revision??0)!==(p.saveRevision??0))return false;
   candidate.revision=(p.saveRevision??0)+1;
   const encoded=JSON.stringify(candidate);
   storage.setItem(KEY,encoded);
   if(storage.getItem(KEY)!==encoded)return false;
   p.saveRevision=candidate.revision;return true;
  }catch(_){return false;}
 }
 return Object.freeze({KEY,SOURCE_KEY,VERSION,SLOTS,MATERIALS,TEST_CLASSES,fromV2,fresh,validate,validateActive,toRuntime,fromRuntime,persist,stage});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ProgressV3Core;
