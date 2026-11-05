"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.join(__dirname,"..");
const source=fs.readFileSync(path.join(root,"progress-core.js"),"utf8");
const core=vm.runInNewContext(source+"\nProgressCore");
const heroes=[
 {id:"kael",name:"Каэль",side:"ally",hp:120,atk:24,speed:110},
 {id:"lyra",name:"Лира",side:"ally",hp:88,atk:31,speed:155},
 {id:"ves",name:"Вестник",side:"enemy",hp:90,atk:18,speed:105}
];
const p=core.createProgress(heroes);
assert.equal(p.materials,0);
assert.equal(p.levels.kael,1);
assert.equal(core.levelOf(p,"ves"),null);
assert.equal(core.upgradeCost(p,"kael"),1);
assert.equal(core.upgrade(p,"kael"),false,"no free upgrades");
assert.equal(core.upgrade(p,"ves"),false,"enemy never upgrades");
assert.equal(core.awardVictory(p,{active:false,winner:"enemy"}),0,"no defeat reward");
assert.equal(core.awardVictory(p,{active:true,winner:"ally"}),0,"no reward for ongoing battle");
const b={active:false,winner:"ally"};
assert.equal(core.awardVictory(p,b),1);
assert.equal(core.awardVictory(p,b),0,"no repeated award to the same battle");
assert.equal(p.materials,1);
assert.equal(core.upgrade(p,"kael"),true);
assert.equal(core.upgrade(p,"kael"),false,"cannot spend twice");
assert.equal(p.materials,0);
assert.equal(p.levels.kael,2);
const second=core.heroStats(p,heroes[0]);
assert.equal(second.hp,132);
assert.equal(second.atk,26);
assert.equal(second.speed,110);
assert.equal(core.upgradeCost(p,"kael"),2);
assert.equal(core.heroStats(p,heroes[1]).hp,88,"other heroes unchanged");
for(let n=0;n<2;n++){
 const b2={active:false,winner:"ally"};
 assert.equal(core.awardVictory(p,b2),1);
}
assert.equal(core.upgrade(p,"kael"),true);
const third=core.heroStats(p,heroes[0]);
assert.equal(third.hp,144);
assert.equal(third.atk,29);
assert.equal(core.upgradeCost(p,"kael"),null);
assert.equal(core.canUpgrade(p,"kael"),false);
assert.equal(core.upgrade(p,"kael"),false);
assert.equal(core.heroStats(p,heroes[1],2).atk,34,"31 * 1.1 rounds to 34");
assert.equal(heroes[0].hp,120,"base data remains unchanged");
const fresh=core.createProgress(heroes);
assert.equal(fresh.levels.kael,1,"fresh page session starts at level one");
assert.equal(fresh.materials,0);
console.log("Progress-001 economy, level costs, rounding and one-time award passed");
