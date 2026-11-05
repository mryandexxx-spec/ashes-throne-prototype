"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const source=["initiative-model.js","ability-data.js","combat-core.js"].map(p=>fs.readFileSync(path.join(root,p),"utf8")).join("\n");
const {AbilityData,CombatCore}=vm.runInNewContext(source+"\n({AbilityData,CombatCore})");
const hero=(id,side="ally",atk=20,hp=200,speed=200)=>({id,name:id,side,atk,hp,speed});
const make=id=>{const b=CombatCore.createBattle([hero(id),hero("enemy","enemy",5,500,5)]);CombatCore.advanceToPlayerTurn(b);return b;};
for(const [id,name,target,kind,multiplier] of [
 ["kael","Прикрытие","ally","guard",undefined],
 ["lyra","Ослабляющий удар","enemy","damage",1],
 ["darin","Сокрушительный удар","enemy","damage",1.5]
]){
 const def=AbilityData.get(hero(id),"special");
 assert.equal(def.name,name);
 assert.equal(def.target,target);
 assert.equal(def.kind,kind);
 if(multiplier!==undefined)assert.equal(def.multiplier,multiplier);
 const b=make(id);
 assert.equal(CombatCore.specialName(b.fighters[0]),name);
 assert.equal(CombatCore.abilityTargetSide(b,"special"),target);
 assert.equal(CombatCore.abilityReady(b,"special"),true);
 assert.equal(CombatCore.performPlayerAbility(b,"special"),true);
 assert.equal(b.fighters[0].specialCooldown,2);
 if(id==="kael"){
  assert.equal(b.fighters[0].guardHits,2);
  assert.equal(b.fighters[1].hp,500);
 }else{
  assert.equal(b.fighters[1].hp,id==="darin"?470:480);
  if(id==="lyra")assert.equal(b.fighters[1].weakenAttacks,2);
 }
}
const basic=make("kael");
assert.equal(CombatCore.abilityTargetSide(basic,"basic"),"enemy");
assert.equal(CombatCore.performPlayerAbility(basic,"basic"),true);
assert.equal(basic.fighters[1].hp,480);
const unknown=make("other");
assert.equal(CombatCore.specialName(unknown.fighters[0]),"Особый удар");
assert.equal(CombatCore.abilityTargetSide(unknown,"special"),"enemy");
assert.equal(CombatCore.performPlayerAbility(unknown,"special"),true);
assert.equal(unknown.fighters[1].hp,480);
assert.equal(CombatCore.abilityTargetSide(unknown,"powerful"),null);
assert.equal(CombatCore.abilityReady(unknown,"powerful"),false);
assert.equal(CombatCore.performPlayerAbility(unknown,"powerful"),false);
const dead=make("kael");
dead.fighters[0].hp=0;
assert.equal(CombatCore.abilityReady(dead,"special"),false);
const wrongSide=make("kael");
wrongSide.selectedAlly=1;
assert.equal(CombatCore.performPlayerAbility(wrongSide,"special"),false);
assert.equal(wrongSide.fighters[0].specialCooldown,0);
console.log("Ability-001 definitions and shared execution contracts passed");
