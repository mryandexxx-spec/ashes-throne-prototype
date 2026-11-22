/* STATS-001B + PROGRESSIONSTATS004: one direct 14-stat path for all playable heroes.
 * Numerical curves are prototype proposals, not accepted balance.
 * All stats are derived from the profile, level, stars and equipped bonuses;
 * legacy hp/atk/speed are NOT inputs to the calculation. */
const HeroStatsCombatBridge=(()=>{
 "use strict";
 function apply(hero,progression,profile,core){
  if(!hero||!progression||!profile||!core||
     hero.id!==profile.id||!["ren","nada","liora","art","sava"].includes(hero.id))
   throw new TypeError("Only matching playable hero profiles are supported");
  if(typeof core.resolve!=="function")throw new TypeError("Stats core required");
  const level=progression.level,stars=progression.stars;
  const gear=progression.gearPercent??{};
  if(!gear||typeof gear!=="object"||Array.isArray(gear)||
     Object.keys(gear).some(key=>!["hp","atk","stats"].includes(key))||
     ![gear.hp??0,gear.atk??0].every(value=>Number.isFinite(value)&&value>=0))
   throw new RangeError("Invalid equipment bonuses");
  // Current equipped G items provide percentages in ProgressCore. The
  // percentage is applied to the newly resolved hero stats, never to demo atk.
  core.resolve(profile,{level,stars}); // validate level and rank
  // Apply equipped percent bonuses before Core rounds once.
  // StarCore's percentage is the ONLY star stat gain in real hero combat.
  // The older prototype growth.star points are not stacked with NET-007.
  const raw=key=>profile.combatStats[key]+
   (level-1)*(profile.growth?.level?.[key]??0);
  // NET-007's approved 3% per star remains the ONLY primary-stat
  // multiplier. Preserve its five base-stat targets and avoid double growth.
  const starFactor=typeof StarCore!=="undefined"?
   StarCore.combatMultiplier(stars):1+(stars-1)*0.03;
  const primaryStarKeys=typeof StarCore!=="undefined"?
   StarCore.COMBAT_BONUS_STATS:
   ["hp","physicalAttack","magicAttack","physicalDefense","magicDefense"];
  const bonuses={
   hp:raw("hp")*(gear.hp??0),
   physicalAttack:raw("physicalAttack")*(gear.atk??0)
  };
  for(const key of primaryStarKeys)
   bonuses[key]=(bonuses[key]||0)+profile.combatStats[key]*(starFactor-1);
  // PROGRESSIONSTATS004 [PROPOSAL]: profile-driven flat secondary
  // specializations per star (e.g. Protection, Accuracy, Debuff Potency).
  // Legacy growth.star primary entries remain ignored: applying them would
  // stack another HP/ATK gain on top of NET-007's existing 3% multiplier.
  for(const [key,perStar] of Object.entries(profile.growth?.star??{})){
   if(primaryStarKeys.includes(key))continue;
   bonuses[key]=(bonuses[key]||0)+(stars-1)*perStar;
  }
  const itemStats=progression.gearStats??{};
  if(!itemStats||typeof itemStats!=="object"||Array.isArray(itemStats)||
    Object.keys(itemStats).some(key=>!core.KEYS.includes(key)||key==="speed"||
      !Number.isFinite(itemStats[key])||itemStats[key]<0))
   throw new RangeError("Invalid item stat bonuses");
  for(const [key,value] of Object.entries(itemStats))
   bonuses[key]=(bonuses[key]||0)+value;
  const stats=core.resolve(profile,{level,stars:1,gearBonuses:bonuses});
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
