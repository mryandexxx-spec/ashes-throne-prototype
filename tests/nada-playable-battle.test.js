"use strict";
/* NADAPLAY001: real combat core, targeting, cooldown, status and replay. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const script=["initiative-model.js","combat-status-core.js","skill-core.js",
 "ability-data.js","battle-rng.js","combat-core.js"]
 .map(read).join("\n");
const {C,A}=vm.runInNewContext(script+"\n({C:CombatCore,A:AbilityData})");
const nada=()=>({id:"nada",name:"Нада",side:"ally",classId:"support",hp:85,atk:18,speed:120,
 combatProfile:"stats002c",physicalAttack:18,physicalDefense:8,magicDefense:12,
 protection:0,maxProtection:0,skillLevels:{basic:1,special:1,powerful:1}});
const enemy=(hp=200)=>({id:"enemy",name:"Противник",side:"enemy",hp,atk:1,speed:1,
 physicalDefense:0,magicDefense:0,protection:0,maxProtection:0});
test("Nada builds distinct read-move stacks with special and group powerful",()=>{
 const battle=C.createBattle([nada(),enemy()]);
 C.advanceToPlayerTurn(battle);
 assert.equal(battle.fighters[battle.currentActor].id,"nada");
 assert.equal(C.performPlayerAbility(battle,"special"),true);
 assert.ok(battle.fighters[1].hp<200);
 assert.equal(battle.fighters[1].renStatuses?.["read-move"]?.stacks,2);
 assert.ok(battle.fighters[0].specialCooldown>=1);
 assert.equal(C.performPlayerAbility(battle,"powerful"),true);
 assert.ok(battle.fighters[1].hp<200-18*.7);
 assert.equal(battle.fighters[1].renStatuses?.["read-move"]?.stacks,4);
 assert.equal(A.get(nada(),"passive").name,"Внимание к деталям");
 assert.equal(A.get(nada(),"leader"),null);
});
test("a second battle starts clean; Nada remains usable independently of trial-Nada",()=>{
 const before=C.createBattle([nada(),enemy(12)]);
 C.advanceToPlayerTurn(before);
 assert.equal(C.performPlayerAbility(before,"basic"),true);
 assert.equal(before.winner,"ally");
 const fresh=C.createBattle([nada(),enemy(200)]);
 C.advanceToPlayerTurn(fresh);
 assert.equal(fresh.fighters[fresh.currentActor].id,"nada");
 assert.equal(fresh.fighters[0].hp,85);
 assert.equal(fresh.fighters[1].hp,200);
 assert.equal(fresh.fighters[1].weakenAttacks,0);
 assert.equal(fresh.fighters[0].specialCooldown,0);
});
