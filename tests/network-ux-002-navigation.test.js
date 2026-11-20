"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const freshNavigation=()=>{
 const id=require.resolve("../network-navigation.js");
 delete require.cache[id];
 return require(id);
};
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
 const click=item=>registered[0][1]({target:{closest:()=>item}});
 return {root,tabs,clues,threat,registered,click};
}
test("NET-UX-002 tabs: touch selection, squad return, saved states and idempotent mount",()=>{
 const f=fixture(),nav=freshNavigation();
 assert.equal(nav.mount({threatAvailable:true}),true);
 assert.equal(f.registered.length,1);
 assert.equal(nav.current(),"clues");
 assert.equal(f.clues.hidden,false);
 assert.equal(f.threat.hidden,true);
 assert.equal(f.tabs[0].attrs["aria-pressed"],"true");
 const oldClue=f.clues.saved,oldThreat=f.threat.saved;
 f.click(f.tabs[1]);
 assert.equal(nav.current(),"threat");
 assert.equal(f.clues.hidden,true);
 assert.equal(f.threat.hidden,false);
 assert.equal(f.tabs[1].attrs["aria-pressed"],"true");
 assert.equal(f.tabs[0].attrs["aria-pressed"],"false");
 assert.equal(nav.select("threat"),true,"weekly squad/battle return");
 assert.equal(nav.select("clues"),true,"clue squad/battle return");
 assert.strictEqual(f.clues.saved,oldClue);
 assert.strictEqual(f.threat.saved,oldThreat);
 assert.equal(nav.select("unknown"),false);
 assert.equal(nav.current(),"clues");
 nav.mount({threatAvailable:true});
 assert.equal(f.registered.length,1,"no duplicate listeners on re-entry");
 delete global.document;
});
test("NET-UX-002 pilot mode hides weekly and ignores disabled/external taps",()=>{
 const f=fixture(),nav=freshNavigation();
 nav.mount({threatAvailable:false});
 assert.equal(nav.select("threat"),false);
 assert.equal(f.tabs[1].hidden,true);
 assert.equal(f.threat.hidden,true);
 f.click(f.tabs[1]);
 assert.equal(nav.current(),"clues");
 f.click({dataset:{netView:"threat"},hidden:false,disabled:false});
 assert.equal(nav.current(),"clues");
 nav.setThreatAvailable(true);
 assert.equal(f.tabs[1].hidden,false);
 f.click(f.tabs[1]);
 assert.equal(nav.current(),"threat");
 nav.setThreatAvailable(false);
 assert.equal(nav.current(),"clues");
 assert.equal(f.clues.hidden,false);
 assert.equal(f.threat.hidden,true);
 delete global.document;
});
test("NET-UX-002 app routes, existing game systems and release contract",()=>{
 const html=read("index.html"),game=read("game.js"),css=read("network-pilot.css");
 for(const needle of [
  'class="hq-station hq-station-operations" data-screen="network"',
  '<button data-screen="network"><span aria-hidden="true">⌖</span>Разведсеть</button>',
  'id="netuxCluesPanel"',
  'data-net-view="clues"',
  'data-net-view="threat"',
  'data-screen="operations" aria-label="Открыть учебные разведоперации"',
  'network-navigation.js?v=0.3.216" type="text/progress-gated"',
  'id="buildVersion">Прототип · v0.3.216 · ASSETLOAD001'
 ])assert.ok(html.includes(needle),needle);
 for(const needle of [
  'NetworkNavigation.mount(',
  'squadReturnScreen==="weekly"?"threat":"clues"',
  'NetworkPilotSession.create(',
  'WeeklyThreatUI.mount(',
  'battleIsNetwork=squadReturnScreen==="network"',
  'showScreen(squadReturnScreen==="weekly"?"network":squadReturnScreen)'
 ])assert.ok(game.includes(needle),needle);
 assert.ok(css.includes(".netux-tabs"));
 assert.ok(css.includes("min-height:44px"));
 assert.equal(JSON.parse(read("package.json")).version,"0.3.216");
});
