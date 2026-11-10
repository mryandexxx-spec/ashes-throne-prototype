"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,".."),read=file=>fs.readFileSync(path.join(root,file),"utf8");
const html=read("index.html"),game=read("game.js"),css=read("styles.css");
const signal=require("../signal-operation-core.js");
const pkg=JSON.parse(read("package.json"));
function fakeUI(){
 const ids=["signalOperations","sigSaveStatus","sigPhase","sigReport","sigActions",
  "sigNotice","sigHistory","sigPostStatus","sigGuardA","sigGuardB","sigGuardAName","sigGuardBName","sigResultTitle",
  "sigResultText","sigResultStatus","sigResultBack","sigResultAgain","sigResultHome"];
 const nodes=new Map(ids.map(id=>[id,{
  id,disabled:false,textContent:"",innerHTML:"",listeners:{},
  contains(){return true;},
  addEventListener(name,handler){this.listeners[name]=handler;}
 }]));
 const items=new Map();
 const store={getItem:key=>items.get(key)??null,setItem:(key,v)=>items.set(key,v)};
 const views=[],squad=[];
 const start=game.indexOf("// OPS-002B: separate UI and save;");
 const end=game.indexOf("function renderChallenges(){",start);
 assert.ok(start>=0&&end>start);
 const context={
  SignalOperationCore:signal,signalProgress:signal.fresh(),
  signalSaveBlocked:false,signalSaveAvailable:true,signalNotice:"",
  signalRunCounter:0,ENEMIES:[{id:"ves",name:"Первый страж"},{id:"shade",name:"Второй страж"}],
  window:{localStorage:store,crypto:{getRandomValues(arr){arr[0]=0;arr[1]=77;return arr}}},
  Uint32Array,Math,Date,$:query=>nodes.get(query.slice(1))||null,
  showScreen:id=>views.push(id),openSquad:id=>squad.push(id)
 };
 const ui=vm.runInNewContext(game.slice(start,end)+
  "\n({renderSignalOperations,renderSignalOperationResult,createSignalOperation,changeSignalOperation})",context);
 function click(data){
  const target={dataset:data,disabled:false,closest(){return this}};
  nodes.get("signalOperations").listeners.click({target});
 }
 return {nodes,context,ui,click,views,squad,store,items};
}
test("OPS-002B exposes separate touch UI, real battle routing and version",()=>{
 for(const id of ["signalOperations","signalOperationResult","sigSaveStatus","sigPhase",
  "sigReport","sigActions","sigNotice","sigHistory","sigGuardA","sigGuardB",
  "sigPostStatus","sigGuardAName","sigGuardBName","sigResultTitle","sigResultText","sigResultStatus",
  "sigResultAgain","sigResultBack","sigResultHome"])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/data-screen="signalOperations"/);
 assert.ok(html.indexOf('src="signal-operation-core.js"')>html.indexOf('src="operation-core.js"'));
 assert.ok(html.indexOf('src="signal-operation-core.js"')<html.indexOf('src="game.js"'));
 assert.equal(pkg.version,"0.3.89");
 assert.match(html,/v0\.3\.89 · ROSTER005/);
 assert.match(css,/\.sig-guards\{/);
 assert.match(css,/@media \(orientation:landscape\) and \(max-height:540px\)/);
 const tokens=[
  'battleIsSignal=squadReturnScreen==="signalOperations"',
  'signalBattleRunId=battleIsSignal?signalProgress.active.runId:null',
  'SignalOperationCore.battlePlan(signalProgress.active)',
  'const batch=SignalOperationCore.capture',
  'SignalOperationCore.battleEnded(pending,signalBattleRunId,state,signalBattleTracker)',
  'signalBattleTracker=battleIsSignal?SignalOperationCore.startTracker(signalProgress.active):null',
  'if(battleIsSignal&&!state.active&&!signalResultRecorded)',
  'if(battleIsSignal&&!state.active&&!missionResultShown)',
  'if(id==="signalOperations")renderSignalOperations()',
  'if(id==="signalOperationResult")renderSignalOperationResult()',
  'SignalOperationCore.save(candidate,()=>window.localStorage,signalSaveBlocked)',
  'openSquad("signalOperations")'
 ];
 for(const token of tokens)assert.ok(game.includes(token),token);
 assert.ok(!read("operation-core.js").includes("SignalOperationCore"));
 assert.ok(!read("progress-v3-core.js").includes("OPS-002"));
 assert.ok(!read("campaign-data.js").includes("OPS-002"));
});
test("signal UI click handlers: reconnaissance -> quiet -> battle -> clean result",()=>{
 const t=fakeUI();t.ui.renderSignalOperations();
 assert.match(t.nodes.get("sigActions").innerHTML,/data-sig-new/);
 t.click({sigNew:"yes"});
 assert.equal(t.nodes.get("sigGuardAName").textContent,"Первый страж");
 assert.equal(t.nodes.get("sigGuardBName").textContent,"Второй страж");
 assert.equal(t.context.signalProgress.active.signalId,"ves");
 assert.equal(t.context.signalProgress.active.phase,"prep");
 assert.equal(t.items.has(signal.KEY),true);
 t.click({sigPrep:"survey"});
 assert.equal(t.context.signalProgress.active.phase,"assault");
 assert.equal(t.nodes.get("sigGuardA").textContent,"Связной установлен");
 assert.equal(t.nodes.get("sigGuardB").textContent,"Постовой");
 t.click({sigAssault:"quiet"});
 assert.equal(t.context.signalProgress.active.phase,"battle");
 assert.match(t.nodes.get("sigReport").textContent,/Связной установлен/);
 t.click({sigFight:"yes"});
 assert.deepEqual(t.squad,["signalOperations"]);
 let run=t.context.signalProgress.active;
 const tracker=signal.capture(signal.startTracker(run),
  [{type:"ability",actorId:"kael",abilityId:"special"},
   {type:"death",targetId:"ves"},{type:"death",targetId:"shade"}],1);
 const result=signal.battleEnded(run,run.runId,
  {active:false,winner:"ally",totalWaves:1,wave:1},tracker);
 assert.equal(result.outcome,"clean");
 assert.equal(t.ui.changeSignalOperation(result),true);
 assert.equal(t.context.signalProgress.active.phase,"final");
 t.click({sigFinish:"ledger"});
 assert.equal(t.context.signalProgress.active,null);
 assert.equal(t.views.at(-1),"signalOperationResult");
 assert.equal(t.context.signalProgress.history[0].outcome,"clean");
 t.ui.renderSignalOperationResult();
 assert.match(t.nodes.get("sigResultText").textContent,/Пост взят незаметно/);
});
test("extraction and cordon: two waves, both local objectives and replay",()=>{
 const t=fakeUI();t.click({sigNew:"yes"});
 t.click({sigPrep:"extraction"});
 assert.equal(t.nodes.get("sigGuardA").textContent,"Роль не установлена");
 t.click({sigAssault:"cordon"});
 let run=t.context.signalProgress.active;
 assert.equal(signal.battlePlan(run).kind,"twoWaves");
 assert.match(t.nodes.get("sigReport").textContent,/2 волны/);
 let tracker=signal.capture(signal.startTracker(run),
  [{type:"ability",actorId:"hero"},{type:"death",targetId:"ves"},
   {type:"death",targetId:"shade"}],1);
 let done=signal.battleEnded(run,run.runId,
  {active:false,winner:"ally",totalWaves:2,wave:2},tracker);
 assert.equal(done.outcome,"loud");
 t.ui.changeSignalOperation(done);
 assert.match(t.nodes.get("sigActions").innerHTML,/data-sig-finish="both"/);
 t.click({sigFinish:"both"});
 assert.equal(t.context.signalProgress.history[0].ledgerSecured,true);
 assert.equal(t.context.signalProgress.history[0].coverPreserved,true);
 assert.equal(t.context.signalProgress.history[0].concealed,false);
 t.nodes.get("sigResultAgain").listeners.click();
 assert.equal(t.context.signalProgress.active.phase,"prep");
 assert.equal(t.context.signalProgress.history.length,1);
 assert.equal(t.views.at(-1),"signalOperations");
});
test("checkpoint survives reload; abandon is possible before an interrupted 3D fight",()=>{
 const t=fakeUI();t.click({sigNew:"yes"});t.click({sigPrep:"survey"});
 t.click({sigAssault:"quiet"});
 const id=t.context.signalProgress.active.runId;
 const loaded=signal.load(()=>t.store);
 assert.equal(loaded.progress.active.runId,id);
 assert.equal(loaded.progress.active.phase,"battle");
 assert.equal(signal.startTracker(loaded.progress.active).lastSequence,0);
 t.click({sigQuit:"yes"});
 assert.equal(t.views.at(-1),"signalOperationResult");
 assert.equal(t.context.signalProgress.history[0].outcome,"abandoned");
 assert.equal(t.context.signalProgress.active,null);
});
test("write failure does not advance UI state or present an unsaved operation",()=>{
 const t=fakeUI();t.click({sigNew:"yes"});
 const existing=t.context.signalProgress.active;
 t.store.setItem=()=>{throw Error("quota");};
 t.click({sigPrep:"survey"});
 assert.equal(t.context.signalProgress.active,existing);
 assert.equal(t.context.signalProgress.active.phase,"prep");
 assert.match(t.nodes.get("sigNotice").textContent,/Сохранение не удалось/);
 const noStore=fakeUI();noStore.context.signalSaveAvailable=false;
 noStore.ui.renderSignalOperations();
 assert.match(noStore.nodes.get("sigActions").innerHTML,/disabled/);
});
test("combat capture hook processes completed batches before any presentation check",()=>{
 const start=game.indexOf("function captureResolvedVisuals(beforeFighters){");
 const end=game.indexOf("function finishVisualTransition(){",start);
 assert.ok(start>=0&&end>start);
 const battle=signal.chooseAssault(signal.prepare(signal.start("ves","hook"),"survey"),"quiet");
 const ctx={
  state:{events:[{type:"ability",actorId:"kael"},
   {type:"death",targetId:"ves"},{type:"death",targetId:"shade"}]},
  challengeTracker:null,battleIsChallenge:false,battleIsSignal:true,
  signalBattleTracker:signal.startTracker(battle),signalCaptureFailed:false,
  SignalOperationCore:signal,scene:null,engine:null
 };
 const hook=vm.runInNewContext(game.slice(start,end)+"\n captureResolvedVisuals",ctx);
 hook([]);
 assert.equal(ctx.signalBattleTracker.firstLoss,"both");
 assert.equal(ctx.signalBattleTracker.lastSequence,1);
 assert.equal(ctx.signalCaptureFailed,false);
 hook([]);
 assert.equal(ctx.signalCaptureFailed,true,"a duplicate death batch must fail closed");
});
