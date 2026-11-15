"use strict";
// GARDENS-TAG-001: explicit owner approval, not an inferred biography/faction rewrite.
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const api=vm.runInNewContext([
 "hero-profile-data.js","skill-core.js","ability-data.js",
 "initiative-model.js","battle-rng.js","combat-status-core.js","combat-core.js"
].map(read).join("\n")+"\n({HeroProfileData,AbilityData,CombatCore})");
test("LIORA GARDENS: permanent roster and biography agree on region tag",()=>{
 const src=read("game.js");
 const row=src.split("\n").find(line=>line.includes('{id:"liora",name:"Лиора Вель"'));
 assert.ok(row,"Liora remains permanent");
 assert.match(row,/classId:"tank",tags:\["gardens-over-abyss"\]/);
 const profile=api.HeroProfileData.get("liora");
 assert.deepEqual(Array.from(profile.tags),["gardens-over-abyss"]);
 assert.equal(api.HeroProfileData.hasTag(profile,"gardens-over-abyss"),true);
 assert.deepEqual(Array.from(api.HeroProfileData.tagLabels(profile.tags)),["Сады над пропастью"]);
 assert.equal(api.HeroProfileData.tag("gardens-over-abyss").kind,"region",
  "do not silently redefine the existing regional tag as recruitment/faction");
 assert.equal(profile.classId,undefined,"class remains independent of tags");
});
test("LIORA GARDENS: combat keeps her tag for Ren/Nada synergy; no new abilities",()=>{
 const fighter=(id,tags,speed)=>({id,name:id,side:"ally",hp:200,atk:20,
  physicalAttack:20,speed,tags,combatProfile:"stats002c",skillLevels:{
   basic:1,special:1,powerful:1,passive:1}});
 const trio=[
  fighter("ren",["gardens-over-abyss"],150),
  fighter("nada",["gardens-over-abyss"],120),
  fighter("liora",Array.from(api.HeroProfileData.get("liora").tags),115)
 ];
 const foe={id:"foe",name:"Test",side:"enemy",hp:200,atk:1,speed:1};
 const battle=api.CombatCore.createBattle([...trio,foe]);
 const liora=battle.fighters.find(f=>f.id==="liora");
 assert.ok(liora);
 assert.equal(api.HeroProfileData.hasTag(liora,"gardens-over-abyss"),true);
 assert.equal(api.AbilityData.get(trio[0],"passive").combatRules.gardensTagId,"gardens-over-abyss");
 assert.equal(api.AbilityData.get(trio[1],"passive").combatRules.gardensTagId,"gardens-over-abyss");
 assert.equal(api.AbilityData.get(trio[2],"special").name,"Под прикрытием");
 assert.equal(api.AbilityData.get(trio[2],"leader").name,"Опора отряда");
 assert.equal(api.AbilityData.get(trio[2],"passive").name,"Ответственность за своих");
});
