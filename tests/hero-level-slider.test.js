"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const core=vm.runInNewContext(read("progress-core.js")+"\nProgressCore");
const html=read("index.html"),game=read("game.js"),css=read("hero-card.css");
const roster=[{id:"ren",side:"ally",hp:91,atk:27,speed:150}];

test("HEROLEVELSLIDER001 has one accessible slider and exact-level purchase action",()=>{
 assert.match(html,/<input[^>]+type="range"[^>]+id="heroLevelSlider"[^>]+aria-label="Выбрать целевой уровень героя"/);
 assert.match(html,/id="heroLevelTarget"[^>]*aria-live="polite"/);
 assert.match(html,/id="heroLevelCost"[^>]*aria-live="polite"/);
 assert.match(html,/id="detailUpgrade"/);
 assert.doesNotMatch(html,/id="detailUpgradeFive"|id="detailUpgradeMax"/);
 assert.match(game,/heroLevelSlider"\)\?\.addEventListener\("input"/);
 assert.match(game,/if\(!plan\|\|plan\.levels!==count\|\|plan\.to!==selectedLevelTarget\)return/);
 assert.match(game,/applyHeroLevels\(count\)/);
 assert.match(css,/#heroDetail #heroLevelSlider:disabled/);
 assert.match(css,/webkit-slider-thumb/);
 assert.match(css,/touch-action:pan-x/);
});

test("HEROLEVELSLIDER001 costs exactly chosen levels, never spends beyond wallet or cap",()=>{
 const p=core.createProgress(roster);
 p.accountXp=core.xpThresholdForLevel(85);p.currency=500000;
 const target=11,preview=core.upgradePlan(p,"ren",target-p.levels.ren);
 assert.equal(preview.from,1);
 assert.equal(preview.to,target);
 const wallet=p.currency;
 const result=core.upgradeMany(p,"ren",target-p.levels.ren);
 assert.equal(result.to,target);
 assert.equal(result.cost,preview.cost);
 assert.equal(p.currency,wallet-preview.cost);
 assert.equal(p.levels.ren,target);
 const nextPrice=core.upgradeCost(p,"ren");
 p.currency=nextPrice-1;
 const noFunds=core.upgradePlan(p,"ren",85);
 assert.equal(noFunds.to,target);
 assert.equal(noFunds.levels,0);
 assert.equal(core.upgradeMany(p,"ren",1),null);
 assert.equal(p.levels.ren,target);
 p.currency=500000;
 p.accountXp=0;
 assert.equal(core.upgradePlan(p,"ren",85).to,target);
 assert.equal(core.upgradeMany(p,"ren",85),null);
});
