"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const {ChallengeCore:C,DailyCore:D}=vm.runInNewContext(
 ["challenge-core.js","daily-core.js"].map(read).join("\n")+"\n({ChallengeCore,DailyCore})");
test("two independent modes, four test stages each, stable pilot IDs and progression",()=>{
 assert.deepEqual(Array.from(C.byKind("tactical").map(x=>x.id)),["T-01","T-02","T-03","T-04"]);
 assert.deepEqual(Array.from(C.byKind("onslaught").map(x=>x.id)),["N-01","N-02","N-03","N-04"]);
 const p=C.fresh();
 assert.equal(C.available("T-01",p),true);
 assert.equal(C.available("N-01",p),true);
 assert.equal(C.available("T-02",p),false);
 assert.equal(C.available("N-02",p),false);
 p.bestStars["T-01"]=1;
 assert.equal(C.available("T-02",p),true);
 assert.equal(C.available("N-02",p),false);
 p.bestStars["N-01"]=1;
 assert.equal(C.available("N-02",p),true);
 assert.equal(C.byKind("invalid").length,0);
 for(const task of C.all()){
  assert.ok(task.enemyIds.length>=2);
  assert.equal(new Set(task.enemyIds).size,task.enemyIds.length);
  if(task.kind==="onslaught"){
   assert.ok(task.futureWaves.length>=1);
   assert.equal(task.thirdStarActionLimit,null);
  }else assert.ok(task.enemyIds.includes(task.priorityId));
 }
});
test("existing two-mission local save loads and extends without losing stars",()=>{
 const map=new Map([[C.KEY,JSON.stringify({version:1,bestStars:{"T-01":3,"N-01":2}})]]);
 const storage={getItem:key=>map.get(key)??null,setItem:(key,v)=>map.set(key,v)};
 const loaded=C.load(()=>storage);
 assert.equal(loaded.blocked,false);
 assert.equal(loaded.progress.bestStars["T-01"],3);
 assert.equal(loaded.progress.bestStars["N-01"],2);
 assert.equal(loaded.progress.bestStars["T-02"],0);
 assert.equal(loaded.progress.bestStars["N-04"],0);
 assert.equal(C.save(loaded.progress,()=>storage),true);
 assert.equal(C.load(()=>storage).progress.bestStars["N-01"],2);
});
test("dynamic tactical priorities and multistage wave grading",()=>{
 for(const id of ["T-02","T-03","T-04"]){
  const def=C.get(id),t=C.start(id);
  C.capture(t,[{type:"ability"},{type:"death",targetId:def.priorityId}]);
  const foes=def.enemyIds.map(x=>({id:x,side:"enemy",hp:0}));
  const battle={active:false,winner:"ally",fighters:[{id:"ally",side:"ally",hp:30},...foes],wave:1,totalWaves:1};
  assert.equal(C.score(id,battle,t),3,id);
  const bad=C.start(id),other=def.enemyIds.find(x=>x!==def.priorityId);
  C.capture(bad,[{type:"ability"},{type:"death",targetId:other}]);
  assert.equal(C.score(id,battle,bad),1,id);
 }
 for(const id of ["N-02","N-03","N-04"]){
  const def=C.get(id),t=C.start(id),num=def.futureWaves.length+1;
  const battle={active:false,winner:"ally",fighters:[{id:"ally",side:"ally",hp:30}],wave:num,totalWaves:num,allyActions:50};
  assert.equal(C.score(id,battle,t),2,id);
  assert.equal(C.score(id,{...battle,wave:num-1},t),0,id);
 }
});
test("old 3-task daily save is valid and upgraded without resetting earlier claims",()=>{
 const state={day:"2026-11-08",counts:{"hero-level":1,"equip-item":0,"campaign-battle":1},claimed:["hero-level"]};
 assert.equal(D.valid(state),true);
 const profile={saveVersion:3,currency:100,accountXp:25,materials:{Fe:0,Le:0,Cl:0},daily:JSON.parse(JSON.stringify(state))};
 assert.equal(D.unclaimedCount(profile,"2026-11-08"),1);
 assert.equal(D.today(profile,"2026-11-08"),true);
 assert.equal(D.valid(profile.daily),true);
 assert.equal(profile.daily.counts["tactical-participation"],0);
 assert.equal(profile.daily.claimed[0],"hero-level");
 assert.equal(D.record(profile,"tactical-participation","2026-11-08"),true);
 assert.equal(D.record(profile,"onslaught-participation","2026-11-08"),true);
 assert.equal(D.unclaimedCount(profile,"2026-11-08"),3);
 assert.equal(D.record(profile,"onslaught-participation","2026-11-08"),false);
});
test("claim all collects only eligible tasks, once, with one combined award",()=>{
 const profile={saveVersion:3,currency:1,accountXp:2,materials:{Fe:0,Le:0,Cl:0},daily:D.empty("2026-11-08")};
 assert.equal(D.record(profile,"tactical-participation","2026-11-08"),true);
 assert.equal(D.record(profile,"onslaught-participation","2026-11-08"),true);
 assert.equal(D.record(profile,"hero-level","2026-11-08"),true);
 assert.equal(D.claim(profile,"hero-level","2026-11-08").currency,200);
 const amount=D.claimAll(profile,"2026-11-08");
 assert.deepEqual(Array.from(amount.ids),["tactical-participation","onslaught-participation"]);
 assert.equal(amount.currency,400);
 assert.equal(amount.xp,30);
 assert.equal(profile.currency,601);
 assert.equal(profile.accountXp,47);
 assert.equal(profile.materials.Fe,4);
 assert.equal(profile.materials.Le,2);
 assert.equal(profile.daily.claimed.length,3);
 assert.equal(D.claimAll(profile,"2026-11-08"),null);
 assert.equal(D.unclaimedCount(profile,"2026-11-08"),0);
 assert.equal(D.claim(profile,"tactical-participation","2026-11-08"),null);
});
test("claim all is atomic on overflow, missing materials and backwards clock",()=>{
 const p={saveVersion:3,currency:0,accountXp:0,materials:{Fe:0,Le:0,Cl:0},daily:D.empty("2026-11-08")};
 D.record(p,"tactical-participation","2026-11-08");
 D.record(p,"onslaught-participation","2026-11-08");
 p.currency=Number.MAX_SAFE_INTEGER-200;
 let before=JSON.stringify(p);
 assert.equal(D.claimAll(p,"2026-11-08"),null);
 assert.equal(JSON.stringify(p),before);
 p.currency=0;delete p.materials.Le;before=JSON.stringify(p);
 assert.equal(D.claimAll(p,"2026-11-08"),null);
 assert.equal(JSON.stringify(p),before);
 p.materials.Le=0;before=JSON.stringify(p);
 assert.equal(D.claimAll(p,"2026-11-07"),null);
 assert.equal(JSON.stringify(p),before);
});
test("new daily tasks survive v3 save/load and a failed write can be rolled back",()=>{
 const {S}=vm.runInNewContext(["gear-data.js","progress-core.js","daily-core.js",
  "progress-v3-core.js","save-core.js"].map(read).join("\n")+"\n({S:SaveCore})");
 const heroes=["kael","lyra","darin","medic-demo","test-area-damage"].map(id=>({id,side:"ally"}));
 const files=new Map();
 const store={getItem:key=>files.get(key)??null,setItem:(key,value)=>files.set(key,value)};
 let p=S.load(heroes,()=>store).progress;
 assert.equal(D.record(p,"tactical-participation","2026-11-08"),true);
 assert.equal(D.record(p,"onslaught-participation","2026-11-08"),true);
 assert.equal(S.save(p,()=>store),true);
 p=S.load(heroes,()=>store).progress;
 assert.equal(p.daily.counts["tactical-participation"],1);
 const snapshot=JSON.stringify(p),prior=files.get("ashes-throne.progress.v3");
 assert.ok(D.claimAll(p,"2026-11-08"));
 assert.equal(S.save(p,()=>({getItem:store.getItem,setItem(){throw Error("Safari write denied");}})),false);
 Object.keys(p).forEach(key=>delete p[key]);
 Object.assign(p,JSON.parse(snapshot));
 assert.equal(files.get("ashes-throne.progress.v3"),prior);
 assert.equal(p.daily.claimed.length,0);
 assert.ok(D.claimAll(p,"2026-11-08"));
 assert.equal(S.save(p,()=>store),true);
 const saved=S.load(heroes,()=>store).progress;
 assert.equal(saved.currency,400);
 assert.equal(saved.accountXp,30);
 assert.equal(saved.daily.claimed.length,2);
 assert.equal(D.claimAll(saved,"2026-11-08"),null);
});
test("challenge participation is distinct from campaign, and claim-all UI is connected",()=>{
 const game=read("game.js"),html=read("index.html"),css=read("styles.css");
 for(const id of ["challengeModes","challengeModeBack","challengeModeTitle","challengeList","dailyClaimAll"])
  assert.ok(html.includes('id="'+id+'"'),id);
 for(const kind of ["tactical","onslaught"])assert.ok(html.includes('data-challenge-kind="'+kind+'"'));
 for(const marker of ['recordDailyTask(task)','DailyCore.claimAll(progress,day)','ChallengeCore.byKind(kind)',
  'ChallengeCore.available(id,challengeProgress)','$("#challengeModeBack")?.addEventListener'])
  assert.ok(game.includes(marker),marker);
 assert.ok(css.includes(".challenge-mode-grid"));
});
