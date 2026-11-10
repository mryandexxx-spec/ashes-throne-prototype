"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const html=read("index.html"),game=read("game.js"),css=read("styles.css");
const pkg=JSON.parse(read("package.json"));
const ops=require("../operation-core.js");
test("OPS-001B has its own map, controls, results and versioned script",()=>{
 for(const id of ["operations","opsPhase","opsReport","opsActions","opsNotice",
  "opsNorth","opsSouth","opsJunction","opsNorthMark","opsSouthMark","opsAuthentic",
  "opsSaveStatus","opsHistory","operationResult","operationResultText",
  "operationResultTitle","operationResultStatus","operationResultAgain",
  "operationResultBack","operationResultHome"]){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(html,/data-screen="operations"/);
 assert.ok(html.indexOf('src="operation-core.js"')>html.indexOf('src="challenge-core.js"'));
 assert.ok(html.indexOf('src="operation-core.js"')<html.indexOf('src="game.js"'));
 assert.equal(pkg.version,"0.3.100");
 assert.match(html,/v0\.3\.100 · UIMODES001C/);
 assert.match(pkg.scripts.test,/node --check operation-core\.js/);
 assert.match(css,/\.ops-layout\{/);
 assert.match(css,/\.ops-nodes\{/);
 assert.match(css,/@media\(orientation:landscape\) and \(max-height:540px\)/);
});
test("operation routes only to shared battle and does not pay or alter campaign",()=>{
 const checks=[
  'OperationCore.load(()=>window.localStorage)',
  'battleIsOperation=squadReturnScreen==="operations"',
  'operationBattleRunId=battleIsOperation?operationProgress.active.runId:null',
  'OperationCore.battlePlan(operationProgress.active)',
  'return [...selectedParty(),...ENEMIES.slice(0,2).map(progressedEnemy)];',
  'return plan.kind==="twoWaves"?[[progressedEnemy(reinforcement)]]:[];',
  'OperationCore.battleEnded(pending,operationBattleRunId,state)',
  'if(battleIsOperation&&!state.active&&!operationResultRecorded)',
  'showScreen(operationProgress.active?.phase==="final"?"operations":',
  'if(id==="operations")renderOperations()',
  'if(id==="operationResult")renderOperationResult()',
  'openSquad("operations")',
  'OperationCore.stage(operationProgress,next)',
  'OperationCore.save(candidate,()=>window.localStorage,operationSaveBlocked)'
 ];
 for(const value of checks)assert.ok(game.includes(value),value);
 assert.match(game,/battleIsCampaign=squadReturnScreen==="campaign"/);
 assert.match(game,/if\(battleIsCampaign&&!freeStoryEntry\)/);
 assert.ok(!read("mission-data.js").includes("OPS-001"));
 assert.ok(!read("campaign-data.js").includes("OPS-001"));
 assert.ok(!read("daily-core.js").includes("OPS-001"));
 assert.ok(!read("hero-collection-core.js").includes("OPS-001"));
});
function fakeOperationUI(){
 const ids=["operations","opsSaveStatus","opsPhase","opsReport","opsActions",
  "opsNotice","opsHistory","opsNorth","opsSouth","opsJunction",
  "opsNorthMark","opsSouthMark","opsAuthentic","operationResultBack",
  "operationResultAgain","operationResultHome","operationResultTitle",
  "operationResultText","operationResultStatus"];
 const nodes=new Map(ids.map(id=>[id,{
  id,disabled:false,innerHTML:"",textContent:"",dataset:{},listeners:{},
  classList:{toggle(){}},
  contains(){return true;},
  addEventListener(kind,listener){this.listeners[kind]=listener;}
 }]));
 const map=new Map(),store={
  getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)
 };
 const screen=[],squad=[];
 const start=game.indexOf("// OPS-001B: small landscape-first operation screen.");
 const end=game.indexOf("function renderChallenges(){",start);
 assert.ok(start>=0&&end>start,"OPS UI source must be isolated for handler test");
 const context={
  OperationCore:ops,window:{localStorage:store},Date,
  operationProgress:ops.fresh(),operationSaveBlocked:false,
  operationSaveAvailable:true,operationNotice:"",operationRunCounter:0,
  $:key=>nodes.get(key.slice(1))||null,
  openSquad:name=>squad.push(name),
  showScreen:name=>screen.push(name)
 };
 const ui=vm.runInNewContext(game.slice(start,end)+"\n({renderOperations,newOperation,changeOperation,renderOperationResult})",context);
 function click(data){
  const target={dataset:data,disabled:false,closest(){return this;}};
  nodes.get("operations").listeners.click({target});
 }
 return {nodes,map,store,ui,context,click,screen,squad};
}
test("real click handlers: new → two orders → map → squad → result",()=>{
 const t=fakeOperationUI();
 t.ui.renderOperations();
 assert.match(t.nodes.get("opsActions").innerHTML,/data-ops-new/);
 t.click({opsNew:"yes"});
 assert.equal(t.context.operationProgress.active.phase,"order1");
 assert.equal(t.map.has(ops.KEY),true);
 t.click({opsOrder:"register"});
 assert.equal(t.context.operationProgress.active.phase,"order2");
 assert.equal(t.nodes.get("opsAuthentic").textContent,"◈");
 t.click({opsOrder:"observe"});
 assert.equal(t.context.operationProgress.active.phase,"target");
 assert.equal(t.nodes.get("opsNorth").disabled,false);
 assert.equal(t.nodes.get("opsJunction").disabled,true);
 assert.equal(t.nodes.get("opsNorthMark").textContent,"◈");
 t.click({opsTarget:"north"});
 assert.equal(t.context.operationProgress.active.phase,"battle");
 assert.deepEqual(t.squad,["operations"]);
 const checkpoint=JSON.parse(t.map.get(ops.KEY));
 assert.equal(checkpoint.active.phase,"battle");
 const final=ops.battleEnded(t.context.operationProgress.active,
  t.context.operationProgress.active.runId,{active:false,winner:"ally"});
 assert.equal(t.ui.changeOperation(final),true);
 assert.equal(t.context.operationProgress.active.phase,"final");
 t.click({opsFinish:"cover"});
 assert.equal(t.context.operationProgress.active,null);
 assert.equal(t.context.operationProgress.history.length,1);
 assert.equal(t.context.operationProgress.history[0].outcome,"success");
 assert.equal(t.screen.at(-1),"operationResult");
 t.ui.renderOperationResult();
 assert.match(t.nodes.get("operationResultText").textContent,/Подлинник захвачен/);
});
test("blockade map enforces junction and quitting a checkpoint releases run",()=>{
 const t=fakeOperationUI();t.click({opsNew:"yes"});
 t.click({opsOrder:"block"});
 t.click({opsOrder:"extract"});
 assert.equal(t.nodes.get("opsNorth").disabled,true);
 assert.equal(t.nodes.get("opsJunction").disabled,false);
 t.click({opsTarget:"junction"});
 assert.equal(ops.battlePlan(t.context.operationProgress.active).kind,"twoWaves");
 t.ui.renderOperations();
 t.click({opsAbandon:"yes"});
 assert.equal(t.context.operationProgress.active,null);
 assert.equal(t.context.operationProgress.history[0].outcome,"abandoned");
 assert.equal(t.screen.at(-1),"operationResult");
 t.click({opsNew:"yes"});
 assert.equal(t.context.operationProgress.active.variantId,"B");
});
test("persist rejection leaves the active checkpoint unchanged",()=>{
 const t=fakeOperationUI();
 t.click({opsNew:"yes"});
 const old=t.context.operationProgress.active;
 t.store.setItem=()=>{throw Error("write denied");};
 t.click({opsOrder:"register"});
 assert.equal(t.context.operationProgress.active,old);
 assert.equal(t.context.operationProgress.active.phase,"order1");
 assert.match(t.nodes.get("opsNotice").textContent,/Не удалось сохранить/);
});
test("shared CombatCore completes a single wave or a real two-wave encounter",()=>{
 const source=["initiative-model.js","ability-data.js","combat-core.js"].map(read).join("\n");
 const combat=vm.runInNewContext(source+"\nCombatCore");
 const enemy=id=>({id,side:"enemy",name:id,hp:12,atk:1,speed:65});
 for(const kind of ["singleWave","twoWaves"]){
  let r=ops.start("A",kind);
  if(kind==="twoWaves"){
   r=ops.order(ops.order(r,"block"),"extract");
   r=ops.intercept(r,"junction");
  }else{
   r=ops.order(ops.order(r,"register"),"observe");
   r=ops.intercept(r,"north");
  }
  const plan=ops.battlePlan(r);
  assert.equal(plan.kind,kind);
  const battle=combat.createBattle([{id:"hero",name:"Hero",side:"ally",
   hp:250,atk:50,speed:200},enemy("ves"),enemy("shade")],
   kind==="twoWaves"?[[enemy("ves-2")]]:[]);
  combat.advanceToPlayerTurn(battle);
  let steps=0;
  while(battle.active&&steps++<40){
   assert.equal(combat.performPlayerAbility(battle,"basic"),true);
  }
  assert.ok(steps<40);
  assert.equal(battle.winner,"ally");
  assert.equal(battle.totalWaves,kind==="twoWaves"?2:1);
  assert.equal(battle.wave,battle.totalWaves);
  assert.equal(ops.battleEnded(r,r.runId,battle).phase,"final");
 }
});
