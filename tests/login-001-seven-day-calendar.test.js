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
for(const [month,days] of [["2026-02",28],["2028-02",29],["2026-04",30],
 ["2026-11",30],["2026-12",31],["2027-01",31]])
 assert.equal(L.daysInMonth(month),days);
assert.equal(L.daysInMonth("2026-13"),null);
assert.equal(L.REWARDS.length,7,"seven existing temporary reward recipes are reused, not seven calendar days");
const p=S.load(heroes,get).progress;
assert.equal(p.saveVersion,3);
assert.equal(p.login,undefined,"existing v3 profile has no calendar field");
assert.equal(L.current(p,"2026-11-08").days,30);
assert.equal(L.current(p,"2026-11-08").nextDay,1);
assert.equal(L.claim(p,"2026-11-08").day,1);
assert.equal(p.currency,100);
assert.equal(p.accountXp,10);
assert.equal(p.materials.Fe,1);
assert.equal(L.claim(p,"2026-11-08"),null,"no double claim");
assert.equal(L.current(p,"2026-11-07").clockBack,true);
assert.equal(L.claim(p,"2026-11-07"),null,"clock rollback");
assert.equal(S.save(p,get),true);
let restored=S.load(heroes,get).progress;
assert.equal(restored.login.version,2);
assert.equal(restored.login.month,"2026-11");
assert.equal(restored.login.claimed,1);
assert.equal(L.claim(restored,"2026-11-08"),null,"reload cannot double claim");
assert.equal(L.claim(restored,"2026-11-11").day,2,"skipped days do not reset claimed reward sequence");
for(let d=12;d<=29;d++){
 const reward=L.claim(restored,"2026-11-"+String(d).padStart(2,"0"));
 assert.equal(reward.day,d-9);
}
assert.equal(restored.login.claimed,20);
assert.equal(L.current(restored,"2026-11-29").claimedThisMonth,20);
assert.equal(L.current(restored,"2026-11-29").days,30);
assert.equal(L.claim(restored,"2026-11-30").day,21,"calendar sequence is based on claims, not the date number");
assert.equal(restored.login.claimed,21);
assert.equal(L.current(restored,"2026-12-01").days,31);
assert.equal(L.current(restored,"2026-12-01").nextDay,1,"first of the new month resets calendar");
const december=L.claim(restored,"2026-12-01");
assert.equal(december.day,1);
assert.equal(restored.login.month,"2026-12");
assert.equal(restored.login.claimed,1);
assert.equal(L.current(restored,"2026-11-30"),null,"old month blocked after rolling forward");
assert.equal(S.save(restored,get),true);
const reread=S.load(heroes,get).progress;
assert.equal(reread.login.month,"2026-12");
assert.equal(reread.login.claimed,1);
assert.equal(L.current(reread,"2026-12-01").alreadyClaimed,true);
assert.equal(L.current(reread,"2026-12-02").nextDay,2);
assert.equal(L.current(reread,"2026-11-31"),null,"invalid date");

const calendar=L.fresh("2028-02");
assert.equal(L.valid(calendar),true);
const leap={saveVersion:3,login:calendar,currency:0,accountXp:0,
 materials:{Fe:0,Le:0,Cl:0,Wo:0,Fa:0,Th:0,Gl:0}};
for(let d=1;d<=29;d++){
 const date="2028-02-"+String(d).padStart(2,"0");
 assert.equal(L.claim(leap,date).day,d,"leap month has 29 sequential rewards");
}
assert.equal(leap.login.claimed,29);
assert.equal(L.current(leap,"2028-02-29").available,false);
assert.equal(L.claim(leap,"2028-02-29"),null);
assert.equal(L.current(leap,"2028-03-01").nextDay,1);
assert.equal(L.claim(leap,"2028-03-01").day,1,"next month resets full leap calendar");

assert.equal(L.valid({version:2,month:"2026-11",claimed:31,lastClaimDay:"2026-11-30"}),false);
assert.equal(L.valid({version:2,month:"2026-11",claimed:1,lastClaimDay:"2026-12-01"}),false);
assert.equal(L.valid({version:2,month:"2026-11",claimed:0,lastClaimDay:"2026-11-01"}),false);
assert.equal(L.valid({version:2,month:"2026-11",claimed:1,lastClaimDay:null}),false);
// A prior deployed seven-day v1 save is accepted and upgraded on first claim.
const raw=values.get("ashes-throne.progress.v3");
const legacy=JSON.parse(raw);
legacy.login={version:1,totalClaims:7,lastClaimDay:"2026-12-01"};
values.set("ashes-throne.progress.v3",JSON.stringify(legacy));
const migrated=S.load(heroes,get).progress;
assert.equal(migrated.login.version,1);
assert.equal(L.current(migrated,"2026-12-02").nextDay,8);
assert.equal(L.claim(migrated,"2026-12-02").day,8);
assert.equal(migrated.login.version,2);
assert.equal(migrated.login.claimed,8);
assert.equal(S.save(migrated,get),true);
const migratedReload=S.load(heroes,get).progress;
assert.equal(migratedReload.login.claimed,8);
const bad=JSON.parse(values.get("ashes-throne.progress.v3"));
bad.login.month="2026-99";
values.set("ashes-throne.progress.v3",JSON.stringify(bad));
assert.equal(S.load(heroes,get).blocked,true,"corrupt month cannot silently overwrite save");
values.set("ashes-throne.progress.v3",raw);
const source=read("game.js"),html=read("index.html");
assert.ok(html.includes('src="login-core.js"'));
assert.ok(html.indexOf('src="login-core.js"')<html.indexOf('src="progress-v3-core.js"'));
assert.ok(html.includes('id="loginCalendarMonth"'));
assert.ok(html.includes('data-screen="loginCalendar"'));
assert.ok(source.includes("i<view.days"));
assert.ok(source.includes("LoginCore.rewardForDay(i+1)"));
assert.ok(source.includes("view.claimedThisMonth"));
assert.ok(source.includes("markLoginCalendarSeen()"));
console.log("Login-001/002: month-length calendar, leap years, skipped days, first-of-month reset, v1 migration, save and UI passed");
