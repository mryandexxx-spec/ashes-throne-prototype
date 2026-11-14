"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const source=["initiative-model.js","combat-status-core.js","ability-data.js","battle-rng.js",
 "combat-core.js","progress-core.js","save-core.js","hero-collection-core.js",
 "star-core.js","skill-core.js","gear-data.js","progress-v3-core.js",
 "hero-profile-data.js","hero-stats-profiles.js","dev/src/assets/models.js"].map(read).join("\n");
const api=vm.runInNewContext(source+"\n({CombatCore,AbilityData,ProgressV3Core,HeroCollectionCore,StarCore,SkillCore,HeroProfileData,HeroStatsProfiles,LioraModelAssets})");
const {ProgressV3Core:v3,HeroCollectionCore:collection,StarCore:stars,SkillCore:skills}=api;
const ids=["kael","lyra","darin","medic-demo","test-area-damage","ren","nada","liora"];
const heroes=ids.map(id=>({id,side:"ally"}));
function storage(){const m=new Map();return {m,getItem(k){return m.get(k)??null;},setItem(k,v){m.set(k,v);}};}
function oldProfile(count=7){
 const old=JSON.parse(JSON.stringify(v3.fresh(heroes.slice(0,count),1730000000000)));
 for(const id of ids.slice(count)){
  delete old.heroes[id];delete old.heroStars[id];
  old.unlockedHeroes=old.unlockedHeroes.filter(x=>x!==id);
 }
 old.skillLevels=JSON.parse(JSON.stringify(skills.freshLevels()));
 for(const id of ids.slice(count))delete old.skillLevels[id];
 old.revision=12;old.currency=8532;old.accountXp=1234;old.heroes.kael.level=5;
 return old;
}
test("Liora playable pilot has a real persistent ID but no approved backstory",()=>{
 assert.ok(collection.IDS.includes("liora"));
 assert.ok(collection.START.includes("liora"));
 assert.ok(stars.IDS.includes("liora"));
 assert.ok(skills.HERO_IDS.includes("liora"));
 assert.equal(v3.TEST_CLASSES.liora,"tank");
 assert.equal(api.HeroStatsProfiles.liora.combatStats.speed,115);
 assert.equal(api.HeroProfileData.get("liora").tags.length,0);
 assert.equal(api.LioraModelAssets.bytes,2117776);
 assert.equal(api.LioraModelAssets.shieldMesh,"Liora_Shield");
 assert.equal(api.AbilityData.get({id:"liora"},"special").kind,"guard");
 assert.equal(api.AbilityData.get({id:"liora"},"powerful").kind,"guard");
});
test("old valid five/six/seven-character v3 accounts migrate exactly once",()=>{
 for(const count of [5,6,7]){
  const save=storage(),before=oldProfile(count);
  save.setItem(v3.KEY,JSON.stringify(before));const raw=save.getItem(v3.KEY);
  const result=v3.stage(heroes,()=>save,1730000000000);
  assert.equal(result.status,"existing","old count "+count+" "+result.reason);
  const updated=JSON.parse(save.getItem(v3.KEY));
  assert.equal(save.getItem(v3.KEY+".before-liora"),raw);
  assert.equal(updated.currency,8532);
  assert.equal(updated.accountXp,1234);
  assert.equal(updated.revision,12);
  assert.equal(updated.heroes.kael.level,5);
  assert.equal(updated.heroes.liora.classId,"tank");
  assert.equal(updated.heroStars.liora.rank,1);
  assert.equal(updated.skillLevels.liora.basic,1);
  const restored=v3.toRuntime(result.profile,heroes);
  assert.ok(restored);
  assert.equal(collection.owned(restored,"liora"),true);
  restored.currency+=1;
  assert.equal(v3.persist(restored,()=>save),true);
  const twice=v3.stage(heroes,()=>save);
  assert.equal(twice.status,"existing");
  assert.equal(save.getItem(v3.KEY+".before-liora"),raw);
  assert.equal(twice.profile.currency,8533);
 }
});
test("corrupt profile, failed backup writes and stale revisions never reset old data",()=>{
 for(const mode of ["wrong-class","missing-legacy","bad-stars"]){
  const save=storage(),old=oldProfile();
  if(mode==="wrong-class")old.heroes.kael.classId="support";
  if(mode==="missing-legacy")delete old.heroes.lyra;
  if(mode==="bad-stars")old.heroStars.nada.shards=-2;
  const raw=JSON.stringify(old);save.setItem(v3.KEY,raw);
  assert.equal(v3.stage(heroes,()=>save).status,"blocked",mode);
  assert.equal(save.getItem(v3.KEY),raw);
 }
 const save=storage();save.setItem(v3.KEY,JSON.stringify(oldProfile()));
 const initial=save.getItem(v3.KEY);
 const denied={getItem:k=>save.getItem(k),setItem(){throw Error("storage denied");}};
 assert.equal(v3.stage(heroes,()=>denied).status,"blocked");
 assert.equal(save.getItem(v3.KEY),initial);
});
test("Liora GLB and caching are wired without shield assets",()=>{
 const main=read("game.js"),card=read("ren-card-3d.js"),index=read("index.html");
 const sw=read("model-cache-sw.js"),client=read("model-cache-client.js");
 const runtime=read("liora-glb-runtime.js");
 assert.match(main,/ensureLiora3D\(\)/);
 assert.match(main,/lioraGlbRuntime\.update\(activity\)/);
 assert.match(card,/liora-native-idle/);
 assert.match(index,/liora-glb-runtime\.js/);
 assert.match(sw,/liora-mobile-animated\.glb/);
 assert.match(sw,/2117776/);
 assert.match(sw,/liora-aeb64b8d/);
 assert.ok(client.includes('"liora-mobile-animated.glb":"liora"')); // third asset registration
 assert.match(client,/model-cache-sw\.js\?v=liorashield006/);
 assert.match(index,/cache002-liora/);
 assert.doesNotMatch(runtime,/LioraShieldAttachment|LioraShieldAssets|liora-shield-mobile/);
 // LIORA-SHIELD-006: shield clips drive the combat slots; the shield mesh is part of the GLB.
 const LioraGlbRuntime=require("../liora-glb-runtime.js");
 assert.equal(LioraGlbRuntime.SHIELD_MESH,"Liora_Shield");
 assert.deepEqual([LioraGlbRuntime.clipFor("basic"),LioraGlbRuntime.clipFor("special"),LioraGlbRuntime.clipFor("death")],
  ["Liora_Shield_Bash","Liora_Shield_Block","Liora_Shield_Death"]);
 assert.equal(LioraGlbRuntime.clipFor("idle"),"Idle_02");
 assert.match(runtime,/visible\.filter\(isBody\)/,"frame the body without the bind-pose shield");
 assert.match(card,/LioraGlbRuntime\.SHIELD_MESH/,"card framing ignores the shield mesh");
 assert.match(main,/тестовый герой со щитом/);
 assert.doesNotMatch(main,/без щита/);
 assert.match(read("ability-data.js"),/Удар щитом/);
});
