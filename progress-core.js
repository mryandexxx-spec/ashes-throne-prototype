/* Progress-VS-001A: provisional account XP, currency and hero levels (1–15).
   Economy values are TEST DATA, not approved GDD balance. */
const ProgressCore=(()=>{
 "use strict";
 const MAX_LEVEL=15;
 const MAX_ACCOUNT_LEVEL=15; // vertical-slice limit only, not final account cap
 const FIRST_CLEAR_REWARDS=Object.freeze({
  "black-pass-ambush":Object.freeze({xp:80,currency:500}),
  "demo-mission-2":Object.freeze({xp:100,currency:700}),
  "demo-mission-3":Object.freeze({xp:120,currency:900})
 });
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 function createProgress(heroes){
  return {accountXp:0,currency:0,levels:Object.fromEntries(heroes.filter(h=>h.side==="ally").map(h=>[h.id,1])),claimedMissions:[]};
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
 function heroStats(progress,hero,levelOverride){
  const level=levelOverride??levelOf(progress,hero.id);
  if(level===null||level<1||level>MAX_LEVEL)return null;
  // Temporary 4% HP/ATK per level; speed stays unchanged.
  const factor=1+(level-1)*0.04;
  return {...hero,level,hp:Math.round(hero.hp*factor),atk:Math.round(hero.atk*factor)};
 }
 function claimFirstClear(progress,missionId,battle){
  const reward=FIRST_CLEAR_REWARDS[missionId];
  if(!reward||!battle||battle.active||battle.winner!=="ally"||progress.claimedMissions.includes(missionId))
   return null;
  progress.claimedMissions.push(missionId);
  progress.accountXp+=reward.xp;
  progress.currency+=reward.currency;
  return {...reward};
 }
 return Object.freeze({MAX_LEVEL,MAX_ACCOUNT_LEVEL,FIRST_CLEAR_REWARDS,createProgress,xpCost,
  accountLevel,levelOf,upgradeCost,canUpgrade,upgrade,heroStats,claimFirstClear});
})();
