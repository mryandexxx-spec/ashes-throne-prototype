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
 // Completely provisional parameters; the production catalog remains empty.
 const CONFIG=Object.freeze({id:"net-004-pilot-not-production",capacity:3,
  intervalMs:1000,guaranteeAfter:3,focusWeight:1,masteryScore:3});
 const clone=x=>JSON.parse(JSON.stringify(x));
 const fail=code=>Object.freeze({ok:false,code});
 function create({storageProvider,exclusive,ownsLock,now,seed,
  catalog=Data.PROPOSAL_CATALOG}={}){
  if(typeof storageProvider!=="function"||typeof exclusive!=="function"||
   typeof ownsLock!=="function"||typeof now!=="function"||
   typeof seed!=="function"||!Data.validateCatalog(catalog))return null;
  let state=null,blocked=false,busy=false,opened=false;
  function mappedProvider(){
   const raw=storageProvider();
   if(!raw||typeof raw.getItem!=="function"||typeof raw.setItem!=="function")
    throw Error("NETWORK_PILOT_STORAGE_UNAVAILABLE");
   return {
    getItem(key){if(key!==Core.KEY)throw Error("PILOT_KEY_VIOLATION");
     return raw.getItem(KEY);},
    setItem(key,value){if(key!==Core.KEY)throw Error("PILOT_KEY_VIOLATION");
     return raw.setItem(KEY,value);}
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
     loaded=Core.load(mappedProvider,{seed:random,now:Math.max(0,instant-3000),
      config:CONFIG,catalog});
    }catch(_){return fail("LOAD_FAILED");}
    if(loaded.blocked||!loaded.state)return fail("LOAD_FAILED");
    state=loaded.state;opened=true;
    // A new test profile receives up to three test clues immediately.
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
    if(step==="finish")next=Core.finish(state);
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
  return Object.freeze({KEY,CONFIG,open,read,change,complete,
   availableOrders,canSimulate,
   isBlocked:()=>blocked,isBusy:()=>busy,isReady:()=>opened&&!blocked});
 }
 return Object.freeze({KEY,CONFIG,create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkPilotSession;
