/* STATS-001: DESIGN ITERATION [PROPOSAL], NOT APPROVED BALANCE.
 * First genuine 14-stat hero profiles. Level and star gains are additive.
 * Neither ordinary levels, stars nor G equipment increase speed. */
const HeroStatsProfiles=(()=>{
 "use strict";
 const freezeProfile=profile=>Object.freeze({
  id:profile.id,
  combatStats:Object.freeze(profile.combatStats),
  growth:Object.freeze({
   level:Object.freeze(profile.growth.level),
   star:Object.freeze(profile.growth.star)
  })
 });
 return Object.freeze({
  ren:freezeProfile({
   id:"ren",
   combatStats:{
    hp:120,protection:35,physicalAttack:28,magicAttack:0,
    physicalDefense:18,magicDefense:12,speed:150,critChance:10,
    critDamage:150,accuracy:5,evasion:5,defensePenetration:5,
    debuffPotency:15,debuffResistance:10
   },
   growth:{
    level:{hp:2.4,protection:0.5,physicalAttack:0.55,physicalDefense:0.22,magicDefense:0.16},
    star:{hp:12,protection:5,physicalAttack:3,physicalDefense:2,magicDefense:1}
   }
  }),
  // LIORAPLAY001: temporary test values for unarmed Liora; not accepted balance.
  liora:freezeProfile({
   id:"liora",
   combatStats:{
    hp:135,protection:50,physicalAttack:20,magicAttack:0,
    physicalDefense:24,magicDefense:14,speed:115,critChance:5,
    critDamage:150,accuracy:5,evasion:4,defensePenetration:0,
    debuffPotency:10,debuffResistance:25
   },
   growth:{
    level:{hp:2.6,protection:0.8,physicalAttack:0.36,physicalDefense:0.3,magicDefense:0.17},
    star:{hp:14,protection:8,physicalAttack:2,physicalDefense:3,magicDefense:1}
   }
  }),
  nada:freezeProfile({
   id:"nada",
   combatStats:{
    hp:110,protection:45,physicalAttack:19,magicAttack:0,
    physicalDefense:15,magicDefense:18,speed:125,critChance:5,
    critDamage:150,accuracy:10,evasion:5,defensePenetration:0,
    debuffPotency:25,debuffResistance:20
   },
   growth:{
    level:{hp:2.1,protection:0.75,physicalAttack:0.35,physicalDefense:0.18,magicDefense:0.25},
    star:{hp:10,protection:7,physicalAttack:2,physicalDefense:1,magicDefense:2}
   }
  })
 });
})();
if(typeof module!=="undefined"&&module.exports)module.exports=HeroStatsProfiles;
