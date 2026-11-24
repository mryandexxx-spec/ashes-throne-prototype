/* FIRSTPLAY001: isolated first-session gameplay checkpoint, no wallet mutation. */
const FirstPlayCore=(()=>{
 "use strict";
 const KEY="ashes-throne.first-play.v1";
 const CHOICES=Object.freeze(["survey","cover"]);
 // Shared with the battle lineup and the in-scene preview; these are combat-only effects.
 const EFFECTS=Object.freeze({survey:Object.freeze({hero:"art",stat:"speed",bonus:30}),
  cover:Object.freeze({hero:"ren",stat:"protection",bonus:35})});
 const PHASES=Object.freeze(["briefing","ready","battle","won","done"]);
 const fresh=()=>({version:1,phase:"briefing",choice:null});
 const valid=s=>!!s&&s.version===1&&PHASES.includes(s.phase)&&
  (s.choice===null||s.choice==="neutral"||CHOICES.includes(s.choice))&&
  (s.phase==="briefing"||s.phase==="done"||s.choice!==null);
 function load(provider){
  try{
   const storage=provider(),raw=storage.getItem(KEY);
   if(raw===null)return {state:fresh(),exists:false,available:true,blocked:false};
   const stored=JSON.parse(raw);
   if(!valid(stored))return {state:fresh(),exists:true,available:false,blocked:true};
   // A reload during combat must offer a retry, never a false victory.
   return {state:stored.phase==="battle"?{...stored,phase:"ready"}:stored,
    exists:true,available:true,blocked:false};
  }catch(_){return {state:fresh(),exists:false,available:false,blocked:true};}
 }
 function save(state,provider){
  if(!valid(state))return false;
  try{provider().setItem(KEY,JSON.stringify(state));return true;}catch(_){return false;}
 }
 function choose(state,choice){
  if(!valid(state)||!CHOICES.includes(choice)||!["briefing","ready"].includes(state.phase))return null;
  return {version:1,phase:"ready",choice};
 }
 function prepare(state){return valid(state)&&state.phase==="briefing"?{version:1,phase:"ready",choice:"neutral"}:null;}
 function start(state){return valid(state)&&state.phase==="ready"?{...state,phase:"battle"}:null;}
 function finish(state,won){
  return valid(state)&&state.phase==="battle"?{...state,phase:won?"won":"ready"}:null;
 }
 function complete(state){
  return valid(state)&&state.phase==="won"?{...state,phase:"done"}:null;
 }
 function skip(state){
  return valid(state)&&state.phase!=="done"?{version:1,phase:"done",choice:null}:null;
 }
 // Debug-only: delete only the game's own localStorage namespace, never clear
 // unrelated data on the shared origin. A caller must obtain user confirmation.
 function resetGameStorage(provider){
  try{
   const storage=provider(),keys=[];
   for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(typeof key==="string"&&key.startsWith("ashes-throne."))keys.push(key);
   }
   for(const key of keys)storage.removeItem(key);
   return {ok:true,removed:keys.length};
  }catch(_){return {ok:false,removed:null};}
 }
 return Object.freeze({KEY,CHOICES,EFFECTS,PHASES,fresh,valid,load,save,choose,prepare,start,finish,complete,skip,resetGameStorage});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=FirstPlayCore;
