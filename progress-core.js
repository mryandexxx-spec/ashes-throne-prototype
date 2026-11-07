/* Progress-VS-001A: provisional account XP, currency and hero levels (1–15).
   Economy values are TEST DATA, not approved GDD balance. */
const ProgressCore=(()=>{
 "use strict";
 const MAX_LEVEL=15;
 const MAX_ACCOUNT_LEVEL=15; // vertical-slice limit only, not final account cap
 const FIRST_CLEAR_REWARDS=Object.freeze({
  "black-pass-ambush":Object.freeze({xp:80,currency:500,material:12}),
  "demo-mission-2":Object.freeze({xp:100,currency:700,material:18}),
  "demo-mission-3":Object.freeze({xp:120,currency:900,material:24})
 });
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 // VS-001B: six physical placements at each G stage. Temporary recipes.
 const GEAR=Object.freeze({
  1:Object.freeze({heroLevel:1,material:2,currency:1000}),
  2:Object.freeze({heroLevel:6,material:3,currency:2000}),
  3:Object.freeze({heroLevel:12,material:4,currency:3000})
 });
 const freshGear=()=>({tier:1,slots:0});
 function createProgress(heroes){
  return {accountXp:0,currency:0,gearMaterials:0,levels:Object.fromEntries(heroes.filter(h=>h.side==="ally").map(h=>[h.id,1])),gear:Object.fromEntries(heroes.filter(h=>h.side==="ally").map(h=>[h.id,freshGear()])),claimedMissions:[]};
 }
 const xpCost=l=>Math.round(40+7*l+0.28*l*l);
 function accountLevel(progress){
  let xp=progress.accountXp,level=1;
  while(level<MAX_ACCOUNT_LEVEL&&xp>=xpCost(level)){xp-=xpCost(level);level++;}
  return level;
 }
 function levelOf(progress,id){return own(progress.levels,id)?progress.levels[id]:null;}
 function upgradeCost(progress,id){
  const level=levelOf(progress,id);
  return level===null||level>=MAX_LEVEL||level>=accountLevel(progress)?null:Math.round(35+3*level+0.65*level*level);
 }
 function canUpgrade(progress,id){const cost=upgradeCost(progress,id);return cost!==null&&progress.currency>=cost;}
 function upgrade(progress,id){
  if(!canUpgrade(progress,id))return false;
  const cost=upgradeCost(progress,id);
  progress.currency-=cost;progress.levels[id]++;return true;
 }
 function gearState(progress,id){return own(progress.gear||{},id)?progress.gear[id]:null;}
 function gearInstalled(progress,id){
  const state=gearState(progress,id);
  return state?(state.tier-1)*6+state.slots:0;
 }
 function gearCost(progress,id){
  const state=gearState(progress,id),level=levelOf(progress,id);
  if(!state||level===null||state.tier===3&&state.slots===6)return null;
  const recipe=GEAR[state.tier];
  // Split costs as integers across the six placements (no tier skip).
  const currency=Math.floor(recipe.currency/6)+(state.slots<recipe.currency%6?1:0);
  return {tier:state.tier,slot:state.slots+1,material:recipe.material,currency,heroLevel:recipe.heroLevel};
 }
 function gearBlockReason(progress,id){
  const cost=gearCost(progress,id);
  if(!cost)return "Все слоты G1–G3 заполнены.";
  if(levelOf(progress,id)<cost.heroLevel)return "Требуется уровень героя "+cost.heroLevel+".";
  if(progress.gearMaterials<cost.material)return "Недостаточно базовых материалов C.";
  if(progress.currency<cost.currency)return "Недостаточно валюты.";
  return "";
 }
 function canEquip(progress,id){return gearCost(progress,id)!==null&&!gearBlockReason(progress,id);}
 function equip(progress,id){
  if(!canEquip(progress,id))return false;
  const cost=gearCost(progress,id),state=gearState(progress,id);
  progress.gearMaterials-=cost.material;progress.currency-=cost.currency;
  if(state.slots===5&&state.tier<3){state.tier++;state.slots=0;}
  else state.slots++;
  return true;
 }
 function heroStats(progress,hero,levelOverride){
  const level=levelOverride??levelOf(progress,hero.id);
  if(level===null||level<1||level>MAX_LEVEL)return null;
  // Temporary 4% HP/ATK per level; speed stays unchanged.
  const factor=1+(level-1)*0.04+gearInstalled(progress,hero.id)*0.01;
  return {...hero,level,hp:Math.round(hero.hp*factor),atk:Math.round(hero.atk*factor)};
 }
 function claimFirstClear(progress,missionId,battle){
  const reward=FIRST_CLEAR_REWARDS[missionId];
  if(!reward||!battle||battle.active||battle.winner!=="ally"||progress.claimedMissions.includes(missionId))
   return null;
  progress.claimedMissions.push(missionId);
  progress.accountXp+=reward.xp;
  progress.currency+=reward.currency;
  progress.gearMaterials+=reward.material||0;
  return {...reward};
 }
 return Object.freeze({MAX_LEVEL,MAX_ACCOUNT_LEVEL,FIRST_CLEAR_REWARDS,createProgress,xpCost,
  accountLevel,levelOf,upgradeCost,canUpgrade,upgrade,heroStats,claimFirstClear,
  GEAR,freshGear,gearState,gearInstalled,gearCost,gearBlockReason,canEquip,equip});
})();
