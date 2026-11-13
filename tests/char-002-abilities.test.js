"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const load=files=>{
 const script=files.map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
 return vm.runInNewContext(script+"\n({AbilityData,SkillCore,AbilityInfo,CombatCore})");
};
const api=load(["initiative-model.js","battle-rng.js","combat-status-core.js",
 "skill-core.js","ability-data.js","ability-info.js","combat-core.js"]);
const ability=(id,slot,level)=>api.AbilityData.get({
 id,combatProfile:"stats002c",skillLevels:{basic:level,special:level,powerful:level}
},slot);
const number=(a)=>JSON.parse(JSON.stringify(a));
test("CHAR002 Ren has six custom active levels, not generic +0.1 increments",()=>{
 const basics=[1,1.1,1.2,1.2,1.3,1.4],specials=[1.05,1.15,1.15,1.25,1.25,1.35],
 powers=[1.6,1.75,1.75,1.9,1.9,2.05];
 for(let level=1;level<=6;level++){
  const b=ability("ren","basic",level),s=ability("ren","special",level),
   p=ability("ren","powerful",level);
  assert.equal(b.multiplier,basics[level-1]);
  assert.equal(s.multiplier,specials[level-1]);
  assert.equal(p.multiplier,powers[level-1]);
  assert.equal(b.damageType,"physical");
  assert.equal(s.damageType,"physical");
  assert.equal(p.damageType,"physical");
  assert.equal(s.weakening,level>=3?3:2);
  assert.equal(s.cooldown,level>=5?1:2);
  assert.equal(p.cooldown,3);
  assert.equal(p.followUpStatusAll.amount,level>=3?20:15);
  assert.equal(p.followUpStatusAll.turns,level>=5?3:2);
  assert.equal(b.onHitStatus?.turns,level<4?undefined:level>=6?2:1);
 }
});
test("CHAR002 Nada has physical single-target skills, not Ren area status",()=>{
 const basics=[.8,.9,1,1.1,1.2,1.3],specials=[.7,.8,.8,.9,.9,1],
 powers=[1,1.1,1.1,1.2,1.2,1.3];
 for(let level=1;level<=6;level++){
  const b=ability("nada","basic",level),s=ability("nada","special",level),
   p=ability("nada","powerful",level);
  assert.equal(b.multiplier,basics[level-1]);
  assert.equal(s.multiplier,specials[level-1]);
  assert.equal(p.multiplier,powers[level-1]);
  assert.equal(b.damageType,"physical");
  assert.equal(s.damageType,"physical");
  assert.equal(p.damageType,"physical");
  assert.equal(s.weakening,level>=3?3:2);
  assert.equal(s.cooldown,level>=5?1:2);
  assert.equal(p.cooldown,3);
  assert.equal(p.followUpStatusAll,undefined);
  assert.equal(p.onHitStatus.type,"debuff-resistance-down");
  assert.equal(p.onHitStatus.amount,level>=3?25:20);
  assert.equal(p.onHitStatus.turns,level>=5?3:2);
 }
});
test("CHAR002 Nada passive is live for allies and accurately explained",()=>{
 const passive=api.AbilityData.get({id:"nada",side:"ally"},"passive");
 assert.equal(passive.combatRules.allyBonusVsDebuffedPercent,10);
 const info=api.AbilityInfo.format({id:"nada",side:"ally"},"passive");
 assert.equal(info.status,"available");
 assert.match(info.description,/союзники/);
 assert.match(info.description,/10%/);
 assert.match(api.AbilityInfo.format({id:"nada",skillLevels:{powerful:1}},"powerful").description,/основной цели/);
});
test("CHAR002 untouched trial actors, mannequin and missing leaders",()=>{
 assert.equal(api.AbilityData.get({id:"nada"},"leader"),null);
 assert.equal(api.AbilityData.get({id:"ren"},"leader"),null);
 assert.equal(api.AbilityData.get({id:"trial-nada"},"special").multiplier,.8);
 assert.equal(api.AbilityData.get({id:"kael"},"special").kind,"guard");
 assert.equal(api.AbilityData.get({id:"trial-ren",skillLevels:{basic:4}},"basic").onHitStatus.turns,2);
});
function fighter(id,side,speed,hp,physicalAttack){
 return {id,name:id,side,speed,hp,atk:physicalAttack,physicalAttack,
  physicalDefense:0,magicDefense:0,protection:0,maxProtection:0,
  accuracy:0,evasion:0,critChance:0,critDamage:150,
  defensePenetration:0,debuffPotency:0,debuffResistance:0,
  combatProfile:"stats002c",
  skillLevels:{basic:1,special:1,powerful:1}};
}
function battleWithNada(includeNada){
 const ren=fighter("ren","ally",150,120,28);
 const nada=fighter("nada","ally",125,110,19);
 const dummy=fighter("dummy","enemy",10,500,0);
 const fighters=includeNada?[ren,nada,dummy]:[ren,dummy];
 const battle=api.CombatCore.createBattle(fighters);
 api.CombatCore.advanceToPlayerTurn(battle);
 const target=battle.fighters.find(f=>f.id==="dummy");
 target.weakenAttacks=2; // real active negative status
 assert.equal(battle.fighters[battle.currentActor].id,"ren");
 assert.equal(api.CombatCore.performPlayerAbility(battle,"basic"),true);
 return 500-target.hp;
}
test("CHAR002 live Nada aura adds 10 percentage points to Ren 15% passive",()=>{
 const damageAlone=battleWithNada(false);
 const damageTogether=battleWithNada(true);
 assert.equal(damageAlone,Math.round(28*1.15));
 assert.equal(damageTogether,Math.round(28*1.25));
});
