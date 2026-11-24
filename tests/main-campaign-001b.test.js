"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const files=["gear-data.js","progress-core.js","save-core.js","progress-v3-core.js","reward-policy-core.js","main-campaign-core.js"];
const {M,S,V}=vm.runInNewContext(files.map(f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8")).join("\n")+"\n({M:MainCampaignCore,S:SaveCore,V:ProgressV3Core})");
const heroes=["kael","lyra","darin","medic-demo","test-area-damage"].map(id=>({id,side:"ally"}));
const win={active:false,winner:"ally",allyActions:9,fighters:[{side:"ally",hp:9},{side:"enemy",hp:0}]};
function memory(){const rows=new Map();let fail=false;const storage={getItem:k=>rows.get(k)??null,setItem(k,v){if(fail)throw Error("quota");rows.set(k,v);}};
 return {rows,provider:()=>storage,fail:()=>fail=true};}
test("CAM001B: only terminal real victory improves best, reload and defeat cannot downgrade",()=>{
 const m=memory();assert.equal(M.load(m.provider).best,0);
 assert.equal(M.record({...win,active:true},m.provider).earned,0);
 assert.equal(M.record({...win,winner:"enemy"},m.provider).earned,0);
 assert.equal(M.record({...win,allyActions:20},m.provider).best,2);
 assert.equal(M.record(win,m.provider).best,3);
 assert.equal(M.record({...win,winner:"enemy"},m.provider).best,3);
 assert.equal(M.load(m.provider).best,3);
 assert.equal(M.score({...win,fighters:[]}),0);
});
test("CAM001B: persist failure/corrupt proof blocks reward",()=>{
 const m=memory();m.fail();assert.equal(M.record(win,m.provider).ok,false);
 assert.equal(M.load(m.provider).best,0);
 m.rows.set(M.KEY,'{bad');assert.equal(M.load(m.provider),null);
 assert.equal(M.status(null,{}),"blocked");
});
test("CAM001B: reward proof, exact-once wallet receipt, replay and reload",async()=>{
 const m=memory();const loaded=S.load(heroes,m.provider);
 assert.equal(loaded.blocked,false);
 let queue=Promise.resolve();
 const exclusive=fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
 const args={storageProvider:m.provider,heroes,exclusive,day:"2026-11-24"};
 const before=JSON.parse(m.rows.get(V.KEY));
 assert.equal((await M.claim(args)).code,"PROOF_NOT_PERSISTED");
 assert.equal(M.record(win,m.provider).ok,true);
 assert.equal(M.status(M.load(m.provider),loaded.progress),"claimable");
 const results=await Promise.all([M.claim(args),M.claim(args)]);
 assert.equal(results.filter(r=>r.ok).length,1);
 assert.equal(results.filter(r=>r.code==="ALREADY_CLAIMED").length,1);
 const saved=JSON.parse(m.rows.get(V.KEY));assert.equal(saved.currency,before.currency+M.SOURCE.reward.currency);
 assert.equal(saved.energy.value,before.energy.value);
 assert.equal(saved.rewardReceipts.filter(r=>r.id===M.RECEIPT).length,1);
 assert.equal(M.status(M.load(m.provider),S.load(heroes,m.provider).progress),"claimed");
 M.record(win,m.provider);assert.equal((await M.claim(args)).code,"ALREADY_CLAIMED");
 assert.equal(JSON.parse(m.rows.get(V.KEY)).currency,saved.currency);
});
