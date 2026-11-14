"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,".."),read=n=>fs.readFileSync(path.join(root,n),"utf8");
const Combat=vm.runInNewContext(
 ["initiative-model.js","ability-data.js","combat-core.js"].map(read).join("\n")+"\nCombatCore");
const ally=(id,hp=700,atk=5,speed=240)=>({id,name:id,side:"ally",hp,atk,physicalAttack:atk,magicAttack:atk,speed});
const foe=(hp=1000,atk=1,speed=75)=>({id:"foe",name:"Противник",side:"enemy",hp,atk,physicalAttack:atk,magicAttack:atk,speed});
const objective=()=>({kind:"hold-or-defeat",protectAllyId:"ren",allyActionsToHold:8});

test("LORETACTIC001: validate objective contract before combat",()=>{
 assert.throws(()=>Combat.createBattle([ally("ren"),foe()],[],{
  tacticalObjective:{...objective(),protectAllyId:"ghost"}}),/invalid tactical objective/);
 assert.throws(()=>Combat.createBattle([ally("ren"),foe()],[],{
  tacticalObjective:{...objective(),allyActionsToHold:0}}),/invalid tactical objective/);
 assert.throws(()=>Combat.createBattle([ally("ren"),foe()],[[foe()]],{
  tacticalObjective:objective()}),/invalid tactical objective/);
});
test("LORETACTIC001: holding the approach without defeating enemies succeeds",()=>{
 const b=Combat.createBattle([ally("ren"),foe()],[],{tacticalObjective:objective()});
 Combat.advanceToPlayerTurn(b);
 for(let i=1;i<=8;i++){
  assert.equal(b.active,true,"active before action "+i);
  assert.equal(Combat.performPlayerAttack(b),true);
 }
 assert.equal(b.winner,"ally");assert.equal(b.tacticalOutcome,"held");
 assert.equal(b.allyActions,8);assert.ok(b.fighters.find(x=>x.id==="foe").hp>0);
 assert.ok(b.events.some(e=>e.type==="battle-end"&&e.reason==="held"));
 assert.equal(Combat.performPlayerAttack(b),false);
});
test("LORETACTIC001: beating all enemies before the countdown is a second way to win",()=>{
 const b=Combat.createBattle([ally("ren",700,40),foe(2)],[],{tacticalObjective:objective()});
 Combat.advanceToPlayerTurn(b);assert.equal(Combat.performPlayerAttack(b),true);
 assert.equal(b.winner,"ally");assert.equal(b.tacticalOutcome,"defeated-attackers");
 assert.ok(b.allyActions<8);
});
test("LORETACTIC001: protected hero eliminated means failure even when allies survive",()=>{
 const b=Combat.createBattle([ally("ren",1,1,100),ally("nada",100,1,100),foe(1000,100,250)],
 [],{tacticalObjective:objective()});
 Combat.advanceToPlayerTurn(b);
 assert.equal(b.active,false);assert.equal(b.winner,"enemy");
 assert.equal(b.tacticalOutcome,"protected-fallen");
 assert.ok(b.fighters.find(f=>f.id==="nada").hp>0);
 assert.ok(b.events.some(e=>e.type==="battle-end"&&e.reason==="protected-fallen"));
});
test("LORETACTIC001: other battles retain their default termination",()=>{
 const b=Combat.createBattle([ally("ren",100,40),foe(2)]);
 Combat.advanceToPlayerTurn(b);Combat.performPlayerAttack(b);
 assert.equal(b.winner,"ally");assert.equal(b.tacticalObjective,undefined);
 assert.equal(b.tacticalOutcome,null);
});
test("LORETACTIC001: new FS-05 gate cannot be bypassed, but completed FS-06 replays",()=>{
 const Act2=require("../lore-campaign-act2.js");
 const Story=require("../lore-campaign-core.js");
 const g=Act2.data.catalog(),p=Story.fresh(g),ids=g.nodes.map(n=>n.id);
 p.stories["five-shadows"].completedNodeIds=ids.slice(0,5);
 p.stories["five-shadows"].battleClearedNodeIds=ids.slice(0,2);
 assert.equal(Story.available(g,p,ids[5]),false);
 p.stories["five-shadows"].completedNodeIds.push(ids[5]);
 assert.equal(Story.available(g,p,ids[5]),true);
 assert.equal(p.stories["five-shadows"].battleClearedNodeIds.includes(ids[4]),false);
});
