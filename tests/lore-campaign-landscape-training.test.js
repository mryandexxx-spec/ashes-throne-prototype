"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const Data=require("../lore-campaign-data.js");
const Core=require("../lore-campaign-core.js");
const Scenes=require("../lore-campaign-scenes.js");
const Engine=require("../lore-campaign-scene-core.js");
const Save=require("../lore-campaign-scene-save.js");
const Runtime=require("../lore-campaign-scene-runtime.js");
const UI=require("../lore-campaign-ui.js");
const Fixture=require("./lore-campaign-003-fixture.js");
const source=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
function root(){
 return {
  innerHTML:"",listeners:{},
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);},
  removeEventListener(k,fn){this.listeners[k]=(this.listeners[k]||[]).filter(x=>x!==fn);},
  contains(){return true;},querySelector(){return {focus(){}}}
 };
}
function click(r,action,other={}){
 for(const fn of r.listeners.click||[])
  fn({target:{closest(){return {dataset:{loreAction:action,...other}};}}});
}
test("LC-004 UX: one callback routes optional training from lore map, even after remount",()=>{
 const r=root();let launched=0;
 UI.mount(r,Data,Core,{onStartTraining:()=>launched++});
 UI.openStory("five-shadows");
 assert.match(r.innerHTML,/data-lore-action="training-battle"/);
 assert.match(r.innerHTML,/ВНЕ СОБЫТИЙ ГЛАВЫ/);
 click(r,"training-battle");
 assert.equal(launched,1);
 assert.equal(UI.snapshot().view,"map","training cannot complete or skip a story node");
 UI.mount(r,Data,Core,{onStartTraining:()=>launched+=10});
 click(r,"training-battle");
 assert.equal(launched,11,"updated callback, no duplicate handlers");
 assert.equal(r.listeners.click.length,1);
});
test("LC-004 UX: known speaker portrait appears with safe text; narration shows visual fallback",()=>{
 const r=root(),b=Fixture.create(Data);
 b.pack.scenes[0].beats[0].speakerId="Нада";
 const map=new Map();
 UI.mount(r,b.data,Core,{
  pack:b.pack,scripts:Scenes,engine:Engine,save:Save,runtime:Runtime,
  storage:{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}
 });
 UI.openStory("five-shadows");
 assert.equal(UI.startScene(),true);
 assert.match(r.innerHTML,/class="lore-scene-portrait"/);
 assert.match(r.innerHTML,/assets\/nada-portrait-ui\.webp\?v=2/);
 assert.match(r.innerHTML,/alt="Портрет: Нада"/);
 assert.match(r.innerHTML,/lore-scene-layout/);
 assert.match(r.innerHTML,/lore-scene-tools/);
 UI.actInScene("next");
 assert.match(r.innerHTML,/lore-scene-portrait--narrator/);
});
test("LC-004 UX: genuine 3D training has independent result and no canonical encounter",()=>{
 const game=source("game.js"),html=source("index.html"),css=source("lore-campaign.css");
 assert.match(game,/battleIsLoreTraining=squadReturnScreen==="loreTraining"/);
 assert.match(game,/if\(battleIsLoreTraining\)return \[\.\.\.selectedParty\(\)/);
 assert.match(game,/name:"Учебный противник "/);
 assert.match(game,/if\(battleIsLoreTraining&&!state\.active&&!missionResultShown\)/);
 assert.match(game,/showScreen\("loreTrainingResult"\)/);
 assert.match(game,/returnToLoreMap\(\)/);
 assert.match(game,/onStartTraining:openLoreTraining/);
 assert.match(html,/id="loreTrainingResult"/);
 assert.match(html,/id="loreTrainingResultBack"/);
 assert.match(html,/id="loreTrainingResultRetry"/);
 assert.match(css,/body\.lore-scene-open/);
 assert.match(css,/position:fixed!important/);
 assert.match(css,/grid-template-columns:minmax\(0,1\.05fr\) minmax\(0,\.95fr\)/);
 assert.match(css,/safe-area-inset-left/);
 assert.match(css,/\.lore-scene-portrait/);
 assert.deepEqual(Scenes.catalog().scenes,[],"no unreleased prose in public game");
});
