/* Save-001: versioned local-only storage for temporary hero progress. */
const SaveCore=(()=>{
 "use strict";
 const KEY="ashes-throne.progress.v1";
 const VERSION=1;
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const plain=value=>!!value && typeof value==="object" && !Array.isArray(value);
 function validate(data,heroes){
  if(!plain(data)||data.version!==VERSION||!plain(data.levels))return null;
  if(!Number.isSafeInteger(data.materials)||data.materials<0)return null;
  const ids=heroes.filter(h=>h.side==="ally").map(h=>h.id);
  if(Object.keys(data.levels).length!==ids.length)return null;
  const levels={};
  for(const id of ids){
   const level=data.levels[id];
   if(!own(data.levels,id)||!Number.isInteger(level)||level<1||level>ProgressCore.MAX_LEVEL)return null;
   levels[id]=level;
  }
  return {materials:data.materials,levels};
 }
 // Storage access is lazy: Safari can throw while accessing window.localStorage.
 function load(heroes,getStorage){
  const fallback=ProgressCore.createProgress(heroes);
  try{
   const storage=getStorage();
   if(!storage)return {progress:fallback,available:false};
   const raw=storage.getItem(KEY);
   if(raw===null)return {progress:fallback,available:true};
   const restored=validate(JSON.parse(raw),heroes);
   return {progress:restored||fallback,available:true};
  }catch(error){
   return {progress:fallback,available:false};
  }
 }
 function save(progress,getStorage){
  try{
   const storage=getStorage();
   if(!storage)return false;
   storage.setItem(KEY,JSON.stringify({version:VERSION,materials:progress.materials,levels:progress.levels}));
   return true;
  }catch(error){return false;}
 }
 return Object.freeze({KEY,VERSION,validate,load,save});
})();
