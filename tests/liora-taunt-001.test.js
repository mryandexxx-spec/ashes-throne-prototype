"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const scripts=["initiative-model.js","battle-rng.js","combat-status-core.js",
 "skill-core.js","ability-data.js","combat-core.js","progress-core.js","gear-data.js"];
const api=vm.runInNewContext(scripts.map(read).join("\n")+
 "\n({CombatCore,CombatStatusCore,AbilityData,ProgressCore,GearData,SkillCore})");
const {CombatCore:Combat,CombatStatusCore:Status,AbilityData,ProgressCore,GearData,SkillCore}=api;
const fighter=(id,side,speed=100)=>({id,name:id,side,speed,hp:500,atk:20,
 physicalAttack:20,physicalDefense:0,magicDefense:0,protection:0,maxProtection:0,
 accuracy:0,evasion:0,critChance:0,critDamage:150,defensePenetration:0,
 debuffPotency:25,debuffResistance:0,combatProfile:"stats002c",
 skillLevels:{basic:1,special:1,powerful:1}});
test("LIORA001: Liora has an L85 level cap; temporary demo fighters remain L15",()=>{
 assert.equal(ProgressCore.maxLevelOf("liora"),85);
 assert.equal(ProgressCore.maxLevelOf("ren"),85);
 assert.equal(ProgressCore.maxLevelOf("kael"),15);
});
test("LIORA001: provocation is displayed and expires after exactly two later own turns",()=>{
 const a=fighter("liora","ally",1000),b=fighter("ren","ally",50),e=fighter("shade","enemy",1);
 const battle=Combat.createBattle([a,b,e]);
 battle.currentActor=0;battle.fighters[0].meter=1000;
 assert.equal(AbilityData.get(battle.fighters[0],"special").tauntTurns,2);
 assert.equal(Combat.performActorAbility(battle,"special",0),true);
 assert.equal(Status.read(battle.fighters[0],"taunt").remaining,2);
 assert.equal(Combat.activeEffects(battle.fighters[0]).some(x=>x.type==="taunt"),true);
 Status.tickOwnTurn(battle.fighters[0]);
 assert.equal(Status.read(battle.fighters[0],"taunt").remaining,1);
 Status.tickOwnTurn(battle.fighters[0]);
 assert.equal(Status.read(battle.fighters[0],"taunt"),null);
});
test("LIORA001: enemy single-target action is forced onto Liora; area targets stay all",()=>{
 const battle=Combat.createBattle([
   fighter("ren","ally"),fighter("liora","ally"),fighter("shade","enemy")]);
 assert.equal(Status.apply(battle.fighters[1],"taunt",0,2),true);
 const singles=Combat.actorTargetIndices(battle,2,"enemy",0);
 assert.equal(singles.length,1);assert.equal(singles[0],1);
 const group=Combat.actorTargetIndices(battle,2,"all-enemies",0);
 assert.equal(group.length,2);assert.equal(group.includes(0),true);
 assert.equal(group.includes(1),true);
 battle.fighters[1].hp=0;
 const afterDeath=Combat.actorTargetIndices(battle,2,"enemy",0);
 assert.equal(afterDeath[0],0);
});
test("LIORA001: mass guard is a separate ability and protects the entire living party",()=>{
 const battle=Combat.createBattle([
   fighter("liora","ally",1000),fighter("ren","ally",100),fighter("shade","enemy",1)]);
 battle.currentActor=0;battle.fighters[0].meter=1000;
 const def=AbilityData.get(battle.fighters[0],"powerful");
 assert.equal(def.name,"Держать строй");assert.equal(def.target,"all-allies");
 assert.equal(Combat.performActorAbility(battle,"powerful",0),true);
 assert.equal(battle.fighters[0].guardHits,2);
 assert.equal(battle.fighters[1].guardHits,2);
});

