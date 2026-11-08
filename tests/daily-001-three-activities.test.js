"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const {P,S,D}=vm.runInNewContext(["gear-data.js","progress-core.js","daily-core.js","progress-v3-core.js","save-core.js"]
 .map(read).join("\n")+"\n({P:ProgressCore,S:SaveCore,D:DailyCore})");
const heroes=[
 {id:"kael",side:"ally"},{id:"lyra",side:"ally"},{id:"darin",side:"ally"},
 {id:"medic-demo",side:"ally"},{id:"test-area-damage",side:"ally"}
];
const data=new Map(),store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
const get=()=>store,p=S.load(heroes,get).progress;
assert.equal(p.saveVersion,3);
assert.equal(p.daily,undefined,"old save format remains compatible");
assert.equal(D.today(p,"2026-11-08"),true);
assert.equal(D.record(p,"hero-level","2026-11-08"),true);
assert.equal(D.record(p,"hero-level","2026-11-08"),false);
assert.equal(D.claim(p,"equip-item","2026-11-08"),null);
let paid=D.claim(p,"hero-level","2026-11-08");
assert.equal(paid.currency,200);
assert.equal(paid.xp,15);
assert.equal(p.currency,200);
assert.equal(p.accountXp,15);
assert.equal(p.materials.Fe,2);
assert.equal(D.claim(p,"hero-level","2026-11-08"),null);
assert.equal(S.save(p,get),true);
const restored=S.load(heroes,get).progress;
assert.equal(restored.daily.claimed[0],"hero-level");
assert.equal(restored.currency,200);
assert.equal(restored.accountXp,15);
assert.equal(restored.materials.Fe,2);
assert.equal(D.claim(restored,"hero-level","2026-11-08"),null);
assert.equal(D.record(restored,"campaign-battle","2026-11-08"),true);
assert.equal(S.save(restored,get),true);
assert.equal(D.today(restored,"2026-11-07"),false,"clock rollback must not clear claims");
assert.equal(restored.daily.day,"2026-11-08");
assert.equal(D.today(restored,"2026-11-09"),true);
assert.equal(restored.daily.claimed.length,0);
assert.equal(restored.daily.counts["hero-level"],0);
assert.equal(D.record(restored,"campaign-battle","2026-11-09"),true);
assert.equal(D.claim(restored,"campaign-battle","2026-11-09").xp,20);
assert.equal(restored.materials.Cl,3);
assert.equal(S.save(restored,get),true);
const bad=JSON.parse(data.get("ashes-throne.progress.v3"));
bad.daily.claimed.push("hero-level","hero-level");
const oldValue=data.get("ashes-throne.progress.v3");
data.set("ashes-throne.progress.v3",JSON.stringify(bad));
const blocked=S.load(heroes,get);
assert.equal(blocked.blocked,true,"corrupt daily data cannot be overwritten");
data.set("ashes-throne.progress.v3",oldValue);
const game=read("game.js"),html=read("index.html");
for(const marker of ["recordDailyTask(\"hero-level\")","recordDailyTask(\"equip-item\")",
 "recordDailyTask(\"campaign-battle\")","DailyCore.claim","renderDailyTasks"])
 assert.ok(game.includes(marker),marker);
assert.ok(html.includes('src="daily-core.js"'));
assert.ok(html.indexOf('src="daily-core.js"')<html.indexOf('src="progress-v3-core.js"'));
assert.ok(html.includes('id="dailyTaskList"'));
assert.ok(html.includes('data-screen="dailyTasks"'));
console.log("Daily-001: stored v3 daily event/claim, reset, clock rollback, corruption and UI hooks passed");
