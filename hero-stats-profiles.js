/* STATS-001A: CONTROL PROFILES ONLY, NOT PRODUCTION BALANCE.
 * These are CHAR-001 [PROPOSAL] baselines; deliberately no default growth.
 * These profiles are not imported by game.js / combat-core.js. */
const HeroStatsProfiles=(()=>{
 "use strict";
 const profiles={
  ren:{id:"ren",combatStats:{
   hp:120,protection:35,physicalAttack:28,magicAttack:0,
   physicalDefense:18,magicDefense:12,speed:150,critChance:10,
   critDamage:150,accuracy:5,evasion:5,defensePenetration:5,
   debuffPotency:15,debuffResistance:10
  }},
  nada:{id:"nada",combatStats:{
   hp:110,protection:45,physicalAttack:19,magicAttack:0,
   physicalDefense:15,magicDefense:18,speed:125,critChance:5,
   critDamage:150,accuracy:10,evasion:5,defensePenetration:0,
   debuffPotency:25,debuffResistance:20
  }}
 };
 for(const profile of Object.values(profiles)){
  Object.freeze(profile.combatStats);
  Object.freeze(profile);
 }
 return Object.freeze(profiles);
})();
if(typeof module!=="undefined"&&module.exports)module.exports=HeroStatsProfiles;
