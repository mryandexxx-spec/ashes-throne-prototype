/* Campaign-Stars-001: local mission completion + best star record.
   Read legacy Campaign-001 v1 without discarding cleared missions. */
const CampaignCore=(()=>{
 "use strict";
 const KEY="ashes-throne.campaign.v1";
 const VERSION=2;
 const MISSION_ID="black-pass-ambush";
 const own=(x,id)=>Object.prototype.hasOwnProperty.call(x,id);
 const object=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
 const ids=()=>MissionData.all().map(m=>m.id);
 function fresh(){
  return {completed:Object.fromEntries(ids().map(id=>[id,false])),
          bestStars:Object.fromEntries(ids().map(id=>[id,0]))};
 }
 function validate(data){
  if(!object(data)||!object(data.completed)||(data.version!==1&&data.version!==VERSION))return null;
  if(data.version===VERSION&&!object(data.bestStars))return null;
  if(Object.keys(data.completed).some(id=>!ids().includes(id)))return null;
  if(data.version===VERSION&&Object.keys(data.bestStars).some(id=>!ids().includes(id)))return null;
  const result=fresh();
  for(const id of ids()){
   if(!own(data.completed,id))continue; // mission added in a future update
   const done=data.completed[id];
   if(typeof done!=="boolean")return null;
   result.completed[id]=done;
   if(data.version===1){
    // Previous build knows only completion, not whether 2/3 stars were met.
    result.bestStars[id]=done?1:0;
   }else{
    const stars=data.bestStars[id];
    if(!Number.isInteger(stars)||stars<0||stars>3||done!==(stars>0))return null;
    result.bestStars[id]=stars;
   }
  }
  return result;
 }
 function load(getStorage){
  const fallback=fresh();
  try{
   const storage=getStorage();
   if(!storage)return {campaign:fallback,available:false};
   const raw=storage.getItem(KEY);
   return {campaign:raw===null?fallback:validate(JSON.parse(raw))||fallback,available:true};
  }catch(error){return {campaign:fallback,available:false};}
 }
 function save(campaign,getStorage){
  try{
   const storage=getStorage();
   if(!storage)return false;
   const completed={},bestStars={};
   for(const id of ids()){
    const stars=campaign.bestStars[id]||0;
    if(!Number.isInteger(stars)||stars<0||stars>3)return false;
    bestStars[id]=stars;
    completed[id]=stars>0;
   }
   storage.setItem(KEY,JSON.stringify({version:VERSION,completed,bestStars}));
   return true;
  }catch(error){return false;}
 }
 // Returns earned stars and whether persisted campaign state improved.
 function recordResult(campaign,missionId,battle){
  const earned=MissionData.score(missionId,battle);
  if(!own(campaign.bestStars,missionId))return {earned:0,best:0,improved:false};
  const before=campaign.bestStars[missionId];
  const best=Math.max(before,earned);
  if(best!==before){
   campaign.bestStars[missionId]=best;
   campaign.completed[missionId]=true;
  }
  return {earned,best,improved:best!==before};
 }
 // Retain old first-clear helper for Campaign-001 regression clients.
 function complete(campaign,battle){
  if(!battle||battle.active||battle.winner!=="ally"||campaign.completed[MISSION_ID])return false;
  campaign.completed[MISSION_ID]=true;
  campaign.bestStars[MISSION_ID]=Math.max(campaign.bestStars[MISSION_ID],1);
  return true;
 }
 return Object.freeze({KEY,VERSION,MISSION_ID,validate,fresh,load,save,complete,recordResult});
})();
