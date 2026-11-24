/* FIRSTSESSION P1-A: isolated first-play checkpoint and proof for one wallet receipt. */
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
 // P0-D: derive the next suggestion from existing checkpoints, never grant rewards.
 // A full skip has choice=null; only a real completed first victory qualifies.
 function followUp(state,operations,available){
  if(!valid(state)||state.phase!=="done"||state.choice===null)return null;
  if(!available)return "unavailable";
  if(!operations||!Array.isArray(operations.history))return "unavailable";
  if(operations.history.some(e=>e.outcome==="success"&&e.ledgerSecured===true))return null;
  return operations.active?"resume":"available";
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
 // P1-A prototype reward budget: enough for the existing L1 -> L2 purchase (39).
 // The amount is test content, not an approved economy curve.
 const REWARD_SOURCE=Object.freeze({sourceId:"first-report",kind:"first-clear",
  reward:Object.freeze({currency:40,accountXp:0,materials:Object.freeze({})}),energyCost:0});
 const REWARD_OCCURRENCE="once",REWARD_RECEIPT="first-clear:first-report:once";
 const wonProof=s=>valid(s)&&s.phase==="done"&&s.choice!==null;
 const rewardClaimed=p=>Array.isArray(p?.rewardReceipts)&&p.rewardReceipts.some(row=>row.id===REWARD_RECEIPT);
 function authorizeReward({storage,sourceId,kind,occurrenceId,count}={}){
  if(sourceId!==REWARD_SOURCE.sourceId||kind!==REWARD_SOURCE.kind||
     occurrenceId!==REWARD_OCCURRENCE||count!==1)return false;
  try{return wonProof(JSON.parse(storage.getItem(KEY)));}catch(_){return false;}
 }
 function rewardStatus(state,profile,available){
  if(!wonProof(state))return "locked";
  if(rewardClaimed(profile))return "claimed";
  return available&&profile?.saveVersion===3?"claimable":"blocked";
 }
 async function claimReward({storageProvider,heroes,exclusive,day}={}){
  const result=await RewardPolicyCore.claim({
   source:REWARD_SOURCE,occurrenceId:REWARD_OCCURRENCE,count:1,day,heroes,
   storageProvider,authorize:authorizeReward,exclusive
  });
  if(!result.ok)return result;
  try{
   const profile=ProgressV3Core.validateActive(JSON.parse(storageProvider().getItem(ProgressV3Core.KEY)),heroes);
   if(!profile||!rewardClaimed(profile)||profile.revision!==result.revision||
      result.receiptId!==REWARD_RECEIPT)return {ok:false,code:"REWARD_SYNC_FAILED"};
   const runtime=ProgressV3Core.toRuntime(profile,heroes);
   return runtime&&runtime.saveRevision===result.revision?
    {ok:true,receiptId:result.receiptId,runtime}:{ok:false,code:"REWARD_SYNC_FAILED"};
  }catch(_){return {ok:false,code:"REWARD_SYNC_FAILED"};}
 }
 return Object.freeze({KEY,CHOICES,EFFECTS,PHASES,fresh,valid,load,save,choose,prepare,start,finish,complete,skip,followUp,resetGameStorage,
  REWARD_SOURCE,REWARD_OCCURRENCE,REWARD_RECEIPT,wonProof,rewardClaimed,authorizeReward,rewardStatus,claimReward});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=FirstPlayCore;
