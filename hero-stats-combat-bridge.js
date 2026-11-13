/* STATS-001B: one direct 14-stat path for Ren/Nada.
 * Numerical curves are prototype proposals, not accepted balance.
 * All stats are derived from the profile, level, stars and equipped bonuses;
 * legacy hp/atk/speed are NOT inputs to the calculation. */
const HeroStatsCombatBridge=(()=>{
 "use strict";
 function apply(hero,progression,profile,core){
  if(!hero||!progression||!profile||!core||
     hero.id!==profile.id||!["ren","nada"].includes(hero.id))
   throw new TypeError("Only matching Ren/Nada hero profiles are supported");
  if(typeof core.resolve!=="function")throw new TypeError("Stats core required");
  const level=progression.level,stars=progression.stars;
  const gear=progression.gearPercent??{};
  if(!gear||typeof gear!=="object"||Array.isArray(gear)||
     Object.keys(gear).some(key=>!["hp","atk"].includes(key))||
     ![gear.hp??0,gear.atk??0].every(value=>Number.isFinite(value)&&value>=0))
   throw new RangeError("Invalid equipment bonuses");
  // Current equipped G items provide percentages in ProgressCore. The
  // percentage is applied to the newly resolved hero stats, never to demo atk.
  core.resolve(profile,{level,stars}); // validate level and rank
  // Apply equipped percent bonuses before Core rounds once.
  const raw=key=>profile.combatStats[key]+
   (level-1)*(profile.growth?.level?.[key]??0)+
   (stars-1)*(profile.growth?.star?.[key]??0);
  const bonuses={
   hp:raw("hp")*(gear.hp??0),
   physicalAttack:raw("physicalAttack")*(gear.atk??0)
  };
  const stats=core.resolve(profile,{level,stars,gearBonuses:bonuses});
  return Object.freeze({
   ...hero,
   ...stats,
   level,
   // Temporary compatibility alias for generic consumers, sourced from real
   // physical attack instead of the demo HEROES[].atk.
   atk:stats.physicalAttack,
   maxProtection:stats.protection,
   combatProfile:"stats002c"
  });
 }
 return Object.freeze({apply});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=HeroStatsCombatBridge;
