/* GEAR-FINDER-003: pure read-only goals for an installed G1–G13 equipment set.
 * Runtime/save/energy mutations belong to existing ProgressCore, never this planner. */
const GearPlanningCore=(()=>{
 "use strict";
 const own=(o,k)=>!!o&&Object.prototype.hasOwnProperty.call(o,k);
 const integer=n=>Number.isSafeInteger(n)&&n>=0;
 const freeze=o=>Object.freeze(o);
 const EMPTY=freeze([]);
 function valid(progress,heroId){
  return progress?.saveVersion===3&&typeof heroId==="string"&&
   typeof ProgressCore!=="undefined"&&typeof GearData!=="undefined"&&
   typeof GearSourceData!=="undefined"&&
   own(progress.classes,heroId)&&!!ProgressCore.gearState(progress,heroId)&&
   ProgressCore.gearState(progress,heroId).mode==="itemized"&&
   integer(progress.currency)&&!!progress.materials&&
   GearData.MATERIALS.every(id=>integer(progress.materials[id]));
 }
 function sourcesFor(materialId,missing,progress,campaign){
  if(missing<1)return EMPTY;
  return freeze(GearSourceData.findSources(materialId,campaign,progress.energy?.value)
   .map(source=>freeze({...source,
    runsForDeficit:Math.ceil(missing/source.quantity),
    // Comparison only: paid-repeat budget, not a promise of a win or actual spend.
    nominalEnergyForDeficit:Math.ceil(missing/source.quantity)*source.nominalEnergyCost
   })));
 }
 function materialRow(id,need,progress,campaign){
  const have=progress.materials[id],missing=Math.max(0,need-have);
  return freeze({id,label:GearData.MATERIAL_LABELS[id],have,need,missing,
   sources:sourcesFor(id,missing,progress,campaign)});
 }
 function money(have,need){
  return freeze({have,need,missing:Math.max(0,need-have)});
 }
 function plan(progress,heroId,slotId,campaign=null){
  if(!valid(progress,heroId))return null;
  const state=ProgressCore.gearState(progress,heroId);
  const slotIndex=GearData.SLOTS.findIndex(slot=>slot.id===slotId);
  if(slotIndex<0||!Array.isArray(state.slots)||state.slots.length!==GearData.SLOTS.length)
   return null;
  const offers=ProgressCore.itemOffer(progress,heroId,slotId);
  if(offers.length!==1)return null; // No invented choice if catalog is ambiguous.
  const item=offers[0],installed=state.slots[slotIndex];
  if(installed!==null&&installed!==item.id)return null;
  const active=installed===null;
  const requirements=freeze(GearData.MATERIALS.filter(id=>item.ingredients[id]>0)
   .map(id=>materialRow(id,active?item.ingredients[id]:0,progress,campaign)));
  const currency=money(progress.currency,active?item.currency:0);
  const shortages=requirements.some(row=>row.missing>0)||currency.missing>0;
  const ready=active&&!shortages&&ProgressCore.canEquipItem(progress,heroId,item.id);
  return freeze({heroId,slotId,slotIndex,tier:state.tier,
   itemId:item.id,itemName:item.name,
   status:active?(ready?"ready":"missing"):"installed",
   canCraft:ready,currency,materials:requirements,
   bonuses:item.bonuses,statBonuses:item.statBonuses});
 }
 function planTier(progress,heroId,campaign=null){
  if(!valid(progress,heroId))return null;
  const state=ProgressCore.gearState(progress,heroId);
  if(!Array.isArray(state.slots)||state.slots.length!==GearData.SLOTS.length)return null;
  const slots=[],total=Object.fromEntries(GearData.MATERIALS.map(id=>[id,0]));
  let cost=0,installed=0;
  for(const slot of GearData.SLOTS){
   const p=plan(progress,heroId,slot.id,campaign);
   if(!p)return null;
   slots.push(p);
   if(p.status==="installed"){installed++;continue;}
   const item=GearData.get(p.itemId);
   cost+=item.currency;
   for(const [id,n] of Object.entries(item.ingredients))total[id]+=n;
  }
  const materials=freeze(GearData.MATERIALS.filter(id=>total[id]>0)
   .map(id=>materialRow(id,total[id],progress,campaign)));
  const currency=money(progress.currency,cost);
  const complete=installed===GearData.SLOTS.length;
  return freeze({heroId,tier:state.tier,installed,totalSlots:GearData.SLOTS.length,
   slots:freeze(slots),status:complete?"complete":
    currency.missing||materials.some(row=>row.missing)?"missing":"ready",
   currency,materials,
   // Promotion is a separate purchase, never silently included in G kit cost.
   promotion:complete?ProgressCore.gearPromotionCost(progress,heroId):null});
 }
 function findSources(materialId,progress,campaign=null){
  if(!progress||progress.saveVersion!==3)return EMPTY;
  return GearSourceData.findSources(materialId,campaign,progress.energy?.value);
 }
 return freeze({plan,planTier,findSources});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=GearPlanningCore;
