/* NET-004 [ПРЕДЛОЖЕНИЕ]: gated network pilot transaction controller.
 * Test fixtures are stored in ashes-throne.network.pilot.v1, NOT network.v1.
 * No real reward sources, hero shards, energy costs or production writes.
 * All mutations must execute inside ProgressWriterCore.exclusive.
 */
const NetworkPilotSession=(()=>{
 "use strict";
 const Core=typeof NetworkCore!=="undefined"?NetworkCore:require("./network-core.js");
 const Data=typeof NetworkData!=="undefined"?NetworkData:require("./network-data.js");
 const Adapter=typeof NetworkEncounterAdapter!=="undefined"?
  NetworkEncounterAdapter:require("./network-encounter-adapter.js");
 const KEY="ashes-throne.network.pilot.v1";
 const LIVE_CONFIG=Object.freeze({id:"net-007-balanced-b1",capacity:16,
  intervalMs:6*60*60*1000,guaranteeAfter:3,focusWeight:4,masteryScore:90});
 // Completely provisional parameters; the production catalog remains empty.
 const CONFIG=Object.freeze({id:"net-004-pilot-not-production",capacity:3,
  intervalMs:1000,guaranteeAfter:3,focusWeight:1,masteryScore:3});
 const clone=x=>JSON.parse(JSON.stringify(x));
 const fail=code=>Object.freeze({ok:false,code});
 function create({storageProvider,exclusive,ownsLock,now,seed,
  live=false,catalog=live?Data.LIVE_CATALOG:Data.PROPOSAL_CATALOG,
  heroes=null,day=null,onCredit=null}={}){
  if(typeof storageProvider!=="function"||typeof exclusive!=="function"||
   typeof ownsLock!=="function"||typeof now!=="function"||
   typeof seed!=="function"||!Data.validateCatalog(catalog))return null;
  let state=null,blocked=false,busy=false,opened=false;
  const settings=live?LIVE_CONFIG:CONFIG;
  const storeKey=live?Core.KEY:KEY;
  function mappedProvider(){
   const raw=storageProvider();
   if(!raw||typeof raw.getItem!=="function"||typeof raw.setItem!=="function")
    throw Error("NETWORK_PILOT_STORAGE_UNAVAILABLE");
   return {
    getItem(key){if(key!==Core.KEY)throw Error("PILOT_KEY_VIOLATION");
     return raw.getItem(storeKey);},
    setItem(key,value){if(key!==Core.KEY)throw Error("PILOT_KEY_VIOLATION");
     return raw.setItem(storeKey,value);}
   };
  }
  async function transaction(fn){
   if(blocked)return fail("SESSION_BLOCKED_RELOAD_REQUIRED");
   if(busy)return fail("OPERATION_IN_PROGRESS");
   if(!ownsLock()){blocked=true;return fail("WALLET_WRITER_NOT_OWNED");}
   busy=true;
   try{
    const outcome=await exclusive(()=>{
     if(!ownsLock())return fail("WALLET_WRITER_NOT_OWNED");
     return fn();
    });
    if(!outcome?.ok&&["WALLET_WRITER_NOT_OWNED","SAVE_FAILED","LOAD_FAILED"]
     .includes(outcome?.code))blocked=true;
    return outcome&&typeof outcome.ok==="boolean"?outcome:fail("INVALID_RESULT");
   }catch(_){blocked=true;return fail("EXCLUSIVE_LOCK_FAILED");}
   finally{busy=false;}
  }
  function persist(next){
   if(!next||!Core.validState(next))return fail("INVALID_TRANSITION");
   const saved=Core.save(next,mappedProvider,ownsLock);
   if(!saved.ok)return fail("SAVE_FAILED");
   state=saved.state;
   return Object.freeze({ok:true,state:clone(state)});
  }
  function read(){
   if(!opened||!state)return null;
   return clone(state);
  }
  async function open(){
   if(opened)return blocked?fail("SESSION_BLOCKED_RELOAD_REQUIRED"):
    Object.freeze({ok:true,state:read()});
   return transaction(()=>{
    let loaded;
    try{
     const instant=now(),random=seed();
     if(!Number.isSafeInteger(instant)||instant<0||
      !Number.isInteger(random)||random<0||random>0xffffffff)
      return fail("LOAD_FAILED");
     loaded=Core.load(mappedProvider,{seed:random,
      now:Math.max(0,instant-(live?4*settings.intervalMs:3000)),
      config:settings,catalog});
    }catch(_){return fail("LOAD_FAILED");}
    if(loaded.blocked||!loaded.state)return fail("LOAD_FAILED");
    state=loaded.state;opened=true;
    // First opening provides 4 live clues (3 pilot clues), with a real timestamp.
    // Existing profiles only receive elapsed arrivals, with regular capacity limits.
    const next=Core.accrue(state,now(),catalog,["gardens-over-abyss"]);
    if(!next)return fail("LOAD_FAILED");
    if(JSON.stringify(state)===JSON.stringify(next))
     return Object.freeze({ok:true,state:read()});
    return persist(next);
   });
  }
  async function change(step,arg){
   if(blocked)return fail("SESSION_BLOCKED_RELOAD_REQUIRED");
   if(!opened||!state)return fail("NOT_OPEN");
   return transaction(()=>{
    let next=null;
    if(step==="refresh")next=Core.accrue(state,now(),catalog,["gardens-over-abyss"]);
    if(step==="start")next=Core.start(state,arg);
    if(step==="prepare")next=Core.prepare(state,arg);
    if(step==="approach")next=Core.approach(state,arg);
    if(step==="abandon")next=Core.abandon(state);
    if(step==="finish"){
      const t=new Date(now()),weekday=(t.getUTCDay()+6)%7;
      const monday=Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate()-weekday);
      next=Core.finish(state,live?new Date(monday).toISOString().slice(0,10):null);
     }
    if(step==="order")next=Core.setOrder(state,arg,catalog,["gardens-over-abyss"]);
    if(step==="simulate")next=Core.simulate(state,arg,catalog,["gardens-over-abyss"]);
    if(!next)return fail("INVALID_TRANSITION");
    if(JSON.stringify(state)===JSON.stringify(next))
     return Object.freeze({ok:true,state:read()});
    return persist(next);
   });
  }
  // Only the verified CombatCore battle may produce S1 scoring.
  // Uses the same isolated pilot key; never touches wallet or live network.
  async function complete(battle){
   if(blocked)return fail("SESSION_BLOCKED_RELOAD_REQUIRED");
   if(!opened||!state||!battle)return fail("INVALID_BATTLE");
   return transaction(()=>{
    const next=Adapter.complete(state,battle);
    if(!next)return fail("INVALID_BATTLE_OUTCOME");
    return persist(next);
   });
  }
  function availableOrders(){
   if(!state||blocked)return [];
   const eligible=Data.eligibleTemplates(catalog,["gardens-over-abyss"],state.influence);
   if(!eligible)return [];
   const result=[],seen=new Set();
   for(const row of eligible)for(const [kind,targetId] of [
    ["type",row.type],["region",row.regionId],
    ...(row.materialId?[["material",row.materialId]]:[]),
    ...(row.heroId?[["hero",row.heroId]]:[])
   ]){
    const key=kind+":"+targetId;
    if(!seen.has(key)){seen.add(key);result.push({kind,targetId});}
   }
   return result;
  }
  function canSimulate(clueId){
   if(!state||blocked||!Number.isSafeInteger(clueId))return false;
   // Safe read-only dry run: never persists an unearned completion.
   return !!Core.simulate(state,clueId,catalog,["gardens-over-abyss"]);
  }
  // Live mode uses the existing serial wallet ledger. Completed clues remain
  // unpaid until their exact ordered RewardPolicy claim has succeeded.
  async function collect(){
   if(!live)return fail("NO_LIVE_REWARDS");
   if(blocked)return fail("SESSION_BLOCKED_RELOAD_REQUIRED");
   if(!opened||!state)return fail("NOT_OPEN");
   if(busy)return fail("OPERATION_IN_PROGRESS");
   if(!Array.isArray(heroes)||typeof day!=="function"||
    typeof NetworkRewardCore==="undefined"||
    typeof NetworkLiveEconomy==="undefined")return fail("INVALID_LIVE_ADAPTER");
   busy=true;
   let paid=0,currency=0,xp=0,shards=0,materials=0;
   try{
    let storage=storageProvider();
    if(!storage)return fail("STORAGE_UNAVAILABLE");
    const raw=storage.getItem("ashes-throne.progress.v3");
    const wallet=typeof raw==="string"?JSON.parse(raw):null;
    const through=wallet?.networkLedger?.claimedThrough??0;
    if(!Number.isSafeInteger(through)||through<0)return fail("INVALID_WALLET");
    // Track effective balance changes, not only catalog promises: rank-7 shard
    // compensation becomes currency instead of hero shards.
    let beforeCurrency=wallet.currency, beforeXp=wallet.accountXp;
    let previousStars=wallet.heroStars??{};
    if(!Number.isSafeInteger(beforeCurrency)||!Number.isSafeInteger(beforeXp))
     return fail("INVALID_WALLET");
    const entries=state.completed.filter(x=>x.serial>through);
    for(const entry of entries){
     const source=NetworkLiveEconomy.source(entry.rewardRef);
     if(!source)return fail("UNRECOGNIZED_REWARD");
     const result=await NetworkRewardCore.claim({serial:entry.serial,
      source,day:day(),heroes,storageProvider,exclusive});
     if(!result.ok){
      if(["SAVE_OUTCOME_UNKNOWN","REWARD_SYNC_FAILED","SESSION_HALTED_RELOAD_REQUIRED",
       "EXCLUSIVE_LOCK_FAILED"].includes(result.code))blocked=true;
      return fail(result.code);
     }
     const next=result.runtime;
     if(!Number.isSafeInteger(next.currency)||!Number.isSafeInteger(next.accountXp)||
      next.currency<beforeCurrency||next.accountXp<beforeXp)
      throw Error("NET007_INVALID_CREDITED_BALANCE");
     paid++;currency+=next.currency-beforeCurrency;xp+=next.accountXp-beforeXp;
     beforeCurrency=next.currency;beforeXp=next.accountXp;
     for(const heroId of Object.keys(source.reward.heroShards||{})){
      shards+=Math.max(0,(next.heroStars?.[heroId]?.shards??0)-
       (previousStars[heroId]?.shards??0));
     }
     previousStars=next.heroStars??{};
     materials+=Object.values(source.reward.materials).reduce((s,n)=>s+n,0);
     if(typeof onCredit==="function")onCredit(next,source.reward);
    }
    return Object.freeze({ok:true,paid,currency,xp,shards,materials});
   }catch(_){blocked=true;return fail("REWARD_SYNC_FAILED");}
   finally{busy=false;}
  }
  function pendingCount(){
   if(!live||!state)return 0;
   try{
    const storage=storageProvider();
    const wallet=JSON.parse(storage.getItem("ashes-throne.progress.v3"));
    const claimed=wallet.networkLedger?.claimedThrough??0;
    return state.completed.filter(x=>x.serial>claimed).length;
   }catch(_){return state.completed.length;}
  }
  return Object.freeze({KEY:storeKey,CONFIG:settings,open,read,change,complete,
   availableOrders,canSimulate,collect,pendingCount,isLive:()=>live,
   isBlocked:()=>blocked,isBusy:()=>busy,isReady:()=>opened&&!blocked});
 }
 return Object.freeze({KEY,CONFIG,LIVE_CONFIG,create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkPilotSession;
