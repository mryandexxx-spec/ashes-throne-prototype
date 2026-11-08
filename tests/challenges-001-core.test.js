"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const core=vm.runInNewContext(read("challenge-core.js")+"\nChallengeCore");
const all=[{id:"a",side:"ally",hp:30},{id:"b",side:"ally",hp:30},
 {id:"ves",side:"enemy",hp:0},{id:"shade",side:"enemy",hp:0}];
const fight=(winner="ally",fighters=all)=>({
 active:false,winner, fighters, wave:1,totalWaves:1,allyActions:4
});
function deathGroups(id,groups){
 const t=core.start(id);
 for(const group of groups){
  const events=[{type:"ability",actorId:"a"}].concat(group.map(targetId=>({type:"death",targetId})));
  assert.equal(core.capture(t,events),true);
 }
 return t;
}
test("catalog is isolated from campaign, rewards and scenario narrative",()=>{
 assert.deepEqual(Array.from(core.all().map(x=>x.id)),["T-01","T-02","T-03","T-04","N-01","N-02","N-03","N-04"]);
 assert.deepEqual(Array.from(core.get("T-01").enemyIds),["ves","shade"]);
 assert.deepEqual(Array.from(core.get("N-01").futureWaves[0]),["ves-2"]);
 assert.equal(core.get("N-01").thirdStarActionLimit,null);
 assert.equal(core.get("missing"),null);
});
test("T-01: strict first kill and alive grading 1/2/3",()=>{
 assert.equal(core.score("T-01",fight(),deathGroups("T-01",[["ves"],["shade"]])),3);
 const wounded=[...all.map(x=>({...x}))];wounded[0].hp=0;
 assert.equal(core.score("T-01",fight("ally",wounded),deathGroups("T-01",[["ves"],["shade"]])),2);
 assert.equal(core.score("T-01",fight(),deathGroups("T-01",[["shade"],["ves"]])),1);
});
test("T-01: simultaneous deaths in one ability cannot count as first",()=>{
 const t=core.start("T-01");
 assert.equal(core.capture(t,[{type:"ability",actorId:"a"},
  {type:"death",targetId:"ves"},{type:"death",targetId:"shade"}]),true);
 assert.equal(core.score("T-01",fight(),t),1);
 const separate=deathGroups("T-01",[["ves"],["shade"]]);
 assert.equal(core.score("T-01",fight(),separate),3);
});
test("passive deaths without a new ability share its action",()=>{
 const t=core.start("T-01");
 core.capture(t,[{type:"ability"},{type:"damage",targetId:"ves"},
  {type:"death",targetId:"ves"},{type:"effect",targetId:"shade"},
  {type:"death",targetId:"shade"}]);
 assert.equal(core.score("T-01",fight(),t),1);
});
test("enemy self-death not linked to an ability is invalid",()=>{
 const t=core.start("T-01");
 assert.equal(core.capture(t,[{type:"death",targetId:"ves"}]),false);
 assert.equal(t.invalid,true);
 assert.equal(core.score("T-01",fight(),t),0);
});
test("loss and an incomplete attempt yield zero, no unlocked progress",()=>{
 assert.equal(core.score("T-01",fight("enemy"),deathGroups("T-01",[["ves"],["shade"]])),0);
 assert.equal(core.score("T-01",{...fight(),active:true},deathGroups("T-01",[["ves"]])),0);
 assert.equal(core.score("T-01",fight(),core.start("N-01")),0);
});
test("N-01 validates final wave, alive allies and pending third-star threshold",()=>{
 const n=core.start("N-01"),done={...fight(),wave:2,totalWaves:2};
 assert.equal(core.score("N-01",done,n),2);
 assert.equal(core.score("N-01",{...done,wave:1},n),0);
 const dead=all.map(x=>({...x}));dead[1].hp=0;
 assert.equal(core.score("N-01",{...done,fighters:dead},n),1);
 assert.equal(core.score("N-01",{...done,winner:"enemy"},n),0);
});
test("progress records better stars only, without mutating original",()=>{
 const original=core.fresh();
 const t=deathGroups("T-01",[["ves"],["shade"]]);
 const first=core.result(original,"T-01",fight(),t);
 assert.equal(first.earned,3);
 assert.equal(first.improved,true);
 assert.equal(first.candidate.bestStars["T-01"],3);
 assert.equal(original.bestStars["T-01"],0);
 const lower=core.result(first.candidate,"T-01",fight(),deathGroups("T-01",[["shade"]])); 
 assert.equal(lower.earned,1);assert.equal(lower.best,3);assert.equal(lower.improved,false);
});
test("independent local save, reload and no overwrite of corrupted data",()=>{
 const map=new Map();
 const store={getItem:key=>map.has(key)?map.get(key):null,setItem:(key,v)=>map.set(key,v)};
 assert.equal(core.load(()=>store).progress.bestStars["T-01"],0);
 const p=core.fresh();p.bestStars["T-01"]=3;p.bestStars["N-01"]=2;
 assert.equal(core.save(p,()=>store),true);
 assert.equal(core.load(()=>store).progress.bestStars["N-01"],2);
 const original=map.get(core.KEY);
 assert.equal(core.save(p,()=>{throw Error("storage unavailable");}),false);
 assert.equal(map.get(core.KEY),original);
 map.set(core.KEY,'{"version":1,"bestStars":{"T-01":99}}');
 const broken=core.load(()=>store);
 assert.equal(broken.blocked,true);
 assert.equal(core.save(p,()=>store,broken.blocked),false);
 assert.equal(map.get(core.KEY),'{"version":1,"bestStars":{"T-01":99}}');
});
test("save schema refuses unknown IDs and invalid grades",()=>{
 const map=new Map(),store={setItem:(k,v)=>map.set(k,v)};
 assert.equal(core.save({bestStars:{...core.fresh().bestStars,unknown:1}},()=>store),false);
 assert.equal(core.save({bestStars:{...core.fresh().bestStars,"N-01":-1}},()=>store),false);
 assert.equal(map.size,0);
});
test("does not touch existing campaign and progress keys",()=>{
 const map=new Map([["ashes-throne.progress.v3","previous profile"],
  ["ashes-throne.campaign.v1","previous campaign"]]);
 const store={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 assert.equal(core.save(core.fresh(),()=>store),true);
 assert.equal(map.get("ashes-throne.progress.v3"),"previous profile");
 assert.equal(map.get("ashes-throne.campaign.v1"),"previous campaign");
 assert.equal(map.size,3);
});
test("real combat wave transition remains independent from challenge scoring",()=>{
 const src=["initiative-model.js","ability-data.js","combat-core.js"].map(read).join("\n");
 const combat=vm.runInNewContext(src+"\nCombatCore");
 const ally={id:"test-ally",name:"Test ally",side:"ally",hp:300,atk:30,speed:250};
 const foe=id=>({id,name:id,side:"enemy",hp:20,atk:1,speed:50});
 const battle=combat.createBattle([ally,foe("ves"),foe("shade")],[[foe("ves-2")]]);
 const t=core.start("N-01");
 combat.advanceToPlayerTurn(battle);
 let attempts=0;
 while(battle.active&&attempts++<20){
  assert.equal(combat.performPlayerAbility(battle,"basic"),true);
  assert.equal(core.capture(t,battle.events),true);
 }
 assert.ok(attempts<20);
 assert.equal(battle.winner,"ally");
 assert.equal(battle.wave,2);
 assert.equal(battle.totalWaves,2);
 assert.equal(core.score("N-01",battle,t),2);
});
