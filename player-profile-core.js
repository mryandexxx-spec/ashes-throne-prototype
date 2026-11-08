/* PROFILE-001: local, user-controlled nickname only.
   Never modify or migrate the economy/hero save on profile edits. */
const PlayerProfileCore=(()=>{
 "use strict";
 const KEY="ashes-throne.player-profile.v1";
 const DEFAULT_NICK="Странник";
 function normalizeNick(value){
  if(typeof value!=="string")return null;
  const nick=value.trim().replace(/\s+/g," ");
  const length=Array.from(nick).length;
  // Prevent invisible/control characters, markup delimiters and unsafe names.
  if(length<2||length>24||/[<>\x00-\x1f\x7f]/.test(nick))return null;
  return nick;
 }
 function fresh(){return {nickname:DEFAULT_NICK};}
 function load(getStorage){
  let storage,raw;
  try{
   storage=getStorage();
   if(!storage)return {profile:fresh(),available:false,blocked:false};
   raw=storage.getItem(KEY);
  }catch(_){return {profile:fresh(),available:false,blocked:false};}
  if(raw===null)return {profile:fresh(),available:true,blocked:false};
  try{
   const value=JSON.parse(raw);
   if(value&&value.version===1&&Object.keys(value).length===2&&
      normalizeNick(value.nickname)===value.nickname)
    return {profile:{nickname:value.nickname},available:true,blocked:false};
  }catch(_){}
  // Never overwrite malformed saved data automatically.
  return {profile:fresh(),available:false,blocked:true};
 }
 function save(profile,getStorage){
  const nick=normalizeNick(profile?.nickname);
  if(!nick)return false;
  try{
   const storage=getStorage();
   if(!storage)return false;
   const old=storage.getItem(KEY);
   if(old!==null){
    let parsed;
    try{parsed=JSON.parse(old);}catch(_){return false;}
    if(!parsed||parsed.version!==1||Object.keys(parsed).length!==2||
       normalizeNick(parsed.nickname)!==parsed.nickname)return false;
   }
   storage.setItem(KEY,JSON.stringify({version:1,nickname:nick}));
   return true;
  }catch(_){return false;}
 }
 function levelProgress(accountXp,xpCost,maxLevel){
  if(!Number.isSafeInteger(accountXp)||accountXp<0||!Number.isInteger(maxLevel)||
     maxLevel<1||typeof xpCost!=="function")return null;
  let remaining=accountXp,level=1;
  while(level<maxLevel){
   const needed=xpCost(level);
   if(!Number.isSafeInteger(needed)||needed<=0)return null;
   if(remaining<needed)
    return {level,current:remaining,required:needed,totalXp:accountXp,
     percent:Math.min(100,100*remaining/needed)};
   remaining-=needed;level++;
  }
  return {level,current:0,required:null,totalXp:accountXp,percent:100};
 }
 return Object.freeze({KEY,DEFAULT_NICK,normalizeNick,fresh,load,save,levelProgress});
})();
