/* CHAR-003 [TEST PILOT]: active skills L1–L6 plus Ren/Nada passives L1–L6.
   Temporary currency names, rewards and numbers are NOT canonical balance. */
const SkillCore=(()=>{
 "use strict";
 const HERO_IDS=Object.freeze(["kael","lyra","darin","medic-demo","test-area-damage","ren","nada","liora"]);
 const IDS=Object.freeze(["basic","special","powerful"]);
 const PASSIVE_IDS=Object.freeze(["ren","nada"]);
 const UPGRADABLE_IDS=Object.freeze([...IDS,"passive"]);
 // Optional v3 field. All pre-CHAR003 saves imply L1 without mutation.
 const freshPassiveLevels=()=>Object.fromEntries(PASSIVE_IDS.map(id=>[id,1]));
 function validPassiveLevels(value){
  return object(value)&&Object.keys(value).length===PASSIVE_IDS.length&&
   PASSIVE_IDS.every(id=>own(value,id)&&Number.isInteger(value[id])&&value[id]>=1&&value[id]<=MAX);
 }
 function passiveLevel(progress,id){
  if(!PASSIVE_IDS.includes(id))return null;
  const n=progress?.passiveLevels?.[id];
  return Number.isInteger(n)&&n>=1&&n<=MAX?n:1;
 }
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
  if(abilityId==="passive")return passiveLevel(progress,id);
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
  if(!progress||progress.saveVersion!==3||!HERO_IDS.includes(id)||
    !(IDS.includes(abilityId)||(abilityId==="passive"&&PASSIVE_IDS.includes(id))))
   return "Навык недоступен.";
  if(progress.passiveLevels!==undefined&&!validPassiveLevels(progress.passiveLevels))
   return "Данные пассивных навыков повреждены.";
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
  const passives=abilityId==="passive"?
   {...freshPassiveLevels(),...(progress.passiveLevels??{})}:null;
  if(passives)passives[id]++;
  else levels[id][abilityId]++;
  progress.currency-=c.currency;
  for(const [key,n] of Object.entries(c.materials))materials[key]-=n;
  if(!passives)progress.skillLevels=levels;
  progress.skillMaterials=materials;
  if(passives)progress.passiveLevels=passives;
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
 // CHAR-003 [PROPOSAL]: progressive passive synergy. Test balance, not canon.
 const PASSIVE_KITS=Object.freeze({
  ren:Object.freeze({readMoveBonusPercentPerStack:Object.freeze([12,13,14,15,16,17]),
   gardensEvasionBonus:Object.freeze([8,8,9,10,11,12])}),
  nada:Object.freeze({gardensAccuracyBonus:Object.freeze([8,9,10,11,12,13])})
 });
 function applyPassive(base,actor){
  const kit=PASSIVE_KITS[actor.id];
  const n=actor.skillLevels?.passive;
  if(!kit||!base?.combatRules||!Number.isInteger(n)||n<1||n>MAX)return base;
  const rules={...base.combatRules};
  for(const [name,curve] of Object.entries(kit))rules[name]=curve[n-1];
  return {...base,combatRules:Object.freeze(rules)};
 }
 // CHAR-002: experimental hero-specific six-step skill progression.
 // Every array index is current skill level minus one. This table, not the
 // general +0.1 demo scaling, owns Ren/Nada's real active ability effects.
 const HERO_KITS=Object.freeze({
  // LIORA001: [PROPOSAL] separate tank curves instead of generic +1 guard hit per rank.
  liora:Object.freeze({
   basic:Object.freeze({damage:[1,1.05,1.1,1.15,1.2,1.25]}),
   special:Object.freeze({guard:[2,2,3,3,4,4],cooldown:[3,3,3,2,2,2]}),
   powerful:Object.freeze({guard:[2,2,2,3,3,3],cooldown:[3,3,3,3,3,3]})
  }),
  ren:Object.freeze({
   basic:Object.freeze({damage:[1,1.1,1.2,1.2,1.3,1.4]}),
   special:Object.freeze({damage:[1.05,1.15,1.15,1.25,1.25,1.35],
    weaken:[2,2,3,3,3,3],cooldown:[2,2,2,2,1,1]}),
   powerful:Object.freeze({damage:[1.6,1.75,1.75,1.9,1.9,2.05]})
  }),
  nada:Object.freeze({
   basic:Object.freeze({damage:[.8,.9,1,1.1,1.2,1.3]}),
   special:Object.freeze({damage:[.7,.8,.8,.9,.9,1],
    readMove:[2,2,3,3,3,3],cooldown:[2,2,2,2,1,1]}),
   powerful:Object.freeze({damage:[.6,.65,.65,.7,.7,.75],
    readMove:[2,2,2,2,3,3]})
  })
 });
 function heroAbility(base,heroId,id,level){
  const kit=HERO_KITS[heroId]?.[id];
  if(!kit)return base;
  const index=level-1;
  if(heroId==="liora"&&base?.kind==="guard")
   return {...base,guardHits:kit.guard[index],cooldown:kit.cooldown[index]};
  if(base?.kind!=="damage")return base;
  const ability={...base,multiplier:kit.damage[index]};
  if(kit.weaken)ability.weakening=kit.weaken[index];
  if(kit.cooldown)ability.cooldown=kit.cooldown[index];
  if(heroId==="ren"&&id==="basic"){
   if(level>=4)ability.onHitStatus=Object.freeze({
    type:"slowed",amount:20,turns:level>=6?2:1});
   else delete ability.onHitStatus;
  }
  if(kit.readMove)ability.onHitStatus=Object.freeze({
   type:"read-move",stacks:kit.readMove[index],turns:2});
  if(heroId==="ren"&&id==="powerful")delete ability.followUpStatusAll;
  return ability;
 }
 // Only explicitly leveled playable abilities are scaled. Fixtures and
 // existing unupgraded combat behavior remain unchanged.
 function apply(base,actor,id){
  if(!base||!actor||!HERO_IDS.includes(actor.id))return base;
  if(id==="passive")return applyPassive(base,actor);
  if(!IDS.includes(id))return base;
  const lvl=actor.skillLevels?.[id];
  if(!Number.isInteger(lvl)||lvl<1||lvl>MAX)return base;
  if(HERO_KITS[actor.id])return heroAbility(base,actor.id,id,lvl);
  if(lvl===1)return base;
  const delta=lvl-1;
  if(base.kind==="damage"&&Number.isFinite(base.multiplier))
   return {...base,multiplier:Math.round((base.multiplier+delta*.1)*100)/100};
  if(base.kind==="heal"&&Number.isInteger(base.healAmount))
   return {...base,healAmount:base.healAmount+5*delta};
  if(base.kind==="guard"&&Number.isInteger(base.guardHits))
   return {...base,guardHits:base.guardHits+delta};
  return base;
 }
 return Object.freeze({HERO_IDS,IDS,PASSIVE_IDS,UPGRADABLE_IDS,RESOURCE_IDS,LABELS,FLOORS,MAX,STEPS,
  freshLevels,freshPassiveLevels,freshMaterials,validLevels,validPassiveLevels,validMaterials,
  passiveLevel,level,cost,blocked,upgrade,grantTest,apply});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=SkillCore;
