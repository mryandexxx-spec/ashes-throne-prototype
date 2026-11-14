"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const file=n=>fs.readFileSync(path.join(root,n),"utf8");
const {CombatCore,EnemyDecision,AutoDecision,CombatStatusCore,AbilityData}=vm.runInNewContext(
 ["initiative-model.js","combat-status-core.js","ability-data.js",
  "combat-core.js","enemy-decision.js","auto-decision.js"].map(file).join("\n")+
 "\n({CombatCore,EnemyDecision,AutoDecision,CombatStatusCore,AbilityData})"
);
const ally=(id,hp,atk,speed)=>({
 id,name:id,side:"ally",hp,atk,speed,physicalAttack:atk,
 physicalDefense:12,magicDefense:10,protection:0,maxProtection:0,combatProfile:"stats002c"
});
const enemy=(id,hp,atk,speed,assaultFocus=false)=>({
 id,name:id,side:"enemy",hp,atk,speed,assaultFocus,physicalAttack:atk,
 physicalDefense:8,magicDefense:8,protection:0,maxProtection:0,combatProfile:"stats002c"
});
const team=()=>[
 ally("ren",120,27,150),ally("nada",100,18,120),
 ally("kael",120,24,110),ally("lyra",88,31,155),ally("darin",105,27,125)
];
const foes=()=>[enemy("ves",150,22,105),enemy("shade",225,60,135,true),
 enemy("ves-2",150,22,105)];
const objective={kind:"hold-or-defeat",protectAllyId:"ren",allyActionsToHold:12};
function battle(){return CombatCore.createBattle([...team(),...foes()],[],{tacticalObjective:objective});}
function simulate(focusPursuer=false){
 const b=battle();CombatCore.advanceToPlayerTurn(b);
 for(let steps=0;b.active&&steps<45;steps++){
  const decision=AutoDecision.chooseAction(b);
  if(focusPursuer){
   const hunter=b.fighters.findIndex(f=>f.id==="shade"&&f.hp>0);
   if(hunter>=0){
    const ability=AbilityData.get(b.fighters[b.currentActor],decision.abilityId);
    if(ability.target==="enemy")decision.targetIndex=hunter;
   }
  }
  assert.equal(CombatCore.performAutoAction(b,decision),true);
 }
 assert.equal(b.active,false);
 return b;
}
test("LOREUX001: only the designated hunter prioritizes Ren, not other enemies",()=>{
 const b=battle(),hunter=b.fighters.findIndex(x=>x.id==="shade"),guard=b.fighters.findIndex(x=>x.id==="ves");
 b.currentActor=hunter;b.fighters[hunter].meter=1000;
 assert.equal(EnemyDecision.chooseAction(b,hunter).targetIndex,
  b.fighters.findIndex(x=>x.id==="ren"));
 b.currentActor=guard;b.fighters[guard].meter=1000;
 assert.equal(EnemyDecision.chooseAction(b,guard).targetIndex,
  b.fighters.findIndex(x=>x.id==="lyra"),"ordinary guard targets lowest HP, not Ren");
});
test("LOREUX001: Liora can divert the hunter's single-target assault",()=>{
 const b=CombatCore.createBattle([
  ally("ren",120,27,150),ally("liora",105,20,115),...foes()],
  [],{tacticalObjective:objective});
 const hunter=b.fighters.findIndex(f=>f.id==="shade"),
  liora=b.fighters.findIndex(f=>f.id==="liora");
 b.currentActor=hunter;b.fighters[hunter].meter=1000;
 const plan=EnemyDecision.chooseAction(b,hunter);
 assert.equal(plan.targetIndex,b.fighters.findIndex(f=>f.id==="ren"));
 CombatStatusCore.apply(b.fighters[liora],"taunt",0,2);
 assert.deepEqual(Array.from(CombatCore.actorTargetIndices(b,hunter,"enemy",plan.targetIndex)),[liora]);
});
test("LOREUX001: tactical decision affects survival; automatic planner is still allowed",()=>{
 const byDefault=simulate(false),protectPriority=simulate(true);
 assert.equal(byDefault.winner,"enemy");
 assert.equal(byDefault.tacticalOutcome,"protected-fallen",
  "default target priority is not a guaranteed victory");
 assert.equal(protectPriority.winner,"ally");
 assert.equal(protectPriority.tacticalOutcome,"held",
  "targeting the pursuer first allows the same reference squad to hold the escape");
 assert.ok(protectPriority.fighters.find(f=>f.id==="ren").hp>0);
 assert.equal(protectPriority.allyActions,12);
});
test("LOREUX001: mission tuning stays scoped to FS-05, old arena contracts unchanged",()=>{
 const game=file("game.js");
 assert.match(game,/const isRescue=loreRequiredContext.nodeId==="five-shadows:fs-05"/);
 assert.match(game,/name:"Преследователь",hp:225,atk:60,assaultFocus:true/);
 assert.match(game,/name:"Дозорный 1",hp:150,atk:22/);
 const old=CombatCore.createBattle([...team(),enemy("ves",90,18,105)],[],{});
 assert.equal(old.tacticalObjective,undefined);
});