test("LIORA001: leader aura adds 10% Protection and vanishes when Liora dies",()=>{
 const l=fighter("liora","ally"),r=fighter("ren","ally"),e=fighter("shade","enemy");
 l.protection=80;l.maxProtection=80;r.protection=50;r.maxProtection=50;
 const battle=Combat.createBattle([l,r,e],[],{leaderId:"liora"});
 assert.equal(battle.fighters[0].protection,88);
 assert.equal(battle.fighters[0].maxProtection,88);
 assert.equal(battle.fighters[1].protection,55);
 assert.equal(battle.fighters[1].maxProtection,55);
 // The opponent deals lethal damage to the actual leader through the
 // ordinary combat executor. The aura is removed before its action ends.
 battle.currentActor=2;battle.fighters[2].meter=1000;
 battle.fighters[2].atk=999; battle.fighters[2].physicalAttack=999;
 assert.equal(Combat.performActorAbility(battle,"basic",0),true);
 assert.equal(battle.fighters[0].hp,0);
 assert.equal(battle.fighters[1].maxProtection,50);
 assert.equal(battle.fighters[1].protection,50);
});

test("LIORA001: Liora active skill ranks L1-L6 are distinct from generic guard growth",()=>{
 for(let level=1;level<=6;level++){
  const hero=fighter("liora","ally");hero.skillLevels={basic:level,special:level,powerful:level};
  const basic=AbilityData.get(hero,"basic");
  const special=AbilityData.get(hero,"special");
  const powerful=AbilityData.get(hero,"powerful");
  assert.equal(basic.multiplier,[1,1.05,1.1,1.15,1.2,1.25][level-1]);
  assert.equal(special.guardHits,[2,2,3,3,4,4][level-1]);
  assert.equal(special.tauntTurns,2,"rank cannot increase taunt duration");
  assert.equal(special.cooldown,[3,3,3,2,2,2][level-1]);
  assert.equal(powerful.guardHits,[2,2,2,3,3,3][level-1]);
  assert.equal(powerful.target,"all-allies");
  assert.equal(powerful.cooldown,3);
 }
});
test("LIORA001: tank gear offers all six slots at every G1-G13 rank",()=>{
 const slots=GearData.SLOTS.map(x=>x.id);
 assert.equal(slots.length,6);
 for(let tier=1;tier<=13;tier++){
  for(const slot of slots){
   const items=GearData.offered("tank",slot,tier);
   assert.equal(items.length,1,"tank G"+tier+" "+slot);
   assert.equal(items[0].tier,tier);
   assert.equal(items[0].allowedClasses.includes("tank"),true);
   assert.equal(items[0].bonuses.speed,0);
  }
 }
});

test("LIORA001: old two-hero passive saves remain valid; new Liora level is optional",()=>{
 assert.equal(SkillCore.validPassiveLevels({ren:2,nada:3}),true);
 assert.equal(SkillCore.validPassiveLevels({ren:2,nada:3,liora:4}),true);
 assert.equal(SkillCore.validPassiveLevels({ren:2,nada:3,liora:0}),false);
 assert.equal(SkillCore.validPassiveLevels({ren:2,nada:3,liora:undefined}),false);
 const owner=fighter("liora","ally");
 owner.skillLevels.passive=6;
 const p=AbilityData.get(owner,"passive");
 assert.equal(p.combatRules.protectAllyBelowHpPercent,45);
 assert.equal(p.combatRules.protectAllyGuardHits,2);
 assert.equal(p.combatRules.protectAllyCooldownOwnTurns,2);
});
test("LIORA001: Liora shields a wounded teammate, not herself, with a real cooldown",()=>{
 const leader=fighter("liora","ally");
 const ally=fighter("ren","ally");ally.hp=100;
 const enemy=fighter("shade","enemy");enemy.physicalAttack=80;enemy.atk=80;
 const battle=Combat.createBattle([leader,ally,enemy]);
 battle.currentActor=2;battle.fighters[2].meter=1000;
 assert.equal(Combat.performActorAbility(battle,"basic",1),true);
 assert.equal(battle.fighters[1].hp,20);
 assert.equal(battle.fighters[1].guardHits,1);
 assert.equal(battle.fighters[0].emergencyGuardCooldown,3);
 assert.equal(battle.events.some(x=>x.type==="passive-trigger"&&x.ownerId==="liora"),true);
 // Another action while the cooldown is active cannot grant a second shield.
 battle.fighters[1].guardHits=0;battle.currentActor=2;battle.fighters[2].meter=1000;
 assert.equal(Combat.performActorAbility(battle,"basic",1),true);
 assert.equal(battle.fighters[1].guardHits,0);
});
