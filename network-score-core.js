/* NET-006A: opt-in network encounter score S1, never a wallet/reward source.
 * Uses durable observations collected by CombatCore only on network battles.
 * Pace budgets in NET-003 fixtures are provisional until encounter balancing.
 */
const NetworkScoreCore=(()=>{
 "use strict";
 const VERSION=1,MAX_ACTIONS=10000;
 const id=x=>typeof x==="string"&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(x);
 const int=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
 const unique=a=>new Set(a).size===a.length;
 const keys=(x,expected)=>!!x&&typeof x==="object"&&!Array.isArray(x)&&
  Object.keys(x).length===expected.length&&Object.keys(x).every(k=>expected.includes(k));
 const METRIC_KEYS=["version","allyIds","enemyIds","knockedOutIds","enemyDeaths",
  "objectiveEnemyId","paceBudget"];
 const SUMMARY_KEYS=["version","wave","deployed","knockedOut","allyActions",
  "paceBudget","objectiveEnemyId","objectiveDone","score"];
 function pace(actions,budget){
  return Math.max(0,5-Math.max(0,actions-budget));
 }
 function points({deployed,knockedOut,allyActions,paceBudget,objectiveDone}){
  return Math.round(60+25*(1-knockedOut/deployed)+
   (objectiveDone?10:0)+pace(allyActions,paceBudget));
 }
 function validSummary(s){
  return keys(s,SUMMARY_KEYS)&&s.version===VERSION&&int(s.wave)&&
   int(s.deployed,1)&&s.deployed<=5&&int(s.knockedOut)&&
   s.knockedOut<=s.deployed&&int(s.allyActions,1)&&
   s.allyActions<=MAX_ACTIONS&&int(s.paceBudget,1)&&s.paceBudget<=100&&
   id(s.objectiveEnemyId)&&typeof s.objectiveDone==="boolean"&&
   int(s.score,60)&&s.score<=100&&s.score===points(s);
 }
 function finalScore(summaries){
  if(!Array.isArray(summaries)||!summaries.length||
   !summaries.every((s,i)=>validSummary(s)&&s.wave===i))return null;
  return Math.round(summaries.reduce((sum,s)=>sum+s.score,0)/summaries.length);
 }
 function stars(score){
  return !int(score,60)||score>100?0:score>=90?3:score>=75?2:1;
 }
 // Start a fresh log for every INDEPENDENT encounter. Does not affect allies,
 // RNG, initiative, damage, victory rules or the separate wave's checkpoint.
 function attach(battle,plan){
  if(!battle?.active||!Array.isArray(battle.fighters)||
   !Array.isArray(plan?.first)||!plan.first.length||
   !Number.isSafeInteger(plan?.binding?.wave)||battle.networkScoreMetrics)return false;
  const allyIds=battle.fighters.filter(f=>f.side==="ally").map(f=>f.id);
  const enemyIds=battle.fighters.filter(f=>f.side==="enemy").map(f=>f.id);
  if(!allyIds.length||allyIds.length>5||!enemyIds.length||
   ![...allyIds,...enemyIds].every(id)||!unique([...allyIds,...enemyIds])||
   enemyIds.length!==plan.first.length)return false;
  battle.networkScoreMetrics={
   version:VERSION,allyIds,enemyIds,knockedOutIds:[],enemyDeaths:[],
   objectiveEnemyId:enemyIds[0],
   // TEST-ONLY encounter budgets; no dependence on animation/time/auto speed.
   paceBudget:Math.max(5,enemyIds.length*5)
  };
  return true;
 }
 // CombatCore calls this ONLY on death events. Events from earlier turns can
 // disappear from battle.events; the unique persistent ids cannot.
 function observe(battle,type,targetId){
  if(type!=="death")return;
  const m=battle?.networkScoreMetrics;
  if(!m||!Array.isArray(m.allyIds)||!Array.isArray(m.enemyIds)||
   !Array.isArray(m.knockedOutIds)||!Array.isArray(m.enemyDeaths))return;
  if(m.allyIds.includes(targetId)&&!m.knockedOutIds.includes(targetId))
   m.knockedOutIds.push(targetId);
  if(m.enemyIds.includes(targetId)&&!m.enemyDeaths.includes(targetId))
   m.enemyDeaths.push(targetId);
 }
 function summarize(battle,wave){
  const m=battle?.networkScoreMetrics;
  if(!keys(m,METRIC_KEYS)||m.version!==VERSION||
   !int(wave)||battle.active!==false||battle.winner!=="ally"||
   !Array.isArray(battle.fighters)||!int(battle.allyActions,1)||
   battle.allyActions>MAX_ACTIONS||
   !int(m.paceBudget,1)||m.paceBudget>100||
   ![m.allyIds,m.enemyIds,m.knockedOutIds,m.enemyDeaths].every(Array.isArray)||
   !m.allyIds.length||m.allyIds.length>5||!m.enemyIds.length||
   ![...m.allyIds,...m.enemyIds].every(id)||
   !unique([...m.allyIds,...m.enemyIds])||
   !unique(m.knockedOutIds)||!unique(m.enemyDeaths)||
   m.knockedOutIds.some(id=>!m.allyIds.includes(id))||
   m.enemyDeaths.some(id=>!m.enemyIds.includes(id))||
   m.enemyDeaths.length!==m.enemyIds.length||
   !m.enemyIds.includes(m.objectiveEnemyId)||
   battle.fighters.filter(f=>f.side==="ally").some(f=>!m.allyIds.includes(f.id)||
    (f.hp<=0&&!m.knockedOutIds.includes(f.id)))||
   battle.fighters.filter(f=>f.side==="enemy").some(f=>!m.enemyIds.includes(f.id)||
    f.hp>0)||battle.fighters.length!==m.allyIds.length+m.enemyIds.length)
   return null;
  const summary={version:VERSION,wave,deployed:m.allyIds.length,
   knockedOut:m.knockedOutIds.length,allyActions:battle.allyActions,
   paceBudget:m.paceBudget,objectiveEnemyId:m.objectiveEnemyId,
   objectiveDone:m.enemyDeaths[0]===m.objectiveEnemyId};
  summary.score=points(summary);
  return validSummary(summary)?summary:null;
 }
 return Object.freeze({VERSION,validSummary,finalScore,stars,attach,observe,summarize});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkScoreCore;
