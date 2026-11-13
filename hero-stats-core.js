/* STATS-001A [EXPERIMENTAL, NOT WIRED TO GAME].
 * Pure 14-stat resolver for Ren and Nada. No balance curves are implied here.
 * Inputs are explicit; no save, combat, gear-catalog or DOM mutation. */
const HeroStatsCore=(()=>{
 "use strict";
 const KEYS=Object.freeze([
  "hp","protection","physicalAttack","magicAttack","physicalDefense",
  "magicDefense","speed","critChance","critDamage","accuracy",
  "evasion","defensePenetration","debuffPotency","debuffResistance"
 ]);
 const PERCENT=new Set(["critChance","accuracy","evasion","defensePenetration",
  "debuffPotency","debuffResistance"]);
 const COUNTS=new Set(["hp","protection","physicalAttack","magicAttack",
  "physicalDefense","magicDefense"]);
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
 function exactKeys(value,allowed,context,required=false){
  if(!object(value))throw new TypeError(context+" must be an object");
  if(required&&allowed.some(key=>!own(value,key)))
   throw new TypeError(context+" is missing a stat");
  if(Object.keys(value).some(key=>!allowed.includes(key)))
   throw new TypeError(context+" has an unknown stat");
 }
 function validStat(key,value,context){
  if(typeof value!=="number"||!Number.isFinite(value))
   throw new RangeError(context+"."+key+" must be finite");
  if(value<0||(key==="hp"&&value===0)||(key==="speed"&&value===0))
   throw new RangeError(context+"."+key+" is out of range");
  if(PERCENT.has(key)&&value>100)
   throw new RangeError(context+"."+key+" exceeds 100");
  if(key==="critDamage"&&(value<100||value>1000))
   throw new RangeError(context+".critDamage is out of range");
  if(COUNTS.has(key)&&(!Number.isSafeInteger(value)))
   throw new RangeError(context+"."+key+" must be a safe integer");
 }
 function resolve(definition,options={}){
  if(!object(definition)||!object(options))throw new TypeError("Invalid resolver arguments");
  if(!["ren","nada"].includes(definition.id))
   throw new TypeError("STATS-001A is scoped to Ren and Nada");
  const base=definition.combatStats;
  exactKeys(base,KEYS,"combatStats",true);
  for(const key of KEYS)validStat(key,base[key],"combatStats");
  const growth=definition.growth??{};
  if(!object(growth)||Object.keys(growth).some(key=>!["level","star"].includes(key)))
   throw new TypeError("growth must have only level and star");
  const levelGrowth=growth.level??{},starGrowth=growth.star??{};
  const gear=options.gearBonuses??{};
  exactKeys(levelGrowth,KEYS,"growth.level");
  exactKeys(starGrowth,KEYS,"growth.star");
  exactKeys(gear,KEYS,"gearBonuses");
  // Growth fields are additive absolute points per level/star, not percentages.
  // This lets balance designers determine actual curves later, without 4% legacy.
  for(const [name,part] of [["growth.level",levelGrowth],["growth.star",starGrowth],["gearBonuses",gear]]){
   for(const [key,value] of Object.entries(part)){
    if(typeof value!=="number"||!Number.isFinite(value)||value<0)
     throw new RangeError(name+"."+key+" must be finite and nonnegative");
    if(key==="speed"&&value!==0)
     throw new RangeError("Ordinary progression cannot increase speed");
   }
  }
  const level=options.level??1,stars=options.stars??1;
  if(!Number.isSafeInteger(level)||level<1||level>85)
   throw new RangeError("level must be from 1 to 85");
  if(!Number.isSafeInteger(stars)||stars<1||stars>7)
   throw new RangeError("stars must be from 1 to 7");
  const values={};
  for(const key of KEYS){
   const raw=base[key]+(level-1)*(levelGrowth[key]??0)+
    (stars-1)*(starGrowth[key]??0)+(gear[key]??0);
   // Integer combat pools and flat defenses are rounded once at the end;
   // percentage-point stats may retain fractions for future formula approval.
   const result=COUNTS.has(key)?Math.round(raw):raw;
   validStat(key,result,"resolved");
   values[key]=result;
  }
  return Object.freeze(values);
 }
 return Object.freeze({KEYS,resolve});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=HeroStatsCore;
