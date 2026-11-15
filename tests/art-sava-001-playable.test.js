"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const source=[
 "gear-data.js","progress-core.js","hero-collection-core.js","star-core.js","skill-core.js",
 "daily-core.js","login-core.js","save-core.js","progress-v3-core.js",
 "hero-stats-core.js","hero-stats-profiles.js","hero-stats-combat-bridge.js",
 "hero-profile-data.js","ability-data.js","initiative-model.js","battle-rng.js",
 "combat-status-core.js","combat-core.js"
].map(read).join("\n");
const {C,V,H,S,K,P,Stats,Bridge,Profiles,Abilities,Combat,HeroData,G}=vm.runInNewContext(source+
 "\n({C:HeroCollectionCore,V:ProgressV3Core,H:HeroCollectionCore,S:StarCore,K:SkillCore,P:ProgressCore,Stats:HeroStatsCore,Bridge:HeroStatsCombatBridge,Profiles:HeroStatsProfiles,Abilities:AbilityData,Combat:CombatCore,HeroData:HeroProfileData,G:GearData})");
const ids=["kael","lyra","darin","medic-demo","test-area-damage","ren","nada","liora","art","sava"];
const heroes=ids.map(id=>({id,side:"ally"}));
const db=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
function old8(){
 const p=V.fresh(heroes,1730000000000);
 assert.ok(p);
 for(const id of ["art","sava"]){
  delete p.heroes[id];delete p.heroStars[id];
  p.unlockedHeroes=p.unlockedHeroes.filter(x=>x!==id);
 }
 p.skillLevels=JSON.parse(JSON.stringify(K.freshLevels()));
 for(const id of ["art","sava"])delete p.skillLevels[id];
 p.accountXp=777;p.currency=2048;p.revision=17;
 p.heroes.kael.level=4;p.skillLevels.kael.basic=3;
 const shield=G.offered("tank","weapon",1)[0];
 assert.ok(shield);
 p.heroes.kael.gear.installedByTier["1"][0]={kind:"item",itemId:shield.id};
 return p;
}
test("ARTSAVA001 exposes permanent selectable heroes with typed 14-stat profiles and equipment",()=>{
 assert.deepEqual(ids.filter(id=>!H.IDS.includes(id)),[]);
 for(const [id,classId] of [["art","tank"],["sava","support"]]){
  assert.ok(H.START.includes(id));
  assert.equal(V.TEST_CLASSES[id],classId);
  assert.ok(K.HERO_IDS.includes(id));
  assert.equal(P.maxLevelOf(id),85);
  const profile=Profiles[id];assert.equal(Stats.KEYS.length,14);
  const hero=Bridge.apply({id,side:"ally"}, {level:1,stars:1},profile,Stats);
  assert.equal(hero.combatProfile,"stats002c");assert.ok(hero.hp>0);
  assert.equal(hero.maxProtection,hero.protection);
  assert.equal(G.statOverview(hero).filter(x=>x.active).length,14);
  assert.ok(HeroData.get(id).biography.length>70);
  assert.ok(G.offered(classId,"weapon",1).length>=1);
 }
 assert.equal(Abilities.get({id:"art"},"special").kind,"guard");
 assert.equal(Abilities.get({id:"sava"},"special").kind,"damage");
 assert.equal(Abilities.get({id:"art"},"passive").name,"Пассивная способность (не определена)");
});
test("ARTSAVA001 migrates exact valid 8-hero save once, preserving values, items, revision and old squad",()=>{
 const local=db();const old=old8();const raw=JSON.stringify(old);
 local.setItem(V.KEY,raw);
 const r=V.stage(heroes,()=>local,1730000000000);
 assert.equal(r.status,"existing",r.reason);
 assert.equal(local.getItem(V.KEY+".before-art-sava"),raw);
 const updated=JSON.parse(local.getItem(V.KEY));
 assert.equal(updated.currency,2048);assert.equal(updated.accountXp,777);
 assert.equal(updated.revision,17);assert.equal(updated.heroes.kael.level,4);
 assert.equal(updated.skillLevels.kael.basic,3);
 assert.equal(updated.heroes.kael.gear.installedByTier["1"][0].kind,"item");
 for(const [id,classId] of [["art","tank"],["sava","support"]]){
  assert.equal(updated.heroes[id].classId,classId);
  assert.equal(updated.heroes[id].level,1);
  assert.equal(updated.heroStars[id].rank,1);
  assert.equal(updated.skillLevels[id].basic,1);
  assert.ok(updated.unlockedHeroes.includes(id));
 }
 const runtime=V.toRuntime(r.profile,heroes);assert.ok(runtime);
 assert.equal(H.owned(runtime,"art"),true);assert.equal(H.owned(runtime,"sava"),true);
 runtime.currency+=7;
 assert.equal(V.persist(runtime,()=>local),true);
 const again=V.stage(heroes,()=>local);
 assert.equal(again.status,"existing");
 assert.equal(again.profile.currency,2055);
 assert.equal(local.getItem(V.KEY+".before-art-sava"),raw);
});
test("ARTSAVA001 refuses corrupted old records and denied backup writes without resetting save",()=>{
 for(const corrupt of ["missing-kael","bad-rank","wrong-class"]){
  const local=db();const profile=old8();
  if(corrupt==="missing-kael")delete profile.heroes.kael;
  if(corrupt==="bad-rank")profile.heroStars.ren.rank=9;
  if(corrupt==="wrong-class")profile.heroes.nada.classId="tank";
  const raw=JSON.stringify(profile);local.setItem(V.KEY,raw);
  assert.equal(V.stage(heroes,()=>local).status,"blocked",corrupt);
  assert.equal(local.getItem(V.KEY),raw);
 }
 const local=db();local.setItem(V.KEY,JSON.stringify(old8()));
 const raw=local.getItem(V.KEY);
 const denied={getItem:k=>local.getItem(k),setItem(){throw Error("denied");}};
 assert.equal(V.stage(heroes,()=>denied).status,"blocked");
 assert.equal(local.getItem(V.KEY),raw);
});
test("ARTSAVA001 boots combat with their built-in non-GLB actions and battle placeholders",()=>{
 const a=Bridge.apply({id:"art",name:"Арт",side:"ally"}, {level:1,stars:1},Profiles.art,Stats);
 const s=Bridge.apply({id:"sava",name:"Сава",side:"ally"}, {level:1,stars:1},Profiles.sava,Stats);
 const dummy={id:"enemy",name:"Манекен",side:"enemy",hp:300,atk:5,speed:80};
 const battle=Combat.createBattle([a,s,dummy]);
 Combat.advanceToPlayerTurn(battle);
 assert.ok(battle.active);
 assert.ok(["art","sava"].includes(battle.fighters[battle.currentActor].id));
 assert.equal(Combat.performPlayerAbility(battle,"basic"),true);
 assert.ok(battle.turn>1);
 assert.match(read("game.js"),/CreateCapsule\("body_"/);
 assert.match(read("game.js"),/h\.id==="art"\?new BABYLON\.Color3/);
 assert.match(read("game.js"),/h\.id==="sava"\?new BABYLON\.Color3/);
 assert.doesNotMatch(read("dev\/src\/assets\/models.js"),/art-mobile|sava-mobile/);
});
test("ARTSAVA001 connects portraits to roster, dossier and biography with no GLB card loader",()=>{
 const game=read("game.js"),card=read("ren-card-3d.js"),css=read("styles.css");
 for(const name of ["art","sava"]){
  assert.ok(game.includes('id:"'+name+'",name:'));
  assert.ok(game.includes("assets/"+name+"-portrait.webp?v=1"));
  assert.ok(game.includes("hero-avatar-"+name));
  assert.ok(css.includes(".hero-avatar-"+name));
 }
 assert.match(card,/heroId!=="nada"/,{message:"legacy on older branches"});
 assert.match(card,/\["art","sava"\]\.includes\(heroId\)/);
 assert.match(read("index.html"),/v0\.3\.160 · ARTSAVA001/);
});
