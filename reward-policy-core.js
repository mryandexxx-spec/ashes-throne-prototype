/* LC-008 / GEAR-REWARDS-007A — UNWIRED reward transaction contract.
   This module is NOT loaded by index.html. No live reward sources exist here.
   An exclusive lock shared by ALL wallet writers is required before integration. */
const RewardPolicyCore=(()=>{
 "use strict";
 const KEY="ashes-throne.progress.v3";
 const ID=/^[a-z0-9][a-z0-9._-]{0,79}$/;
 const KINDS=Object.freeze(["first-clear","best-stars","repeat","serial"]);
 const MATERIALS=Object.freeze(["Fe","Le","Cl","Wo","Fa","Th","Gl"]);
 const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
 const obj=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
 const nonneg=v=>Number.isSafeInteger(v)&&v>=0;
 const failure=code=>Object.freeze({ok:false,code});
 const clone=v=>JSON.parse(JSON.stringify(v));
 function validDay(day){
  if(typeof day!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;
  const parsed=new Date(day+"T00:00:00Z");
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===day;
 }
 function validSource(source){
  if(!obj(source)||!ID.test(source.sourceId||"")||!KINDS.includes(source.kind)||
    !obj(source.reward)||!nonneg(source.reward.currency)||
    !nonneg(source.reward.accountXp)||!obj(source.reward.materials)||
    Object.keys(source.reward.materials).some(id=>!MATERIALS.includes(id)||
      !nonneg(source.reward.materials[id]))||
    !nonneg(source.energyCost)||
    (source.kind==="serial"&&(source.energyCost!==0||source.maxPerDay!==undefined))||
    (source.reward.heroShards!==undefined&&(source.kind!=="serial"||
      !obj(source.reward.heroShards)||typeof StarCore==="undefined"||
      Object.keys(source.reward.heroShards).some(id=>
       !StarCore.IDS.includes(id)||!nonneg(source.reward.heroShards[id]))))||
    (source.maxPerDay!==undefined&&(!Number.isSafeInteger(source.maxPerDay)||source.maxPerDay<1)))
   return false;
  return source.reward.currency>0||source.reward.accountXp>0||
   Object.values(source.reward.materials).some(n=>n>0)||
   Object.values(source.reward.heroShards||{}).some(n=>n>0);
 }
 function receiptId(source,occurrenceId){
  return source.kind+":"+source.sourceId+":"+occurrenceId;
 }
 function resolve({source,occurrenceId,count=1,day,wallet}={}){
  if(!validSource(source))return failure("REWARDS_NOT_CONFIGURED");
  const serial=source.kind==="serial"?Number(occurrenceId):null;
  if(source.kind==="serial"&&(!nonneg(serial)||serial<1||
    String(serial)!==occurrenceId))return failure("INVALID_SERIAL");
  if(!ID.test(occurrenceId||""))return failure("INVALID_OCCURRENCE");
  if(!Number.isSafeInteger(count)||count<1||count>100||
   (source.kind!=="repeat"&&count!==1))return failure("INVALID_COUNT");
  if(!validDay(day))return failure("INVALID_DAY");
  if(!obj(wallet)||wallet.version!==3||!obj(wallet.materials)||
   !obj(wallet.energy)||!nonneg(wallet.currency)||!nonneg(wallet.accountXp)||
   !nonneg(wallet.energy.value))return failure("INVALID_WALLET");
  const rows=wallet.rewardReceipts===undefined?[]:wallet.rewardReceipts;
  if(typeof ProgressV3Core==="undefined"||!ProgressV3Core.validReceipts(rows))
   return failure("INVALID_RECEIPTS");
  const id=receiptId(source,occurrenceId);
  if(source.kind==="serial"){
   const ledger=wallet.networkLedger??{claimedThrough:0};
   if(!ProgressV3Core.validNetworkLedger(ledger))return failure("INVALID_NETWORK_LEDGER");
   if(serial<=ledger.claimedThrough)return failure("ALREADY_CLAIMED");
   if(serial!==ledger.claimedThrough+1)return failure("SERIAL_OUT_OF_ORDER");
  }else{
   if(rows.some(row=>row.id===id))return failure("ALREADY_CLAIMED");
   if(rows.length>=ProgressV3Core.MAX_REWARD_RECEIPTS)return failure("RECEIPT_CAPACITY");
  }
  if(source.maxPerDay!==undefined){
   const prior=rows.filter(row=>row.sourceId===source.sourceId);
   if(prior.some(row=>row.day>day))return failure("CLOCK_ROLLBACK");
   if(prior.filter(row=>row.day===day).reduce((n,row)=>n+row.count,0)+count>source.maxPerDay)
    return failure("DAILY_LIMIT");
  }
  const energy=source.energyCost*count;
  const currency=source.reward.currency*count;
  const accountXp=source.reward.accountXp*count;
  const materials={};
  if(!nonneg(energy)||!nonneg(currency)||!nonneg(accountXp)||
    wallet.energy.value<energy||
    !nonneg(wallet.currency+currency)||!nonneg(wallet.accountXp+accountXp))
   return failure("INSUFFICIENT_OR_INVALID_BALANCE");
  for(const key of MATERIALS){
   const delta=(source.reward.materials[key]||0)*count;
   if(!nonneg(delta)||!nonneg(wallet.materials[key])||
     !nonneg(wallet.materials[key]+delta))return failure("INSUFFICIENT_OR_INVALID_BALANCE");
   materials[key]=delta;
  }
  const heroShards=source.reward.heroShards||{};
  if(Object.keys(heroShards).length){
   if(typeof StarCore==="undefined")return failure("INVALID_HERO_SHARDS");
   const stars=wallet.heroStars??StarCore.fromLegacy(wallet.unlockedHeroes);
   if(!StarCore.valid(stars))return failure("INVALID_HERO_SHARDS");
   for(const [heroId,amount] of Object.entries(heroShards)){
    if(amount===0)continue;
    if(stars[heroId].rank===StarCore.MAX)
     return failure("SHARDS_AT_MAX_RANK_UNRESOLVED");
    if(!nonneg(stars[heroId].shards+amount))
     return failure("SHARD_BALANCE_OVERFLOW");
   }
  }
  return Object.freeze({ok:true,serial,
   receipt:source.kind==="serial"?null:Object.freeze({id,sourceId:source.sourceId,day,count}),
   delta:Object.freeze({energy,currency,accountXp,materials,heroShards})});
 }
 /* No localStorage compare-and-swap exists. A caller-provided exclusive lock is
    mandatory; without it claim fails closed. The proof callback MUST re-read
    and validate the durable mode save, including win/completion, star gate,
    run identity and any limits, before returning strictly true. */
 async function claim({source,occurrenceId,count=1,day,heroes,storageProvider,authorize,exclusive}={}){
  if(typeof exclusive!=="function")return failure("EXCLUSIVE_LOCK_REQUIRED");
  // Browser claims must participate in the SAME writer as all v3 saves.
  if(typeof window!=="undefined"&&typeof ProgressWriterCore!=="undefined"&&
     (!ProgressWriterCore.isOwner()||exclusive!==ProgressWriterCore.exclusive))
   return failure("EXCLUSIVE_LOCK_REQUIRED");
  if(typeof authorize!=="function")return failure("PROOF_REQUIRED");
  if(typeof storageProvider!=="function"||!Array.isArray(heroes))
   return failure("INVALID_ADAPTER");
  try{
   return await exclusive(async()=>{
    let storage,raw,profile;
    try{
     storage=storageProvider();
     if(!storage)return failure("STORAGE_UNAVAILABLE");
     raw=storage.getItem(KEY);
    }catch(_){return failure("WALLET_READ_FAILED");}
    if(raw===null)return failure("WALLET_NOT_STAGED");
    try{
     const parsed=JSON.parse(raw);
     profile=typeof ProgressV3Core==="undefined"?null:
      ProgressV3Core.validateActive(parsed,heroes);
    }catch(_){return failure("INVALID_WALLET");}
    if(!profile)return failure("INVALID_WALLET");
    const plan=resolve({source,occurrenceId,count,day,wallet:profile});
    if(!plan.ok)return plan;
    let authorized=false;
    try{
     authorized=(await authorize({storage,sourceId:source.sourceId,
      kind:source.kind,occurrenceId,count,day}))===true;
    }catch(_){authorized=false;}
    if(!authorized)return failure("PROOF_NOT_PERSISTED");
    // Guard against writers that do not yet participate in the exclusive lock.
    try{if(storage.getItem(KEY)!==raw)return failure("STALE_WALLET");}
    catch(_){return failure("WALLET_READ_FAILED");}
    const next=clone(profile),d=plan.delta;
    if(!nonneg((next.revision??0)+1))return failure("REVISION_OVERFLOW");
    next.revision=(next.revision??0)+1;
    next.currency+=d.currency;
    next.accountXp+=d.accountXp;
    next.energy.value-=d.energy;
    for(const key of MATERIALS)next.materials[key]+=d.materials[key];
    if(source.kind==="serial"){
     next.networkLedger={claimedThrough:plan.serial};
     if(Object.values(d.heroShards).some(amount=>amount>0)){
      if(typeof StarCore==="undefined")return failure("INVALID_HERO_SHARDS");
      if(next.heroStars===undefined)
       next.heroStars=StarCore.fromLegacy(next.unlockedHeroes);
      if(!next.heroStars)return failure("INVALID_HERO_SHARDS");
      for(const [heroId,amount] of Object.entries(d.heroShards)){
       if(amount>0&&!StarCore.add(next,heroId,amount))
        return failure("INVALID_HERO_SHARDS");
      }
     }
    }else next.rewardReceipts=(next.rewardReceipts||[]).concat([plan.receipt]);
    if(!ProgressV3Core.validateActive(next,heroes))return failure("INVALID_CANDIDATE");
    const encoded=JSON.stringify(next);
    try{
     storage.setItem(KEY,encoded);
     if(storage.getItem(KEY)!==encoded)return failure("SAVE_OUTCOME_UNKNOWN");
    }catch(_){return failure("SAVE_OUTCOME_UNKNOWN");}
    return Object.freeze(source.kind==="serial"?
     {ok:true,serial:plan.serial,revision:next.revision}:
     {ok:true,receiptId:plan.receipt.id,revision:next.revision});
   });
  }catch(_){return failure("EXCLUSIVE_LOCK_FAILED");}
 }
 return Object.freeze({KEY,KINDS,MATERIALS,validDay,validSource,receiptId,resolve,claim});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=RewardPolicyCore;
