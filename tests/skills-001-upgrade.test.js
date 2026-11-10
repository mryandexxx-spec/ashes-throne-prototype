"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const code=["initiative-model.js","ability-data.js","ability-info.js","skill-core.js",
 "combat-core.js","gear-data.js","progress-core.js","daily-core.js",
 "login-core.js","progress-v3-core.js","save-core.js"].map(read).join("\n");
const {SkillCore:S,AbilityData:A,CombatCore:C,SaveCore:Save}=vm.runInNewContext(code+
 "\n({SkillCore,AbilityData,CombatCore,SaveCore})");
const heroes=S.HERO_IDS.map(id=>({id,side:"ally"}));
const db=new Map(),storage={getItem:k=>db.get(k)??null,setItem:(k,v)=>db.set(k,v)},get=()=>storage;
const p=Save.load(heroes,get).progress;
assert.equal(p.saveVersion,3);
assert.equal(p.skillLevels,undefined,"old v3 profile has no levels");
assert.equal(p.skillMaterials,undefined,"old v3 profile has no manuals");
assert.equal(S.level(p,"kael","basic"),1);
assert.equal(S.cost(p,"kael","basic").to,2);
assert.equal(S.cost(p,"kael","basic").heroLevel,2);
assert.equal(Object.keys(S.cost(p,"kael","basic").materials).length,0);
assert.equal(S.blocked(p,"kael","passive"),"Навык недоступен.");
assert.equal(S.upgrade(p,"kael","basic"),null,"hero level gate");
assert.equal(S.grantTest(p),true);
assert.equal(p.skillMaterials.manual1,60);
assert.equal(p.skillMaterials.manual2,40);
assert.equal(p.skillMaterials.seal,20);
assert.equal(S.grantTest(p),true,"dev resources use floors, not additive payouts");
assert.equal(p.skillMaterials.manual1,60);
p.levels.kael=2;p.currency=5000;
assert.equal(S.upgrade(p,"kael","basic").level,2);
assert.equal(p.currency,4900);
assert.equal(S.level(p,"kael","basic"),2);
assert.equal(S.blocked(p,"kael","basic"),"Нужен уровень героя 3.");
assert.equal(S.level(p,"lyra","basic"),1,"hero skill levels are independent");
assert.equal(S.level(p,"kael","special"),1,"skills are independent");
p.levels.kael=12;
const amounts={manual1:60,manual2:40,seal:20};
for(let target=3;target<=6;target++){
 const old=S.level(p,"kael","basic");
 const cost=S.cost(p,"kael","basic");
 assert.equal(cost.to,target);
 assert.equal(cost.heroLevel,[0,0,0,3,5,8,12][target]);
 const result=S.upgrade(p,"kael","basic");
 assert.equal(result.level,target);
 assert.equal(S.level(p,"kael","basic"),old+1);
 for(const [key,amount] of Object.entries(cost.materials))amounts[key]-=amount;
}
assert.equal(S.level(p,"kael","basic"),6);
assert.equal(S.cost(p,"kael","basic"),null);
assert.equal(S.upgrade(p,"kael","basic"),null,"max level blocks further spending");
for(const key of S.RESOURCE_IDS)assert.equal(p.skillMaterials[key],amounts[key]);
const rich={...p,currency:10000,
 skillMaterials:{manual1:0,manual2:0,seal:0},
 skillLevels:S.freshLevels()};
rich.levels={...p.levels,lyra:12};
assert.equal(S.upgrade(rich,"lyra","special").level,2);
assert.equal(S.blocked(rich,"lyra","special"),"Недостаточно материалов навыка.");
assert.equal(S.upgrade(rich,"lyra","special"),null);
assert.equal(S.level(rich,"lyra","special"),2);
assert.equal(S.grantTest(rich),true);
assert.equal(S.upgrade(rich,"lyra","special").level,3);
assert.equal(S.upgrade(rich,"lyra","special").level,4);
const beforeCurrency=rich.currency;
assert.equal(S.upgrade(rich,"lyra","special").level,5);
assert.ok(rich.currency<beforeCurrency);
assert.equal(S.validLevels(rich.skillLevels),true);
assert.equal(S.validMaterials(rich.skillMaterials),true);
assert.equal(S.validLevels({kael:{basic:99}}),false);
assert.equal(S.validMaterials({...rich.skillMaterials,seal:-1}),false);
assert.equal(S.validMaterials({...rich.skillMaterials,extraneous:3}),false);

