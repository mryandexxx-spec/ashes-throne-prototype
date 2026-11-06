"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const code=["initiative-model.js","ability-data.js","combat-core.js"]
 .map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const {CombatCore:core,AbilityData}=vm.runInNewContext(code+"\n({CombatCore,AbilityData})");
const h=(id,side="ally",hp=100,atk=20,speed=100)=>
 ({id,name:id,side,hp,atk,speed});
const battle=(allies,enemies=[h("foe","enemy",500,1,1)],leaderId=null,waves=[])=>
 core.createBattle([...allies,...enemies],waves,{leaderId});

let b=battle([h("test-leader-aura"),h("kael")]);
assert.equal(b.leaderId,null,"no leader is valid, even if a leader-capable hero is present");
assert.equal(core.effectiveStat(b,b.fighters[0],"atk"),20,"unselected leader has no aura");
assert.equal(core.effectiveStat(b,b.fighters[1],"speed"),100);
assert.equal(core.activeLeaderModifiers(b,"kael").length,0);
assert.equal(AbilityData.get({id:"kael"},"leader"),null);
assert.equal(core.abilityReady(b,"leader"),false);
assert.equal(core.performPlayerAbility(b,"leader"),false);

b=battle([h("test-leader-aura"),h("kael")],[h("foe","enemy",500,1,1)],"test-leader-aura");
assert.equal(b.leaderId,"test-leader-aura");
assert.equal(core.effectiveStat(b,b.fighters[0],"atk"),24);
assert.equal(core.effectiveStat(b,b.fighters[1],"atk"),24);
assert.equal(core.effectiveStat(b,b.fighters[1],"speed"),120);
assert.equal(core.effectiveStat(b,b.fighters[2],"atk"),1,"enemies never get allied aura");
assert.equal(b.fighters[1].atk,20,"derived buff doesn't mutate base attack");
assert.deepEqual(Array.from(core.activeLeaderModifiers(b,"kael"),x=>({...x})),
 [{stat:"atk",operation:"flat",value:4},{stat:"speed",operation:"flat",value:20}]);
core.advanceToPlayerTurn(b);
assert.equal(b.fighters[b.currentActor].id,"test-leader-aura",
 "equal effective speed preserves stable order");
const enemy=b.fighters[2],before=enemy.hp;
assert.equal(core.performPlayerAbility(b,"basic"),true);
assert.equal(enemy.hp,before-24,"aura changes real attack calculation");
assert.equal(b.fighters[0].atk,20);
assert.equal(b.allyActions,1);

// Owner's personal passive and the leader's aura add without special-case code.
b=battle([h("test-leader-aura"),h("test-passive-always")],[h("foe","enemy",500,1,1)],"test-leader-aura");
assert.equal(core.effectiveStat(b,b.fighters[1],"atk"),29,"20 + passive 5 + leader 4");
assert.equal(core.effectiveStat(b,b.fighters[1],"speed"),120);

b=battle([h("test-leader-self"),h("kael")],[h("foe","enemy",500,1,1)],"test-leader-self");
assert.equal(core.effectiveStat(b,b.fighters[0],"atk"),29);
assert.equal(core.effectiveStat(b,b.fighters[1],"atk"),20,"self-only aura never buffs allies");

b=battle([h("test-leader-aura"),h("kael")],[h("foe","enemy",500,1,1)],"test-leader-aura");
b.fighters[0].hp=0;
assert.equal(core.activeLeaderModifiers(b,"kael").length,0,"dead leader's aura is disabled");
assert.equal(core.effectiveStat(b,b.fighters[1],"atk"),20);
assert.equal(b.leaderId,"test-leader-aura","leader assignment is not silently transferred");
b.fighters[0].hp=100;
assert.equal(core.effectiveStat(b,b.fighters[1],"atk"),24,
 "a hypothetical revived leader reactivates the aura when alive");
b.fighters[1].hp=0;
assert.equal(core.activeLeaderModifiers(b,"kael").length,0,"dead recipient is excluded");

// Victory/waves must neither transfer leadership nor create another leader.
b=battle([h("test-leader-aura"),h("kael")],[h("weak","enemy",1,1,1)],
 "test-leader-aura",[[h("second","enemy",100,1,1)]]);
core.advanceToPlayerTurn(b);
assert.equal(core.performPlayerAbility(b,"basic"),true);
assert.equal(b.wave,2,"wave transitions remain correct");
assert.equal(b.leaderId,"test-leader-aura");
assert.equal(core.effectiveStat(b,b.fighters[1],"atk"),24);
assert.equal(core.effectiveStat(b,b.fighters[2],"atk"),1);

for(const bad of ["kael","foe","missing",17,{},false]){
 assert.throws(()=>battle([h("test-leader-aura"),h("kael")],[h("foe","enemy")],bad),
  "invalid or ineligible leader assignment rejected: "+String(bad));
}
assert.throws(()=>battle([h("test-leader-aura","ally",0),h("kael")],
 [h("foe","enemy")],"test-leader-aura"),"dead leaders can't be assigned");
// Existing call signatures, no leader UI, and five playable heroes remain unchanged.
b=core.createBattle([h("kael"),h("foe","enemy",100,1,1)]);
assert.equal(b.leaderId,null);
assert.equal(core.effectiveStat(b,b.fighters[0],"atk"),20);
for(const id of ["kael","lyra","darin","medic-demo","test-area-damage"]){
 assert.equal(AbilityData.get({id},"leader"),null,"playable ally never implicitly gains leadership");
}
console.log("Combat-014A explicit leader selection, opt-in auras, passive stacking, death, waves and invalid roster passed");
