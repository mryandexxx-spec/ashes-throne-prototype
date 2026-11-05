/* Campaign-001: one demo mission. Saved separately to preserve Save-001 v1 progress. */
const CampaignCore=(()=>{
 "use strict";
 const KEY="ashes-throne.campaign.v1";
 const VERSION=1;
 const MISSION_ID="black-pass-ambush";
 function validate(data){
  if(!data||typeof data!=="object"||Array.isArray(data)||data.version!==VERSION)return null;
  if(!data.completed||typeof data.completed!=="object"||Array.isArray(data.completed))return null;
  if(Object.keys(data.completed).length!==1||data.completed[MISSION_ID]!==true&&data.completed[MISSION_ID]!==false)return null;
  return {completed:{[MISSION_ID]:data.completed[MISSION_ID]}};
 }
 function fresh(){return {completed:{[MISSION_ID]:false}};}
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
   storage.setItem(KEY,JSON.stringify({version:VERSION,completed:{[MISSION_ID]:campaign.completed[MISSION_ID]===true}}));
   return true;
  }catch(error){return false;}
 }
 function complete(campaign,battle){
  if(!battle||battle.active||battle.winner!=="ally"||campaign.completed[MISSION_ID])return false;
  campaign.completed[MISSION_ID]=true;
  return true;
 }
 return Object.freeze({KEY,VERSION,MISSION_ID,validate,fresh,load,save,complete});
})();
