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
  assert.ok(H.PLAYABLE.includes(id));
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
 assert.equal(Abilities.get({id:"art"},"special").kind,"insurance");
 assert.equal(Abilities.get({id:"sava"},"special").kind,"signal");
 assert.equal(Abilities.get({id:"art"},"passive").name,"Знать предел");
});
// Superseded by DEMOROSTER001 (tests/heroes-001-mission-unlock.test.js):
// previous incremental expansion is obsolete; active roster is exactly five.

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
test("ARTSAVA001 boots combat with unchanged actions and fallback placeholders",()=>{
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
 assert.match(read("dev\/src\/assets\/models.js"),/art-mobile/); assert.match(read("dev\/src\/assets\/models.js"),/sava-mobile/);
});
test("ARTSAVA001 preserves portraits and biographies with optional Sava GLB",()=>{
 const game=read("game.js"),card=read("ren-card-3d.js"),css=read("styles.css");
 for(const name of ["art","sava"]){
  assert.ok(game.includes('id:"'+name+'",name:'));
  assert.ok(game.includes("assets/"+name+"-portrait-ui.webp?v=2"));
  assert.ok(game.includes("assets/"+name+"-portrait-roster.webp?v=2"));
  assert.ok(game.includes("hero-avatar-"+name));
  assert.ok(css.includes(".hero-avatar-"+name));
 }
 assert.match(card,/\["art","sava"\]\.includes\(heroId\)/);
 assert.ok(read("index.html").includes("v"+JSON.parse(read("package.json")).version+" · "));
});
