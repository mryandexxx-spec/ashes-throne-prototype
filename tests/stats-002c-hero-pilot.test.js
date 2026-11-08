"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const game=read("game.js");
const begin=game.indexOf("const PILOT_HERO_STATS=");
const end=game.indexOf("function hasLeaderSkill",begin);
assert.ok(begin>0&&end>begin);
const src=[
 "initiative-model.js","ability-data.js","combat-core.js","gear-data.js","progress-core.js"
].map(read).join("\n")+
 "\n"+game.slice(0,game.indexOf("const $="))+
 "\nconst progress=ProgressCore.createProgress(HEROES.filter(x=>x.side==='ally'));\n"+
 game.slice(begin,end)+
 "\n({HEROES,progress,ProgressCore,CombatCore,AbilityData,GearData,progressedHero,progressedEnemy,PILOT_HERO_STATS})";
const {HEROES,progress,ProgressCore,CombatCore,AbilityData,GearData,progressedHero,progressedEnemy}=vm.runInNewContext(src);
const byId=id=>HEROES.find(x=>x.id===id);
const stats={
 kael:{hp:120,atk:24,speed:110,physicalDefense:24,magicDefense:12,protection:20},
 lyra:{hp:88,atk:31,speed:155,physicalDefense:6,magicDefense:15,protection:0},
 darin:{hp:105,atk:27,speed:125,physicalDefense:14,magicDefense:9,protection:0}
};
for(const [id,expected] of Object.entries(stats)){
 const h=progressedHero(byId(id));
 for(const [key,val] of Object.entries(expected))assert.equal(h[key],val,id+" "+key);
 assert.equal(h.physicalAttack,h.atk);
 assert.equal(h.combatProfile,"stats002c");
 assert.equal(h.maxProtection,h.protection);
 assert.equal(h.magicAttack,undefined,"no invented magic attack for "+id);
 assert.equal(AbilityData.get(h,"basic").damageType,"physical");
 assert.equal(GearData.statOverview(h).find(s=>s.id==="physicalAttack").value,h.atk);
 assert.equal(GearData.statOverview(h).find(s=>s.id==="magicAttack").value,null);
 assert.equal(GearData.statOverview(h).find(s=>s.id==="protection").value,h.protection);
}
for(const id of ["lyra","darin"]){
 const h=progressedHero(byId(id));
 assert.equal(AbilityData.get(h,"special").damageType,"physical");
 assert.equal(AbilityData.get(h,"powerful").damageType,"physical");
}
assert.equal(AbilityData.get(progressedHero(byId("kael")),"special").kind,"guard");
assert.equal(AbilityData.get(progressedHero(byId("kael")),"powerful").kind,"guard");
for(const id of ["medic-demo","test-area-damage"]){
 const h=progressedHero(byId(id));
 assert.equal(h.combatProfile,undefined);
 assert.equal(AbilityData.get(h,"basic").damageType,undefined);
 assert.equal(h.physicalAttack,undefined);
}
for(const id of ["ves","shade","ves-2","shade-2","ves-3"]){
 const e=progressedEnemy(byId(id));
 assert.equal(e.combatProfile,"stats002c");
 assert.equal(e.physicalAttack,e.atk);
 assert.equal(e.physicalDefense,8);
 assert.equal(e.magicDefense,8);
 assert.equal(e.protection,0);
 assert.equal(AbilityData.get(e,"basic").damageType,"physical");
 assert.equal(byId(id).physicalAttack,undefined,"roster template must not mutate");
}
// Paid upgrades: the pilot physical attack follows computed legacy ATK, not raw template.
progress.levels.lyra=3;
const upgraded=progressedHero(byId("lyra"));
assert.ok(upgraded.atk>byId("lyra").atk);
assert.equal(upgraded.physicalAttack,upgraded.atk);
assert.equal(upgraded.speed,155,"speed must not scale by level");
// The physical enemy attacks Kael's Protection before HP.
const kael=progressedHero(byId("kael"));
const ves=progressedEnemy(byId("ves"));
ves.speed=160;
let b=CombatCore.createBattle([kael,ves]);
CombatCore.advanceToPlayerTurn(b);
assert.equal(b.fighters[0].protection,5);
assert.equal(b.fighters[0].hp,120);
assert.equal(b.events.find(x=>x.type==="damage").damageType,"physical");
assert.equal(b.events.find(x=>x.type==="damage").protectionDamage,15);
assert.equal(b.events.find(x=>x.type==="damage").hpDamage,0);
// A magic attack fixture exercises Kael's distinct magic defense and Protection.
b=CombatCore.createBattle([
 {...byId("test-magical-strike"),id:"test-magical-strike",name:"test-magical-strike",
 side:"ally",hp:120,atk:1,magicAttack:40,speed:300},
 progressedHero(byId("kael"))&&{...progressedHero(byId("kael")),side:"enemy",speed:1}
]);
CombatCore.advanceToPlayerTurn(b);
assert.equal(CombatCore.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].protection,0,"magic damage consumes shield");
assert.equal(b.fighters[1].hp,104,"40 magic against 12 DEF yields 36, 20 absorbed and 16 HP");
// Old technical fixtures with physicalAttack but no profile marker remain legacy.
const originalTest={id:"lyra",physicalAttack:900,atk:35};
assert.equal(AbilityData.get(originalTest,"special").damageType,undefined);
const fx={id:"test-physical-strike",physicalAttack:100};
assert.equal(AbilityData.get(fx,"special").damageType,"physical");
// Battle UI sources must expose the Protection resource, not conflate it with guard.
assert.match(game,/arena-protection/);
assert.match(game,/Protection: /);
assert.match(game,/Все 14 характеристик/);
assert.match(read("styles.css"),/\.arena-protection span/);
console.log("Stats-002C: hero profiles, gear-safe scaling, typed enemies, shield, magic defense and legacy fixtures passed");
