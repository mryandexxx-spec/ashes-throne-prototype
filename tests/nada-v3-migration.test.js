/* NADAPLAY001: existing account data must survive 5->7 and 6->7 expansion. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const source=["gear-data.js","progress-core.js","star-core.js","skill-core.js",
 "hero-collection-core.js","daily-core.js","login-core.js","progress-v3-core.js","save-core.js"]
 .map(read).join("\n");
const api=vm.runInNewContext(source+"\n({V:ProgressV3Core,S:StarCore,H:HeroCollectionCore,K:SkillCore,G:GearData})");
const {V,S,H,K,G}=api;
const IDs=["kael","lyra","darin","medic-demo","test-area-damage","ren","nada"];
const heroDefs=ids=>ids.map(id=>({id,side:"ally"}));
const mk=()=>{const data=new Map();return {data,storage:{
 getItem:key=>data.has(key)?data.get(key):null,
 setItem:(key,val)=>data.set(key,val)
}};};
function older(ids){
 const s=V.fresh(heroDefs(IDs),1730000000000);
 for(const id of IDs.filter(x=>!ids.includes(x))){
  delete s.heroes[id];
  delete s.heroStars[id];
  s.unlockedHeroes=s.unlockedHeroes.filter(x=>x!==id);
 }
 s.skillLevels=K.freshLevels();
 for(const id of IDs.filter(x=>!ids.includes(x)))delete s.skillLevels[id];
 s.accountXp=901;s.currency=27180;s.revision=19;
 s.skillLevels.kael.basic=3;
 s.heroes.kael.level=8;s.heroStars.kael.shards=19;
 const oldItem=G.offered("tank","weapon",1)[0];
 assert.ok(oldItem);
 s.heroes.kael.gear.installedByTier["1"][0]={kind:"item",itemId:oldItem.id};
 s.claimedMissions=["black-pass-ambush"];
 return s;
}
// Superseded by DEMOROSTER001 (tests/heroes-001-mission-unlock.test.js):
// previous incremental expansion is obsolete; active roster is exactly five.

// Superseded by DEMOROSTER001 (tests/heroes-001-mission-unlock.test.js):
// previous incremental expansion is obsolete; active roster is exactly five.

test("corrupt or failed migration never overwrites the original save",()=>{
 for(const kind of ["negative-currency","missing-hero","wrong-class","bad-rank"]){
  const m=mk(),old=older(IDs.filter(id=>id!=="nada"));
  if(kind==="negative-currency")old.currency=-1;
  if(kind==="missing-hero")delete old.heroes.darin;
  if(kind==="wrong-class")old.heroes.lyra.classId="mage";
  if(kind==="bad-rank")old.heroStars.kael.rank=99;
  const raw=JSON.stringify(old);m.storage.setItem(V.KEY,raw);
  assert.equal(V.stage(heroDefs(IDs),()=>m.storage).status,"blocked");
  assert.equal(m.data.get(V.KEY),raw);
 }
 const m=mk(),old=older(IDs.filter(id=>id!=="nada")),raw=JSON.stringify(old);
 m.storage.setItem(V.KEY,raw);
 const readonly={getItem:k=>m.storage.getItem(k),setItem(){throw Error("denied");}};
 assert.equal(V.stage(heroDefs(IDs),()=>readonly).status,"blocked");
 assert.equal(m.data.get(V.KEY),raw);
});
