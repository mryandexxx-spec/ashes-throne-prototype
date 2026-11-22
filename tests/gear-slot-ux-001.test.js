"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");

function fakeNode(tag){
 return {tag,children:[],className:"",textContent:"",
  setAttribute(name,value){this[name]=value;},
  append(...nodes){this.children.push(...nodes);},
  replaceChildren(...nodes){this.children=nodes;}
 };
}
function mountSlots(statuses){
 const slots=statuses.map((status,i)=>({
  dataset:{gearSlot:String(i),gearState:status},
  children:[],replaceChildren(...nodes){this.children=nodes;}
 }));
 const gearHost={querySelectorAll:()=>slots};
 const document={
  getElementById:id=>id==="gearSlots"?gearHost:null,
  querySelectorAll:()=>[],
  createElement:fakeNode,createElementNS:(_,tag)=>fakeNode(tag),
  body:{classList:{toggle(){}}}
 };
 const GearData=require("../gear-data.js");
 const ui=vm.runInNewContext(read("hero-card-ui.js")+"\nHeroCardUI",
  {document,GearData});
 ui.decorate();
 return {ui,slots};
}

test("GEARSLOTUX001: three visual states and an explicit fallback",()=>{
 const {ui,slots}=mountSlots(["ready","missing","installed","unknown"]);
 const captions=slots.map(slot=>slot.children.find(node=>node.className==="gear-slot-state-label").textContent);
 assert.deepEqual(captions,["Создать","Найти","Надето","Проверить"]);
 const marks=slots.map(slot=>slot.children.find(node=>node.className==="gear-slot-indicator"));
 assert.equal(marks[0].textContent,"+");
 assert.equal(marks[1].children[0].tag,"svg");
 assert.equal(marks[2].textContent,"✓");
 assert.match(ui.gearVisual("ready").aria,/изготовить и надеть/);
 assert.match(ui.gearVisual("missing").aria,/ресурсы/);
 assert.match(ui.gearVisual("installed").aria,/надет/);
 assert.equal(ui.gearVisual("not-a-state").caption,"Проверить");
});

test("GEARSLOTUX001: slot statuses are obtained from live gear plan, not color guesses",()=>{
 const game=read("game.js"),css=read("hero-card.css"),gearUx=read("gear-ux-004.js");
 assert.match(game,/GearPlanningCore\.plan\(progress,base\.id,entry\.id,campaignProgress\)/);
 assert.match(game,/data-gear-state/);
 assert.match(game,/slotPlans\[i\]\?\.status/);
 assert.match(gearUx,/gear-ux-state--/);
 assert.match(css,/\.gear-slot--ready/);
 assert.match(css,/\.gear-slot--missing/);
 assert.match(css,/\.gear-slot--installed/);
 assert.match(css,/max-height:360px/);
 assert.match(css,/gear-slot-state-label\{display:none\}/);
});
