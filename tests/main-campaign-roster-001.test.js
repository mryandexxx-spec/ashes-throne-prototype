"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const files=["gear-data.js","progress-core.js","star-core.js","skill-core.js","hero-collection-core.js","daily-core.js","login-core.js","progress-v3-core.js","save-core.js","reward-policy-core.js","main-campaign-core.js"];
const {S,H,V,R,C,Star,P,Skill,G}=vm.runInNewContext(files.map(f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8")).join("\n")+"\n({S:SaveCore,H:HeroCollectionCore,V:ProgressV3Core,R:RewardPolicyCore,C:MainCampaignCore,Star:StarCore,P:ProgressCore,Skill:SkillCore,G:GearData})");
const heroes=["ren","nada","liora","art","sava"].map(id=>({id,side:"ally"}));
function setup(){
 const map=new Map();let fail=false;
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>{if(fail)throw Error("quota");map.set(k,v)}};
 const provider=()=>storage;let pending=Promise.resolve();
 const exclusive=fn=>{const next=pending.then(fn);pending=next.catch(()=>{});return next};
 const loaded=S.load(heroes,provider);assert.equal(loaded.blocked,false);
 const args={source:{sourceId:"main-cam-test-fictional-recruit",kind:"first-clear",energyCost:0,reward:{currency:0,accountXp:0,materials:{},heroGrants:["nada"]}},occurrenceId:"once",day:"2026-11-24",heroes,storageProvider:provider,exclusive,authorize:({storage})=>storage.getItem("test-proof")==="won"};
 return {map,storage,provider,args,loaded,fail:()=>{fail=true}};
}
test("fresh two, locked three, no real M1 recruitment and no shard shortcut",()=>{
 const {loaded,provider}=setup(),p=loaded.progress;
 assert.deepEqual(Array.from(p.unlockedHeroes),["ren","art"]);
 for(const id of ["ren","art"])assert.equal(H.owned(p,id),true);
 for(const id of ["nada","liora","sava"]){assert.equal(H.owned(p,id),false);assert.equal(Star.rankOf(p,id),0)}
 p.currency=100000;P.grantTestResources(p);Skill.grantTest(p);
 const before=JSON.stringify(p);
 assert.equal(P.upgradeMany(p,"nada",1),null);
 assert.equal(P.equipItem(p,"nada",G.offered(p.classes.nada,G.SLOTS[0].id,1)[0].id),false);
 assert.equal(Skill.upgrade(p,"nada","basic"),null);
 assert.equal(JSON.stringify(p),before);
 assert.equal(Star.add(p,"nada",20),true);assert.equal(Star.promote(p,"nada"),null);
 assert.equal(C.SOURCE.reward.heroGrants,undefined);
 assert.equal(S.save(p,provider),true);assert.equal(H.owned(S.load(heroes,provider).progress,"nada"),false);
});
test("proof required, first-clear grant atomic and idempotent across reload",async()=>{
 const {map,storage,provider,args,loaded}=setup();
 const original=map.get(V.KEY);
 assert.equal((await R.claim(args)).code,"PROOF_NOT_PERSISTED");assert.equal(map.get(V.KEY),original);
 assert.equal((await R.claim({...args,occurrenceId:"other"})).code,"INVALID_OCCURRENCE");
 storage.setItem("test-proof","won");
 const result=await Promise.all([R.claim(args),R.claim(args)]);
 assert.equal(result.filter(x=>x.ok).length,1);assert.equal(result.find(x=>!x.ok).code,"ALREADY_CLAIMED");
 const restored=S.load(heroes,provider).progress;
 assert.equal(H.owned(restored,"nada"),true);assert.equal(Star.rankOf(restored,"nada"),1);
 assert.equal(restored.rewardReceipts.length,1);assert.equal(H.owned(restored,"liora"),false);
 assert.equal(S.save(loaded.progress,provider),false);
});
test("failed write does not grant, repeat source disallowed",async()=>{
 const {map,storage,args,fail}=setup();storage.setItem("test-proof","won");
 const old=map.get(V.KEY);
 assert.equal(R.validSource({...args.source,kind:"repeat"}),false);
 fail();assert.equal((await R.claim(args)).code,"SAVE_OUTCOME_UNKNOWN");
 assert.equal(map.get(V.KEY),old);
});

test("unknown write outcome after durable grant recovers once, without losing pre-earned shards",async()=>{
 const {map,storage,provider,args,loaded}=setup();
 assert.equal(Star.add(loaded.progress,"nada",20),true);
 assert.equal(S.save(loaded.progress,provider),true);
 storage.setItem("test-proof","won");
 const realSet=storage.setItem;
 storage.setItem=(k,v)=>{realSet(k,v);if(k===V.KEY)throw Error("write succeeded before exception")};
 const source={...args.source,reward:{...args.source.reward,currency:40,heroGrants:["nada","liora"]}};
 const claim={...args,source};
 assert.equal((await R.claim(claim)).code,"SAVE_OUTCOME_UNKNOWN");
 storage.setItem=realSet;
 const recovered=S.load(heroes,provider);
 assert.equal(recovered.blocked,false);
 assert.equal(recovered.progress.currency,40);
 assert.equal(recovered.progress.rewardReceipts.length,1);
 for(const id of ["nada","liora"]){assert.equal(H.owned(recovered.progress,id),true);assert.equal(Star.rankOf(recovered.progress,id),1)}
 assert.equal(Star.shardsOf(recovered.progress,"nada"),20);
 assert.equal(H.owned(recovered.progress,"sava"),false);
 const durable=map.get(V.KEY);
 assert.equal((await R.claim(claim)).code,"ALREADY_CLAIMED");
 assert.equal(map.get(V.KEY),durable);
});
test("already-owned hero in a later first-clear grant keeps its rank and shards",async()=>{
 const {map,storage,provider,args,loaded}=setup(),p=loaded.progress;
 assert.equal(Star.directGrant(p,"nada"),true);
 assert.equal(Star.add(p,"nada",40),true);
 assert.ok(Star.promote(p,"nada"));
 const rank=Star.rankOf(p,"nada"),shards=Star.shardsOf(p,"nada");
 assert.equal(S.save(p,provider),true);
 storage.setItem("test-proof","won");
 assert.equal((await R.claim(args)).ok,true);
 const restored=S.load(heroes,provider).progress;
 assert.equal(Star.rankOf(restored,"nada"),rank);
 assert.equal(Star.shardsOf(restored,"nada"),shards);
 assert.equal(restored.unlockedHeroes.filter(id=>id==="nada").length,1);
});

test("corrupt or inaccessible wallet renders a two-starter preview without resetting storage",()=>{
 const {map,storage,provider}=setup();
 for(const mode of ["corrupt","denied"]){
  map.set(V.KEY,"{broken");
  const denied={getItem(){throw Error("storage denied")},setItem(){throw Error("must not write")}};
  const source=mode==="corrupt"?provider:()=>denied;
  const loaded=S.load(heroes,source);
  assert.equal(loaded.blocked,true);
  assert.equal(loaded.available,false);
  assert.equal(loaded.progress.saveBlocked,true);
  assert.equal(loaded.progress.saveVersion,3);
  assert.deepEqual(Array.from(loaded.progress.unlockedHeroes),["ren","art"]);
  for(const id of ["ren","art"])assert.equal(Star.rankOf(loaded.progress,id),1);
  for(const id of ["nada","liora","sava"])assert.equal(Star.rankOf(loaded.progress,id),0);
  assert.equal(S.save(loaded.progress,source),false);
  assert.equal(map.get(V.KEY),"{broken");
 }
});
