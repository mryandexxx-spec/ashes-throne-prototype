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
test("six-hero save expands to seven, byte-exact backup, keeps all ownership",()=>{
 const m=mk(),old=older(IDs.filter(id=>id!=="nada"));
 const raw=JSON.stringify(old);m.storage.setItem(V.KEY,raw);
 const p=V.stage(heroDefs(IDs),()=>m.storage,1730000000000);
 assert.equal(p.status,"existing");
 assert.equal(m.data.get(V.KEY+".before-nada"),raw);
 const fresh=JSON.parse(m.data.get(V.KEY));
 assert.equal(fresh.currency,27180);
 assert.equal(fresh.accountXp,901);
 assert.equal(fresh.revision,19);
 assert.equal(fresh.heroes.kael.level,8);
 assert.equal(fresh.heroes.kael.gear.installedByTier["1"][0].kind,"item");
 assert.equal(fresh.skillLevels.kael.basic,3);
 assert.equal(fresh.heroStars.kael.shards,19);
 assert.equal(fresh.heroes.nada.classId,"support");
 assert.equal(fresh.heroStars.nada.rank,1);
 assert.equal(fresh.skillLevels.nada.special,1);
 assert.deepEqual(Array.from(fresh.claimedMissions),["black-pass-ambush"]);
 const runtime=V.toRuntime(p.profile,heroDefs(IDs));
 assert.equal(runtime.levels.nada,1);
 assert.equal(H.owned(runtime,"nada"),true);
 assert.equal(S.rankOf(runtime,"nada"),1);
 runtime.currency+=10;
 assert.equal(V.persist(runtime,()=>m.storage),true);
 const updated=V.stage(heroDefs(IDs),()=>m.storage);
 assert.equal(updated.status,"existing");
 assert.equal(V.toRuntime(updated.profile,heroDefs(IDs)).currency,27190);
 assert.equal(m.data.get(V.KEY+".before-nada"),raw);
});
test("five-hero save adds Ren and Nada without resetting saved resources",()=>{
 const m=mk(),old=older(IDs.filter(id=>id!=="ren"&&id!=="nada"));
 const raw=JSON.stringify(old);m.storage.setItem(V.KEY,raw);
 const p=V.stage(heroDefs(IDs),()=>m.storage);
 assert.equal(p.status,"existing");
 assert.equal(m.data.get(V.KEY+".before-ren"),raw);
 assert.equal(p.profile.heroes.ren.classId,"melee");
 assert.equal(p.profile.heroes.nada.classId,"support");
 assert.equal(p.profile.heroStars.ren.rank,1);
 assert.equal(p.profile.heroStars.nada.rank,1);
 assert.equal(p.profile.heroes.kael.level,8);
 assert.equal(p.profile.accountXp,901);
});
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
