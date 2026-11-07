/* Progress-VS-001A: intentionally reset old Progress-001 demo resources.
   New economic rewards and claimed mission IDs live together in one record. */
const SaveCore=(()=>{
 "use strict";
 const KEY="ashes-throne.progress.v2";
 const VERSION=2;
 const plain=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
 const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 function validate(data,heroes){
  if(!plain(data)||data.version!==VERSION||!plain(data.levels)||!Array.isArray(data.claimedMissions))
   return null;
  if(!Number.isSafeInteger(data.currency)||data.currency<0||
     !Number.isSafeInteger(data.accountXp)||data.accountXp<0)return null;
  const ids=heroes.filter(h=>h.side==="ally").map(h=>h.id);
  if(Object.keys(data.levels).some(id=>!ids.includes(id)))return null;
  const levels={};
  for(const id of ids){
   const level=own(data.levels,id)?data.levels[id]:1;
   if(!Number.isInteger(level)||level<1||level>ProgressCore.MAX_LEVEL)return null;
   levels[id]=level;
  }
  const claims=data.claimedMissions;
  const known=Object.keys(ProgressCore.FIRST_CLEAR_REWARDS);
  if(claims.some(id=>typeof id!=="string"||!known.includes(id))||new Set(claims).size!==claims.length)return null;
  const progress={accountXp:data.accountXp,currency:data.currency,levels,claimedMissions:claims.slice()};
  if(Object.values(levels).some(level=>level>ProgressCore.accountLevel(progress)))return null;
  return progress;
 }
 function load(heroes,getStorage){
  const fallback=ProgressCore.createProgress(heroes);
  try{
   const storage=getStorage();if(!storage)return {progress:fallback,available:false,fresh:true};
   const raw=storage.getItem(KEY);
   const restored=raw===null?null:validate(JSON.parse(raw),heroes);
   return {progress:restored||fallback,available:true,fresh:!restored};
  }catch(error){return {progress:fallback,available:false,fresh:true};}
 }
 function save(progress,getStorage){
  try{
   const storage=getStorage();if(!storage)return false;
   storage.setItem(KEY,JSON.stringify({version:VERSION,accountXp:progress.accountXp,
    currency:progress.currency,levels:progress.levels,claimedMissions:progress.claimedMissions}));
   return true;
  }catch(error){return false;}
 }
 return Object.freeze({KEY,VERSION,validate,load,save});
})();
