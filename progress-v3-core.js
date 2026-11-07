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
   const valid=validate(parsed,heroes);
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
 return Object.freeze({KEY,SOURCE_KEY,VERSION,SLOTS,MATERIALS,TEST_CLASSES,fromV2,fresh,validate,stage});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ProgressV3Core;
