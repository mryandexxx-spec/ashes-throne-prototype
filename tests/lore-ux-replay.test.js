"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Act2=require("../lore-campaign-act2.js");
const Core=require("../lore-campaign-core.js");
const Scripts=require("../lore-campaign-scenes.js");
const Engine=require("../lore-campaign-scene-core.js");
const Runtime=require("../lore-campaign-scene-runtime.js");
const Save=require("../lore-campaign-scene-save.js");
function memory(){
 const map=new Map();
 return {map,getItem:k=>map.has(k)?map.get(k):null,setItem(k,v){map.set(k,String(v));}};
}
const create=storage=>Runtime.create({graph:Act2.data.catalog(),graphCore:Core,
 pack:Act2.pack,scriptData:Scripts,sceneCore:Engine,saveModule:Save,storage});
function play(r,id){
 assert.equal(r.start(id).ok,true,"start "+id);
 for(let i=0;i<170;i++){
  let v=r.current();
  for(const x of v.inspections)if(!x.done)assert.equal(r.inspect(x.id).ok,true);
  v=r.current();
  for(const x of v.comparisons)if(x.ready&&!x.done)assert.equal(r.compare(x.id).ok,true);
  v=r.current();
  if(v.choices.length)assert.equal(r.choose(v.choices[0].id).ok,true);
  else if(v.canContinue)assert.equal(r.next().ok,true);
  else if(v.canFinish){assert.equal(r.finish().ok,true);return;}
  else assert.fail("scene stalled "+id);
 }
 assert.fail("scene loop "+id);
}
function seed(){
 const store=memory(),r=create(store),ids=Act2.data.catalog().nodes.map(x=>x.id);
 for(let i=0;i<5;i++){
  play(r,ids[i]);
  if(i<2){
   assert.equal(r.beginRequiredBattle(ids[i]).ok,true);
   assert.equal(r.recordBattleVictory(ids[i],
    i===0?"fs01-approach-combat":"fs02-evidence-combat").ok,true);
  }
 }
 return {r,store,ids};
}
test("LOREUX001: replay requires prior real battle receipt; ordinary first-clear still gates",()=>{
 const {r,ids}=seed(),id=ids[4];
 assert.equal(r.beginRequiredBattle(id,true).code,"BATTLE_NOT_AVAILABLE");
 assert.equal(Core.available(Act2.data.catalog(),r.progress(),ids[5]),false);
 assert.equal(r.beginRequiredBattle(id).ok,true);
 assert.equal(r.recordBattleVictory(id,"not-fs05").code,"INVALID_BATTLE");
 assert.equal(r.recordBattleVictory(id,"fs05-cover-evacuation").ok,true);
 assert.equal(Core.available(Act2.data.catalog(),r.progress(),ids[5]),true);
 assert.equal(r.beginRequiredBattle(id).code,"BATTLE_NOT_AVAILABLE");
});
test("LOREUX001: repeat victory is verified but never writes a second receipt",()=>{
 const {r,store,ids}=seed(),id=ids[4],battleId="fs05-cover-evacuation";
 assert.equal(r.beginRequiredBattle(id).ok,true);
 assert.equal(r.recordBattleVictory(id,battleId).ok,true);
 const before=store.getItem(Core.KEY),state=JSON.stringify(r.progress());
 const replay=r.beginRequiredBattle(id,true);
 assert.equal(replay.ok,true);assert.equal(replay.replay,true);
 assert.equal(r.recordBattleVictory(id,"wrong").code,"INVALID_BATTLE");
 assert.equal(r.recordBattleVictory(id,battleId).replay,true);
 assert.equal(store.getItem(Core.KEY),before,"no duplicate writes");
 assert.equal(JSON.stringify(r.progress()),state,"no story modifications");
 assert.equal(r.recordBattleVictory(id,battleId).code,"BATTLE_NOT_ACTIVE");
 const loaded=create(store);
 assert.equal(loaded.beginRequiredBattle(id,true).ok,true,"reload keeps replay enabled");
 loaded.cancelRequiredBattle();
 assert.equal(loaded.recordBattleVictory(id,battleId).code,"BATTLE_NOT_ACTIVE");
 assert.equal(store.getItem(Core.KEY),before);
});
test("LOREUX001: a completed battle offers real replay action in the map",()=>{
 const {r,store,ids}=seed(),id=ids[4],battleId="fs05-cover-evacuation";
 assert.equal(r.beginRequiredBattle(id).ok,true);
 assert.equal(r.recordBattleVictory(id,battleId).ok,true);
 const UI=require("../lore-campaign-ui.js");
 const root={innerHTML:"",handlers:{},addEventListener(type,fn){
  (this.handlers[type]??=[]).push(fn);
 },removeEventListener(){},contains(){return true},querySelector(){return null}};
 const started=[];
 assert.equal(UI.mount(root,Act2.data,Core,{pack:Act2.pack,storage:store,
  scripts:Scripts,engine:Engine,save:Save,runtime:Runtime,
  onStartRequiredBattle:ctx=>{started.push(ctx);return true;}}),true);
 assert.equal(UI.openStory("five-shadows"),true);
 assert.equal(UI.selectNode(id),true);
 assert.match(root.innerHTML,/data-lore-action="replay-battle"/);
 assert.doesNotMatch(root.innerHTML,/data-lore-action="required-battle"/);
 const button={dataset:{loreAction:"replay-battle"}};
 for(const fn of root.handlers.click)fn({target:{closest:()=>button}});
 assert.equal(started.length,1);
 assert.equal(started[0].battleId,battleId);
 assert.equal(started[0].replay,true);
 assert.equal(UI.recordBattleVictory(id,battleId).replay,true);
 assert.equal(UI.replayableBattle(Act2.data.getNode(id)),true);
});
