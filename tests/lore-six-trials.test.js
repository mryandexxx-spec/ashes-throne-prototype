"use strict";
/* LORETRIALS001: six mandatory battle gates, diverse objectives, terminal
   completion, old-save preservation and scope isolation. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,".."),read=n=>fs.readFileSync(path.join(root,n),"utf8");
const Base=require("../lore-campaign-data.js"),Core=require("../lore-campaign-core.js");
const Scripts=require("../lore-campaign-scenes.js"),Engine=require("../lore-campaign-scene-core.js");
const Save=require("../lore-campaign-scene-save.js"),Runtime=require("../lore-campaign-scene-runtime.js");
const Act2=require("../lore-campaign-act2.js"),Trials=require("../lore-campaign-trials.js");
const UI=require("../lore-campaign-ui.js");
const Combat=vm.runInNewContext(
 ["initiative-model.js","ability-data.js","combat-core.js"].map(read).join("\n")+"\nCombatCore");
const ally=(id,hp=700,atk=200,speed=250)=>({
 id,name:id,side:"ally",hp,atk,physicalAttack:atk,magicAttack:atk,speed
});
const foe=(id,hp=35,atk=1,speed=35)=>({
 id,name:id,side:"enemy",hp,atk,physicalAttack:atk,magicAttack:atk,speed
});
const memory=()=>{
 const map=new Map();
 return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};
};
const create=storage=>Runtime.create({graph:Trials.data.catalog(),graphCore:Core,
 pack:Trials.pack,scriptData:Scripts,sceneCore:Engine,saveModule:Save,storage});
function play(r,id){
 assert.equal(r.start(id).ok,true,"start "+id);
 for(let step=0;step<125;step++){
  let v=r.current();assert.ok(v,"scene "+id);
  for(const x of v.inspections)if(!x.done)assert.equal(r.inspect(x.id).ok,true);
  v=r.current();
  for(const x of v.comparisons)if(x.ready&&!x.done)assert.equal(r.compare(x.id).ok,true);
  v=r.current();
  if(v.choices.length)assert.equal(r.choose(v.choices[0].id).ok,true);
  else if(v.canContinue)assert.equal(r.next().ok,true);
  else if(v.canFinish){assert.equal(r.finish().ok,true);return;}
  else assert.fail("stuck at "+v.beatId);
 }
 assert.fail("too many beats "+id);
}
test("LORETRIALS001: six distinct gates, existing scripts and unchanged rewards",()=>{
 const g=Trials.data.catalog(),prior=Act2.data.catalog();
 assert.equal(Base.catalogIsValid(g),true);
 assert.equal(Scripts.valid(Trials.pack,g),true);
 assert.equal(g.nodes.length,6);
 assert.equal(new Set(g.nodes.map(n=>n.requiredBattleId)).size,6);
 assert.ok(g.nodes.every(n=>n.requiredBattleId&&Trials.encounter(n.id)));
 assert.equal(g.nodes[5].nextNodeIds.length,0,"final node can have a mandatory fight");
 assert.equal(g.nodes[4].requiredBattleId,prior.nodes[4].requiredBattleId);
 assert.deepEqual(g.nodes[4].requiredBattleObjective,prior.nodes[4].requiredBattleObjective);
 assert.deepEqual(g.nodes.map(n=>n.requiredBattleObjective?.kind||"defeat"),[
  "defeat","protect-and-defeat","defeat","priority-first",
  "hold-or-defeat","hold-or-defeat"]);
 assert.ok(g.nodes.every(n=>n.rewardPoolId===null&&n.energyCostId===null));
 assert.equal(Trials.pack,Act2.pack,"story script stays unchanged");
 assert.equal(prior.nodes[2].requiredBattleId,undefined,"original Act II graph is not mutated");
 assert.equal(prior.nodes[5].requiredBattleId,undefined);
});
test("LORETRIALS001: all battles are mandatory and terminal FS-06 is not falsely complete",()=>{
 const store=memory(),r=create(store),nodes=Trials.data.catalog().nodes;
 for(let i=0;i<nodes.length;i++){
  const n=nodes[i];
  assert.equal(Core.available(Trials.data.catalog(),r.progress(),n.id),true);
  play(r,n.id);
  assert.equal(UI.nodeStatus(n,Trials.data.catalog(),r.progress(),Core).code,
   "battle-pending","scene complete is not victory: "+n.id);
  if(nodes[i+1])assert.equal(Core.available(Trials.data.catalog(),r.progress(),nodes[i+1].id),false);
  assert.equal(r.beginRequiredBattle(n.id).ok,true);
  assert.equal(r.recordBattleVictory(n.id,n.requiredBattleId).ok,true);
  assert.equal(UI.nodeStatus(n,Trials.data.catalog(),r.progress(),Core).code,"completed");
 }
 assert.deepEqual(r.stateFor("five-shadows").battleClearedNodeIds,nodes.map(n=>n.id));
 assert.deepEqual([...store.map.keys()],[Core.KEY],"lore-only save");
 const before=store.getItem(Core.KEY),last=nodes[5];
 assert.equal(r.beginRequiredBattle(last.id).code,"BATTLE_NOT_AVAILABLE");
 assert.equal(r.beginRequiredBattle(last.id,true).ok,true,"final fight replay");
 assert.equal(r.recordBattleVictory(last.id,last.requiredBattleId).replay,true);
 assert.equal(store.getItem(Core.KEY),before,"replay cannot rewrite victory or rewards");
 const loaded=create(store);
 assert.equal(UI.nodeStatus(last,Trials.data.catalog(),loaded.progress(),Core).code,"completed");
});
test("LORETRIALS001: new battle gates respect legacy completed scenes",()=>{
 const g=Trials.data.catalog(),p=Core.fresh(g),s=p.stories["five-shadows"],nodes=g.nodes;
 s.completedNodeIds=nodes.slice(0,4).map(n=>n.id);
 s.battleClearedNodeIds=nodes.slice(0,2).map(n=>n.id);
 assert.equal(Core.available(g,p,nodes[4].id),false,"new FS-04 gate is not bypassed");
 assert.equal(Core.available(g,p,nodes[3].id),true,"replay still available");
 s.battleClearedNodeIds.push(nodes[2].id,nodes[3].id);
 assert.equal(Core.available(g,p,nodes[4].id),true);
});
test("LORETRIALS001: protect-and-defeat requires survival, not a timer",()=>{
 const objective={kind:"protect-and-defeat",protectAllyId:"nada"};
 assert.throws(()=>Combat.createBattle([ally("ren"),foe("ves")],[],{
  tacticalObjective:objective}),/invalid tactical objective/);
 assert.throws(()=>Combat.createBattle([ally("ren"),ally("nada"),foe("ves")],[],{
  tacticalObjective:{...objective,allyActionsToHold:8}}),/invalid tactical objective/);
 const won=Combat.createBattle([ally("ren"),ally("nada"),foe("ves")],[],{
  tacticalObjective:objective});
 Combat.advanceToPlayerTurn(won);
 assert.equal(Combat.performPlayerAttack(won),true);
 assert.equal(won.winner,"ally");
 assert.equal(won.tacticalOutcome,"protected-victory");
 const fallen=Combat.createBattle([ally("ren"),ally("nada",1,2,20),foe("ves",500,100,260)],
 [],{tacticalObjective:objective});
 Combat.advanceToPlayerTurn(fallen);
 // This assertion only depends on the combat engine, not browser UI timing.
 fallen.fighters.find(f=>f.id==="nada").hp=0;
 Combat.advanceToPlayerTurn(fallen);
 assert.equal(fallen.winner,"enemy");
 assert.equal(fallen.tacticalOutcome,"protected-fallen");
});
test("LORETRIALS001: priority-first rejects a wrong or simultaneous kill",()=>{
 const objective={kind:"priority-first",priorityEnemyId:"shade"};
 const squad=()=>[ally("ren"),foe("ves"),foe("shade"),foe("ves-2")];
 const wrong=Combat.createBattle(squad(),[],{tacticalObjective:objective});
 Combat.advanceToPlayerTurn(wrong);
 assert.equal(Combat.performPlayerAttack(wrong),true); // default target: ves
 assert.equal(wrong.winner,"enemy");
 assert.equal(wrong.tacticalOutcome,"wrong-order");
 const success=Combat.createBattle(squad(),[],{tacticalObjective:objective});
 Combat.advanceToPlayerTurn(success);
 assert.equal(Combat.chooseEnemy(success,2),true);
 assert.equal(Combat.performPlayerAttack(success),true);
 assert.equal(success.priorityCleared,true);
 assert.equal(success.active,true);
 for(let steps=0;steps<20&&success.active;steps++){
  Combat.advanceToPlayerTurn(success);
  if(success.active)assert.equal(Combat.performPlayerAttack(success),true);
 }
 assert.equal(success.winner,"ally");
 assert.equal(success.tacticalOutcome,"priority-victory");
 const together=Combat.createBattle(squad(),[],{tacticalObjective:objective});
 Combat.advanceToPlayerTurn(together);
 together.fighters[1].hp=0;together.fighters[2].hp=0;
 Combat.advanceToPlayerTurn(together);
 assert.equal(together.winner,"enemy","concurrent casualties cannot fake priority");
});
test("LORETRIALS001: two-wave battle keeps combat rules and avoids phantom victory",()=>{
 const b=Combat.createBattle([ally("ren"),foe("ves")],[[foe("shade")]]);
 Combat.advanceToPlayerTurn(b);
 assert.equal(Combat.performPlayerAttack(b),true);
 assert.equal(b.wave,2);
 assert.equal(b.active,true);
 assert.equal(b.winner,null);
 Combat.advanceToPlayerTurn(b);
 assert.equal(Combat.performPlayerAttack(b),true);
 assert.equal(b.winner,"ally");
 assert.equal(b.totalWaves,2);
});
