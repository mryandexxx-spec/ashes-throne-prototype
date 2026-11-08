/* OPS-002A: standalone, noncanonical signal-post operation model.
 * No UI, combat rules, profile, campaign, challenge or OPS-001 save changes. */
const SignalOperationCore=(()=>{
 "use strict";
 const KEY="ashes-throne.signal-operation.v1",VERSION=1,ID="OPS-002";
 const GUARDS=Object.freeze(["ves","shade"]);
 const PREPARATIONS=Object.freeze(["survey","extraction"]);
 const ASSAULTS=Object.freeze(["quiet","cordon"]);
 const CHOICES=Object.freeze(["cover","ledger","leave","both"]);
 const OUTCOMES=Object.freeze(["clean","alerted","loud","defeat","abandoned"]);
 const PHASES=Object.freeze(["prep","assault","battle","final","done"]);
 const is=(list,value)=>list.includes(value);
 const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
 const exact=(obj,keys)=>obj!==null&&typeof obj==="object"&&!Array.isArray(obj)&&
  Object.keys(obj).length===keys.length&&Object.keys(obj).every(key=>keys.includes(key));
 const RUN_KEYS=["operationId","runId","signalId","phase","preparation","assault",
  "battleResult","firstLoss","finalChoice","outcome"];
 const ENTRY_KEYS=["runId","preparation","assault","outcome",
  "signalStopped","concealed","coverPreserved","ledgerSecured"];
 const TRACK_KEYS=["runId","lastSequence","firstLoss","seenDeaths"];
 const success=outcome=>is(["clean","alerted","loud"],outcome);
 const validId=id=>typeof id==="string"&&id.trim().length>0&&id.length<=128;
 const copyRun=run=>({...run});
 function expectedOutcome(run){
  if(run.assault==="cordon")return run.firstLoss===null?"loud":null;
  if(run.assault!=="quiet"||!is(["ves","shade","both"],run.firstLoss))return null;
  return run.firstLoss==="both"||run.firstLoss===run.signalId?"clean":"alerted";
 }
 function validRun(run){
  if(!exact(run,RUN_KEYS)||run.operationId!==ID||!validId(run.runId)||
   !is(GUARDS,run.signalId)||!is(PHASES,run.phase)||
   (run.preparation!==null&&!is(PREPARATIONS,run.preparation))||
   (run.assault!==null&&!is(ASSAULTS,run.assault))||
   (run.assault!==null&&run.preparation===null)||
   (run.battleResult!==null&&!is(["ally","enemy"],run.battleResult))||
   (run.firstLoss!==null&&!is(["ves","shade","both"],run.firstLoss))||
   (run.finalChoice!==null&&!is(CHOICES,run.finalChoice))||
   (run.outcome!==null&&!is(OUTCOMES,run.outcome)))return false;
  const pristine=run.battleResult===null&&run.firstLoss===null&&
   run.finalChoice===null&&run.outcome===null;
  if(run.phase==="prep")return run.preparation===null&&run.assault===null&&pristine;
  if(run.phase==="assault")return run.preparation!==null&&run.assault===null&&pristine;
  if(run.phase==="battle")return run.preparation!==null&&run.assault!==null&&pristine;
  if(run.phase==="final")return run.preparation!==null&&run.assault!==null&&
   run.battleResult==="ally"&&run.outcome===expectedOutcome(run)&&
   success(run.outcome)&&run.finalChoice===null;
  if(run.outcome==="abandoned")return run.battleResult===null&&
   run.firstLoss===null&&run.finalChoice===null;
  if(run.preparation===null||run.assault===null)return false;
  if(run.outcome==="defeat")return run.battleResult==="enemy"&&
   run.firstLoss===null&&run.finalChoice===null;
  return success(run.outcome)&&run.battleResult==="ally"&&
   run.outcome===expectedOutcome(run)&&is(CHOICES,run.finalChoice)&&
   (run.finalChoice!=="both"||run.preparation==="extraction");
 }
 function start(signalId,runId){
  if(!is(GUARDS,signalId)||!validId(runId))return null;
  return {operationId:ID,runId,signalId,phase:"prep",
   preparation:null,assault:null,battleResult:null,firstLoss:null,
   finalChoice:null,outcome:null};
 }
 function prepare(run,choice){
  if(!validRun(run)||run.phase!=="prep"||!is(PREPARATIONS,choice))return null;
  return {...copyRun(run),preparation:choice,phase:"assault"};
 }
 function chooseAssault(run,choice){
  if(!validRun(run)||run.phase!=="assault"||!is(ASSAULTS,choice))return null;
  return {...copyRun(run),assault:choice,phase:"battle"};
 }
 function intel(run){
  if(!validRun(run))return null;
  return {signalId:run.preparation==="survey"?run.signalId:null,
   extractionPrepared:run.preparation==="extraction"};
 }
 function battlePlan(run){
  if(!validRun(run)||run.phase!=="battle")return null;
  return {runId:run.runId,guardIds:GUARDS.slice(),
   kind:run.assault==="quiet"?"singleWave":"twoWaves",
   checkpoint:"restart-battle-before-first-turn"};
 }
 function validTracker(tracker){
  if(!exact(tracker,TRACK_KEYS)||!validId(tracker.runId)||
   !Number.isSafeInteger(tracker.lastSequence)||tracker.lastSequence<0||
   !Array.isArray(tracker.seenDeaths)||
   tracker.seenDeaths.length>GUARDS.length||
   !tracker.seenDeaths.every(id=>is(GUARDS,id))||
   new Set(tracker.seenDeaths).size!==tracker.seenDeaths.length||
   (tracker.firstLoss!==null&&!is(["ves","shade","both"],tracker.firstLoss)))return false;
  if(tracker.lastSequence===0)return tracker.firstLoss===null&&tracker.seenDeaths.length===0;
  if(tracker.firstLoss===null)return tracker.seenDeaths.length===0;
  return tracker.firstLoss==="both"?
   tracker.seenDeaths.length===2:
   tracker.seenDeaths.includes(tracker.firstLoss);
 }
 function startTracker(run){
  if(!validRun(run)||run.phase!=="battle")return null;
  return {runId:run.runId,lastSequence:0,firstLoss:null,seenDeaths:[]};
 }
 // Capture each completed CombatCore event batch ONCE, with a strictly
 // increasing sequence. An "ability" boundary defines one atomic action,
 // including all deaths from a wide attack, regardless of death row order.
 // Return a new tracker; reject malformed, out-of-order or duplicate batches.
 function capture(tracker,events,sequence){
  if(!validTracker(tracker)||!Array.isArray(events)||events.length>1000||
   !Number.isSafeInteger(sequence)||sequence!==tracker.lastSequence+1)return null;
  const next={runId:tracker.runId,lastSequence:sequence,
   firstLoss:tracker.firstLoss,seenDeaths:tracker.seenDeaths.slice()};
  let group=null;
  function completeGroup(){
   if(!group||!group.length||next.firstLoss!==null)return;
   next.firstLoss=group.length===2?"both":group[0];
  }
  for(const event of events){
   if(!event||typeof event!=="object"||Array.isArray(event)||
    typeof event.type!=="string")return null;
   if(event.type==="ability"){
    completeGroup();
    group=[];
   }else if(event.type==="death"&&is(GUARDS,event.targetId)){
    // The caller must include the originating ability, not isolated rows.
    if(!group||next.seenDeaths.includes(event.targetId))return null;
    group.push(event.targetId);
    next.seenDeaths.push(event.targetId);
   }
  }
  completeGroup();
  return validTracker(next)?next:null;
 }
 function battleEnded(run,runId,battle,tracker){
  if(!validRun(run)||run.phase!=="battle"||run.runId!==runId||
   !battle||battle.active!==false||!is(["ally","enemy"],battle.winner)||
   !validTracker(tracker)||tracker.runId!==runId||tracker.lastSequence<1)return null;
  const waves=run.assault==="cordon"?2:1;
  if(battle.totalWaves!==waves||!Number.isSafeInteger(battle.wave)||
   battle.wave<1||battle.wave>waves)return null;
  if(battle.winner==="enemy")return {...copyRun(run),phase:"done",
   battleResult:"enemy",outcome:"defeat"};
  if(battle.wave!==waves)return null;
  if(run.assault==="quiet"&&tracker.seenDeaths.length!==GUARDS.length)return null;
  const firstLoss=run.assault==="quiet"?tracker.firstLoss:null;
  const result={...copyRun(run),phase:"final",battleResult:"ally",firstLoss};
  result.outcome=expectedOutcome(result);
  return validRun(result)?result:null;
 }
 function finalChoices(run){
  if(!validRun(run)||run.phase!=="final")return [];
  return run.preparation==="extraction"?CHOICES.slice():
   CHOICES.filter(choice=>choice!=="both");
 }
 function finish(run,choice){
  if(!is(finalChoices(run),choice))return null;
  return {...copyRun(run),phase:"done",finalChoice:choice};
 }
 function abandon(run){
  if(!validRun(run)||!is(["prep","assault","battle"],run.phase))return null;
  return {...copyRun(run),phase:"done",outcome:"abandoned"};
 }
 function summary(run){
  if(!validRun(run)||run.phase!=="done")return null;
  const complete=success(run.outcome);
  return {runId:run.runId,preparation:run.preparation,assault:run.assault,
   outcome:run.outcome,signalStopped:is(["clean","loud"],run.outcome),
   concealed:run.outcome==="clean",
   coverPreserved:complete&&is(["cover","both"],run.finalChoice),
   ledgerSecured:complete&&is(["ledger","both"],run.finalChoice)};
 }
 function validHistory(entry){
  if(!exact(entry,ENTRY_KEYS)||!validId(entry.runId)||
   (entry.preparation!==null&&!is(PREPARATIONS,entry.preparation))||
   (entry.assault!==null&&!is(ASSAULTS,entry.assault))||
   (entry.assault!==null&&entry.preparation===null)||
   !is(OUTCOMES,entry.outcome)||
   !["signalStopped","concealed","coverPreserved","ledgerSecured"]
    .every(key=>typeof entry[key]==="boolean"))return false;
  const complete=success(entry.outcome);
  if(!complete&&(entry.coverPreserved||entry.ledgerSecured))return false;
  if(entry.signalStopped!==is(["clean","loud"],entry.outcome)||
   entry.concealed!==(entry.outcome==="clean"))return false;
  if(entry.outcome!=="abandoned"&&
   (entry.preparation===null||entry.assault===null))return false;
  if(entry.outcome==="clean"||entry.outcome==="alerted"){
   if(entry.assault!=="quiet")return false;
  }else if(entry.outcome==="loud"&&entry.assault!=="cordon")return false;
  return !(entry.coverPreserved&&entry.ledgerSecured&&entry.preparation!=="extraction");
 }
 function fresh(){return {active:null,history:[]};}
 function validProgress(progress){
  if(!exact(progress,["active","history"])||
   (progress.active!==null&&(!validRun(progress.active)||progress.active.phase==="done"))||
   !Array.isArray(progress.history)||progress.history.length>20||
   !progress.history.every(validHistory))return false;
  const ids=progress.history.map(item=>item.runId);
  if(progress.active)ids.push(progress.active.runId);
  return new Set(ids).size===ids.length;
 }
 function stage(progress,run){
  if(!validProgress(progress)||!validRun(run)||
   progress.history.some(item=>item.runId===run.runId))return null;
  const old=progress.active;
  if(!old){if(run.phase!=="prep")return null;}
  else{
   if(old.runId!==run.runId||old.signalId!==run.signalId||
    (old.preparation!==null&&old.preparation!==run.preparation)||
    (old.assault!==null&&old.assault!==run.assault)||
    (old.battleResult!==null&&old.battleResult!==run.battleResult)||
    (old.firstLoss!==null&&old.firstLoss!==run.firstLoss)||
    (old.outcome!==null&&old.outcome!==run.outcome))return null;
   const allowed={prep:["assault","done"],assault:["battle","done"],
    battle:["final","done"],final:["done"]};
   if(!is(allowed[old.phase]||[],run.phase))return null;
   if(run.phase==="done"&&run.outcome==="abandoned"&&
    (old.phase==="final"||old.preparation!==run.preparation||
     old.assault!==run.assault))return null;
   if(old.phase==="battle"&&run.phase==="done"&&
    !is(["defeat","abandoned"],run.outcome))return null;
   if(old.phase==="final"&&run.phase==="done"&&
    (!success(run.outcome)||!is(finalChoices(old),run.finalChoice)))return null;
  }
  if(run.phase==="done")return {active:null,
   history:[...progress.history,summary(run)].slice(-20)};
  return {active:copyRun(run),history:progress.history.slice()};
 }
 function validStored(data){
  return exact(data,["version","active","history"])&&data.version===VERSION&&
   validProgress({active:data.active,history:data.history});
 }
 function load(storageProvider){
  try{
   const store=storageProvider();
   if(!store)return {progress:fresh(),available:false,blocked:true};
   const raw=store.getItem(KEY);
   if(raw===null)return {progress:fresh(),available:true,blocked:false};
   const data=JSON.parse(raw);
   if(!validStored(data))return {progress:fresh(),available:true,blocked:true};
   return {progress:{active:data.active,history:data.history},
    available:true,blocked:false};
  }catch(_){return {progress:fresh(),available:false,blocked:true};}
 }
 function save(progress,storageProvider,blocked=false){
  if(blocked||!validProgress(progress))return false;
  try{
   const store=storageProvider();if(!store)return false;
   const old=store.getItem(KEY);
   if(old!==null&&!validStored(JSON.parse(old)))return false;
   store.setItem(KEY,JSON.stringify({version:VERSION,...progress}));
   return true;
  }catch(_){return false;}
 }
 return Object.freeze({KEY,VERSION,ID,GUARDS,PREPARATIONS,ASSAULTS,
  start,prepare,chooseAssault,intel,battlePlan,startTracker,validTracker,capture,
  battleEnded,finalChoices,finish,abandon,summary,validRun,validProgress,
  stage,fresh,load,save});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=SignalOperationCore;
