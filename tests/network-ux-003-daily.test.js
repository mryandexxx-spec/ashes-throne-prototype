"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const freshNav=()=>{delete require.cache[require.resolve("../network-navigation.js")];return require("../network-navigation.js");};
function fixture(){
 const events=[];
 const tab=view=>({dataset:{netView:view},hidden:view==="threat",disabled:false,attrs:{},
  setAttribute(k,v){this.attrs[k]=v}});
 const tabs=["clues","threat","daily"].map(tab);
 const clues={hidden:false,progress:{active:{wave:1}}},threat={hidden:true,progress:{score:91}},
  daily={hidden:true,progress:{claimed:["hero-level"]}};
 const root={addEventListener(type,cb){events.push([type,cb])},
  querySelectorAll(selector){assert.equal(selector,"[data-net-view]");return tabs},
  contains(item){return tabs.includes(item)}};
 const els={network:root,netuxCluesPanel:clues,net008aThreat:threat,netuxDailyPanel:daily};
 global.document={getElementById:id=>els[id]??null};
 const click=tab=>events[0][1]({target:{closest:()=>tab}});
 return {events,tabs,clues,threat,daily,click};
}
test("NET-UX-003: daily tab shares controller, saves stay untouched",()=>{
 const f=fixture(),n=freshNav(),saved=f.daily.progress;
 assert.equal(n.mount({threatAvailable:true}),true);
 assert.equal(n.select("daily"),true);
 assert.equal(n.current(),"daily");
 assert.equal(f.daily.hidden,false);
 assert.equal(f.clues.hidden,true);
 assert.equal(f.threat.hidden,true);
 assert.equal(f.tabs[2].attrs["aria-pressed"],"true");
 assert.equal(n.select("clues"),true);
 f.click(f.tabs[2]);
 assert.equal(n.current(),"daily");
 assert.strictEqual(f.daily.progress,saved);
 assert.equal(f.clues.progress.active.wave,1);
 assert.equal(f.threat.progress.score,91);
 n.mount({threatAvailable:true});
 assert.equal(f.events.length,1,"only one network click listener");
 delete global.document;
});
test("NET-UX-003: pilot hides only weekly threat, never daily goals",()=>{
 const f=fixture(),n=freshNav();
 assert.equal(n.mount({threatAvailable:false}),true);
 assert.equal(f.tabs[1].hidden,true);
 assert.equal(n.select("daily"),true);
 n.setThreatAvailable(false);
 assert.equal(n.current(),"daily");
 f.click(f.tabs[1]);
 assert.equal(n.current(),"daily");
 delete global.document;
});
const modules=vm.runInNewContext(
 ["gear-data.js","progress-core.js","skill-core.js","daily-core.js","progress-v3-core.js","save-core.js"]
  .map(read).join("\n")+"\n({S:SaveCore,D:DailyCore})");
const {S,D}=modules;
const heroes=[{id:"kael",side:"ally"},{id:"lyra",side:"ally"},{id:"darin",side:"ally"},
 {id:"medic-demo",side:"ally"},{id:"test-area-damage",side:"ally"}];
const createStore=()=>{const data=new Map();return {data,
 getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test("NET-UX-003: same DailyCore wallet survives reload and cannot pay twice",()=>{
 const store=createStore(),get=()=>store,p=S.load(heroes,get).progress,day="2026-11-19";
 assert.equal(D.today(p,day),true);
 assert.equal(D.record(p,"tactical-participation",day),true);
 assert.equal(D.record(p,"hero-level",day),true);
 assert.equal(S.save(p,get),true);
 const pending=S.load(heroes,get).progress;
 assert.equal(pending.daily.counts["hero-level"],1);
 assert.equal(D.unclaimedCount(pending,day),2);
 const batch=D.claimAll(pending,day);
 assert.equal(batch.ids.length,2);
 assert.equal(S.save(pending,get),true);
 const restored=S.load(heroes,get).progress;
 const balance=restored.currency,claimed=restored.daily.claimed.length;
 assert.equal(D.claimAll(restored,day),null);
 assert.equal(D.claim(restored,"hero-level",day),null);
 assert.equal(restored.currency,balance);
 assert.equal(restored.daily.claimed.length,claimed);
 assert.equal(D.today(restored,"2026-11-18"),false,"clock rollback does not reset claimed");
});
test("NET-UX-003: legacy three-task day migrates without new reward rules",()=>{
 const p={saveVersion:3,daily:{day:"2026-11-19",counts:{
  "hero-level":1,"equip-item":0,"campaign-battle":0},claimed:["hero-level"]}};
 assert.equal(D.today(p,"2026-11-19"),true);
 assert.equal(p.daily.counts["tactical-participation"],0);
 assert.equal(p.daily.counts["onslaught-participation"],0);
 assert.deepEqual(Array.from(p.daily.claimed),["hero-level"]);
});
test("NET-UX-003: network panel, activity links, safe return, mobile CSS and build",()=>{
 const html=read("index.html"),js=read("game.js"),css=read("network-pilot.css");
 const nav=read("network-navigation.js"),pkg=JSON.parse(read("package.json"));
 for(const id of ["netuxDailyPanel","netuxDailyTaskList","netuxDailyClaimAll","netuxDailyProgress",
  "netuxDailyBadge","netuxDailyReturn","netuxDailyTaskNotice"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/data-net-view="daily"/);
 for(const task of D.TASKS)
  assert.ok(js.includes('"'+task.id+'"')||js.includes("DailyCore.TASKS"),task.id);
 for(const token of ["DailyCore.claim(progress,button.dataset.dailyClaim,day)",
  "DailyCore.claimAll(progress,day)","persistProgress()","renderDailyTasks();renderDailyClaimBadge()",
  'dailyNavigationOrigin?"daily"','selectedChallengeKind="tactical"',
  'selectedChallengeKind="onslaught"','if(id==="network")renderDailyTasks()'])
  assert.ok(js.includes(token),token);
 assert.match(nav,/currentView!=="daily"/);
 assert.match(css,/max-height:calc\(100dvh - 218px\)/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/safe-area-inset/);
 assert.equal(pkg.version,"0.3.198");
 assert.match(html,/id="buildVersion">Прототип · v0\.3\.198 · NETUXBOARD004/);
});
