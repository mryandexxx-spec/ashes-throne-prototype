/* OPS-001A: noncanonical, UI-free training operation.
 * No campaign, challenge, account progress, rewards or combat formulas are changed. */
const OperationCore=(()=>{
 "use strict";
 const KEY="ashes-throne.operations.v1", VERSION=1, ID="OPS-001";
 const VARIANTS=Object.freeze({
  A:Object.freeze({authentic:"diamond",north:"diamond",south:"circle",correct:"north"}),
  B:Object.freeze({authentic:"circle",north:"diamond",south:"circle",correct:"south"})
 });
 const FIRST=Object.freeze(["register","block","extract"]);
 const CHOICES=Object.freeze(["cover","ledger","leave","both"]);
 const PHASES=Object.freeze(["order1","order2","target","battle","final","done"]);
 const has=(a,x)=>a.includes(x);
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const exact=(o,keys)=>!!o&&typeof o==="object"&&!Array.isArray(o)&&
  Object.keys(o).length===keys.length&&Object.keys(o).every(k=>has(keys,k));
 const copy=r=>({...r,orders:r.orders.slice()});
 function availableOrders(run){
  if(!validRun(run))return [];
  if(run.phase==="order1")return FIRST.slice();
  if(run.phase!=="order2")return [];
  if(run.orders[0]==="block")return ["register","extract"];
  return run.orders[0]==="register"?["observe","extract"]:["observe","register"];
 }
 function validOrders(orders){
  if(!Array.isArray(orders)||orders.length>2)return false;
  if(!orders.length)return true;
  if(!has(FIRST,orders[0]))return false;
  if(orders.length===1)return true;
  const second=orders[0]==="block"?["register","extract"]:
   orders[0]==="register"?["observe","extract"]:["observe","register"];
  return has(second,orders[1]);
 }
 function correctTarget(r){
  return r.target==="junction"&&has(r.orders,"block")||
   r.target===VARIANTS[r.variantId].correct;
 }
 function validRun(r){
  const keys=["operationId","runId","variantId","phase","orders","target",
   "battleResult","finalChoice","outcome"];
  if(!exact(r,keys)||r.operationId!==ID||
   typeof r.runId!=="string"||!r.runId.trim()||r.runId.length>128||
   !own(VARIANTS,r.variantId)||!has(PHASES,r.phase)||!validOrders(r.orders))return false;
  const n=r.orders.length, hasTarget=r.target==="north"||r.target==="south"||
   r.target==="junction", block=has(r.orders,"block");
  if(r.target!==null&&!hasTarget)return false;
  if(hasTarget&&((block&&r.target!=="junction")||(!block&&r.target==="junction")))return false;
  if(r.battleResult!==null&&!has(["ally","enemy"],r.battleResult))return false;
  if(r.finalChoice!==null&&!has(CHOICES,r.finalChoice))return false;
  if(r.outcome!==null&&!has(["success","wrongTarget","defeat","abandoned"],r.outcome))return false;
  if(r.phase==="order1")return n===0&&r.target===null&&r.battleResult===null&&r.finalChoice===null&&r.outcome===null;
  if(r.phase==="order2")return n===1&&r.target===null&&r.battleResult===null&&r.finalChoice===null&&r.outcome===null;
  if(r.phase==="target")return n===2&&r.target===null&&r.battleResult===null&&r.finalChoice===null&&r.outcome===null;
  if(r.phase==="battle")return n===2&&hasTarget&&r.battleResult===null&&r.finalChoice===null&&r.outcome===null;
  if(r.phase==="final")return n===2&&hasTarget&&correctTarget(r)&&r.battleResult==="ally"&&r.finalChoice===null&&r.outcome===null;
  if(r.outcome==="abandoned")return !hasTarget&&r.battleResult===null&&r.finalChoice===null;
  if(n!==2||!hasTarget)return false;
  if(r.outcome==="defeat")return r.battleResult==="enemy"&&r.finalChoice===null;
  if(r.outcome==="wrongTarget")return r.battleResult==="ally"&&!correctTarget(r)&&r.finalChoice===null;
  return r.outcome==="success"&&r.battleResult==="ally"&&correctTarget(r)&&
   has(CHOICES,r.finalChoice)&& (r.finalChoice!=="both"||has(r.orders,"extract"));
 }
 function start(variantId,runId){
  if(!own(VARIANTS,variantId)||typeof runId!=="string"||!runId.trim()||runId.length>128)return null;
  return {operationId:ID,runId,variantId,phase:"order1",orders:[],
   target:null,battleResult:null,finalChoice:null,outcome:null};
 }
 function order(run,action){
  if(!has(availableOrders(run),action))return null;
  return {...copy(run),orders:[...run.orders,action],
   phase:run.phase==="order1"?"order2":"target"};
 }
 function intel(run){
  if(!validRun(run))return null;
  const v=VARIANTS[run.variantId];
  return {authenticMark:has(run.orders,"register")?v.authentic:null,
   courierMarks:has(run.orders,"observe")?{north:v.north,south:v.south}:null,
   blocked:has(run.orders,"block"),extractionPrepared:has(run.orders,"extract")};
 }
 function targetAssessment(run,target){
  if(!validRun(run)||run.phase!=="target"||!has(["north","south","junction"],target))return null;
  if(has(run.orders,"block"))return target==="junction"?"guaranteed":null;
  if(target==="junction")return null;
  return has(run.orders,"register")&&has(run.orders,"observe")?
   (target===VARIANTS[run.variantId].correct?"confirmed":"disproved"):"unconfirmed";
 }
 function intercept(run,target){
  if(!targetAssessment(run,target)||!validRun(run))return null;
  return {...copy(run),phase:"battle",target};
 }
 function battlePlan(run){
  if(!validRun(run)||run.phase!=="battle")return null;
  return {runId:run.runId,kind:run.target==="junction"?"twoWaves":"singleWave",
   checkpoint:"restart-battle-before-first-turn"};
 }
 function battleEnded(run,runId,result){
  if(!validRun(run)||run.phase!=="battle"||run.runId!==runId||
   !result||result.active!==false||!has(["ally","enemy"],result.winner))return null;
  if(result.winner==="enemy")return {...copy(run),phase:"done",battleResult:"enemy",outcome:"defeat"};
  if(!correctTarget(run))return {...copy(run),phase:"done",battleResult:"ally",outcome:"wrongTarget"};
  return {...copy(run),phase:"final",battleResult:"ally"};
 }
 function finalChoices(run){
  if(!validRun(run)||run.phase!=="final")return [];
  return has(run.orders,"extract")?CHOICES.slice():CHOICES.filter(c=>c!=="both");
 }
 function finish(run,choice){
  if(!has(finalChoices(run),choice))return null;
  return {...copy(run),phase:"done",finalChoice:choice,outcome:"success"};
 }
 function abandon(run){
  if(!validRun(run)||!has(["order1","order2","target"],run.phase))return null;
  return {...copy(run),phase:"done",outcome:"abandoned"};
 }
 function summary(run){
  if(!validRun(run)||run.phase!=="done")return null;
  return {runId:run.runId,variantId:run.variantId,outcome:run.outcome,
   coverPreserved:run.finalChoice==="cover"||run.finalChoice==="both",
   ledgerSecured:run.finalChoice==="ledger"||run.finalChoice==="both"};
 }
 const HISTORY_KEYS=["runId","variantId","outcome","coverPreserved","ledgerSecured"];
 function validHistory(e){
  return exact(e,HISTORY_KEYS)&&typeof e.runId==="string"&&!!e.runId.trim()&&
   e.runId.length<=128&&own(VARIANTS,e.variantId)&&
   has(["success","wrongTarget","defeat","abandoned"],e.outcome)&&
   typeof e.coverPreserved==="boolean"&&typeof e.ledgerSecured==="boolean"&&
   (e.outcome==="success"||(!e.coverPreserved&&!e.ledgerSecured));
 }
 function fresh(){return {active:null,history:[]};}
 function validProgress(p){
  if(!exact(p,["active","history"])||
   (p.active!==null&&!validRun(p.active))||
   (p.active!==null&&p.active.phase==="done")||
   !Array.isArray(p.history)||p.history.length>20||!p.history.every(validHistory))return false;
  const ids=p.history.map(x=>x.runId);
  if(p.active)ids.push(p.active.runId);
  return new Set(ids).size===ids.length;
 }
 function stage(progress,run){
  if(!validProgress(progress)||!validRun(run)||
   progress.history.some(h=>h.runId===run.runId))return null;
  if(progress.active){
   if(progress.active.runId!==run.runId||
    progress.active.variantId!==run.variantId)return null;
   const phases={order1:["order2","done"],order2:["target","done"],
    target:["battle","done"],battle:["final","done"],final:["done"]};
   if(!has(phases[progress.active.phase]||[],run.phase))return null;
   if(run.orders.length<progress.active.orders.length||
    !progress.active.orders.every((v,i)=>v===run.orders[i]))return null;
  }else if(run.phase!=="order1")return null;
  if(run.phase==="done"){
   const result=summary(run);
   return {active:null,history:[...progress.history,result].slice(-20)};
  }
  return {active:copy(run),history:progress.history.slice()};
 }
 function validStored(data){
  return exact(data,["version","active","history"])&&data.version===VERSION&&
   validProgress({active:data.active,history:data.history});
 }
 function load(provider){
  try{
   const store=provider();if(!store)return {progress:fresh(),available:false,blocked:true};
   const raw=store.getItem(KEY);
   if(raw===null)return {progress:fresh(),available:true,blocked:false};
   const data=JSON.parse(raw);
   if(!validStored(data))return {progress:fresh(),available:true,blocked:true};
   return {progress:{active:data.active,history:data.history},available:true,blocked:false};
  }catch(_){return {progress:fresh(),available:false,blocked:true};}
 }
 function save(progress,provider,blocked=false){
  if(blocked||!validProgress(progress))return false;
  try{
   const store=provider();if(!store)return false;
   const old=store.getItem(KEY);
   if(old!==null&&!validStored(JSON.parse(old)))return false;
   store.setItem(KEY,JSON.stringify({version:VERSION,...progress}));
   return true;
  }catch(_){return false;}
 }
 return Object.freeze({KEY,VERSION,ID,start,order,availableOrders,intel,
  targetAssessment,intercept,battlePlan,battleEnded,finalChoices,finish,abandon,
  summary,fresh,validRun,validProgress,stage,load,save});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=OperationCore;
