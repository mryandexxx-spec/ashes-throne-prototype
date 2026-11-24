"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const files=["gear-data.js","progress-core.js","star-core.js","skill-core.js","hero-collection-core.js","daily-core.js","login-core.js","progress-v3-core.js","save-core.js","reward-policy-core.js","main-campaign-core.js"];
const {S,H,V,R,C,Star}=vm.runInNewContext(files.map(f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8")).join("\n")+"\n({S:SaveCore,H:HeroCollectionCore,V:ProgressV3Core,R:RewardPolicyCore,C:MainCampaignCore,Star:StarCore})");
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
