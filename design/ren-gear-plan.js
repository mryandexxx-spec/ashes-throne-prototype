/* REN-002 [ПРЕДЛОЖЕНИЕ] — design-only equipment trajectory for the existing melee class.
 * No import from index.html; no mutation of GearData, pricing, hero saves or recipes.
 * G1–G3 item IDs are the ACTUAL shared pilot items already offered to melee.
 * G4–G13 numbers below are HYPOTHESES needing resource-economy tests and approval.
 * The seven materials are existing catalog keys, not newly invented resources. */
const RenGearPlan=(()=>{
 "use strict";
 const SLOTS=Object.freeze(["weapon","torso","head","hands","feet","utility"]);
 const MATERIALS=Object.freeze(["Fe","Le","Cl","Wo","Fa","Th","Gl"]);
 const PILOT=Object.freeze({
  1:Object.freeze(["g1-blade","g1-vest","g1-helm","g1-gaunt","g1-bootlight","g1-belt"]),
  2:Object.freeze(["g2-blade","g2-vest","g2-helm","g2-gaunt","g2-bootlight","g2-belt"]),
  3:Object.freeze(["g3-blade","g3-vest","g3-helm","g3-gaunt","g3-bootlight","g3-belt"])
 });
 const ALLOWED_BY_SLOT=Object.freeze({
  weapon:Object.freeze(["melee","tank"]),
  torso:Object.freeze(["melee","tank"]),
  head:Object.freeze(["melee","tank"]),
  hands:Object.freeze(["melee","ranged","tank"]),
  feet:Object.freeze(["melee","ranged","mage","support"]),
  utility:Object.freeze(["melee","ranged","mage","support","tank"])
 });
 const FAMILY=Object.freeze({
  weapon:"Клинок (общий предмет ближнего боя)",
  torso:"Походный жилет",
  head:"Защитный головной убор",
  hands:"Защитные перчатки",
  feet:"Походные сапоги",
  utility:"Походное снаряжение и пояс"
 });
 function rawRecipe(tier,slotId){
  if(!Number.isInteger(tier)||tier<4||tier>13||!SLOTS.includes(slotId))return null;
  const k=tier-3,half=Math.ceil(k/2),third=Math.floor(k/3);
  // Intentionally conservative: no special materials, random rolls or class exceptions.
  const map={
   weapon:{Fe:4+2*k,Fa:2+k,Wo:1,Th:1+third},
   torso:{Fe:3+k,Le:3+2*k,Cl:2+k,Fa:2+half},
   head:{Fe:4+k,Le:2+k,Fa:2+half},
   hands:{Fe:2+Math.floor(k/2),Le:2+k,Cl:1+k,Th:1+half,Fa:1+third},
   feet:{Le:3+2*k,Cl:2+k,Th:2+k,Fa:1+third},
   utility:{Fe:1+Math.floor(k/2),Cl:2+k,Wo:1,Fa:2+k,Th:2+half,Gl:third}
  };
  return Object.freeze(Object.fromEntries(
   Object.entries(map[slotId]).filter(([,count])=>count>0)));
 }
 function proposal(tier,slotId){
  const recipe=rawRecipe(tier,slotId);
  if(!recipe)return null;
  return Object.freeze({tier,slotId,name:FAMILY[slotId]+" G"+tier,
   status:"proposal",classId:"melee",allowedClasses:ALLOWED_BY_SLOT[slotId],recipe,
   currency:null,bonuses:null,minHeroLevel:null});
 }
 function tierPlan(tier){
  if(!Number.isInteger(tier)||tier<1||tier>13)return null;
  return Object.freeze(tier<=3?
   SLOTS.map((slotId,i)=>Object.freeze({tier,slotId,itemId:PILOT[tier][i],
    status:"current-pilot-item"})):
   SLOTS.map(slotId=>proposal(tier,slotId)));
 }
 function allTiers(){return Object.freeze(Array.from({length:13},(_,i)=>tierPlan(i+1)));}
 return Object.freeze({SLOTS,MATERIALS,PILOT,FAMILY,ALLOWED_BY_SLOT,rawRecipe,proposal,tierPlan,allTiers});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=RenGearPlan;
