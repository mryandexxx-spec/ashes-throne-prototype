/* NET-008A [ПРЕДЛОЖЕНИЕ]: a solo weekly threat using CombatCore and the existing wallet.
 * Client-side integrity is not anti-cheat: device time and localStorage are user-controlled. */
const WeeklyThreatCore=(()=>{
 "use strict";
 const KEY="ashes-throne.weekly.v1",NETWORK_KEY="ashes-throne.network.v1",MS=86400000;
 const Score=typeof NetworkScoreCore!=="undefined"?NetworkScoreCore:require("./network-score-core.js");
 const Npc=typeof NpcEnemyData!=="undefined"?NpcEnemyData:require("./npc-enemy-data.js");
 const Rewards=typeof RewardPolicyCore!=="undefined"?RewardPolicyCore:require("./reward-policy-core.js");
 const V3=typeof ProgressV3Core!=="undefined"?ProgressV3Core:require("./progress-v3-core.js");
 const Network=typeof NetworkCore!=="undefined"?NetworkCore:require("./network-core.js");
 const VARIANTS=Object.freeze([
  Object.freeze({id:"watch",title:"Срыв дозорного сигнала",goal:"Сначала обезвредить сигнальщика, затем старшего дозора",enemies:["npc-route-signaller","npc-watch-captain","npc-pass-guard","npc-ridge-slinger","npc-field-medic"]}),
  Object.freeze({id:"supplies",title:"Перехват опасного груза",goal:"Сначала остановить полевого перевязчика",enemies:["npc-field-medic","npc-pass-guard","npc-trail-interceptor","npc-watch-captain","npc-ridge-slinger"]}),
  Object.freeze({id:"ridge",title:"Засада на уступах",goal:"Сначала остановить сигнальщика под прикрытием пращника",enemies:["npc-route-signaller","npc-ridge-slinger","npc-watch-captain","npc-pass-guard","npc-trail-interceptor"]})
 ]);
 // Economic model B experiment; all drops are the seven existing G materials.
 const TIERS=Object.freeze([
  Object.freeze({score:60,currency:5000,xp:450,materials:Object.freeze({Fe:18,Le:18,Cl:18,Wo:8,Fa:18,Th:18,Gl:8})}),
  Object.freeze({score:75,currency:3000,xp:250,materials:Object.freeze({Fe:12,Le:12,Cl:12,Wo:10,Fa:12,Th:12,Gl:10})}),
  Object.freeze({score:90,currency:2000,xp:200,materials:Object.freeze({Fe:10,Le:10,Cl:10,Wo:10,Fa:10,Th:10,Gl:12})})
 ]);
 const int=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const fail=code=>Object.freeze({ok:false,code});
 function weekStart(now){
  if(!int(now)||now>8640000000000000)return null;
  const d=new Date(now),day=d.getUTCDay();
  return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-(day+6)%7);
 }
 function weekId(start){return new Date(start).toISOString().slice(0,10);}
 function variant(start){return VARIANTS[Math.floor(start/(7*MS))%VARIANTS.length];}
 function validWin(w){return !!w&&int(w.weekStart)&&weekStart(w.weekStart)===w.weekStart&&
  int(w.bestScore,60)&&w.bestScore<=100;}
 function valid(s){
  return !!s&&s.version===1&&int(s.revision)&&int(s.weekStart)&&
   weekStart(s.weekStart)===s.weekStart&&int(s.lastSeenAt)&&int(s.attempts)&&
   int(s.bestScore)&&s.bestScore<=100&&Array.isArray(s.history)&&
   s.history.length<=520&&s.history.every(validWin)&&
   new Set(s.history.map(x=>x.weekStart)).size===s.history.length&&
   s.history.every(x=>x.weekStart<s.weekStart)&&
   (s.active===null||!!s.active&&["survey","cover"].includes(s.active.preparation)&&
    int(s.active.intel)&&s.active.intel<=3&&
    int(s.active.attempt,1)&&s.active.attempt===s.attempts);
 }
 function fresh(now){const start=weekStart(now);return {version:1,revision:0,
  weekStart:start,lastSeenAt:now,attempts:0,bestScore:0,active:null,history:[]};}
 function roll(s,now){
  if(!valid(s)||!int(now)||now<s.lastSeenAt)return null;
  const start=weekStart(now),next=clone(s);
  if(start>s.weekStart){
   if(s.bestScore>=60)next.history.push({weekStart:s.weekStart,bestScore:s.bestScore});
   if(next.history.length>520)next.history=next.history.slice(-520);
   next.weekStart=start;next.attempts=0;next.bestScore=0;next.active=null;
  }
  next.lastSeenAt=now;
  return valid(next)?next:null;
 }
 function plan(s){
  if(!valid(s)||!s.active)return null;
  const v=variant(s.weekStart),a=s.active,first=v.enemies.map((id,i)=>{
   const unit=Npc.spawn(id,{instanceId:"npc-week-"+(i+1),level:45,stars:1,gearTier:1,skillLevel:3});
   if(!unit)return null;
   // Choice changes the battle itself. Intel deepens the chosen advantage;
   // it does not invent extra abilities or alter CombatCore's rules.
   const multiplier=a.preparation==="survey"&&i===0?
    (a.intel>=2?.76:.90):1;
   const attackScale=a.preparation==="cover"?(a.intel>=2?.78:.90):1;
   return {...unit,hp:Math.max(1,Math.round(unit.hp*multiplier)),
    maxHp:Math.max(1,Math.round(unit.hp*multiplier)),
    physicalAttack:Math.max(1,Math.round(unit.physicalAttack*attackScale)),
    atk:Math.max(1,Math.round(unit.physicalAttack*attackScale))};
  });
  if(first.some(x=>!x))return null;
  const seed=(s.weekStart+Math.imul(a.attempt,2654435761))>>>0;
  return {variant:v,first,binding:{weekStart:s.weekStart,attempt:a.attempt,
   preparation:a.preparation,intel:a.intel,seed,wave:0},options:{rngSeed:seed}};
 }
 function startBattle(s,allies,combat,leaderId=null){
  const p=plan(s);
  if(!p||!combat||!Array.isArray(allies)||!allies.length||allies.length>5||
   new Set(allies.map(x=>x.id)).size!==allies.length||
   allies.some(x=>x.side!=="ally"||!(x.hp>0)))return null;
  try{
   const battle=combat.createBattle([...allies,...p.first],[],{
    ...p.options,...(leaderId?{leaderId}:{})});
   battle.weeklyBinding={...p.binding,allyIds:allies.map(x=>x.id)};
   if(!Score.attach(battle,p))return null;
   return {plan:p,battle};
  }catch(_){return null;}
 }
 function result(s,battle){
  const p=plan(s);
  if(!p||!battle||battle.active!==false||
   !["ally","enemy"].includes(battle.winner)||battle.totalWaves!==1||
   battle.wave!==1||!Array.isArray(battle.pendingWaves)||battle.pendingWaves.length||
   JSON.stringify(battle.weeklyBinding)!==JSON.stringify({...p.binding,
    allyIds:battle.fighters.filter(x=>x.side==="ally").map(x=>x.id)})||
   JSON.stringify(battle.fighters.filter(x=>x.side==="enemy").map(x=>x.archetypeId))!==
    JSON.stringify(p.variant.enemies))return null;
  const next=clone(s);
  if(battle.winner==="enemy"){
   if(battle.fighters.some(x=>x.side==="ally"&&x.hp>0))return null;
   next.active=null;
   return {state:next,score:0,win:false};
  }
  const summary=Score.summarize(battle,0);
  if(!summary)return null;
  next.bestScore=Math.max(next.bestScore,summary.score);
  next.active=null;
  return {state:next,score:summary.score,win:true,summary};
 }
 function source(stage){
  const x=TIERS[stage-1];
  return x?{sourceId:"net008a-stage-"+stage,kind:"first-clear",energyCost:0,
   reward:{currency:x.currency,accountXp:x.xp,materials:x.materials}}:null;
 }
 function create({storageProvider,exclusive,ownsLock,now,day,heroes,onCredit}={}){
  if(![storageProvider,exclusive,ownsLock,now,day,onCredit].every(x=>typeof x==="function")||
   !Array.isArray(heroes))return null;
  let current=null,blocked=false,busy=false,clockBack=false;
  function read(){return current?clone(current):null;}
  async function transact(fn){
   if(blocked)return fail("BLOCKED_RELOAD");
   if(busy)return fail("BUSY");
   if(!ownsLock())return fail("NO_WRITER");
   busy=true;
   try{return await exclusive(()=>{
    if(!ownsLock())return fail("NO_WRITER");
    const storage=storageProvider(),raw=storage?.getItem(KEY);
    let prior=raw===null?null:JSON.parse(raw);
    if(prior!==null&&!valid(prior))return fail("INVALID_SAVE");
    const time=now(),base=prior??fresh(time);
    if(!valid(base))return fail("INVALID_CLOCK");
    const next=roll(base,time);
    if(!next){clockBack=true;return fail("CLOCK_ROLLBACK");}
    clockBack=false;
    const output=fn(next,storage);
    if(!output?.ok)return output||fail("INVALID_ACTION");
    if(!valid(output.state))return fail("INVALID_STATE");
    const write=clone(output.state);
    write.revision=base.revision+1;
    if(!int(write.revision))return fail("REVISION_OVERFLOW");
    const encoded=JSON.stringify(write);
    if(storage.getItem(KEY)!==raw)return fail("STALE_WEEKLY_SAVE");
    storage.setItem(KEY,encoded);
    if(storage.getItem(KEY)!==encoded)return fail("SAVE_OUTCOME_UNKNOWN");
    current=write;
    return {...output,state:read()};
   });}
   catch(_){blocked=true;return fail("SAVE_OUTCOME_UNKNOWN");}
   finally{busy=false;}
  }
  async function open(){
   const r=await transact(s=>({ok:true,state:s}));
   if(!r.ok&&r.code==="CLOCK_ROLLBACK"){
    try{const raw=storageProvider().getItem(KEY);
     const s=JSON.parse(raw);if(valid(s))current=s;
    }catch(_){}
   }
   return r;
  }
  async function begin(preparation){
   return transact((s,storage)=>{
    if(!["survey","cover"].includes(preparation)||s.active)return fail("INVALID_ACTION");
    let net;
    try{net=JSON.parse(storage.getItem(NETWORK_KEY));}catch(_){return fail("NETWORK_NOT_READY");}
    if(!Network.validState(net))return fail("NETWORK_NOT_READY");
    const intel=Math.min(3,net.threatIntel[weekId(s.weekStart)]??0);
    s.attempts++;s.active={preparation,intel,attempt:s.attempts};
    return {ok:true,state:s};
   });
  }
  async function finish(battle){
   return transact(s=>{
    const outcome=result(s,battle);
    return outcome?{ok:true,...outcome}:fail("INVALID_BATTLE_RESULT");
   });
  }
  async function abandon(){
   return transact(s=>{if(!s.active)return fail("NO_ACTIVE_ATTEMPT");
    s.active=null;return {ok:true,state:s};});
  }
  function pending(){
   if(!current)return [];
   let wallet;
   try{wallet=JSON.parse(storageProvider().getItem(V3.KEY));}catch(_){return [];}
   const paid=new Set((wallet.rewardReceipts||[]).map(x=>x.id));
   const wins=[...current.history,...(current.bestScore>=60?
    [{weekStart:current.weekStart,bestScore:current.bestScore}]:[])];
   return wins.flatMap(x=>TIERS.flatMap((t,i)=>x.bestScore>=t.score&&
    !paid.has(Rewards.receiptId(source(i+1),weekId(x.weekStart)))?
     [{weekStart:x.weekStart,stage:i+1}]:[]));
  }
  async function collect(){
   if(blocked||busy)return fail("BLOCKED_OR_BUSY");
   let count=0,currency=0,xp=0,materials=0;
   for(const item of pending()){
    const src=source(item.stage),occurrenceId=weekId(item.weekStart);
    const claim=await Rewards.claim({source:src,occurrenceId,day:day(),
     heroes,storageProvider,exclusive,
     authorize:({storage,sourceId,kind,occurrenceId:occ})=>{
      if(kind!=="first-clear"||sourceId!==src.sourceId||occ!==occurrenceId)return false;
      let s;try{s=JSON.parse(storage.getItem(KEY));}catch(_){return false;}
      if(!valid(s))return false;
      const win=[...s.history,{weekStart:s.weekStart,bestScore:s.bestScore}]
       .find(x=>weekId(x.weekStart)===occ);
      return !!win&&win.bestScore>=TIERS[item.stage-1].score;
     }});
    if(!claim.ok){
     if(claim.code==="ALREADY_CLAIMED")continue;
     if(["SAVE_OUTCOME_UNKNOWN","STALE_WALLET","EXCLUSIVE_LOCK_FAILED"].includes(claim.code))blocked=true;
     return fail(claim.code);
    }
    const saved=V3.validateActive(JSON.parse(storageProvider().getItem(V3.KEY)),heroes);
    const runtime=saved&&V3.toRuntime(saved,heroes);
    if(!runtime){blocked=true;return fail("REWARD_SYNC_FAILED");}
    onCredit(runtime,src.reward);
    count++;currency+=src.reward.currency;xp+=src.reward.accountXp;
    materials+=Object.values(src.reward.materials).reduce((a,b)=>a+b,0);
   }
   return {ok:true,count,currency,xp,materials};
  }
  return Object.freeze({open,read,begin,finish,abandon,pending,collect,
   isReady:()=>!!current&&!blocked&&!clockBack,isBlocked:()=>blocked,
   isClockBack:()=>clockBack,isBusy:()=>busy});
 }
 return Object.freeze({KEY,VARIANTS,TIERS,weekStart,weekId,variant,valid,fresh,
  roll,plan,startBattle,result,source,create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=WeeklyThreatCore;
