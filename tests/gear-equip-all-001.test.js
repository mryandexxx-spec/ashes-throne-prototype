"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const {GearData,ProgressCore,GearEquipAllCore}=vm.runInNewContext(
 ["gear-data.js","progress-core.js","gear-equip-all-core.js"].map(read).join("\n")+
 "\n({GearData,ProgressCore,GearEquipAllCore})");
const copy=x=>JSON.parse(JSON.stringify(x));
function fresh(){
 return {saveVersion:3,classes:{ren:"melee"},gear:{ren:{mode:"itemized",tier:1,
  slots:Array(GearData.SLOTS.length).fill(null),history:{}}},
  materials:Object.fromEntries(GearData.MATERIALS.map(id=>[id,0])),currency:0};
}
function fullWallet(p){
 const items=GearData.SLOTS.map(slot=>ProgressCore.itemOffer(p,"ren",slot.id)[0]);
 assert.equal(items.length,6);
 for(const item of items){
  assert.ok(item);
  p.currency+=item.currency;
  for(const [id,n] of Object.entries(item.ingredients))p.materials[id]+=n;
 }
 return items;
}
test("GEAREQUIPALL001: empty inventory, invalid saves and completed tier never spend",()=>{
 const p=fresh(),before=JSON.stringify(p);
 const plan=GearEquipAllCore.preview(p,"ren");
 assert.equal(plan.count,0);
 assert.equal(plan.empty,6);
 assert.equal(plan.all,false);
 assert.equal(GearEquipAllCore.equip(p,"ren"),null);
 assert.equal(JSON.stringify(p),before);
 assert.equal(GearEquipAllCore.preview({...p,saveVersion:2},"ren"),null);
 assert.equal(GearEquipAllCore.preview(p,"unknown"),null);
 const legacy=fresh();legacy.gear.ren.mode="legacy";
 assert.equal(GearEquipAllCore.preview(legacy,"ren"),null);
});

test("GEAREQUIPALL001: all remaining items equipped once at exact old recipe costs",()=>{
 const p=fresh(),items=fullWallet(p),start=copy(p);
 const preview=GearEquipAllCore.preview(p,"ren");
 assert.equal(preview.count,6);
 assert.equal(preview.empty,6);
 assert.equal(preview.all,true);
 assert.equal(JSON.stringify(p),JSON.stringify(start),"planning is read only");
 assert.equal(Object.isFrozen(preview),true);
 const result=GearEquipAllCore.equip(p,"ren");
 assert.equal(result.count,6);
 assert.equal(result.all,true);
 assert.equal(p.gear.ren.tier,1,"batch does not promote");
 assert.deepEqual(copy(p.gear.ren.slots),items.map(x=>x.id));
 assert.equal(p.currency,0);
 for(const id of GearData.MATERIALS)assert.equal(p.materials[id],0);
 assert.equal(GearEquipAllCore.equip(p,"ren"),null,"repeat never spends a second time");
 assert.equal(GearEquipAllCore.preview(p,"ren").empty,0);
 assert.equal(p.currency,0);
});

test("GEAREQUIPALL001: only affordable items are installed, no wallet overdraw",()=>{
 const p=fresh(),weapon=ProgressCore.itemOffer(p,"ren","weapon")[0];
 p.currency=weapon.currency;
 for(const [id,n] of Object.entries(weapon.ingredients))p.materials[id]=n;
 const plan=GearEquipAllCore.preview(p,"ren");
 assert.equal(plan.count,1);
 assert.equal(plan.all,false);
 assert.equal(plan.itemIds[0],weapon.id);
 const result=GearEquipAllCore.equip(p,"ren");
 assert.equal(result.count,1);
 assert.equal(p.gear.ren.slots[0],weapon.id);
 assert.ok(p.gear.ren.slots.slice(1).every(x=>x===null));
 assert.equal(p.currency,0);
 for(const id of GearData.MATERIALS)assert.ok(p.materials[id]>=0);
 assert.equal(GearEquipAllCore.equip(p,"ren"),null);
});

test("GEAREQUIPALL001: shared components are reserved across slots and installed slots skipped",()=>{
 const p=fresh();const items=fullWallet(p);
 assert.equal(ProgressCore.equipItem(p,"ren",items[0].id),true);
 const installed=p.gear.ren.slots[0];
 let plan=GearEquipAllCore.preview(p,"ren");
 assert.equal(plan.empty,5);
 assert.equal(plan.count,5);
 assert.equal(plan.itemIds.includes(installed),false);
 // A full wallet is now reduced to exactly one item's ingredients.
 p.currency=items[1].currency;
 for(const id of GearData.MATERIALS)p.materials[id]=items[1].ingredients[id]||0;
 plan=GearEquipAllCore.preview(p,"ren");
 assert.equal(plan.empty,5);
 assert.equal(plan.count,1);
 assert.equal(plan.itemIds[0],items[1].id);
 const outcome=GearEquipAllCore.equip(p,"ren");
 assert.equal(outcome.count,1);
 assert.equal(p.gear.ren.slots[0],installed);
 assert.equal(p.gear.ren.slots[1],items[1].id);
});

test("GEAREQUIPALL001: unexpected failure in the middle restores all resource and slot changes",()=>{
 const p=fresh();fullWallet(p);
 let count=0;
 const failing={...ProgressCore,equipItem(progress,heroId,itemId){
  count++;return count===2?false:ProgressCore.equipItem(progress,heroId,itemId);
 }};
 const failingBatch=vm.runInNewContext(read("gear-equip-all-core.js")+"\nGearEquipAllCore",
  {GearData,ProgressCore:failing});
 const snapshot=JSON.stringify(p);
 assert.equal(failingBatch.equip(p,"ren"),null);
 assert.equal(JSON.stringify(p),snapshot);
});

test("GEAREQUIPALL001: batch button uses the existing wallet-safe save and daily task path",()=>{
 const html=read("index.html"),game=read("game.js"),css=read("hero-card.css");
 assert.match(html,/id="gearEquipAll"/);
 assert.match(html,/gear-equip-all-core\.js\?v=/);
 assert.match(game,/GearEquipAllCore\.preview\(progress,base\.id\)/);
 assert.match(game,/GearEquipAllCore\.equip\(progress,base\.id\)/);
 assert.match(game,/recordDailyTask\("equip-item"\)/);
 assert.match(game,/if\(!saved\)\{[\s\S]*?Object\.assign\(progress,JSON\.parse\(before\)\)/);
 assert.match(css,/hero-card-gear-actions/);
 assert.match(css,/min-height:44px/);
});
