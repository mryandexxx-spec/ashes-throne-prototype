/* GEAREQUIPALL001: one deterministic equipment batch using existing item rules.
 * No tier promotion, extra discounts or new inventory semantics. */
const GearEquipAllCore=(()=>{
 "use strict";
 const safe=n=>Number.isSafeInteger(n)&&n>=0;
 function preview(progress,heroId){
  if(progress?.saveVersion!==3||typeof heroId!=="string"||
     typeof ProgressCore==="undefined"||typeof GearData==="undefined")return null;
  const state=ProgressCore.gearState(progress,heroId);
  if(state?.mode!=="itemized"||!Array.isArray(state.slots)||
     state.slots.length!==GearData.SLOTS.length||
     !safe(progress.currency)||!progress.materials||
     GearData.MATERIALS.some(id=>!safe(progress.materials[id])))return null;
  const budget={...progress.materials};
  let currency=progress.currency,empty=0;
  const itemIds=[];
  for(let i=0;i<GearData.SLOTS.length;i++){
   if(state.slots[i]!==null)continue;
   empty++;
   const offers=ProgressCore.itemOffer(progress,heroId,GearData.SLOTS[i].id);
   if(offers.length!==1)continue;
   const item=ProgressCore.itemCost(progress,heroId,offers[0].id);
   if(!item||currency<item.currency||
      Object.entries(item.ingredients).some(([id,n])=>!safe(n)||!safe(budget[id])||budget[id]<n))
    continue;
   currency-=item.currency;
   for(const [id,n] of Object.entries(item.ingredients))budget[id]-=n;
   itemIds.push(item.id);
  }
  return Object.freeze({
   itemIds:Object.freeze(itemIds),count:itemIds.length,empty,
   all:empty>0&&itemIds.length===empty
  });
 }
 function equip(progress,heroId){
  const plan=preview(progress,heroId);
  if(!plan||!plan.count)return null;
  const state=ProgressCore.gearState(progress,heroId);
  const snapshot={currency:progress.currency,materials:{...progress.materials},slots:state.slots.slice()};
  for(const itemId of plan.itemIds){
   if(ProgressCore.equipItem(progress,heroId,itemId))continue;
   progress.currency=snapshot.currency;
   Object.assign(progress.materials,snapshot.materials);
   state.slots=snapshot.slots;
   return null;
  }
  return Object.freeze({count:plan.count,all:plan.all});
 }
 return Object.freeze({preview,equip});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=GearEquipAllCore;
