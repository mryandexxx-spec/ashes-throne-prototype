"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const api=vm.runInNewContext(read("ability-data.js")+"\n"+read("ability-info.js")+"\n({AbilityData,AbilityInfo})");
const {AbilityData,AbilityInfo}=api;
const names=["kael","lyra","darin","medic-demo","test-area-damage"];
const special=["Прикрытие","Ослабляющий удар","Сокрушительный удар","Перевязка","Учебный широкий удар"];
const powerful=["Учебный бастион","Учебная метка","Учебный натиск",
 "Учебное исцеление отряда","Учебный мощный удар"];
for(let i=0;i<names.length;i++){
 const hero={id:names[i],combatProfile:i<3?"stats002c":undefined};
 const slots=AbilityInfo.forHero(hero);
 assert.equal(slots.length,5);
 assert.deepEqual(Array.from(slots,x=>x.id),["basic","special","powerful","passive","leader"]);
 assert.equal(slots[0].name,"Базовая атака");
 assert.equal(slots[1].name,special[i]);
 assert.equal(slots[2].name,powerful[i]);
 assert.equal(slots[3].status,"not-defined");
 assert.equal(slots[4].status,"not-assigned");
 assert.equal(slots[4].name,"Не назначена");
 assert.ok(slots[0].meta.some(x=>x.includes("Цель:")));
 assert.ok(slots[1].meta.some(x=>x.includes("Перезарядка")));
 assert.equal(slots[0].meta.some(x=>x.includes("Перезарядка")),false);
 for(const slot of slots){
  assert.equal(typeof slot.description,"string");
  assert.ok(slot.description.length>0);
  assert.ok(slot.meta.every(x=>typeof x==="string"));
 }
}
const kael=AbilityInfo.forHero({id:"kael",combatProfile:"stats002c"});
assert.match(kael[1].description,/2 ударов/);
assert.equal(kael[1].meta.some(x=>x.includes("Физический")),false);
const lyra=AbilityInfo.forHero({id:"lyra",combatProfile:"stats002c"});
assert.match(lyra[1].description,/Ослабляет/);
assert.match(lyra[1].meta.join(" "),/Физический/);
const healer=AbilityInfo.forHero({id:"medic-demo"});
assert.match(healer[1].description,/30 HP/);
assert.match(healer[2].meta.join(" "),/все живые союзники/);
const mage=AbilityInfo.forHero({id:"test-area-damage"});
assert.match(mage[1].meta.join(" "),/все живые противники/);
const doc=read("index.html"),game=read("game.js"),css=read("styles.css");
assert.ok(doc.includes('src="ability-info.js"'));
assert.ok(doc.indexOf('src="ability-data.js"')<doc.indexOf('src="ability-info.js"'));
assert.ok(doc.indexOf('src="ability-info.js"')<doc.indexOf('src="game.js"'));
assert.ok(doc.includes('id="heroAbilityList"'));
assert.ok(doc.includes('id="heroAbilitiesTitle"'));
assert.ok(doc.includes("v0.3.77 · OPSHELP"));
assert.ok(game.includes("function renderHeroAbilities(hero)"));
assert.ok(game.includes("renderHeroAbilities(hero);"));
assert.ok(game.includes('document.createElement("article")'));
assert.ok(game.includes("AbilityInfo.forHero(hero)"));
assert.ok(css.includes(".hero-abilities-list"));
console.log("Abilities-UI-001: data-derived five slots and read-only dossier integration passed");
