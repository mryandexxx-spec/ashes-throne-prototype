"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const files=["gear-data.js","progress-core.js","star-core.js","skill-core.js",
 "hero-collection-core.js","daily-core.js","login-core.js","progress-v3-core.js","save-core.js"];
const {Star,H,S}=vm.runInNewContext(files.map(read).join("\n")+
 "\n({Star:StarCore,H:HeroCollectionCore,S:SaveCore})");
const roster=["ren","nada","liora","art","sava"];
const inactive=["kael","lyra","darin","medic-demo","test-area-damage"];
assert.deepEqual(Array.from(Star.START),roster);
assert.deepEqual(Array.from(H.START),roster);
assert.equal(Star.MAX,7);
assert.deepEqual(Array.from(Star.COST),[10,15,25,30,65,85,100]);
const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
const provider=()=>storage,allies=roster.map(id=>({id,side:"ally"}));
let p=S.load(allies,provider).progress;
assert.equal(p.saveVersion,3);
assert.equal(Star.valid(p.heroStars),true);
for(const id of roster){assert.equal(Star.rankOf(p,id),1);assert.equal(H.owned(p,id),true);}
for(const id of inactive){
 assert.equal(H.owned(p,id),false);
 assert.equal(Star.add(p,id,10),false);
 assert.equal(Star.directGrant(p,id),false);
 assert.equal(Star.promote(p,id),null);
}
assert.equal(Star.add(p,"bad-id",12),false);
assert.equal(Star.add(p,"ren",-1),false);
assert.equal(Star.add(p,"ren",1.5),false);
assert.equal(Star.promote(p,"ren"),null);
assert.equal(Star.add(p,"ren",14),true);
assert.equal(Star.promote(p,"ren"),null);
assert.equal(Star.add(p,"ren",1),true);
assert.equal(Star.promote(p,"ren").rank,2);
assert.equal(Star.shardsOf(p,"ren"),0);
assert.equal(Star.costOf(p,"ren"),25);
assert.equal(S.save(p,provider),true);
p=S.load(allies,provider).progress;
assert.equal(Star.rankOf(p,"ren"),2);
for(let rank=2;rank<7;rank++){
 const amount=Star.COST[rank];
 assert.equal(Star.add(p,"ren",amount),true);
 const promoted=Star.promote(p,"ren");
 assert.equal(promoted.rank,rank+1);
 assert.equal(promoted.spent,amount);
 assert.equal(Star.shardsOf(p,"ren"),0);
}
assert.equal(Star.rankOf(p,"ren"),7);
assert.equal(Star.promote(p,"ren"),null);
const wallet=p.currency;
assert.equal(Star.add(p,"ren",1),true);
assert.equal(p.currency,wallet+Star.EXCESS_SHARD_CURRENCY);
assert.equal(Star.refillTest(p),true);
assert.equal(Star.shardsOf(p,"nada"),Star.TOTAL-Star.usedThrough(1));
for(const id of inactive)assert.equal(Star.shardsOf(p,id),0);
assert.equal(S.save(p,provider),true);
assert.equal(Star.rankOf(S.load(allies,provider).progress,"ren"),7);
const saved=data.get("ashes-throne.progress.v3");
let broken=JSON.parse(saved);broken.heroStars.ren.rank=8;
data.set("ashes-throne.progress.v3",JSON.stringify(broken));
assert.equal(S.load(allies,provider).blocked,true);
data.set("ashes-throne.progress.v3",saved);
assert.equal(S.load(allies,provider).blocked,false);
const html=read("index.html"),game=read("game.js");
for(const id of ["starPromoteButton","starShardCount","detailStarStrip"])assert.ok(html.includes('id="'+id+'"'));
assert.ok(game.includes("StarCore.refillTest(progress)")&&game.includes("StarCore.promote(progress,id)"));
assert.ok(html.includes('v'+require("../package.json").version+' · '));
console.log("Stars-001: five playable heroes, retirement guards, rank 1–7, reload, overflow and corruption passed");