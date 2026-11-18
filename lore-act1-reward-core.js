/* LC-008F: five approved Five Shadows first-clear rewards, one receipt per act.
 * Keep the LC-008D Act I exports for saved-game and test compatibility.
 * Proof is always reread from persisted lore while the shared wallet writer runs. */
const LoreActOneRewardCore=(()=>{
 "use strict";
 const OCCURRENCE_ID="once";
 const SOURCE=Object.freeze({
  sourceId:"five-shadows-act-1",kind:"first-clear",
  reward:Object.freeze({currency:1500,accountXp:180,
   materials:Object.freeze({Fe:5,Le:6,Cl:8,Wo:1,Fa:3,Th:3,Gl:0})}),
  energyCost:0
 });
 const makeSource=(act,currency,accountXp,materials)=>Object.freeze({
  sourceId:"five-shadows-act-"+act,kind:"first-clear",
  reward:Object.freeze({currency,accountXp,materials:Object.freeze(materials)}),
  energyCost:0
 });
 const sources=Object.freeze([
  SOURCE,
  makeSource(2,2000,230,{Fe:5,Le:5,Cl:10,Wo:1,Fa:4,Th:3,Gl:1}),
  makeSource(3,3000,280,{Fe:8,Le:7,Cl:8,Wo:2,Fa:5,Th:4,Gl:1}),
  makeSource(4,4000,350,{Fe:8,Le:8,Cl:10,Wo:2,Fa:6,Th:5,Gl:2}),
  makeSource(5,5000,460,{Fe:9,Le:10,Cl:10,Wo:2,Fa:6,Th:5,Gl:2})
 ]);
 const ACTS=Object.freeze(sources.map((source,index)=>Object.freeze({
  act:index+1,source,receiptId:"first-clear:"+source.sourceId+":"+OCCURRENCE_ID
 })));
 const RECEIPT_ID=ACTS[0].receiptId;
 const getAct=act=>Number.isInteger(act)&&act>=1&&act<=ACTS.length?ACTS[act-1]:null;
 const sourceForAct=act=>getAct(act)?.source||null;
 const isClaimed=(profile,act)=>Array.isArray(profile?.rewardReceipts)&&
  profile.rewardReceipts.some(row=>row.id===act.receiptId);
 function savedProfile(storageProvider,heroes){
  if(typeof storageProvider!=="function"||!Array.isArray(heroes))return null;
  try{
   const storage=storageProvider();
   const raw=storage?.getItem(ProgressV3Core.KEY);
   return typeof raw==="string"?ProgressV3Core.validateActive(JSON.parse(raw),heroes):null;
  }catch(_){return null;}
 }
 function statusForAct(act,{storageProvider,heroes}={}){
  const entry=getAct(act);
  if(!entry)return "blocked"; // Never authorize invented or future acts.
  const profile=savedProfile(storageProvider,heroes);
  if(!profile)return "blocked";
  if(isClaimed(profile,entry))return "claimed";
  try{
   const storage=storageProvider();
   return LoreRewardProofCore.authorize({
    storage,sourceId:entry.source.sourceId,kind:"first-clear",
    occurrenceId:OCCURRENCE_ID,count:1
   })?"claimable":"locked";
  }catch(_){return "blocked";}
 }
 async function claimForAct(act,{storageProvider,heroes,exclusive,day}={}){
  const entry=getAct(act);
  if(!entry)return Object.freeze({ok:false,code:"INVALID_ACT"});
  const result=await RewardPolicyCore.claim({
   source:entry.source,occurrenceId:OCCURRENCE_ID,count:1,day,heroes,
   storageProvider,authorize:LoreRewardProofCore.authorize,exclusive
  });
  if(!result.ok)return result;
  // The claim's verified write increments v3 revision. Return a validated
  // snapshot to update the original mutable game progress object in place.
  const profile=savedProfile(storageProvider,heroes);
  if(!profile||!isClaimed(profile,entry)||profile.revision!==result.revision||
     result.receiptId!==entry.receiptId)
   return Object.freeze({ok:false,code:"REWARD_SYNC_FAILED"});
  const runtime=ProgressV3Core.toRuntime(profile,heroes);
  if(!runtime||runtime.saveRevision!==result.revision)
   return Object.freeze({ok:false,code:"REWARD_SYNC_FAILED"});
  return Object.freeze({ok:true,code:"CLAIMED",receiptId:entry.receiptId,
   revision:result.revision,runtime});
 }
 // Existing act-I callers and tests retain the same API and exact receipt.
 const status=options=>statusForAct(1,options);
 const claim=options=>claimForAct(1,options);
 return Object.freeze({SOURCE,OCCURRENCE_ID,RECEIPT_ID,ACTS,sourceForAct,
  status,claim,statusForAct,claimForAct});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreActOneRewardCore;
