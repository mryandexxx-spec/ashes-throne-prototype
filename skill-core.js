/* Skills-001 [TEST PILOT]: six levels for active abilities only.
   Temporary currency names, rewards and numbers are NOT canonical balance. */
const SkillCore=(()=>{
 "use strict";
 const HERO_IDS=Object.freeze(["kael","lyra","darin","medic-demo","test-area-damage","ren"]);
 const IDS=Object.freeze(["basic","special","powerful"]);
 const RESOURCE_IDS=Object.freeze(["manual1","manual2","seal"]);
 const LABELS=Object.freeze({manual1:"Учебник I",manual2:"Учебник II",seal:"Печать мастерства"});
 const FLOORS=Object.freeze({manual1:60,manual2:40,seal:20});
 const MAX=6;
 // index = CURRENT skill level; costs to NEXT level. 1->2 only coins,
 // first basic manual at 2->3, advanced at 4->5, mastery seal at 5->6.
 const STEPS=Object.freeze([
  null,
  Object.freeze({to:2,heroLevel:2,currency:100,materials:Object.freeze({})}),
  Object.freeze({to:3,heroLevel:3,currency:200,materials:Object.freeze({manual1:2})}),
  Object.freeze({to:4,heroLevel:5,currency:300,materials:Object.freeze({manual1:3})}),
  Object.freeze({to:5,heroLevel:8,currency:500,materials:Object.freeze({manual2:3})}),
  Object.freeze({to:6,heroLevel:12,currency:700,materials:Object.freeze({manual2:5,seal:1})})
 ]);
 const object=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const validInt=x=>Number.isSafeInteger(x)&&x>=0;
 const freshLevels=()=>Object.fromEntries(HERO_IDS.map(id=>[id,Object.fromEntries(IDS.map(ability=>[ability,1]))]));
 const freshMaterials=()=>Object.fromEntries(RESOURCE_IDS.map(id=>[id,0]));
 function validLevels(value){
  return object(value)&&Object.keys(value).length===HERO_IDS.length&&
   HERO_IDS.every(id=>object(value[id])&&Object.keys(value[id]).length===IDS.length&&
    IDS.every(key=>own(value[id],key)&&Number.isInteger(value[id][key])&&
     value[id][key]>=1&&value[id][key]<=MAX));
 }
 function validMaterials(value){
  return object(value)&&Object.keys(value).length===RESOURCE_IDS.length&&
   RESOURCE_IDS.every(id=>own(value,id)&&validInt(value[id]));
 }
 function level(progress,id,abilityId){
  if(!HERO_IDS.includes(id)||!IDS.includes(abilityId))return null;
  const x=progress?.skillLevels?.[id]?.[abilityId];
  return Number.isInteger(x)&&x>=1&&x<=MAX?x:1;
 }
 function cost(progress,id,abilityId){
  const cur=level(progress,id,abilityId);
  if(cur===null||cur>=MAX)return null;
  return STEPS[cur];
 }
 function blocked(progress,id,abilityId){
  if(!progress||progress.saveVersion!==3||!HERO_IDS.includes(id)||!IDS.includes(abilityId))return "Навык недоступен.";
  if(progress.skillLevels!==undefined&&!validLevels(progress.skillLevels))return "Данные навыков повреждены.";
  if(progress.skillMaterials!==undefined&&!validMaterials(progress.skillMaterials))return "Данные материалов повреждены.";
  const c=cost(progress,id,abilityId);
  if(!c)return "Достигнут максимальный уровень навыка.";
  if(!Number.isInteger(progress.levels?.[id])||progress.levels[id]<c.heroLevel)
   return "Нужен уровень героя "+c.heroLevel+".";
  if(!validInt(progress.currency)||progress.currency<c.currency)return "Недостаточно игровой валюты.";
  if(Object.entries(c.materials).some(([key,n])=>(progress.skillMaterials?.[key]??0)<n))
   return "Недостаточно материалов навыка.";
  return "";
 }
 function upgrade(progress,id,abilityId){
  if(blocked(progress,id,abilityId))return null;
  const c=cost(progress,id,abilityId);
  const levels=progress.skillLevels??freshLevels();
  const materials=progress.skillMaterials??freshMaterials();
  levels[id][abilityId]++;
  progress.currency-=c.currency;
  for(const [key,n] of Object.entries(c.materials))materials[key]-=n;
  progress.skillLevels=levels;progress.skillMaterials=materials;
  return {level:c.to,currency:c.currency,materials:c.materials};
 }
 function grantTest(progress){
  if(!progress||progress.saveVersion!==3||
    (progress.skillMaterials!==undefined&&!validMaterials(progress.skillMaterials)))return false;
  const materials=progress.skillMaterials??freshMaterials();
  for(const id of RESOURCE_IDS)materials[id]=Math.max(materials[id],FLOORS[id]);
  progress.skillMaterials=materials;
  return true;
 }
 // Only explicitly leveled playable abilities are scaled. Fixtures and
 // existing unupgraded combat behavior remain byte-for-byte equivalent.
 function apply(base,actor,id){
  if(!base||!actor||!HERO_IDS.includes(actor.id)||!IDS.includes(id))return base;
  const lvl=actor.skillLevels?.[id];
  if(!Number.isInteger(lvl)||lvl<=1||lvl>MAX)return base;
  const delta=lvl-1;
  if(base.kind==="damage"&&Number.isFinite(base.multiplier))
   return {...base,multiplier:Math.round((base.multiplier+delta*.1)*100)/100};
  if(base.kind==="heal"&&Number.isInteger(base.healAmount))
   return {...base,healAmount:base.healAmount+5*delta};
  if(base.kind==="guard"&&Number.isInteger(base.guardHits))
   return {...base,guardHits:base.guardHits+delta};
  return base;
 }
 return Object.freeze({HERO_IDS,IDS,RESOURCE_IDS,LABELS,FLOORS,MAX,STEPS,
  freshLevels,freshMaterials,validLevels,validMaterials,level,cost,blocked,upgrade,grantTest,apply});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=SkillCore;
