/* Playable hero collection. Retired tutorial actors are no longer recruitable
 * or mission rewards. Encounter NPCs remain non-recruitable. */
const HeroCollectionCore=(()=>{
 "use strict";
 const IDS=Object.freeze(["ren","nada","liora","art","sava"]);
 const START=Object.freeze(["ren","nada","liora","art","sava"]);
 const MISSION_UNLOCKS=Object.freeze({});
 function valid(value){
  return Array.isArray(value)&&value.length>=START.length&&value.length<=IDS.length&&
    value.every(id=>typeof id==="string"&&IDS.includes(id))&&
    new Set(value).size===value.length&&START.every(id=>value.includes(id));
 }
 function owned(progress,id){
  if(!IDS.includes(id))return false;
  if(typeof StarCore!=="undefined"&&progress?.heroStars!==undefined)
   return StarCore.rankOf(progress,id)>0;
  // Original v3 players keep all five heroes and their saved squads.
  if(progress?.saveVersion!==3||progress.unlockedHeroes===undefined)return true;
  return valid(progress.unlockedHeroes)&&progress.unlockedHeroes.includes(id);
 }
 function grant(progress,missionId){
  const starHero=MISSION_UNLOCKS[missionId];
  if(progress?.saveVersion===3&&typeof StarCore!=="undefined"&&progress.heroStars!==undefined)
   return starHero&&StarCore.directGrant(progress,starHero)?starHero:null;
  if(progress?.saveVersion!==3||progress.unlockedHeroes===undefined||
    !valid(progress.unlockedHeroes))return null;
  const id=MISSION_UNLOCKS[missionId];
  if(!id||progress.unlockedHeroes.includes(id))return null;
  progress.unlockedHeroes.push(id);
  return id;
 }
 function reward(missionId){return MISSION_UNLOCKS[missionId]||null;}
 function unlockMission(id){return Object.keys(MISSION_UNLOCKS).find(key=>MISSION_UNLOCKS[key]===id)||null;}
 return Object.freeze({IDS,START,MISSION_UNLOCKS,valid,owned,grant,reward,unlockMission});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=HeroCollectionCore;
