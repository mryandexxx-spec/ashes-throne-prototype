"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const GearData=require("../gear-data.js");
const RenGearPlan=require("../design/ren-gear-plan.js");
const slots=["weapon","torso","head","hands","feet","utility"];
assert.equal(RenGearPlan.allTiers().length,13);
assert.equal(RenGearPlan.SLOTS.join(","),slots.join(","));
assert.equal(RenGearPlan.allTiers().reduce((sum,rows)=>sum+rows.length,0),78,"13 tiers with 6 slots");
for(let tier=1;tier<=13;tier++){
 const rows=RenGearPlan.tierPlan(tier);
 assert.equal(rows.length,6);
 assert.equal(rows.map(x=>x.slotId).join(","),slots.join(","),"slot order");
 for(const row of rows){
  assert.equal(row.tier,tier);
  if(tier<=3){
   assert.equal(row.status,"current-pilot-item");
   const item=GearData.get(row.itemId);
   assert.ok(item, "pilot item exists");
   assert.equal(item.tier,tier);
   assert.equal(item.slotId,row.slotId);
   assert.ok(item.allowedClasses.includes("melee"));
   assert.equal(GearData.offered("melee",row.slotId,tier).some(x=>x.id===item.id),true,"offered class item");
  }else{
   assert.equal(row.status,"proposal");
   assert.equal(row.currency,null);
   assert.equal(row.bonuses,null);
   assert.equal(row.minHeroLevel,null);
   assert.equal(row.classId,"melee");
   assert.ok(row.allowedClasses.includes("melee"),"future item is class-compatible");
   assert.equal(row.recipe.speed,undefined);
   assert.equal(Object.keys(row.recipe).every(k=>GearData.MATERIALS.includes(k)),true);
   assert.equal(Object.values(row.recipe).every(n=>Number.isSafeInteger(n)&&n>0),true);
  }
 }
}
assert.equal(RenGearPlan.tierPlan(0),null);
assert.equal(RenGearPlan.tierPlan(14),null);
assert.equal(RenGearPlan.rawRecipe(3,"weapon"),null);
assert.equal(RenGearPlan.proposal(4,"bad-slot"),null);
for(const slot of slots){
 let prev=RenGearPlan.rawRecipe(4,slot);
 for(let tier=5;tier<=13;tier++){
  const next=RenGearPlan.rawRecipe(tier,slot);
  for(const key of Object.keys(prev)) assert.ok((next[key]||0)>=prev[key],"proposal recipe monotonic for "+slot+" / "+key);
  prev=next;
 }
}
const html=read("index.html"),css=read("styles.css"),game=read("game.js"),portrait=read("assets/ren-concept-sketch.svg");
assert.match(portrait,/<svg[^>]*viewBox="0 0 320 420"/);
assert.match(portrait,/<title[^>]*>Рен Терен/);
assert.ok(portrait.includes("страховочной верёвки"));
assert.doesNotMatch(portrait,/<script|(?:href|src)="https?:\/\//i,"self-contained SVG");
assert.equal((html.match(/src="assets\/ren-concept-sketch\.svg"/g)||[]).length,2,"preview and biography");
assert.match(html,/class="ren-sketch-mini"/);
assert.match(html,/id="heroBiographyPortrait"/);
assert.match(css,/ren-biography-sketch\[hidden\]\{display:none\}/);
assert.match(game,/sketch\.hidden=hero\.id!=="trial-ren"/);
assert.ok(!read("hero-collection-core.js").includes("trial-ren"),"Ren remains outside permanent collection");
assert.ok(!read("progress-v3-core.js").includes("trial-ren"),"no v3 migration without approval");
assert.ok(!read("index.html").includes('src="design/ren-gear-plan.js"'),"future recipes must not load in live UI");
console.log("REN-002: portrait, 18 shared gear choices, 60 proposed recipes, 78-slot total, no runtime economy modifications verified");
