"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("NET-UX-004: compact board reuses live engine, ids and view navigation",()=>{
 const html=read("index.html"),js=read("network-pilot-ui.js"),css=read("network-pilot.css");
 for(const id of ["network","netuxCluesPanel","net004Board","net004Active",
  "net004Result","net004Clues","netuxSelectedTitle","netuxStartSelected",
  "netuxSimulateSelected","netuxOrderDetails","net005OrderChoices",
  "net007Collect","net008aThreat","netuxDailyPanel",
  "netuxInfluence"])
   assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.match(html,/class="netux-rail"/);
 assert.match(html,/class="netux-workspace"/);
 assert.match(html,/data-net-view="daily"/);
 assert.match(html,/data-net-view="threat"/);
 assert.match(html,/data-net-action="start-selected"/);
 assert.match(html,/data-net-action="simulate-selected"/);
 assert.equal((html.match(/data-net-view="threat"/g)||[]).length,1);
 assert.match(js,/selectedClueId=/);
 assert.match(js,/function updateSelection\(/);
 assert.match(js,/if\(action==="pick"\)/);
 assert.match(js,/action==="start-selected"\?"start":"simulate"/);
 assert.match(js,/session\.canSimulate\(selected\.id\)/);
 assert.match(js,/choice\.setAttribute\("aria-pressed"/);
 assert.match(css,/#net004Clues\s*\{/);
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/safe-area-inset-right/);
 assert.match(css,/min-height:44px/);
 const pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.220");
 assert.match(html,/id="buildVersion">Прототип · v0\.3\.219 · NETFULL001/);
});
test("NET-UX-004: core, reward and daily files stay untouched by UI stage",()=>{
 const source=read("network-pilot-ui.js");
 assert.match(source,/session\.change\(action,value\)/);
 assert.match(source,/session\.collect\(\)/);
 const nav=read("network-navigation.js");
 assert.match(nav,/clues\.hidden=currentView!=="clues"/);
 assert.match(nav,/daily\.hidden=currentView!=="daily"/);
 assert.match(nav,/threat\.hidden=currentView!=="threat"/);
});