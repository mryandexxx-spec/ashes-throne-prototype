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
 // Gear-002: six independent items within each sequential G tier. Recipes/buffs
 // are temporary vertical-slice data, NOT final balance or canonical item names.
 const SLOT_COUNT=6;
 const SLOT_NAMES=Object.freeze(["Щиток","Клинок","Пластина","Перчатка","Пояс","Амулет"]);
 const gearItem=(tier,slot)=>{
  if(!GEAR[tier]||!Number.isInteger(slot)||slot<0||slot>=SLOT_COUNT)return null;
  const recipe=GEAR[tier];
  // Preserve total tier cost (G1 1000; G2 2000; G3 3000), but offer
  // individual items; each gives a different prototype stat contribution.
  const currency=Math.floor(recipe.currency/6)+(slot<recipe.currency%6?1:0);
  const hpBonus=slot%2===0?0.02:0,atkBonus=slot%2!==0?0.02:0;
  return {tier,slot,material:recipe.material,currency,heroLevel:recipe.heroLevel,
   name:SLOT_NAMES[slot],hpBonus,atkBonus};
 };
 // Gear-002B: promotion is a distinct paid step after the sixth item.
 // These fees and stats are PROTOTYPE balance, not approved GDD values.
 const GEAR_PROMOTION_CURRENCY=Object.freeze({1:250,2:500});
 const GEAR_PROMOTION_STAT_BONUS=0.03;
 const freshGear=()=>({tier:1,slots:Array(SLOT_COUNT).fill(false)});
 const installedInTier=state=>state.slots.filter(Boolean).length;
 // VS-001C UX revision: mission entry costs energy regardless of manual/simulation mode.
 // All numbers are provisional; simulation becomes available after 3★ only.
 const ENERGY_MAX=240,ENERGY_REGEN_MS=6*60*1000;
 const MISSION_FARM=Object.freeze({
  "black-pass-ambush":Object.freeze({cost:10,material:12,currency:0,xp:5}),
  "demo-mission-2":Object.freeze({cost:12,material:0,currency:200,xp:5}),
  "demo-mission-3":Object.freeze({cost:16,material:24,currency:0,xp:5})
 });
 // DEV-RES-001: temporary repeatable test tool, NOT normal economy or reward.
 // Replenishes to useful minimum balances without uncontrolled accumulation.
 const TEST_RESOURCE_FLOOR=Object.freeze({currency:5000,material:100});
 function grantTestResources(progress,now=Date.now()){
  if(!progress||!progress.energy||!Number.isSafeInteger(now)||now<0||
     !Number.isSafeInteger(progress.currency)||progress.currency<0||
     !Number.isSafeInteger(progress.gearMaterials)||progress.gearMaterials<0)return null;
  const currency=Math.max(0,TEST_RESOURCE_FLOOR.currency-progress.currency);
  const material=Math.max(0,TEST_RESOURCE_FLOOR.material-progress.gearMaterials);
  const energy=ENERGY_MAX-progress.energy.value;
  progress.currency+=currency;
  progress.gearMaterials+=material;
  progress.energy.value=ENERGY_MAX;
  progress.energy.updatedAt=now;
  const materials={};
  if(progress.saveVersion===3&&typeof GearData!=="undefined"&&progress.materials){
   for(const id of GearData.MATERIALS){
    if(!Number.isSafeInteger(progress.materials[id])||progress.materials[id]<0)return null;
    materials[id]=Math.max(0,GearData.FLOOR[id]-progress.materials[id]);
    progress.materials[id]+=materials[id];
   }
  }
  return {currency,material,energy,materials};
 }
 const freshEnergy=(now=Date.now())=>({value:ENERGY_MAX,updatedAt:now});
 function refreshEnergy(progress,now=Date.now()){
  if(!Number.isSafeInteger(now)||now<0||!progress.energy)return 0;
  const e=progress.energy;
  if(now<=e.updatedAt)return 0;
  const elapsed=now-e.updatedAt;
  const ticks=Math.floor(elapsed/ENERGY_REGEN_MS);
  if(ticks<=0)return 0;
  const restored=Math.min(ENERGY_MAX-e.value,ticks);
  e.value+=restored;
  e.updatedAt=e.value===ENERGY_MAX?now:e.updatedAt+ticks*ENERGY_REGEN_MS;
  return restored;
 }
 function missionEnergyCost(id){return MISSION_FARM[id]?.cost??null;}
 function affordableRuns(progress,id,now=Date.now()){
  refreshEnergy(progress,now);
  const cost=missionEnergyCost(id);
  return cost?Math.floor(progress.energy.value/cost):0;
 }
 function spendEnergy(progress,id,count=1,now=Date.now()){
  refreshEnergy(progress,now);
  const cost=missionEnergyCost(id);
  if(!cost||!Number.isSafeInteger(count)||count<1||count>Math.floor(progress.energy.value/cost))return false;
  const wasFull=progress.energy.value===ENERGY_MAX;
  progress.energy.value-=cost*count;
  if(wasFull)progress.energy.updatedAt=now;
  return true;
 }
 function refundEnergy(progress,id,now=Date.now()){
  const cost=missionEnergyCost(id);
  if(!cost)return false;
  refreshEnergy(progress,now);
  progress.energy.value=Math.min(ENERGY_MAX,progress.energy.value+cost);
  if(progress.energy.value===ENERGY_MAX)progress.energy.updatedAt=now;
  return true;
 }
 function simulate(progress,id,bestStars,count,now=Date.now()){
  const reward=MISSION_FARM[id];
  if(!reward||bestStars!==3||!spendEnergy(progress,id,count,now))return null;
  const result={count,energy:count*reward.cost,material:count*reward.material,
   currency:count*reward.currency,xp:count*reward.xp};
  progress.gearMaterials+=result.material;
  progress.currency+=result.currency;
  progress.accountXp+=result.xp;
  return result;
 }
 function createProgress(heroes){
  return {accountXp:0,currency:0,gearMaterials:0,energy:freshEnergy(),levels:Object.fromEntries(heroes.filter(h=>h.side==="ally").map(h=>[h.id,1])),gear:Object.fromEntries(heroes.filter(h=>h.side==="ally").map(h=>[h.id,freshGear()])),claimedMissions:[]};
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
  // Vertical-slice test: account level is informational, not a hero upgrade gate.
  return level===null||level>=MAX_LEVEL?null:Math.round(35+3*level+0.65*level*level);
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
  return state?(state.tier-1)*SLOT_COUNT+installedInTier(state):0;
 }
 function gearCost(progress,id,slot){
  const state=gearState(progress,id),level=levelOf(progress,id);
  if(!state||state.mode==="itemized"||level===null||!Number.isInteger(slot)||slot<0||slot>=SLOT_COUNT||state.slots[slot])return null;
  return gearItem(state.tier,slot);
 }
 function gearBlockReason(progress,id,slot){
  const state=gearState(progress,id);
  if(!state)return "Герой не найден.";
  if(!Number.isInteger(slot)||slot<0||slot>=SLOT_COUNT)return "Выбери слот экипировки.";
  if(state.slots[slot])return "Предмет уже установлен.";
  const cost=gearCost(progress,id,slot);
  if(!cost)return "Все слоты G1–G3 заполнены.";
  if(progress.gearMaterials<cost.material)return "Недостаточно базовых материалов C.";
  if(progress.currency<cost.currency)return "Недостаточно валюты.";
  return "";
 }
 function canEquip(progress,id,slot){
  return gearCost(progress,id,slot)!==null&&!gearBlockReason(progress,id,slot);
 }
 function equip(progress,id,slot){
  if(!canEquip(progress,id,slot))return false;
  const cost=gearCost(progress,id,slot),state=gearState(progress,id);
  progress.gearMaterials-=cost.material;progress.currency-=cost.currency;
  state.slots[slot]=true;
  // Never auto-promote; six filled slots unlock an explicit paid action.
  return true;
 }
 function gearPromotionCost(progress,id){
  const state=gearState(progress,id);
  if(!state||state.mode==="itemized"||state.tier>=3||installedInTier(state)!==SLOT_COUNT)return null;
  return {from:state.tier,to:state.tier+1,currency:GEAR_PROMOTION_CURRENCY[state.tier],
   heroLevel:GEAR[state.tier+1].heroLevel};
 }
 function gearPromotionBlockReason(progress,id){
  const cost=gearPromotionCost(progress,id);
  if(!cost)return "Сначала установи все шесть предметов текущей G-ступени.";
  if(progress.currency<cost.currency)return "Недостаточно игровой валюты.";
  return "";
 }
 function canPromoteGear(progress,id){
  return gearPromotionCost(progress,id)!==null&&!gearPromotionBlockReason(progress,id);
 }
 function promoteGear(progress,id){
  if(!canPromoteGear(progress,id))return null;
  const cost=gearPromotionCost(progress,id),state=gearState(progress,id);
  progress.currency-=cost.currency;
  state.tier=cost.to;
  state.slots=Array(SLOT_COUNT).fill(false);
  return {...cost};
 }
 // Gear-003A2: G1 only. Each purchase produces one permanent installed item.
 function itemOffer(progress,id,slotId){
  const state=gearState(progress,id);
  if(progress.saveVersion!==3||state?.mode!=="itemized"||state.tier!==1||
     !progress.classes||!Object.prototype.hasOwnProperty.call(progress.classes,id)||
     typeof GearData==="undefined")return [];
  return GearData.offered(progress.classes[id],slotId);
 }
 function itemCost(progress,id,itemId){
  const state=gearState(progress,id);
  const item=typeof GearData!=="undefined"?GearData.get(itemId):null;
  if(!item||!state||state.mode!=="itemized"||state.tier!==1||
     !itemOffer(progress,id,item.slotId).some(x=>x.id===item.id))return null;
  const slotIndex=GearData.SLOTS.findIndex(x=>x.id===item.slotId);
  if(state.slots[slotIndex]!==null)return null;
  return item;
 }
 function itemBlockReason(progress,id,itemId){
  const item=itemCost(progress,id,itemId);
  if(!item)return "Предмет недоступен для выбранного героя или слот уже занят.";
  if(progress.currency<item.currency)return "Недостаточно игровой валюты.";
  const missing=GearData.missing(item,progress.materials);
  if(!missing||Object.keys(missing).length)return "Недостаточно компонентов: "+
   Object.entries(missing||{}).map(([name,n])=>name+" ×"+n).join(", ")+".";
  return "";
 }
 function canEquipItem(progress,id,itemId){
  return itemCost(progress,id,itemId)!==null&&!itemBlockReason(progress,id,itemId);
 }
 function equipItem(progress,id,itemId){
  if(!canEquipItem(progress,id,itemId))return false;
  const item=itemCost(progress,id,itemId);
  for(const [name,count] of Object.entries(item.ingredients))progress.materials[name]-=count;
  progress.currency-=item.currency;
  progress.gear[id].slots[GearData.SLOTS.findIndex(x=>x.id===item.slotId)]=item.id;
  return true;
 }
 function gearBonuses(progress,id){
  const state=gearState(progress,id);
  if(!state)return {hp:0,atk:0};
  if(state.mode==="itemized"){
   let hp=0,atk=0;
   for(const itemId of state.slots){
    if(!itemId)continue;
    const item=typeof GearData!=="undefined"?GearData.get(itemId):null;
    if(!item)continue;
    hp+=item.bonuses.hp;atk+=item.bonuses.atk;
   }
   return {hp,atk};
  }
  let hp=0,atk=0;
  for(let tier=1;tier<=state.tier;tier++){
   for(let slot=0;slot<SLOT_COUNT;slot++){
    if(tier===state.tier&&!state.slots[slot])continue;
    const item=gearItem(tier,slot);
    hp+=item.hpBonus;atk+=item.atkBonus;
   }
  }
  // Tier transitions grant a small permanent bonus separately from item pieces.
  hp+=(state.tier-1)*GEAR_PROMOTION_STAT_BONUS;
  atk+=(state.tier-1)*GEAR_PROMOTION_STAT_BONUS;
  return {hp,atk};
 }
 function heroStats(progress,hero,levelOverride){
  const level=levelOverride??levelOf(progress,hero.id);
  if(level===null||level<1||level>MAX_LEVEL)return null;
  // Gear-002: individual bonuses by slot; neither levels nor gear modify speed.
  const bonus=gearBonuses(progress,hero.id),baseFactor=1+(level-1)*0.04;
  return {...hero,level,hp:Math.round(hero.hp*(baseFactor+bonus.hp)),
   atk:Math.round(hero.atk*(baseFactor+bonus.atk))};
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
  GEAR,SLOT_COUNT,SLOT_NAMES,gearItem,freshGear,gearState,gearInstalled,gearCost,gearBlockReason,canEquip,equip,
  itemOffer,itemCost,itemBlockReason,canEquipItem,equipItem,gearBonuses,
  GEAR_PROMOTION_CURRENCY,GEAR_PROMOTION_STAT_BONUS,gearPromotionCost,gearPromotionBlockReason,canPromoteGear,promoteGear,
  ENERGY_MAX,ENERGY_REGEN_MS,MISSION_FARM,TEST_RESOURCE_FLOOR,grantTestResources,freshEnergy,refreshEnergy,
  missionEnergyCost,affordableRuns,spendEnergy,refundEnergy,simulate});
})();
