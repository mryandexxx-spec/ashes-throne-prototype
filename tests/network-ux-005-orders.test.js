"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Pilot=require("../network-pilot-session.js"),Core=require("../network-core.js");
test("NET-UX-005: dialog, tabs, priority, accessible state, guaranteed progress and version",()=>{
 const html=read("index.html"),js=read("network-pilot-ui.js"),css=read("network-pilot.css");
 for(const id of ["netuxOrderOpen","net005OrderStatus","netuxOrderProgress",
  "netuxOrderDialog","netuxOrderTabs","net005OrderChoices","netuxOrderCurrent",
  "netuxOrderCurrentProgress","netuxOrderPreview","netuxOrderApply","netuxOrderClear","netuxOrderMessage"])
  assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id);
 assert.match(html,/aria-haspopup="dialog"/);
 assert.match(html,/aria-labelledby="netuxOrderHeading"/);
 assert.match(js,/session\.availableOrders\(\)/);
 assert.match(js,/await change\("order",next\)/);
 assert.match(js,/s\.config\.focusWeight/);
 assert.match(js,/s\.config\.guaranteeAfter/);
 assert.match(js,/active\.misses/);
 assert.match(css,/\.netux-order-options\{[^}]*overflow-y:auto/s);
 assert.match(css,/\.netux-order-dialog::backdrop/);
 assert.match(css,/safe-area-inset-left/);
 assert.match(css,/min-height:44px/);
 assert.ok(!html.includes('<details class="net005-order"'));
 assert.equal(JSON.parse(read("package.json")).version,"0.3.199");
 assert.ok(html.includes('id="buildVersion">Прототип · v0.3.199 · NETUXORDER005'));
});
function store(){
 const map=new Map();let failed=false,lock=true;
 return {map,set failed(v){failed=v},set lock(v){lock=v},owns:()=>lock,
  local:{getItem:k=>map.has(k)?map.get(k):null,
   setItem(k,v){if(failed)throw Error("WRITE_FAILED");map.set(k,v)}}};
}
const factory=s=>Pilot.create({live:true,storageProvider:()=>s.local,
 exclusive:async f=>f(),ownsLock:s.owns,now:()=>1795094000000,seed:()=>123});
test("NET-UX-005: all four live order kinds save, preserve existing clues and wallet",async()=>{
 const s=store(),pilot=factory(s);
 assert.equal((await pilot.open()).ok,true);
 const board=JSON.stringify(pilot.read().board);
 const options=pilot.availableOrders();
 for(const kind of ["material","hero","region","type"]){
  const o=options.find(x=>x.kind===kind);assert.ok(o,kind);
  assert.equal((await pilot.change("order",o)).ok,true);
  assert.equal(pilot.read().order.kind,kind);
  assert.equal(pilot.read().order.targetId,o.targetId);
  assert.equal(pilot.read().order.misses,0);
  assert.equal(JSON.stringify(pilot.read().board),board);
 }
 const revision=pilot.read().revision;
 assert.equal((await pilot.change("refresh")).ok,true);
 assert.equal(pilot.read().revision,revision,"full board cannot advance the guarantee");
 assert.equal((await pilot.change("order",null)).ok,true);
 assert.equal(pilot.read().order,null);
 assert.equal(JSON.stringify(pilot.read().board),board);
 assert.equal(s.map.has("ashes-throne.progress.v3"),false);
});
test("NET-UX-005: failed save is blocked, old order and board persist",async()=>{
 const s=store(),pilot=factory(s);assert.equal((await pilot.open()).ok,true);
 const material=pilot.availableOrders().find(x=>x.kind==="material");
 assert.equal((await pilot.change("order",material)).ok,true);
 const saved=s.map.get(Core.KEY),before=pilot.read();
 s.failed=true;
 assert.equal((await pilot.change("order",pilot.availableOrders().find(x=>x.kind==="hero"))).ok,false);
 assert.equal(pilot.isBlocked(),true);
 assert.equal(s.map.get(Core.KEY),saved);
 assert.deepEqual(pilot.read(),before);
 assert.equal((await pilot.change("order",null)).ok,false);
});
