/* Login-002: month-length calendar, one claimed reward per local day.
   Missed days do not reset the sequence; the calendar resets on the 1st.
   v1 seven-day saves stay readable and migrate on the next successful claim. */
const LoginCore=(()=>{
 "use strict";
 const VERSION=2;
 // Existing seven prototype reward bundles reused as a test-only cycle
 // inside each 28/29/30/31-day calendar; no final economy is asserted.
 const REWARDS=Object.freeze([
  Object.freeze({currency:100,xp:10,materials:Object.freeze({Fe:1})}),
  Object.freeze({currency:150,xp:10,materials:Object.freeze({Le:1})}),
  Object.freeze({currency:200,xp:15,materials:Object.freeze({Cl:2})}),
  Object.freeze({currency:250,xp:15,materials:Object.freeze({Wo:1})}),
  Object.freeze({currency:300,xp:20,materials:Object.freeze({Fa:2})}),
  Object.freeze({currency:350,xp:20,materials:Object.freeze({Th:2})}),
  Object.freeze({currency:600,xp:35,materials:Object.freeze({Gl:1})})
 ]);
 const isDay=day=>typeof day==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&
  Number.isFinite(Date.parse(day+"T12:00:00Z"))&&
  new Date(day+"T12:00:00Z").toISOString().slice(0,10)===day;
 const monthOf=day=>day.slice(0,7);
 function daysInMonth(month){
  if(typeof month!=="string"||!/^\d{4}-\d{2}$/.test(month))return null;
  const [y,m]=month.split("-").map(Number);
  if(y<100||y>9999||m<1||m>12)return null;
  return new Date(Date.UTC(y,m,0)).getUTCDate();
 }
 const fresh=month=>({version:VERSION,month,claimed:0,lastClaimDay:null});
 function valid(state){
  if(!state||typeof state!=="object"||Array.isArray(state))return false;
  if(state.version===1)return Number.isSafeInteger(state.totalClaims)&&
   state.totalClaims>=0&&(state.lastClaimDay===null||isDay(state.lastClaimDay))&&
   (state.totalClaims===0)===(state.lastClaimDay===null);
  if(state.version!==VERSION)return false;
  const count=daysInMonth(state.month);
  return count!==null&&Number.isInteger(state.claimed)&&state.claimed>=0&&
   state.claimed<=count&&(state.lastClaimDay===null||isDay(state.lastClaimDay))&&
   (state.claimed===0)===(state.lastClaimDay===null)&&
   (state.lastClaimDay===null||monthOf(state.lastClaimDay)===state.month);
 }
 function normalizedState(stored,month){
  if(!stored)return fresh(month);
  if(stored.version===1){
   // Preserve past v1 claims in the current month only. Never grant them again.
   if(stored.lastClaimDay!==null&&monthOf(stored.lastClaimDay)===month)
    return {version:VERSION,month,claimed:Math.min(stored.totalClaims,daysInMonth(month)),
     lastClaimDay:stored.lastClaimDay};
   return fresh(month);
  }
  if(stored.month<month)return fresh(month);
  if(stored.month>month)return null; // Clock rollback cannot reopen a past month.
  return stored;
 }
 function current(progress,day){
  if(!isDay(day)||!progress||progress.saveVersion!==3||
   (progress.login!==undefined&&!valid(progress.login)))return null;
  const month=monthOf(day),days=daysInMonth(month);
  if(days===null||(progress.login?.version===1&&
     progress.login.lastClaimDay!==null&&day<progress.login.lastClaimDay))return null;
  const state=normalizedState(progress.login,month);
  if(!state)return null;
  const alreadyClaimed=state.lastClaimDay===day;
  const clockBack=state.lastClaimDay!==null&&day<state.lastClaimDay;
  const available=!alreadyClaimed&&!clockBack&&state.claimed<days;
  const nextDay=state.claimed+1;
  return {state,month,days,claimedThisMonth:state.claimed,
   available,alreadyClaimed,clockBack,nextDay,
   reward:available?REWARDS[(nextDay-1)%REWARDS.length]:null};
 }
 function rewardForDay(dayNumber){
  if(!Number.isInteger(dayNumber)||dayNumber<1)return null;
  return REWARDS[(dayNumber-1)%REWARDS.length];
 }
 function claim(progress,day){
  const view=current(progress,day);
  if(!view?.available)return null;
  const reward=view.reward;
  if(!Number.isSafeInteger(progress.accountXp)||!Number.isSafeInteger(progress.currency)||
   !Number.isSafeInteger(progress.accountXp+reward.xp)||
   !Number.isSafeInteger(progress.currency+reward.currency)||
   !progress.materials||Object.entries(reward.materials).some(([key,amount])=>
    !Number.isSafeInteger(progress.materials[key])||
    !Number.isSafeInteger(progress.materials[key]+amount)))return null;
  progress.accountXp+=reward.xp;
  progress.currency+=reward.currency;
  for(const [key,amount] of Object.entries(reward.materials))progress.materials[key]+=amount;
  progress.login={version:VERSION,month:view.month,claimed:view.nextDay,lastClaimDay:day};
  return {day:view.nextDay,...reward};
 }
 return Object.freeze({VERSION,REWARDS,daysInMonth,fresh,valid,current,rewardForDay,claim});
})();
