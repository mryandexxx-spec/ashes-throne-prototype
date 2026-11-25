/* CAM-001B: main campaign M1 only. Separate proof; wallet receipt is authoritative.
 * Test encounter/reward/third star numbers are provisional, not new canon. */
const MainCampaignCore=(()=>{
 "use strict";
 const KEY="ashes-throne.main-campaign.v1",ID="main-cam-001-m1";
 const TITLE="Пролёт без отметки";
 const SOURCE=Object.freeze({sourceId:ID,kind:"first-clear",energyCost:0,
  reward:Object.freeze({currency:40,accountXp:0,materials:Object.freeze({})})});
 const RECEIPT="first-clear:"+ID+":once";
 function load(provider){
  try{
   const storage=provider();if(!storage)return null;
   const raw=storage.getItem(KEY);
   if(raw===null)return {version:1,best:0};
   const data=JSON.parse(raw);
   return data?.version===1&&Number.isInteger(data.best)&&data.best>=0&&data.best<=3?{version:1,best:data.best}:null;
  }catch(_){return null;}
 }
 function score(battle){
  if(!battle||battle.active!==false||battle.winner!=="ally"||!Array.isArray(battle.fighters))return 0;
  const allies=battle.fighters.filter(f=>f.side==="ally");
  if(!allies.length||!allies.some(f=>f.hp>0))return 0;
  if(!allies.every(f=>f.hp>0))return 1;
  return Number.isSafeInteger(battle.allyActions)&&battle.allyActions<=10?3:2;
 }
 function record(battle,provider){
  const earned=score(battle),before=load(provider);
  if(!before)return {ok:false,earned,best:0};
  if(!earned)return {ok:true,earned,best:before.best};
  if(typeof window!=="undefined"&&(typeof ProgressWriterCore==="undefined"||
     !ProgressWriterCore.canPersist()))return {ok:false,earned,best:before.best};
  const best=Math.max(before.best,earned);
  if(best===before.best)return {ok:true,earned,best};
  try{
   const storage=provider(),encoded=JSON.stringify({version:1,best});
   storage.setItem(KEY,encoded);
   return storage.getItem(KEY)===encoded?{ok:true,earned,best}:{ok:false,earned,best:before.best};
  }catch(_){return {ok:false,earned,best:before.best};}
 }
 function claimed(wallet){return Array.isArray(wallet?.rewardReceipts)&&wallet.rewardReceipts.some(r=>r.id===RECEIPT);}
 function status(proof,wallet){
  if(!proof)return "blocked";
  if(claimed(wallet))return proof.best>0?"claimed":"blocked";
  return proof.best>0?"claimable":"locked";
 }
 function authorize({storage,sourceId,kind,occurrenceId,count}){
  return sourceId===ID&&kind==="first-clear"&&occurrenceId==="once"&&count===1&&
   (load(()=>storage)?.best||0)>0;
 }
 async function claim(options){
  const {storageProvider,heroes,exclusive,day}=options;
  const result=await RewardPolicyCore.claim({source:SOURCE,occurrenceId:"once",count:1,day,heroes,storageProvider,authorize,exclusive});
  if(!result.ok)return result;
  try{
   const profile=ProgressV3Core.validateActive(JSON.parse(storageProvider().getItem(ProgressV3Core.KEY)),heroes);
   const runtime=profile&&ProgressV3Core.toRuntime(profile,heroes);
   if(!runtime||!claimed(runtime)||runtime.saveRevision!==result.revision||result.receiptId!==RECEIPT)
    return {ok:false,code:"REWARD_SYNC_FAILED"};
   return {ok:true,runtime};
  }catch(_){return {ok:false,code:"REWARD_SYNC_FAILED"};}
 }
 function enemies(npcs){
  // Starter encounter only: do not change shared NPC profiles or scale to owned heroes.
  return [["npc-pass-guard","npc-cam-m1-guard",90,15,14],["npc-trail-interceptor","npc-cam-m1-interceptor",65,10,19]].map(([archetype,id,hp,protection,physicalAttack])=>{
   const npc=npcs.spawn(archetype,{instanceId:id});
   if(!npc)throw Error("CAM001B_NPC_MISSING");
   return {...npc,hp,protection,maxProtection:protection,physicalAttack,atk:physicalAttack};
  });
 }
 
 // CAM-002-B foundation: per-mission proof keys, same atomic wallet receipt.
 // No new mission is reachable from the live UI until its battle adapter is wired.
 const II_ID="main-cam-002-m1";
 const II_SOURCE=Object.freeze({sourceId:II_ID,kind:"first-clear",energyCost:0,
  reward:Object.freeze({currency:0,accountXp:0,materials:Object.freeze({}),heroGrants:Object.freeze(["nada"])})});
 const MISSIONS=Object.freeze([
  Object.freeze({id:ID,key:KEY,source:SOURCE,receipt:RECEIPT,previous:null}),
  Object.freeze({id:II_ID,key:"ashes-throne.main-campaign.002-m1.v1",source:II_SOURCE,receipt:"first-clear:"+II_ID+":once",previous:ID})
 ]);
 function mission(id){return MISSIONS.find(m=>m.id===id)||null;}
 function proofFor(id,provider){
  const m=mission(id);if(!m)return null;
  if(id===ID)return load(provider);
  try{
   const storage=provider();if(!storage)return null;
   const raw=storage.getItem(m.key);
   if(raw===null)return {version:1,best:0};
   const data=JSON.parse(raw);
   return data?.version===1&&data.missionId===id&&Number.isInteger(data.best)&&data.best>=0&&data.best<=3?
    {version:1,best:data.best}:null;
  }catch(_){return null;}
 }
 function hasReceipt(m,wallet){
  return Array.isArray(wallet?.rewardReceipts)&&wallet.rewardReceipts.some(r=>r.id===m.receipt&&r.sourceId===m.id);
 }
 function statusFor(id,provider,wallet){
  const m=mission(id);if(!m)return "blocked";
  const proof=proofFor(id,provider);if(!proof)return "blocked";
  if(m.previous){
   const previous=statusFor(m.previous,provider,wallet);
   if(previous!=="claimed")return proof.best>0||hasReceipt(m,wallet)||previous==="blocked"?"blocked":"locked";
  }
  if(hasReceipt(m,wallet))return proof.best>0&&(!m.source.reward.heroGrants||
   (typeof StarCore!=="undefined"&&m.source.reward.heroGrants.every(hero=>StarCore.rankOf(wallet,hero)>0)))?"claimed":"blocked";
  return proof.best>0?"claimable":"ready";
 }
 function readWallet(provider,heroes){
  try{
   const raw=provider().getItem(ProgressV3Core.KEY);
   return raw===null?null:ProgressV3Core.validateActive(JSON.parse(raw),heroes);
  }catch(_){return null;}
 }
 // The caller must use the immutable mission identity captured when the battle starts.
 // This is local progression, not an anti-cheat server boundary.
 function recordFor(id,battle,provider,heroes){
  const m=mission(id);if(!m)return {ok:false,earned:0,best:0};
  if(id===ID)return record(battle,provider);
  const proof=proofFor(id,provider),wallet=readWallet(provider,heroes);
  const earned=score(battle);
  if(!proof||!wallet)return {ok:false,earned,best:proof?.best||0};
  const current=statusFor(id,provider,wallet);
  if(current==="blocked"||current==="locked")return {ok:false,earned:0,best:proof.best};
  if(!earned)return {ok:true,earned:0,best:proof.best};
  if(typeof window!=="undefined"&&(typeof ProgressWriterCore==="undefined"||
    !ProgressWriterCore.canPersist()))return {ok:false,earned,best:proof.best};
  const best=Math.max(proof.best,earned);
  if(best===proof.best)return {ok:true,earned,best};
  try{
   const storage=provider(),encoded=JSON.stringify({version:1,missionId:id,best});
   storage.setItem(m.key,encoded);
   return storage.getItem(m.key)===encoded?{ok:true,earned,best}:{ok:false,earned,best:proof.best};
  }catch(_){return {ok:false,earned,best:proof.best};}
 }
 async function claimFor(id,options){
  const m=mission(id);if(!m)return {ok:false,code:"UNKNOWN_MISSION"};
  if(id===ID)return claim(options);
  const {storageProvider,heroes,exclusive,day}=options;
  const result=await RewardPolicyCore.claim({source:m.source,occurrenceId:"once",count:1,day,heroes,storageProvider,exclusive,
   authorize:({storage,sourceId,kind,occurrenceId,count})=>{
    const provider=()=>storage,wallet=readWallet(provider,heroes);
    return !!wallet&&sourceId===id&&kind==="first-clear"&&occurrenceId==="once"&&count===1&&statusFor(id,provider,wallet)==="claimable";
   }});
  if(!result.ok)return result;
  try{
   const profile=readWallet(storageProvider,heroes);
   const runtime=profile&&ProgressV3Core.toRuntime(profile,heroes);
   if(!runtime||statusFor(id,storageProvider,runtime)!=="claimed"||
      runtime.saveRevision!==result.revision||result.receiptId!==m.receipt||
      m.source.reward.heroGrants.some(hero=>!(StarCore.rankOf(runtime,hero)>0)))
    return {ok:false,code:"REWARD_SYNC_FAILED"};
   return {ok:true,runtime};
  }catch(_){return {ok:false,code:"REWARD_SYNC_FAILED"};}
 }
 return Object.freeze({KEY,ID,TITLE,SOURCE,RECEIPT,load,score,record,claimed,status,authorize,claim,enemies,II_ID,MISSIONS,mission,proofFor,statusFor,recordFor,claimFor});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=MainCampaignCore;
