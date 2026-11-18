/* LC-008D: first approved live payout, ACT I only. No replay/choice/farm rewards.
 * Lore and wallet persist separately: proof must be reread under the shared writer. */
const LoreActOneRewardCore=(()=>{
 "use strict";
 const SOURCE=Object.freeze({
  sourceId:"five-shadows-act-1",kind:"first-clear",
  reward:Object.freeze({currency:1500,accountXp:180,
   materials:Object.freeze({Fe:5,Le:6,Cl:8,Wo:1,Fa:3,Th:3,Gl:0})}),
  energyCost:0
 });
 const OCCURRENCE_ID="once";
 const RECEIPT_ID="first-clear:five-shadows-act-1:once";
 const DAY_KIND="first-clear";
 const isClaimed=profile=>Array.isArray(profile?.rewardReceipts)&&
  profile.rewardReceipts.some(row=>row.id===RECEIPT_ID);
 function savedProfile(storageProvider,heroes){
  if(typeof storageProvider!=="function"||!Array.isArray(heroes))return null;
  try{
   const storage=storageProvider();
   const raw=storage?.getItem(ProgressV3Core.KEY);
   return typeof raw==="string"?ProgressV3Core.validateActive(JSON.parse(raw),heroes):null;
  }catch(_){return null;}
 }
 function status({storageProvider,heroes}={}){
  const profile=savedProfile(storageProvider,heroes);
  if(!profile)return "blocked";
  if(isClaimed(profile))return "claimed";
  try{
   const storage=storageProvider();
   return LoreRewardProofCore.authorize({
    storage,sourceId:SOURCE.sourceId,kind:DAY_KIND,
    occurrenceId:OCCURRENCE_ID,count:1
   })?"claimable":"locked";
  }catch(_){return "blocked";}
 }
 async function claim({storageProvider,heroes,exclusive,day}={}){
  const result=await RewardPolicyCore.claim({
   source:SOURCE,occurrenceId:OCCURRENCE_ID,count:1,day,heroes,
   storageProvider,authorize:LoreRewardProofCore.authorize,exclusive
  });
  if(!result.ok)return result;
  // A verified disk snapshot is returned to replace the mutable runtime
  // after RewardPolicy has incremented revision; otherwise the NEXT ordinary
  // v3 save could erase the receipt or be rejected as stale.
  const profile=savedProfile(storageProvider,heroes);
  if(!profile||!isClaimed(profile)||profile.revision!==result.revision)
   return Object.freeze({ok:false,code:"REWARD_SYNC_FAILED"});
  const runtime=ProgressV3Core.toRuntime(profile,heroes);
  if(!runtime||runtime.saveRevision!==result.revision)
   return Object.freeze({ok:false,code:"REWARD_SYNC_FAILED"});
  return Object.freeze({ok:true,code:"CLAIMED",receiptId:RECEIPT_ID,
   revision:result.revision,runtime});
 }
 return Object.freeze({SOURCE,OCCURRENCE_ID,RECEIPT_ID,status,claim});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreActOneRewardCore;
