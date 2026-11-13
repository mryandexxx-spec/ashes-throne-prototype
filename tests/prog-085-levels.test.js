"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const load=(file,n)=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,"..",file),"utf8")+"\n"+n);
const core=load("progress-core.js","ProgressCore");
const StatCore=require("../hero-stats-core.js");
const profiles=require("../hero-stats-profiles.js");
const bridge=require("../hero-stats-combat-bridge.js");
const roster=[{id:"kael",side:"ally",hp:120,atk:24,speed:110},
 {id:"ren",side:"ally",hp:91,atk:27,speed:150},
 {id:"nada",side:"ally",hp:85,atk:18,speed:120}];
const fresh=()=>core.createProgress(roster);
test("PROG085 account cap and hero L85 are reachable, but demo cap stays L15",()=>{
 const p=fresh();
 assert.equal(core.MAX_LEVEL,85);
 assert.equal(core.MAX_ACCOUNT_LEVEL,85);
 assert.equal(core.heroLevelCap(p,"ren"),3);
 assert.equal(core.heroLevelCap(p,"kael"),3);
 p.accountXp=core.xpThresholdForLevel(85);
 assert.equal(core.accountLevel(p),85);
 assert.equal(core.heroLevelCap(p,"ren"),85);
 assert.equal(core.heroLevelCap(p,"nada"),85);
 assert.equal(core.heroLevelCap(p,"kael"),15);
 assert.equal(core.heroLevelCapForAccountLevel(16),16);
 assert.equal(core.heroLevelCapForAccountLevel(84),84);
 assert.equal(core.nextHeroCapUnlock(84).heroCap,85);
});
test("PROG085 1/5/max currency upgrades are atomic and stop at level 85",()=>{
 const p=fresh();
 assert.equal(core.grantLevelTestResources(p),true);
 assert.equal(core.accountLevel(p),85);
 assert.equal(core.upgradePlan(p,"ren",5).levels,5);
 const initial=p.currency;
 const five=core.upgradeMany(p,"ren",5);
 assert.equal(five.from,1);assert.equal(five.to,6);
 assert.equal(initial-p.currency,five.cost);
 const rest=core.upgradeMany(p,"ren",85);
 assert.equal(rest.to,85);
 assert.equal(rest.levels,79);
 assert.equal(core.upgradeCost(p,"ren"),null);
 assert.equal(core.upgradeMany(p,"ren",85),null);
 assert.equal(core.upgradePlan(p,"nada",85).to,85);
 assert.equal(core.upgradeMany(p,"nada",85).to,85);
 assert.equal(core.upgradeMany(p,"kael",85).to,15);
 assert.equal(core.upgradeMany(p,"kael",1),null);
});
test("PROG085 affordability and account gate never overspend or over-upgrade",()=>{
 const p=fresh();p.currency=100000;
 assert.equal(core.upgradePlan(p,"ren",85).to,3);
 assert.equal(core.upgradeMany(p,"ren",85).to,3);
 assert.equal(core.upgradeMany(p,"ren",85),null);
 const before=JSON.stringify(p);
 assert.equal(core.upgradeMany(p,"ren",0),null);
 assert.equal(core.upgradeMany(p,"ren",-1),null);
 assert.equal(core.upgradeMany(p,"ren",2.2),null);
 assert.equal(JSON.stringify(p),before);
 p.accountXp=core.xpThresholdForLevel(85);p.currency=1;
 const limited=core.upgradePlan(p,"nada",85);
 assert.equal(limited.levels,0);
 assert.equal(core.upgradeMany(p,"nada",85),null);
 assert.equal(p.levels.nada,1);
 assert.equal(p.currency,1);
});
test("PROG085 85-level Ren and Nada increase real HP/attack, not speed",()=>{
 const p=fresh();core.grantLevelTestResources(p);
 for(const id of ["ren","nada"]){
  const early=bridge.apply(roster.find(h=>h.id===id),{level:1,stars:1},profiles[id],StatCore);
  const last=bridge.apply(roster.find(h=>h.id===id),{level:85,stars:1},profiles[id],StatCore);
  assert.ok(last.hp>early.hp);
  assert.ok(last.physicalAttack>early.physicalAttack);
  assert.equal(last.speed,early.speed);
  assert.equal(core.upgradeMany(p,id,85).to,85);
  assert.equal(core.levelOf(p,id),85);
 }
});
test("PROG085 QA access is explicit, repeat-safe and does not level heroes",()=>{
 const p=fresh();
 assert.equal(core.grantLevelTestResources(p),true);
 const xp=p.accountXp,currency=p.currency;
 assert.equal(core.grantLevelTestResources(p),true);
 assert.equal(p.accountXp,xp);assert.equal(p.currency,currency);
 assert.equal(p.levels.ren,1);assert.equal(p.levels.nada,1);
});
