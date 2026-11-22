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
  "gearPromotionPortrait","detailRenPortrait","gearPromotionStats","gearPromotionClose",
  "gearPromotionMedal","gearPromotionBonusesTitle","gearPromotionResourceIcon"];
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
 assert.match(html,/gear-promotion-ui\.js\?v=0\.3\.234/);
 assert.match(html,/gear-promotion-ui\.css\?v=0\.3\.234/);
 assert.match(html,/v0\.3\.234 · HEROVICTORY002/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/min-height:44px/);
});

test("star rank displays shards, real star effects and no invented speed gain",()=>{
 const {ui,elements:e}=makeUI();
 const before={hp:120,physicalAttack:23,magicAttack:12,physicalDefense:15,magicDefense:18,speed:110};
 const after={hp:123,physicalAttack:24,magicAttack:12,physicalDefense:16,magicDefense:19,speed:110};
 ui.showStar({heroName:"Нада",from:1,to:2,spent:15,before,after});
 assert.equal(e.gearPromotionTitle.textContent,"Звёздный ранг повышен");
 assert.equal(e.gearPromotionDialog.attributes["data-victory-kind"],"star");
 assert.equal(e.gearPromotionTier.textContent,"2★");
 assert.equal(e.gearPromotionLevel.textContent,"1★ → 2★");
 assert.match(e.gearPromotionCost.textContent,/15 осколков героя/);
 assert.match(e.gearPromotionHistory.textContent,/\+3%/);
 assert.equal(e.gearPromotionStats.children.length,4,"Four computed increases, not five invented effects");
 assert.ok(e.gearPromotionStats.children.every(row=>
  row.children[1].children[0].textContent!=="Скорость"));
 assert.equal(e.gearPromotionResourceIcon.className,"gear-victory-shard-art");
 assert.equal(e.gearPromotionDialog.open,true);
});
test("unlock through shards celebrates new hero, not a false stats gain",()=>{
 const {ui,elements:e}=makeUI();
 ui.showStar({heroName:"Нада",from:0,to:1,spent:10,before:null,after:{hp:85}});
 assert.equal(e.gearPromotionTitle.textContent,"Новый герой открыт");
 assert.equal(e.gearPromotionBonusesTitle.textContent,"Новый союзник");
 assert.match(e.gearPromotionStats.children[0].textContent,/доступен в коллекции/);
});
test("single or bulk level result shows actual levels and cost",()=>{
 const {ui,elements:e}=makeUI();
 const before={hp:100,physicalAttack:20,physicalDefense:11};
 const after={hp:118,physicalAttack:26,physicalDefense:14};
 ui.showLevel({heroName:"Рен Терен",from:3,to:6,currency:425,cap:8,before,after});
 assert.equal(e.gearPromotionDialog.attributes["data-victory-kind"],"level");
 assert.equal(e.gearPromotionTitle.textContent,"Уровни героя повышены");
 assert.equal(e.gearPromotionTier.textContent,"6");
 assert.equal(e.gearPromotionLevel.textContent,"Ур. 3 → 6");
 assert.match(e.gearPromotionHistory.textContent,/Повышено на 3 ур/);
 assert.match(e.gearPromotionHistory.textContent,/предел 8/);
 assert.match(e.gearPromotionCost.textContent,/425 кромов/);
 assert.equal(e.gearPromotionStats.children.length,3);
 assert.equal(e.gearPromotionClose.focused,true);
 ui.showLevel({heroName:"Рен Терен",from:6,to:7,currency:97,before,after});
 assert.equal(e.gearPromotionTitle.textContent,"Уровень героя повышен");
});
test("portrait uses contain without zoom/cropping; all versions and calls are wired",()=>{
 const html=read("index.html"),css=read("gear-promotion-ui.css"),game=read("game.js");
 assert.match(css,/#gearPromotionPortrait\{[^}]*inset:0;width:100%;height:100%;object-fit:contain/);
 assert.doesNotMatch(css,/inset:-12% -4% -12% -5%/);
 assert.match(game,/GearPromotionUI\.showStar\(/);
 assert.match(game,/GearPromotionUI\.showLevel\(/);
 assert.match(html,/id="gearPromotionResourceIcon"/);
 assert.match(html,/v0\.3\.234 · HEROVICTORY002/);
});
