"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const source=["initiative-model.js","combat-status-core.js","ability-data.js","battle-rng.js",
 "combat-core.js","progress-core.js","save-core.js","hero-collection-core.js",
 "star-core.js","skill-core.js","gear-data.js","progress-v3-core.js",
 "hero-profile-data.js","story-trial-data.js"].map(read).join("\n");
const api=vm.runInNewContext(source+"\n({CombatCore,CombatStatusCore,AbilityData,ProgressCore,ProgressV3Core,HeroCollectionCore,StarCore,SkillCore,HeroProfileData,StoryTrialData})");
const {CombatCore:core,CombatStatusCore:status,AbilityData:abilities,
 ProgressV3Core:v3,HeroCollectionCore:collection,StarCore:stars,
 SkillCore:skills,HeroProfileData:profile,StoryTrialData:trial}=api;
const legacyIds=["kael","lyra","darin","medic-demo","test-area-damage"];
const oldHeroes=legacyIds.map(id=>({id,side:"ally",hp:100,atk:22,speed:120}));
const ren={id:"ren",name:"Рен Терен",classId:"melee",side:"ally",role:"Боец ближнего боя",
 tags:["gardens-over-abyss"],hp:91,atk:27,speed:150,combatProfile:"stats002c",
 physicalAttack:27,physicalDefense:14,magicDefense:9,
 maxProtection:0,protection:0,skillLevels:{basic:4,special:1,powerful:1}};
