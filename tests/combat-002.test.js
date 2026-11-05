"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname,"..");
const modelSrc = fs.readFileSync(path.join(root,"initiative-model.js"),"utf8");
const coreSrc = fs.readFileSync(path.join(root,"combat-core.js"),"utf8");
const context = vm.createContext({});
const core = vm.runInContext(modelSrc+"\n"+coreSrc+"\nCombatCore",context);

const party = [
 {id:"kael",name:"Каэль",side:"ally",hp:120,atk:24,speed:110},
 {id:"lyra",name:"Лира",side:"ally",hp:88,atk:31,speed:155},
 {id:"darin",name:"Дарин",side:"ally",hp:105,atk:27,speed:125},
 {id:"ves",name:"Вестник",side:"enemy",hp:90,atk:18,speed:105},
 {id:"shade",name:"Клинок",side:"enemy",hp:78,atk:22,speed:135}
];
let battle=core.createBattle(party);
core.advanceToPlayerTurn(battle);
assert.equal(battle.fighters[battle.currentActor].id,"lyra");
assert.equal(battle.turn,1);
assert.equal(core.chooseEnemy(battle,0),false,"ally cannot be targeted");
assert.equal(core.chooseEnemy(battle,99),false,"out-of-range target rejected");
assert.equal(core.chooseEnemy(battle,4),true,"living enemy target works");
assert.equal(core.performPlayerAttack(battle),true);
assert.equal(battle.fighters[4].hp,47,"manual ally hit uses actor's attack");
assert.ok(battle.turn>=2,"turn counter includes the player action and any subsequent enemy actions");

let steps=0,playerActors=[];
while(battle.active && steps++<50){
 const acting=battle.fighters[battle.currentActor];
 assert.equal(acting.side,"ally","player only controls allied turns");
 assert.ok(acting.hp>0 && acting.meter>=1000-1e-8);
 playerActors.push(acting.id);
 assert.equal(core.performPlayerAttack(battle),true);
}
assert.ok(steps<50,"battle terminates without runaway loop");
assert.equal(battle.winner,"ally");
assert.equal(core.performPlayerAttack(battle),false,"no actions after battle ends");
assert.equal(party[0].hp,120,"prototype hero data is unchanged");

const defeat=core.createBattle([
 {id:"ally",name:"Ally",side:"ally",hp:1,atk:1,speed:100},
 {id:"enemy",name:"Enemy",side:"enemy",hp:100,atk:20,speed:200}
]);
core.advanceToPlayerTurn(defeat);
assert.equal(defeat.winner,"enemy");
assert.equal(defeat.active,false);

const tied=core.createBattle([
 {id:"a",name:"A",side:"ally",hp:20,atk:1,speed:100},
 {id:"b",name:"B",side:"ally",hp:20,atk:1,speed:100},
 {id:"e",name:"E",side:"enemy",hp:50,atk:1,speed:100}
]);
core.advanceToPlayerTurn(tied);
assert.equal(tied.fighters[tied.currentActor].id,"a");
core.performPlayerAttack(tied);
assert.equal(tied.fighters[tied.currentActor].id,"b","tie order is stable");

const fresh=core.createBattle(party);
core.advanceToPlayerTurn(fresh);
assert.equal(fresh.turn,1);
assert.equal(fresh.fighters[0].hp,120);

console.log("Combat-002 rules tests passed");
