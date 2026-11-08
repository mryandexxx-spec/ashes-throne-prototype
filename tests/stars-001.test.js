"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const files=["gear-data.js","progress-core.js","star-core.js","skill-core.js",
 "hero-collection-core.js","daily-core.js","login-core.js","progress-v3-core.js","save-core.js"];
const {P,Star,H,V,S}=vm.runInNewContext(files.map(read).join("\n")+
 "\n({P:ProgressCore,Star:StarCore,H:HeroCollectionCore,V:ProgressV3Core,S:SaveCore})");
const allies=Star.IDS.map(id=>({id,side:"ally"}));
function local(){
 const map=new Map();
 return {map,storage:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}};
}
const freshDB=local(),getter=()=>freshDB.storage,p=S.load(allies,getter).progress;
assert.equal(p.saveVersion,3);
assert.equal(Star.TOTAL,330);
assert.deepEqual(Array.from(Star.COST),[10,15,25,30,65,85,100]);
assert.equal(Star.valid(p.heroStars),true);
for(const id of Star.IDS){
 const expected=Star.START.includes(id)?1:0;
 assert.equal(Star.rankOf(p,id),expected,"fresh star "+id);
 assert.equal(H.owned(p,id),expected>0);
}
assert.equal(Star.costOf(p,"kael"),15);
assert.equal(Star.costOf(p,"medic-demo"),10);
assert.equal(Star.rankOf(p,"unknown"),null);
assert.equal(Star.add(p,"unknown",10),false);
assert.equal(Star.add(p,"medic-demo",-1),false);
assert.equal(Star.add(p,"medic-demo",1.5),false);
// Direct mission grant at 1 star must preserve all prior shards, not consume ten.
assert.equal(Star.add(p,"medic-demo",6),true);
assert.equal(H.grant(p,"black-pass-ambush"),"medic-demo");
assert.equal(Star.rankOf(p,"medic-demo"),1);
assert.equal(Star.shardsOf(p,"medic-demo"),6);
assert.equal(H.owned(p,"medic-demo"),true);
assert.equal(H.grant(p,"black-pass-ambush"),null,"no duplicate first-clear hero");
assert.equal(Star.shardsOf(p,"medic-demo"),6);
assert.equal(Star.costOf(p,"medic-demo"),15);
assert.equal(H.owned(p,"test-area-damage"),false);
assert.equal(S.save(p,getter),true);
assert.equal(Star.shardsOf(S.load(allies,getter).progress,"medic-demo"),6);
assert.equal(Star.rankOf(S.load(allies,getter).progress,"test-area-damage"),0);
// A fully shard-unlocked hero also becomes usable in squads without mission grant.
const q=JSON.parse(JSON.stringify(S.load(allies,getter).progress));
assert.equal(Star.add(q,"test-area-damage",9),true);
assert.equal(Star.promote(q,"test-area-damage"),null);
assert.equal(H.owned(q,"test-area-damage"),false);
assert.equal(Star.add(q,"test-area-damage",1),true);
const acquired=Star.promote(q,"test-area-damage");
assert.equal(acquired.rank,1);
assert.equal(acquired.spent,10);
assert.equal(Star.shardsOf(q,"test-area-damage"),0);
assert.equal(H.owned(q,"test-area-damage"),true);
assert.equal(q.unlockedHeroes.includes("test-area-damage"),true);
assert.equal(H.grant(q,"demo-mission-2"),null);
// Keep the shard-unlock scenario isolated from subsequent legacy migration checks.
// Entire 0-star to 7-star cycle costs exactly 330 shards; never advances twice.
const db2=local(),fresh2=S.load(allies,()=>db2.storage).progress;
const h="test-area-damage";
let paid=0;
for(let rank=0;rank<7;rank++){
 const required=Star.COST[rank];
 assert.equal(Star.rankOf(fresh2,h),rank);
 assert.equal(Star.promote(fresh2,h),null);
 assert.equal(Star.add(fresh2,h,required),true);
 const step=Star.promote(fresh2,h);
 assert.equal(step.spent,required);
 assert.equal(step.rank,rank+1);
 assert.equal(Star.shardsOf(fresh2,h),0);
 paid+=required;
}
assert.equal(paid,330);
assert.equal(Star.rankOf(fresh2,h),7);
assert.equal(Star.costOf(fresh2,h),null);
assert.equal(Star.promote(fresh2,h),null);
assert.equal(Star.add(fresh2,h,1),false,"compensation TBD: no unsupported excess reward");
assert.equal(S.save(fresh2,()=>db2.storage),true);
assert.equal(Star.rankOf(S.load(allies,()=>db2.storage).progress,h),7);
// Debug button floors remaining shards, never pays a real mission/drop reward.
const debugDB=local(),debug=S.load(allies,()=>debugDB.storage).progress;
assert.equal(Star.refillTest(debug),true);
assert.equal(Star.shardsOf(debug,"kael"),320);
assert.equal(Star.shardsOf(debug,"medic-demo"),330);
assert.equal(Star.refillTest(debug),true);
assert.equal(Star.shardsOf(debug,"kael"),320);
assert.equal(Star.promote(debug,"medic-demo").rank,1);
assert.equal(Star.shardsOf(debug,"medic-demo"),320);
assert.equal(Star.refillTest(debug),true);
assert.equal(Star.shardsOf(debug,"medic-demo"),320);
const previousLevel=debug.levels.kael,previousCurrency=debug.currency;
const calcBefore=P.heroStats(debug,{id:"kael",hp:100,atk:20,speed:100});
assert.equal(Star.add(debug,"kael",0),false);
assert.equal(Star.promote(debug,"kael").rank,2);
const calcAfter=P.heroStats(debug,{id:"kael",hp:100,atk:20,speed:100});
assert.deepEqual(JSON.stringify(calcAfter),JSON.stringify(calcBefore),"stars do not modify combat stats including speed");
assert.equal(debug.levels.kael,previousLevel);
assert.equal(debug.currency,previousCurrency);
// A v3 save without new star data migrates without losing ownership or wallet.
const v3=JSON.parse(freshDB.map.get(V.KEY));delete v3.heroStars;
v3.currency=999;v3.heroes.kael.level=3;
freshDB.map.set(V.KEY,JSON.stringify(v3));
const oldExplicit=S.load(allies,getter).progress;
assert.equal(oldExplicit.currency,999);
assert.equal(oldExplicit.levels.kael,3);
assert.equal(Star.rankOf(oldExplicit,"medic-demo"),1);
assert.equal(Star.rankOf(oldExplicit,"test-area-damage"),0);
assert.equal(S.save(oldExplicit,getter),true);
assert.equal(Star.valid(JSON.parse(freshDB.map.get(V.KEY)).heroStars),true);
// Older v3 without unlockedHeroes owns all five, as Heroes-001 promised.
const full=JSON.parse(freshDB.map.get(V.KEY));
delete full.heroStars;delete full.unlockedHeroes;
freshDB.map.set(V.KEY,JSON.stringify(full));
const legacy=S.load(allies,getter).progress;
assert.equal(Star.IDS.every(id=>Star.rankOf(legacy,id)===1&&H.owned(legacy,id)),true);
assert.equal(H.grant(legacy,"black-pass-ambush"),null);
assert.equal(S.save(legacy,getter),true);
assert.equal(S.load(allies,getter).progress.unlockedHeroes,undefined);
// Legacy v2 remains a separate untouched backup when v3 stages and owns five.
const v2DB=local(),old2=P.createProgress(allies);
old2.accountXp=135;old2.currency=421;old2.levels.kael=5;
assert.equal(S.save(old2,()=>v2DB.storage),true);
const backup=v2DB.map.get(S.KEY);
const migrated=S.load(allies,()=>v2DB.storage).progress;
assert.equal(Star.IDS.every(id=>Star.rankOf(migrated,id)===1),true);
assert.equal(migrated.currency,421);
assert.equal(migrated.accountXp,135);
assert.equal(v2DB.map.get(S.KEY),backup);
assert.equal(S.save(migrated,()=>v2DB.storage),true);
// A mismatched unlock mirror or corrupt ranks block rather than reset progress.
const good=freshDB.map.get(V.KEY);
let tampered=JSON.parse(good);tampered.heroStars.kael.rank=8;
freshDB.map.set(V.KEY,JSON.stringify(tampered));
assert.equal(S.load(allies,getter).blocked,true);
assert.equal(freshDB.map.get(V.KEY),JSON.stringify(tampered));
tampered=JSON.parse(good);
tampered.heroStars["test-area-damage"].rank=0;
freshDB.map.set(V.KEY,JSON.stringify(tampered));
assert.equal(S.load(allies,getter).blocked,true,"legacy all-owned mirror rejects locked hero");
freshDB.map.set(V.KEY,good);
const active=S.load(allies,getter).progress;
const saved=JSON.parse(good);
saved.revision=(saved.revision??0)+1;
freshDB.map.set(V.KEY,JSON.stringify(saved));
assert.equal(S.save(active,getter),false,"stale revision cannot replace newer save");
freshDB.map.set(V.KEY,good);
// UI rollback is explicit when a write is rejected.
const restore=JSON.stringify(active);
assert.equal(Star.add(active,"kael",15),true);
assert.ok(Star.promote(active,"kael"));
const failStorage={getItem:k=>freshDB.map.get(k)??null,setItem(){throw Error("denied");}};
assert.equal(S.save(active,()=>failStorage),false);
Object.keys(active).forEach(k=>delete active[k]);
Object.assign(active,JSON.parse(restore));
assert.equal(Star.rankOf(active,"kael"),1);
const html=read("index.html"),game=read("game.js"),css=read("styles.css");
assert.ok(html.indexOf('src="star-core.js"')<html.indexOf('src="hero-collection-core.js"'));
for(const id of ["starPromoteButton","starShardCount","lockedHeroDialog","lockedHeroUnlock","lockedHeroProgress","detailStarStrip"])
 assert.ok(html.includes('id="'+id+'"'),"missing "+id);
for(const token of ["StarCore.refillTest(progress)","StarCore.promote(progress,id)","renderStarPanel(base.id)",
 "showLockedHero(id)","Object.assign(progress,JSON.parse(before))"])
 assert.ok(game.includes(token),token);
assert.ok(css.includes(".star-panel")&&css.includes(".star-locked-dialog"));
assert.equal(JSON.parse(read("package.json")).version,"0.3.71");
assert.ok(html.includes("v0.3.71 · RENCOMBATB"));
console.log("Stars-001: seven ranks/330 shards, direct join, legacy saves, ownership, debug resources, rollback and UI contract passed");
