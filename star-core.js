/* Stars-001: demo roster ranks/shards. No combat bonuses or economy drop tables.
 * Direct mission joins award 1 star; earlier shards are never consumed by joining. */
const StarCore=(()=>{
 "use strict";
 const IDS=Object.freeze(["kael","lyra","darin","medic-demo","test-area-damage"]);
 const START=Object.freeze(["kael","lyra","darin"]);
 const COST=Object.freeze([10,15,25,30,65,85,100]);
 const MAX=7, TOTAL=COST.reduce((sum,n)=>sum+n,0);
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
 // Older v3 saves without unlockedHeroes, and v2 saves, own the whole demo roster.
 function fromLegacy(unlockedHeroes){
  if(unlockedHeroes!==undefined&&(!Array.isArray(unlockedHeroes)||
     START.some(id=>!unlockedHeroes.includes(id))||
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
  if(!current||!Number.isSafeInteger(amount)||amount<=0||current.rank===MAX||
   !Number.isSafeInteger(current.shards+amount))return false;
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
  current.shards-=cost;current.rank++;
  if(current.rank===1)syncOwned(progress,id);
  return {id,rank:current.rank,spent:cost,remainingShards:current.shards};
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
 return Object.freeze({IDS,START,COST,MAX,TOTAL,valid,fromLegacy,
  rankOf,shardsOf,costOf,remaining,usedThrough,add,directGrant,promote,refillTest});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=StarCore;
