"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const api=vm.runInNewContext(["gear-data.js","progress-core.js","daily-core.js","login-core.js",
 "progress-v3-core.js","save-core.js"].map(read).join("\n")+
 "\n({L:LoginCore,S:SaveCore})");
const {L,S}=api,heroes=["kael","lyra","darin","medic-demo","test-area-damage"]
 .map(id=>({id,side:"ally"}));
const values=new Map(),storage={
 getItem:k=>values.get(k)??null,
 setItem:(k,v)=>values.set(k,v)
},get=()=>storage;
const p=S.load(heroes,get).progress;
assert.equal(p.saveVersion,3);
assert.equal(p.login,undefined);
assert.equal(L.current(p,"2026-11-08").nextDay,1);
assert.equal(L.claim(p,"2026-11-08").day,1);
assert.equal(p.currency,100);
assert.equal(p.accountXp,10);
assert.equal(p.materials.Fe,1);
assert.equal(L.claim(p,"2026-11-08"),null,"cannot double claim same day");
assert.equal(L.claim(p,"2026-11-07"),null,"cannot roll back date");
assert.equal(S.save(p,get),true);
let restored=S.load(heroes,get).progress;
assert.equal(restored.login.totalClaims,1);
assert.equal(restored.login.lastClaimDay,"2026-11-08");
assert.equal(L.claim(restored,"2026-11-08"),null,"reload cannot duplicate reward");
assert.equal(L.claim(restored,"2026-11-11").day,2,"missing days do not reset streak");
for(const [date,number] of [["2026-11-12",3],["2026-11-13",4],["2026-11-14",5],
 ["2026-11-15",6],["2026-11-16",7]]){
 const reward=L.claim(restored,date);
 assert.equal(reward.day,number);
}
assert.equal(restored.materials.Gl,1,"day 7 grants existing glass material");
assert.equal(restored.login.totalClaims,7);
assert.equal(L.current(restored,"2026-11-16").claimedThisCycle,7);
assert.equal(L.current(restored,"2026-11-16").available,false);
assert.equal(L.claim(restored,"2026-11-17").day,1,"cycle repeats after day 7");
assert.equal(restored.login.totalClaims,8);
assert.equal(S.save(restored,get),true);
let reread=S.load(heroes,get).progress;
assert.equal(reread.login.totalClaims,8);
assert.equal(L.current(reread,"2026-11-17").alreadyClaimed,true);
assert.equal(L.current(reread,"2026-11-16").clockBack,true);
assert.equal(L.valid({version:1,totalClaims:8,lastClaimDay:null}),false);
assert.equal(L.valid({version:1,totalClaims:0,lastClaimDay:"2026-11-17"}),false);
assert.equal(L.current(reread,"2026-11-31"),null,"invalid calendar dates rejected");
const raw=values.get("ashes-throne.progress.v3");
const bad=JSON.parse(raw);bad.login.lastClaimDay="2026-99-99";
values.set("ashes-throne.progress.v3",JSON.stringify(bad));
assert.equal(S.load(heroes,get).blocked,true,"corrupt calendar must block unsafe save");
values.set("ashes-throne.progress.v3",raw);
const source=read("game.js"),html=read("index.html");
assert.ok(html.includes('src="login-core.js"'));
assert.ok(html.indexOf('src="login-core.js"')<html.indexOf('src="progress-v3-core.js"'));
for(const marker of ["renderLoginCalendar","LoginCore.claim","persistProgress()",
 "loginCalendarGrid","loginCalendarStatus"])assert.ok(source.includes(marker)||html.includes(marker),marker);
assert.ok(source.includes('if(id==="loginCalendar"){\\n  markLoginCalendarSeen();'.replace('\\n','\n')));
assert.ok(html.includes('data-screen="loginCalendar"'));
console.log("Login-001: seven-day claim, repeat, missed days, rollback, v3 save and UI contract passed");
