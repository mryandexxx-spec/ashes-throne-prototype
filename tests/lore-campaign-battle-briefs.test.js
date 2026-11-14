"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const Data=require("../lore-campaign-data.js");
const Core=require("../lore-campaign-core.js");
const SceneData=require("../lore-campaign-scenes.js");
const SceneCore=require("../lore-campaign-scene-core.js");
const Save=require("../lore-campaign-scene-save.js");
const Runtime=require("../lore-campaign-scene-runtime.js");
const UI=require("../lore-campaign-ui.js");
const Fixture=require("./lore-campaign-003-fixture.js");
const source=file=>fs.readFileSync(path.resolve(__dirname,"..",file),"utf8");
const example=()=>({
 title:"TEST_BRIEF_TITLE",
 intro:'Наблюдение <img src=x onerror=alert(1)> без новых NPC',
 lines:[
  {speakerId:"Рен Терен",text:"— Держи проход."},
  {speakerId:"Нада",text:"— Это не доказательство."}
 ],
 victory:"TEST_VICTORY_SCENE. После победы соперники отступили.",
 defeat:"TEST_DEFEAT_SCENE. Проход пока занят."
});
function root(){
 return {innerHTML:"",listeners:{},addEventListener(k,cb){(this.listeners[k]??=[]).push(cb);},
  removeEventListener(k,cb){this.listeners[k]=(this.listeners[k]||[]).filter(x=>x!==cb)},
  contains(){return true},querySelector(){return {focus(){}}},isConnected:true};
}
function fixture(){
 const f=Fixture.create(Data);
 f.graph.nodes[0].requiredBattleId="fs01-test-required";
 f.graph.nodes[0].requiredBattleNarrative=example();
 assert.equal(Data.catalogIsValid(f.graph),true);
 return f;
}
test("LC-006: optional authored metadata requires a real mandatory battle and bounded safe text",()=>{
 const f=fixture();
 const invalid=JSON.parse(JSON.stringify(f.graph));
 delete invalid.nodes[0].requiredBattleId;
 assert.equal(Data.catalogIsValid(invalid),false);
 invalid.nodes[0].requiredBattleId="fs01-test-required";
 invalid.nodes[0].requiredBattleNarrative.lines=[{speakerId:"Ren",text:"x".repeat(251)}];
 assert.equal(Data.catalogIsValid(invalid),false);
 assert.equal(Data.catalog().nodes.every(n=>!n.requiredBattleNarrative),true,
  "Public game ships no privately written encounter material");
});
test("LC-006: full opening and speaker portraits appear only after the scene, before real combat",()=>{
 const f=fixture(),r=root(),store=new Map(),started=[];
 UI.mount(r,f.data,Core,{pack:f.pack,scripts:SceneData,engine:SceneCore,save:Save,
  runtime:Runtime,storage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
  onStartRequiredBattle:x=>{started.push(x);return true;}});
 UI.openStory("five-shadows");
 assert.doesNotMatch(r.innerHTML,/TEST_BRIEF_TITLE/,"No battle text before scene completion");
 assert.equal(UI.startScene(),true);
 assert.equal(UI.actInScene("next"),true);
 assert.equal(UI.actInScene("next"),true);
 assert.equal(UI.actInScene("choose","left"),true);
 assert.equal(UI.actInScene("next"),true);
 assert.equal(UI.actInScene("finish"),true);
 assert.match(r.innerHTML,/TEST_BRIEF_TITLE/);
 assert.match(r.innerHTML,/class="lore-battle-voice"/);
 assert.match(r.innerHTML,/assets\/ren-portrait-ui\.webp\?v=2/);
 assert.match(r.innerHTML,/assets\/nada-portrait-ui\.webp\?v=2/);
 assert.match(r.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(r.innerHTML,/<img src=x onerror/);
 assert.match(r.innerHTML,/data-lore-action="required-battle"/);
 assert.equal(UI.startRequiredBattle(),true);
 assert.equal(started.length,1);
 assert.equal(started[0].nodeId,"five-shadows:fs-01");
 assert.equal(started[0].battleId,"fs01-test-required");
 assert.equal(started[0].battleNarrative.title,"TEST_BRIEF_TITLE");
 assert.equal(UI.recordBattleVictory("five-shadows:fs-01","fs01-test-required").ok,true);
 assert.equal(UI.pendingBattle(f.graph.nodes[0]),false);
 assert.equal(UI.recordBattleVictory("five-shadows:fs-01","fs01-test-required").ok,false,
  "Can never grant the same battle receipt twice");
 const save=JSON.parse(store.get(Save.KEY));
 assert.deepEqual(save.stories["five-shadows"].battleClearedNodeIds,["five-shadows:fs-01"]);
 assert.equal(Core.available(f.graph,save,"five-shadows:fs-02"),true);
});
test("LC-006: public battle renderer escapes private text and never grants rewards",()=>{
 const js=source("game.js"),ui=source("lore-campaign-ui.js");
 assert.match(js,/body\.textContent=summary\+/);
 assert.match(js,/battleNarrative:context\.battleNarrative\|\|null/);
 assert.match(ui,/escapeHtml\(n\.intro\)/);
 assert.match(ui,/escapeHtml\(line\.text\)/);
 assert.match(ui,/battleNarrative:node\.requiredBattleNarrative\|\|null/);
 assert.doesNotMatch(js+ui+source("lore-campaign-data.js"),/Чужой маршрут|Право на свидетельство|Игровые проводники/);
});
