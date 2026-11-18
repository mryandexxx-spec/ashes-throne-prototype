/* NET-002: isolated, unwired network payout adapter.
 * No live reward tables, UI calls, combat changes or approved numeric balance.
 * Only a verified completed network.v1 entry can authorize a serial payout.
 * The caller must hold the SAME ProgressWriterCore Web Lock as other v3 writers. */
const NetworkRewardCore=(()=>{
 "use strict";
 const Network=typeof NetworkCore!=="undefined"?NetworkCore:require("./network-core.js");
 const Rewards=typeof RewardPolicyCore!=="undefined"?RewardPolicyCore:require("./reward-policy-core.js");
 const V3=typeof ProgressV3Core!=="undefined"?ProgressV3Core:require("./progress-v3-core.js");
 let halted=false;
 const fail=code=>Object.freeze({ok:false,code});
 const int=n=>Number.isSafeInteger(n)&&n>=0;
 const uncertain=new Set(["SAVE_OUTCOME_UNKNOWN","STALE_WALLET","WALLET_READ_FAILED",
  "INVALID_WALLET","EXCLUSIVE_LOCK_FAILED","REWARD_SYNC_FAILED"]);
 function readNetwork(storage){
  try{
   const raw=storage?.getItem(Network.KEY);
   if(typeof raw!=="string")return null;
   const data=JSON.parse(raw);
   return Network.validState(data)?data:null;
  }catch(_){return null;}
 }
 function prove({storage,sourceId,kind,occurrenceId,count}){
  const serial=Number(occurrenceId);
  if(kind!=="serial"||count!==1||!int(serial)||serial<1||
   String(serial)!==occurrenceId||typeof sourceId!=="string")return false;
  const state=readNetwork(storage);
  if(!state)return false;
  const completed=state.completed.find(x=>x.serial===serial);
  // Both legitimate manually won and mastered-clue simulated completions
  // use the same ordered serial ledger. No reward is configured in NET-005.
  // NetworkCore.validState also enforces score=0 for simulated entries.
  return !!completed&&completed.status==="done"&&
   ["manual","simulated"].includes(completed.kind)&&
   (completed.kind!=="simulated"||
    (typeof completed.masteryKey==="string"&&
     Network.hasMasteryKey(state,completed.masteryKey)))&&
   completed.rewardRef===sourceId;
 }
 function readWallet(storage,heroes){
  try{
   const raw=storage?.getItem(V3.KEY);
   return typeof raw==="string"?V3.validateActive(JSON.parse(raw),heroes):null;
  }catch(_){return null;}
 }
 // A failed or ambiguous write must stop the session; only reload resets it.
 async function claim({serial,source,day,heroes,storageProvider,exclusive}={}){
  if(halted)return fail("SESSION_HALTED_RELOAD_REQUIRED");
  if(!int(serial)||serial<1)return fail("INVALID_SERIAL");
  if(!source||source.kind!=="serial"||!Rewards.validSource(source))
   return fail("REWARDS_NOT_CONFIGURED");
  if(typeof storageProvider!=="function"||!Array.isArray(heroes))
   return fail("INVALID_ADAPTER");
  const result=await Rewards.claim({
   source,occurrenceId:String(serial),count:1,day,heroes,storageProvider,
   exclusive,authorize:prove
  });
  if(!result.ok){
   if(uncertain.has(result.code))halted=true;
   return result;
  }
  const wallet=readWalletFromProvider(storageProvider,heroes);
  if(!wallet||!wallet.networkLedger||wallet.networkLedger.claimedThrough<serial||
   !int(wallet.revision??0)||(wallet.revision??0)<result.revision){
   halted=true;
   return fail("REWARD_SYNC_FAILED");
  }
  const runtime=V3.toRuntime(wallet,heroes);
  if(!runtime){
   halted=true;
   return fail("REWARD_SYNC_FAILED");
  }
  return Object.freeze({ok:true,serial,revision:wallet.revision,runtime});
 }
 function readWalletFromProvider(provider,heroes){
  try{return readWallet(provider(),heroes);}catch(_){return null;}
 }
 // Compact only already credited network results. A failed network save cannot
 // reverse the wallet payment, so the function reports the failure separately.
 // This does not grant a reward, and never removes unpaid completed operations.
 async function compact({heroes,storageProvider,exclusive,ownsLock}={}){
  if(halted)return fail("SESSION_HALTED_RELOAD_REQUIRED");
  if(typeof exclusive!=="function"||typeof ownsLock!=="function")
   return fail("EXCLUSIVE_LOCK_REQUIRED");
  if(typeof window!=="undefined"&&typeof ProgressWriterCore!=="undefined"&&
   (exclusive!==ProgressWriterCore.exclusive||ownsLock!==ProgressWriterCore.isOwner))
   return fail("EXCLUSIVE_LOCK_REQUIRED");
  if(!Array.isArray(heroes)||typeof storageProvider!=="function")
   return fail("INVALID_ADAPTER");
  try{
   return await exclusive(()=>{
    let storage;
    try{storage=storageProvider();}catch(_){return fail("STORAGE_UNAVAILABLE");}
    const wallet=readWallet(storage,heroes),network=readNetwork(storage);
    if(!wallet||!network)return fail("INVALID_SAVED_STATE");
    const claimed=wallet.networkLedger?.claimedThrough??0;
    if(!int(claimed)||claimed>=network.nextCompletionId)
     return fail("INCONSISTENT_SERIAL_LEDGER");
    const next=Network.compactCompleted(network,claimed);
    if(!next)return fail("INVALID_SAVED_STATE");
    if(next.completed.length===network.completed.length)
     return Object.freeze({ok:true,pruned:0,revision:network.revision});
    const saved=Network.save(next,storageProvider,ownsLock);
    if(!saved.ok){
     if(["uncertain-storage-write","readback-mismatch"].includes(saved.reason))
      halted=true;
     return fail("NETWORK_COMPACTION_FAILED");
    }
    return Object.freeze({ok:true,pruned:network.completed.length-next.completed.length,
     revision:saved.state.revision});
   });
  }catch(_){halted=true;return fail("EXCLUSIVE_LOCK_FAILED");}
 }
 return Object.freeze({claim,prove,compact,readNetwork,isHalted:()=>halted});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkRewardCore;
