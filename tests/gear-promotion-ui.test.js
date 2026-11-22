/* GEARVICTORY001: presentation only, no save / wallet mutation. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
class FakeNode{
 constructor(tag="div"){
  this.tagName=tag;this.children=[];this.attributes={};this.textContent="";
  this.hidden=false;this.alt="";this.className="";this.src="";
  this.classList={classes:new Set(),add:x=>this.classList.classes.add(x),remove:x=>this.classList.classes.delete(x)};
 }
 append(...children){this.children.push(...children)}
 replaceChildren(...children){this.children=[...children]}
 setAttribute(k,v){this.attributes[k]=String(v)}
 getAttribute(k){return this.attributes[k]??null}
 removeAttribute(k){delete this.attributes[k]}
 focus(){this.focused=true}
 showModal(){this.open=true}
}
function makeUI(){
 const names=["gearPromotionDialog","gearPromotionTitle","gearPromotionHeroName",
  "gearPromotionTier","gearPromotionLevel","gearPromotionHistory","gearPromotionCost",
  "gearPromotionPortrait","detailRenPortrait","gearPromotionStats","gearPromotionClose"];
 const elements=Object.fromEntries(names.map(id=>[id,new FakeNode()]));
 elements.detailRenPortrait.setAttribute("src","assets/ren-portrait-ui.webp");
 elements.detailRenPortrait.alt="Рен — портрет из игры";
 const context=vm.createContext({document:{
  getElementById:id=>elements[id]??null,
  createElement:tag=>new FakeNode(tag)
 },Intl,Number,Object});
 vm.runInContext(read("gear-promotion-ui.js")+"\n;globalThis.__GearPromotionUI=GearPromotionUI;",context);
 return {elements,ui:context.__GearPromotionUI};
}
function show(ui,changes={}){
 ui.show({heroName:"Рен Терен",from:5,to:6,currency:1250,
  before:{hp:505,atk:133,speed:150},
  after:{hp:515,atk:136,speed:150},...changes});
}
test("gear result presents true hero, rank, costs and only changed stats",()=>{
 const {ui,elements:e}=makeUI();show(ui);
 assert.equal(e.gearPromotionDialog.open,true);
 assert.equal(e.gearPromotionHeroName.textContent,"Рен Терен");
 assert.equal(e.gearPromotionTier.textContent,"G6");
 assert.equal(e.gearPromotionLevel.textContent,"G5 → G6");
 assert.match(e.gearPromotionCost.textContent,/1.?250 кромов/);
 assert.match(e.gearPromotionHistory.textContent,/G5/);
 assert.equal(e.gearPromotionPortrait.src,"assets/ren-portrait-ui.webp");
 assert.equal(e.gearPromotionStats.children.length,2,"unchanged speed must stay hidden");
 assert.equal(e.gearPromotionStats.children[0].children[2].textContent,"+10");
 assert.equal(e.gearPromotionStats.children[1].children[2].textContent,"+3");
 assert.equal(e.gearPromotionClose.focused,true);
});
test("changed speed is shown and no-change state does not invent a stat",()=>{
 const {ui,elements:e}=makeUI();
 show(ui,{after:{hp:505,atk:133,speed:153}});
 assert.equal(e.gearPromotionStats.children.length,1);
 assert.match(e.gearPromotionStats.children[0].children[1].children[0].textContent,/Скорость/);
 show(ui,{after:{hp:505,atk:133,speed:150}});
 assert.equal(e.gearPromotionStats.children.length,1);
 assert.match(e.gearPromotionStats.children[0].textContent,/без изменений/);
});
test("game routes both promotions through presentation after transactions",()=>{
 const game=read("game.js"),html=read("index.html"),css=read("gear-promotion-ui.css");
 assert.equal((game.match(/GearPromotionUI\.show\(/g)||[]).length,2);
 assert.ok(game.indexOf("persistProgress()")<game.indexOf("GearPromotionUI.show("));
 assert.match(html,/id="gearPromotionPortrait"/);
 assert.match(html,/gear-promotion-ui\.js\?v=0\.3\.233/);
 assert.match(html,/gear-promotion-ui\.css\?v=0\.3\.233/);
 assert.match(html,/v0\.3\.233 · GEARVICTORY001/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/min-height:44px/);
});