assert.equal(Save.save(p,get),true);
const restored=Save.load(heroes,get).progress;
assert.equal(restored.skillLevels.kael.basic,6);
assert.equal(restored.skillLevels.kael.special,1);
assert.equal(restored.skillMaterials.manual1,amounts.manual1);
assert.equal(restored.currency,p.currency);
const original=db.get("ashes-throne.progress.v3");
const tampered=JSON.parse(original);tampered.skillLevels.kael.basic=7;
db.set("ashes-throne.progress.v3",JSON.stringify(tampered));
assert.equal(Save.load(heroes,get).blocked,true,"invalid skill level is blocked, not reset");
db.set("ashes-throne.progress.v3",original);
const oldRevision=restored.saveRevision;
const stale=JSON.parse(original);stale.revision=oldRevision+1;
db.set("ashes-throne.progress.v3",JSON.stringify(stale));
assert.equal(Save.save(restored,get),false,"stale wallet write rejected");
db.set("ashes-throne.progress.v3",original);

const plain={id:"darin",side:"ally",name:"Дарин",atk:20,hp:120,speed:200};
assert.equal(A.get(plain,"special").multiplier,1.5);
const leveled={...plain,skillLevels:{basic:6,special:6,powerful:6}};
assert.equal(A.get(leveled,"special").multiplier,2.0);
assert.equal(A.get(leveled,"basic").multiplier,1.5);
assert.equal(A.get(leveled,"powerful").multiplier,2.5);
assert.equal(A.get({id:"medic-demo",skillLevels:{special:6}},"special").healAmount,55);
assert.equal(A.get({id:"kael",skillLevels:{special:6}},"special").guardHits,7);
assert.equal(A.get({id:"lyra",skillLevels:{special:6}},"special").weakening,2,
 "effects unrelated to upgrade remain unchanged");
const actor={...plain,skillLevels:{basic:6,special:6,powerful:6}};
const enemy={id:"enemy",side:"enemy",name:"enemy",atk:5,hp:500,speed:5};
const battle=C.createBattle([actor,enemy]);
C.advanceToPlayerTurn(battle);
assert.equal(C.performPlayerAbility(battle,"special"),true);
assert.equal(battle.fighters[1].hp,460,"upgraded multiplier actually changes combat damage");
const baseline=C.createBattle([plain,enemy]);
C.advanceToPlayerTurn(baseline);
assert.equal(C.performPlayerAbility(baseline,"special"),true);
assert.equal(baseline.fighters[1].hp,470,"old demo battle stays unchanged");

const html=read("index.html"),game=read("game.js"),pkg=JSON.parse(read("package.json"));
assert.equal(pkg.version,"0.3.97");
assert.ok(html.includes("v0.3.97 · UISYS001C"));
assert.ok(html.includes('id="skillUpgradeDialog"'));
assert.ok(html.indexOf('src="ability-data.js"')<html.indexOf('src="skill-core.js"'));
assert.ok(html.indexOf('src="skill-core.js"')<html.indexOf('src="progress-v3-core.js"'));
for(const marker of ["renderSkillUpgrade","SkillCore.upgrade(progress","SkillCore.grantTest(progress)",
 "renderHeroAbilities(hero)","skillLevelButtons","skillUpgradeButton","persistProgress()"])
 assert.ok(game.includes(marker)||html.includes(marker),marker);
console.log("Skills-001: six levels, tiered resources, real combat, v3 saves, corruption, stale writes and UI passed");
