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
   return {...npc,hp,protection,physicalAttack};
  });
 }
 return Object.freeze({KEY,ID,TITLE,SOURCE,RECEIPT,load,score,record,claimed,status,authorize,claim,enemies});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=MainCampaignCore;
