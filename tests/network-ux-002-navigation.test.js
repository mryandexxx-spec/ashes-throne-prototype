"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
function fixture(){
 const registered=[];
 const tab=view=>({
  dataset:{netView:view},hidden:view==="threat",disabled:false,
  attrs:{},setAttribute(k,v){this.attrs[k]=v}
 });
 const clues={hidden:false,saved:{phase:"brief",boardIds:[1,2]}};
 const threat={hidden:true,saved:{attempts:2,bestScore:78}};
 const tabs=[tab("clues"),tab("threat")];
 const root={addEventListener(type,fn){registered.push([type,fn])},
  querySelectorAll(selector){assert.equal(selector,"[data-net-view]");return tabs},
  contains(x){return tabs.includes(x)}};
 const elements={network:root,netuxCluesPanel:clues,net008aThreat:threat};
 global.document={getElementById(id){return elements[id]||null}};
 const click=(item)=>registered[0][1]({target:{closest:()=>item}});
 return {root,tabs,clues,threat,registered,click};
}
test("NET-UX-002 main navigation: mobile tap, return and no loss of game state",()=>{
 const f=fixture(),nav=require("../network-navigation.js");
 assert.equal(nav.mount({threatAvailable:true}),true);
 assert.equal(f.registered.length,1,"exactly one delegated listener");
 assert.equal(nav.current(),"clues");
 assert.equal(f.clues.hidden,false);
 assert.equal(f.threat.hidden,true);
 assert.equal(f.tabs[0].attrs["aria-pressed"],"true");
 const savedClue=f.clues.saved,savedThreat=f.threat.saved;
 f.click(f.tabs[1]);
 assert.equal(nav.current(),"threat");
 assert.equal(f.clues.hidden,true);
 assert.equal(f.threat.hidden,false);
 assert.equal(f.tabs[1].attrs["aria-pressed"],"true");
 assert.equal(f.tabs[0].attrs["aria-pressed"],"false");
 // A weekly squad/battle returns to the weekly parent instead of the clue board.
 assert.equal(nav.select("threat"),true);
 // A clue squad/battle returns to the exact ongoing clue phase.
 assert.equal(nav.select("clues"),true);
 assert.strictEqual(f.clues.saved,savedClue);
 assert.strictEqual(f.threat.saved,savedThreat);
 assert.equal(nav.select("unknown"),false);
 assert.equal(nav.current(),"clues");
 nav.mount({threatAvailable:true});
 assert.equal(f.registered.length,1,"re-entering never registers another listener");
 delete global.document;
});
test("NET-UX-002 isolated pilot cannot open weekly; external taps are ignored",()=>{
 const f=fixture(),nav=require("../network-navigation.js");
 assert.equal(nav.setThreatAvailable(false),true);
 assert.equal(nav.select("threat"),false);
 assert.equal(f.tabs[1].hidden,true);
 assert.equal(f.threat.hidden,true);
 f.click(f.tabs[1]);
 assert.equal(nav.current(),"clues");
 f.click({dataset:{netView:"threat"},hidden:false,disabled:false});
 assert.equal(nav.current(),"clues");
 assert.equal(f.clues.hidden,false);
 delete global.document;
});
test("NET-UX-002 actual app wiring and version contract",()=>{
 const html=read("index.html"),game=read("game.js"),css=read("network-pilot.css");
 assert.match(html,/class="hq-station hq-station-operations" data-screen="network"/);
 assert.match(html,/<button data-screen="network"><span aria-hidden="true">⌖<\\/span>Разведсеть<\\/button>/);
 assert.match(html,/id="netuxCluesPanel"/);
 assert.match(html,/data-net-view="clues"/);
 assert.match(html,/data-net-view="threat"/);
 assert.match(html,/data-screen="operations" aria-label="Открыть учебные разведоперации"/);
 assert.match(html,/network-navigation\\.js\\?v=0\\.3\\.196" type="text\\/progress-gated"/);
 assert.match(game,/NetworkNavigation\\.mount\\(/);
 assert.match(game,/squadReturnScreen==="weekly"\\?"threat":"clues"/);
 assert.match(css,/\\.netux-tabs/);
 assert.match(css,/min-height:44px/);
 assert.equal(JSON.parse(read("package.json")).version,"0.3.196");
 assert.match(html,/id="buildVersion">Прототип · v0\\.3\\.196 · NETUXNAV002/);
 // NET-UX-002 changes navigation only; reward and combat entrypoints remain.
 assert.match(game,/NetworkPilotSession\\.create\\(/);
 assert.match(game,/WeeklyThreatUI\\.mount\\(/);
 assert.match(game,/battleIsNetwork=squadReturnScreen==="network"/);
});
