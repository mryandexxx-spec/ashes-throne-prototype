/* NET-007: rank combat growth and overflow shard exchange in the playable progression.
 * Direct mission joins award 1 star; earlier shards are never consumed by joining. */
const StarCore=(()=>{
 "use strict";
 const IDS=Object.freeze(["kael","lyra","darin","medic-demo","test-area-damage","ren","nada","liora","art","sava"]);
 const START=Object.freeze(["ren","nada","liora","art","sava"]);
 const COST=Object.freeze([10,15,25,30,65,85,100]);
 const MAX=7, TOTAL=COST.reduce((sum,n)=>sum+n,0);
 const STAR_BONUS_PER_RANK=0.03, EXCESS_SHARD_CURRENCY=80;
 const COMBAT_BONUS_STATS=Object.freeze(["hp","physicalAttack","magicAttack","physicalDefense","magicDefense"]);
 const combatMultiplier=rank=>Number.isInteger(rank)&&rank>=1&&rank<=MAX?
  1+(rank-1)*STAR_BONUS_PER_RANK:1;
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const object=value=>!!value&&typeof value==="object"&&!Array.isArray(value);
 const validCount=value=>Number.isSafeInteger(value)&&value>=0;
 function valid(stars){
  return object(stars)&&Object.keys(stars).length===IDS.length&&
   IDS.every(id=>own(stars,id)&&object(stars[id])&&
    Object.keys(stars[id]).length===2&&
    Number.isInteger(stars[id].rank)&&stars[id].rank>=0&&stars[id].rank<=MAX&&
    validCount(stars[id].shards));
 }
 // Legacy fixture IDs are kept for stat/gear test compatibility, not as recruitable heroes.
 function fromLegacy(unlockedHeroes){
  if(unlockedHeroes!==undefined&&(!Array.isArray(unlockedHeroes)||
     !(START.every(id=>unlockedHeroes.includes(id))||
       ["kael","lyra","darin"].every(id=>unlockedHeroes.includes(id)))||
     unlockedHeroes.some(id=>!IDS.includes(id))||
     new Set(unlockedHeroes).size!==unlockedHeroes.length))return null;
  return Object.fromEntries(IDS.map(id=>[id,{
   rank:unlockedHeroes===undefined||unlockedHeroes.includes(id)?1:0,shards:0
  }]));
 }
 function state(progress,id){
  return IDS.includes(id)&&valid(progress?.heroStars)?progress.heroStars[id]:null;
 }
 function rankOf(progress,id){return state(progress,id)?.rank??null;}
 function shardsOf(progress,id){return state(progress,id)?.shards??null;}
 function costOf(progress,id){
  const rank=rankOf(progress,id);
  return rank===null||rank>=MAX?null:COST[rank];
 }
 function usedThrough(rank){
  return Number.isInteger(rank)&&rank>=0&&rank<=MAX?
   COST.slice(0,rank).reduce((sum,n)=>sum+n,0):null;
 }
 function remaining(progress,id){
  const rank=rankOf(progress,id);
  if(rank===null)return null;
  return Math.max(0,TOTAL-usedThrough(rank)-(shardsOf(progress,id)??0));
 }
 function syncOwned(progress,id){
  if(progress.unlockedHeroes===undefined)return true; // legacy: all owned
  if(!Array.isArray(progress.unlockedHeroes))return false;
  if(!progress.unlockedHeroes.includes(id))progress.unlockedHeroes.push(id);
  return true;
 }
 // Shards may be earned before a hero joins; all shard sources will call this.
 function add(progress,id,amount){
  const current=state(progress,id);
  if(!current||!Number.isSafeInteger(amount)||amount<=0)return false;
  if(current.rank===MAX){
   const refund=amount*EXCESS_SHARD_CURRENCY;
   if(!Number.isSafeInteger(refund)||!validCount(progress.currency)||
    !Number.isSafeInteger(progress.currency+refund))return false;
   progress.currency+=refund;return true;
  }
  if(!Number.isSafeInteger(current.shards+amount))return false;
  current.shards+=amount;return true;
 }
 function directGrant(progress,id){
  const current=state(progress,id);
  if(!current||current.rank!==0)return false;
  if(progress.unlockedHeroes!==undefined&&
     (!Array.isArray(progress.unlockedHeroes)||!IDS.includes(id)))return false;
  current.rank=1;syncOwned(progress,id);
  return true; // do not consume the 10-shard unlock cost or any saved shards
 }
 function promote(progress,id){
  const current=state(progress,id),cost=costOf(progress,id);
  if(!current||cost===null||current.shards<cost)return null;
  if(current.rank===0&&progress.unlockedHeroes!==undefined&&
    !Array.isArray(progress.unlockedHeroes))return null;
  const nextRank=current.rank+1,extra=nextRank===MAX?current.shards-cost:0;
  const refund=extra*EXCESS_SHARD_CURRENCY;
  if(nextRank===MAX&&(!Number.isSafeInteger(refund)||
   !validCount(progress.currency)||!Number.isSafeInteger(progress.currency+refund)))return null;
  current.shards=nextRank===MAX?0:current.shards-cost;current.rank=nextRank;
  if(refund)progress.currency+=refund;
  if(current.rank===1)syncOwned(progress,id);
  return {id,rank:current.rank,spent:cost,remainingShards:current.shards,
   excessCurrency:refund};
 }
 // Explicitly DEBUG-only. A single click supplies the remaining full-cycle
 // shard requirement per hero; repeats cannot mint more for already-full stock.
 function refillTest(progress){
  if(!valid(progress?.heroStars))return false;
  for(const id of IDS){
   const s=progress.heroStars[id];
   if(s.rank===MAX)continue;
   const minimum=TOTAL-usedThrough(s.rank);
   if(s.shards<minimum)s.shards=minimum;
  }
  return true;
 }
 return Object.freeze({IDS,START,COST,MAX,TOTAL,STAR_BONUS_PER_RANK,
  EXCESS_SHARD_CURRENCY,COMBAT_BONUS_STATS,combatMultiplier,valid,fromLegacy,
  rankOf,shardsOf,costOf,remaining,usedThrough,add,directGrant,promote,refillTest});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=StarCore;