const newHeroes=[...oldHeroes,ren];
const mock=()=>{const m=new Map();return {m,storage:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};};
test("Ren is selectable, owned from start, has biography and class-independent tag",()=>{
 assert.ok(collection.IDS.includes("ren")&&collection.START.includes("ren"));
 assert.ok(stars.IDS.includes("ren")&&stars.START.includes("ren"));
 assert.ok(skills.HERO_IDS.includes("ren"));
 assert.equal(v3.TEST_CLASSES.ren,"melee");
 assert.ok(profile.get("ren").biography.includes("Косой Полке"));
 assert.deepEqual(Array.from(profile.get("ren").tags),["gardens-over-abyss"]);
 assert.equal(profile.get("trial-ren").name,profile.get("ren").name);
 const g=read("game.js");
 assert.match(g,/\{id:"ren",name:"Рен Терен"/);
 assert.match(g,/id==="ren"\?"Доступен с начала"/);
 assert.match(g,/hero.id!=="trial-ren"&&hero.id!=="ren"/);
 assert.match(read("index.html"),/OPS001B \\+ RENPLAY/);
 assert.ok(g.includes('ren:Object.freeze({physicalDefense:14,magicDefense:9,maxProtection:0})'));
 const fresh=v3.fresh(newHeroes,1730000000000);
 assert.ok(fresh);
 assert.equal(fresh.heroes.ren.classId,"melee");
 assert.equal(fresh.heroStars.ren.rank,1);
 assert.equal(collection.owned(v3.toRuntime(fresh,newHeroes),"ren"),true);
});
test("old five-hero v3 profile upgrades without losing economy, progress and gear",()=>{
 const m=mock(),old=v3.fresh(oldHeroes,1730000000000);
 assert.ok(old);
 // Represent the shape of a previously published v3 save.
 delete old.heroes.ren;
 old.unlockedHeroes=old.unlockedHeroes.filter(x=>x!=="ren");
 delete old.heroStars.ren;
 old.skillLevels=skills.freshLevels();
 delete old.skillLevels.ren;
 old.currency=45000;old.accountXp=321;
 old.heroes.kael.level=4;
 old.heroStars.kael.shards=23;
 old.claimedMissions=["black-pass-ambush"];
 old.revision=7;
 const raw=JSON.stringify(old);
 m.storage.setItem(v3.KEY,raw);
 const staged=v3.stage(newHeroes,()=>m.storage,1730000000000);
 assert.equal(staged.status,"existing");
 assert.equal(m.m.get(v3.KEY+".before-ren"),raw,"byte-exact backup");
 const migrated=JSON.parse(m.m.get(v3.KEY));
 assert.equal(migrated.heroes.kael.level,4);
 assert.equal(migrated.currency,45000);
 assert.equal(migrated.accountXp,321);
 assert.equal(migrated.revision,7);
 assert.deepEqual(Array.from(migrated.claimedMissions),["black-pass-ambush"]);
 assert.equal(migrated.heroStars.kael.shards,23);
 assert.equal(migrated.heroStars.ren.rank,1);
 assert.equal(migrated.skillLevels.ren.basic,1);
 assert.equal(migrated.heroes.ren.classId,"melee");
 const runtime=v3.toRuntime(staged.profile,newHeroes);
 assert.ok(runtime);
 assert.equal(runtime.levels.kael,4);
 assert.equal(runtime.levels.ren,1);
 assert.equal(collection.owned(runtime,"ren"),true);
 runtime.currency+=111;
 assert.equal(v3.persist(runtime,()=>m.storage),true);
 assert.equal(v3.toRuntime(v3.stage(newHeroes,()=>m.storage).profile,newHeroes).currency,45111);
 assert.equal(m.m.get(v3.KEY+".before-ren"),raw,"backup never overwritten");
});
test("Ren migration rejects corrupt saves and failed storage without wiping old data",()=>{
 for(const kind of ["wrong-class","invalid-shards","missing-legacy-hero"]){
  const m=mock(),s=v3.fresh(oldHeroes,1730000000000);
  delete s.heroes.ren;
  s.unlockedHeroes=s.unlockedHeroes.filter(x=>x!=="ren");
  delete s.heroStars.ren;
  if(kind==="wrong-class")s.heroes.kael.classId="mage";
  if(kind==="invalid-shards")s.heroStars.kael.shards=-7;
  if(kind==="missing-legacy-hero")delete s.heroes.lyra;
  const raw=JSON.stringify(s);m.storage.setItem(v3.KEY,raw);
  assert.equal(v3.stage(newHeroes,()=>m.storage).status,"blocked");
  assert.equal(m.m.get(v3.KEY),raw);
 }
 const m=mock(),old=v3.fresh(oldHeroes,1730000000000);
 delete old.heroes.ren;old.unlockedHeroes=old.unlockedHeroes.filter(x=>x!=="ren");
 delete old.heroStars.ren;
 const raw=JSON.stringify(old);m.storage.setItem(v3.KEY,raw);
 const denied={getItem:k=>m.storage.getItem(k),setItem:()=>{throw Error("private mode")}};
 assert.equal(v3.stage(newHeroes,()=>denied).status,"blocked");
 assert.equal(m.m.get(v3.KEY),raw);
});
test("permanent Ren uses upgraded basic, own physical combat and all active slots",()=>{
 assert.equal(abilities.get(ren,"basic").name,"Точный удар");
 assert.equal(abilities.get(ren,"basic").damageType,"physical");
 assert.equal(abilities.get(ren,"basic").multiplier,1.3);
 assert.equal(abilities.get(ren,"basic").onHitStatus.type,"slowed");
 assert.equal(abilities.get({...ren,skillLevels:{basic:3}},"basic").onHitStatus,undefined);
 assert.equal(abilities.get(ren,"special").name,"Найти брешь");
 assert.equal(abilities.get(ren,"special").damageType,"physical");
 assert.equal(abilities.get(ren,"powerful").name,"Сорвать построение");
 assert.equal(abilities.get(ren,"powerful").damageType,"physical");
 assert.equal(abilities.get(ren,"powerful").followUpStatusAll.amount,15);
 assert.equal(abilities.get(ren,"passive").name,"Чувство тропы");
 assert.equal(abilities.get(ren,"leader"),null);
 const enemy=(id)=>({id,name:id,side:"enemy",hp:400,atk:0,speed:1,
  physicalDefense:10,magicDefense:8,maxProtection:0,protection:0});
 const b=core.createBattle([ren,enemy("a"),enemy("b")]);
 core.advanceToPlayerTurn(b);
 assert.equal(b.fighters[b.currentActor].id,"ren");
 assert.equal(core.performPlayerAbility(b,"powerful"),true);
 assert.equal(status.read(b.fighters[1],"debuff-resistance-down")?.remaining,2);
 assert.equal(status.read(b.fighters[2],"debuff-resistance-down")?.remaining,2);
 assert.equal(b.fighters[2].hp,400);
 assert.equal(core.performPlayerAbility(b,"basic"),true);
 assert.equal(status.read(b.fighters[1],"slowed")?.remaining,2);
 assert.equal(b.fighters[0].powerfulCooldown,1);
 assert.equal(core.performPlayerAbility(b,"special"),true);
 assert.equal(b.fighters[1].weakenAttacks,2);
 assert.equal(b.fighters[0].powerfulCooldown,0);
 assert.equal(b.allyActions,3);
 const fight=v3.fresh(newHeroes,1730000000000);
 const runtime=v3.toRuntime(fight,newHeroes);
 assert.equal(skills.level(runtime,"ren","basic"),1);
 assert.equal(stars.rankOf(runtime,"ren"),1);
 assert.ok(!read("story-trial-data.js").includes('id:"ren"'));
});
