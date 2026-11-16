/* NPCUX004 — read-only tactical cues for the existing NPC encounters.
 * Never reveal OPS-002's signal bearer without SignalOperationCore.intel().
 * No combat modifications, invented lore, 3D meshes or timers.
 */
const NpcBattleIntel=(()=>{
 "use strict";
 const roles=Object.freeze({
  tank:"Защитник",melee:"Ближний бой",ranged:"Стрелок",support:"Поддержка"
 });
 const statLabels=Object.freeze({
  physicalDefense:"физическая защита",evasion:"уклонение",
  accuracy:"точность",debuffResistance:"сопротивление эффектам",
  protection:"защита",debuffPotency:"эффективность эффектов"
 });
 const isNpc=f=>!!f&&f.side==="enemy"&&typeof f.archetypeId==="string"&&
  f.archetypeId.startsWith("npc-")&&!!f.npcAbilities;
 function role(f){
  if(!isNpc(f))return null;
  if(f.combatRole==="healer")return "Лекарь";
  return roles[f.classId]||"Противник";
 }
 // "knownSignalId" MUST be obtained from SignalOperationCore.intel(run),
 // never directly from run.signalId (which is secret before the survey).
 function marker(f,battle,knownSignalId=null){
  if(!isNpc(f)||!(f.hp>0))return null;
  const goal=battle?.tacticalObjective;
  if(goal?.kind==="priority-first"&&battle.priorityCleared!==true&&
   f.id===goal.priorityEnemyId)return "first";
  if(["ves","shade"].includes(knownSignalId)&&
   f.id==="npc-ops002-"+knownSignalId)return "signal";
  if(f.assaultFocus===true&&["hold-or-defeat","protect-and-defeat"].includes(goal?.kind))
   return "hunter";
  return null;
 }
 const markerLabel=kind=>({
  first:"ПЕРВАЯ ЦЕЛЬ",signal:"СВЯЗНОЙ",hunter:"ПРЕСЛЕДОВАТЕЛЬ"
 })[kind]||null;
 function summarizeAbility(a){
  if(!a||typeof a!=="object")return "";
  const notes=[];
  if(a.kind==="damage"){
   notes.push("урон "+Math.round((a.multiplier||1)*100)+"% атаки");
   if(a.weakening>0)notes.push("ослабление на "+a.weakening+" атаки");
  }else if(a.kind==="heal"){
   notes.push("лечение до "+a.healAmount+" HP");
  }else if(a.kind==="guard"){
   notes.push("защита от "+a.guardHits+" ударов");
   if(a.tauntTurns>0)notes.push("провокация на "+a.tauntTurns+" хода");
  }
  return notes.join(", ");
 }
 function abilities(f){
  if(!isNpc(f))return [];
  const entries=[["basic","Базовая"],["special","Особая"],["powerful","Мощная"]];
  const out=entries.map(([key,label])=>{
   const a=f.npcAbilities[key];
   if(!a||typeof a.name!=="string")return null;
   let line=label+": «"+a.name+"»";
   const details=summarizeAbility(a);
   if(details)line+=" — "+details;
   if(a.cooldown>0){
    line+="; перезарядка "+a.cooldown;
    const left=f[key+"Cooldown"];
    if(Number.isSafeInteger(left)&&left>0)line+=" (осталось "+left+")";
   }
   return line+".";
  }).filter(Boolean);
  const passive=f.npcAbilities.passive;
  if(passive?.name){
   const stat=statLabels[passive.stat]||passive.stat;
   const bonus=Number.isFinite(passive.amount)?" — "+stat+" +"+passive.amount:"";
   out.push("Пассивная: «"+passive.name+"»"+bonus+".");
  }
  return out;
 }
 return Object.freeze({isNpc,role,marker,markerLabel,abilities});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NpcBattleIntel;
