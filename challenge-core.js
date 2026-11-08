/* Challenges-001A: independent, noncanonical PvE challenge rules.
 * No campaign, hero progression, currencies, or battle formulas are changed.
 * N-01 third-star action limit remains unset until actual balance testing. */
const ChallengeCore=(()=>{
 "use strict";
 const KEY="ashes-throne.challenges.v1";
 const VERSION=1;
 const catalog=Object.freeze({
  "T-01":Object.freeze({id:"T-01",kind:"tactical",title:"Первая цель",
   enemyIds:Object.freeze(["ves","shade"]),priorityId:"ves",
   futureWaves:Object.freeze([])}),
  "N-01":Object.freeze({id:"N-01",kind:"onslaught",title:"Два рубежа",
   enemyIds:Object.freeze(["ves","shade","ves-2"]),
   futureWaves:Object.freeze([Object.freeze(["ves-2"])]),
   thirdStarActionLimit:null})
 });
 const ids=()=>Object.keys(catalog);
 function get(id){return catalog[id]||null;}
 function fresh(){return {bestStars:Object.fromEntries(ids().map(id=>[id,0]))};}
 function valid(data){
  return !!data&&typeof data==="object"&&!Array.isArray(data)&&
   data.version===VERSION&&data.bestStars&&
   typeof data.bestStars==="object"&&!Array.isArray(data.bestStars)&&
   Object.keys(data.bestStars).every(id=>!!get(id))&&
   Object.entries(data.bestStars).every(([,v])=>Number.isInteger(v)&&v>=0&&v<=3);
 }
 function load(storageProvider){
  const empty=fresh();
  try{
   const store=storageProvider();
   if(!store)return {progress:empty,available:false,blocked:true};
   const raw=store.getItem(KEY);
   if(raw===null)return {progress:empty,available:true,blocked:false};
   const parsed=JSON.parse(raw);
   if(!valid(parsed))return {progress:empty,available:true,blocked:true};
   return {progress:{bestStars:Object.fromEntries(ids().map(id=>[id,parsed.bestStars[id]||0]))},
    available:true,blocked:false};
  }catch(_){return {progress:empty,available:false,blocked:true};}
 }
 function save(progress,storageProvider,blocked=false){
  if(blocked||!progress||!progress.bestStars||Object.keys(progress.bestStars).length!==ids().length||
   !ids().every(id=>Number.isInteger(progress.bestStars[id])&&
    progress.bestStars[id]>=0&&progress.bestStars[id]<=3))return false;
  try{
   const store=storageProvider();
   if(!store)return false;
   store.setItem(KEY,JSON.stringify({version:VERSION,bestStars:progress.bestStars}));
   return true;
  }catch(_){return false;}
 }
 function start(id){
  const def=get(id);
  return def?{id,killGroups:[],invalid:false}:null;
 }
 // One "ability" starts one logical action. All deaths until the next
 // ability belong to that action, including chained passive reactions.
 // Each incoming event batch must be supplied once (not once per UI render).
 function capture(tracker,events){
  const def=tracker&&get(tracker.id);
  if(!def||tracker.invalid||!Array.isArray(events))return false;
  let current=null;
  for(const e of events){
   if(!e||typeof e!=="object"){tracker.invalid=true;return false;}
   if(e.type==="ability"){
    current=[];
    tracker.killGroups.push(current);
   }else if(e.type==="death"&&def.enemyIds.includes(e.targetId)){
    if(!current){tracker.invalid=true;return false;}
    if(!current.includes(e.targetId))current.push(e.targetId);
   }
  }
  return true;
 }
 function strictFirst(tracker,priority){
  if(!tracker||tracker.invalid)return false;
  const first=tracker.killGroups.find(group=>group.length>0);
  return !!first&&first.length===1&&first[0]===priority;
 }
 function score(id,battle,tracker){
  const def=get(id);
  if(!def||!battle||battle.active||battle.winner!=="ally"||
   !Array.isArray(battle.fighters)||!tracker||tracker.id!==id||tracker.invalid)return 0;
  let stars=1;
  const allAlive=battle.fighters.filter(f=>f.side==="ally").length>0&&
   battle.fighters.filter(f=>f.side==="ally").every(f=>f.hp>0);
  if(id==="T-01"){
   if(!strictFirst(tracker,def.priorityId))return 1;
   stars=2;
   if(allAlive)stars=3;
  }else if(id==="N-01"){
   if(battle.wave!==2||battle.totalWaves!==2)return 0;
   if(allAlive)stars=2;
   if(allAlive&&Number.isSafeInteger(def.thirdStarActionLimit)&&
      Number.isSafeInteger(battle.allyActions)&&
      battle.allyActions<=def.thirdStarActionLimit)stars=3;
  }
  return stars;
 }
 // Pure transition: caller saves candidate before showing the best as permanent.
 function result(progress,id,battle,tracker){
  const earned=score(id,battle,tracker);
  if(!get(id)||!progress||!progress.bestStars||
   !Number.isInteger(progress.bestStars[id]))return null;
  const old=progress.bestStars[id];
  const best=Math.max(old,earned);
  const candidate={bestStars:{...progress.bestStars,[id]:best}};
  return {earned,best,improved:best>old,candidate};
 }
 return Object.freeze({KEY,VERSION,get,all:()=>ids().map(get),fresh,valid,load,save,start,capture,strictFirst,score,result});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ChallengeCore;
