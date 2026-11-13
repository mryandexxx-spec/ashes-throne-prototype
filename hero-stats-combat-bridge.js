/* STATS-001B [EXPERIMENTAL]. Optional bridge for the existing Ren/Nada roster.
 * This is a debug pilot, NOT a new 3D asset or a balance migration.
 * Legacy HP/ATK progression is retained until STATS-001C approves growth. */
const HeroStatsCombatBridge=(()=>{
 "use strict";
 function apply(hero,progressed,profile,core){
  if(!hero||!progressed||!profile||!core||
     hero.id!==profile.id||!["ren","nada"].includes(hero.id))
   throw new TypeError("Stats pilot supports only matching Ren/Nada heroes");
  if(typeof core.resolve!=="function")throw new TypeError("Stats core required");
  const full=core.resolve(profile,{level:progressed.level??1});
  // Do not secretly replace the level+gear progression currently owned by
  // ProgressCore. The new other fields remain experimental static baselines.
  if(!Number.isSafeInteger(progressed.hp)||progressed.hp<1||
     !Number.isFinite(progressed.atk)||progressed.atk<0)
   throw new RangeError("Invalid legacy progression snapshot");
  if(!Number.isFinite(hero.speed)||hero.speed<=0||hero.speed!==full.speed)
   throw new RangeError("Speed mismatch: pilot must preserve existing initiative");
  return Object.freeze({
   ...progressed,
   ...full,
   hp:progressed.hp,
   atk:progressed.atk,
   physicalAttack:progressed.atk,
   speed:hero.speed,
   maxProtection:full.protection,
   combatProfile:"stats002c",
   stats001bPilot:true
  });
 }
 return Object.freeze({apply});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=HeroStatsCombatBridge;
