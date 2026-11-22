"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const {GearData,ProgressCore}=vm.runInNewContext(
 read("gear-data.js")+"\n"+read("progress-core.js")+"\n({GearData,ProgressCore})");
function hero(){
 return {saveVersion:3,currency:100000,classes:{nada:"support"},
  gear:{nada:{mode:"itemized",tier:1,slots:Array(6).fill(null),history:{}}},
  materials:Object.fromEntries(GearData.MATERIALS.map(id=>[id,100000]))};
}
test("GEARPROMOCTA001: full six-slot tier has an existing paid promotion transaction",()=>{
 const p=hero(),gear=p.gear.nada;
 assert.equal(ProgressCore.gearPromotionCost(p,"nada"),null);
 for(const slot of GearData.SLOTS){
  const item=ProgressCore.itemOffer(p,"nada",slot.id)[0];
  assert.ok(item);
  assert.equal(ProgressCore.equipItem(p,"nada",item.id),true);
 }
 assert.equal(gear.slots.filter(Boolean).length,6);
 const cost=ProgressCore.gearPromotionCost(p,"nada");
 assert.equal(cost.from,1);
 assert.equal(cost.to,2);
 assert.equal(ProgressCore.canPromoteGear(p,"nada"),true);
 const before=p.currency;
 assert.equal(ProgressCore.promoteGear(p,"nada").to,2);
 assert.equal(p.currency,before-cost.currency);
 assert.equal(gear.tier,2);
 assert.equal(gear.slots.filter(Boolean).length,0);
 assert.equal(gear.history["1"].filter(Boolean).length,6);
 assert.equal(ProgressCore.gearPromotionCost(p,"nada"),null,"G2 cannot promote without a new set");
 assert.equal(ProgressCore.promoteGear(p,"nada"),null,"repeat click cannot charge twice");
});

test("GEARPROMOCTA001: insufficient currency blocks promotion without mutation",()=>{
 const p=hero();
 for(const slot of GearData.SLOTS){
  const item=ProgressCore.itemOffer(p,"nada",slot.id)[0];
  assert.equal(ProgressCore.equipItem(p,"nada",item.id),true);
 }
 p.currency=0;
 const before=JSON.stringify(p);
 assert.ok(ProgressCore.gearPromotionCost(p,"nada"));
 assert.equal(ProgressCore.canPromoteGear(p,"nada"),false);
 assert.match(ProgressCore.gearPromotionBlockReason(p,"nada"),/Недостаточно/);
 assert.equal(ProgressCore.promoteGear(p,"nada"),null);
 assert.equal(JSON.stringify(p),before);
 p.gear.nada.tier=GearData.MAX_TIER;
 assert.equal(ProgressCore.gearPromotionCost(p,"nada"),null,"max tier has no next step");
});

test("GEARPROMOCTA001: visible primary action switches from batch to next G",()=>{
 const html=read("index.html"),game=read("game.js"),css=read("hero-card.css");
 assert.match(html,/id="gearEquipAll"/);
 assert.match(game,/batchButton\.classList\.toggle\("gear-equip-promote",ready&&!!promotion\)/);
 assert.match(game,/batchButton\.textContent=promotion\?"Повысить до G"/);
 assert.match(game,/if\(state\?\.mode==="itemized"&&state\.slots\.every\(Boolean\)\)/);
 assert.match(game,/#gearEquipNext"\)\?\.click\(\)/);
 assert.match(css,/#gearEquipAll\.gear-equip-promote/);
 const version=JSON.parse(read("package.json")).version;
 assert.match(version,/^0\.\d+\.\d+$/);
 assert.ok(html.includes('id="buildVersion">Прототип · v'+version+' · '),"build version must track package.json");
});
