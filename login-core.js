/* Login-001: seven-claim calendar. One explicit claim per local day.
   No automatic rewards on page load; no streak reset on missed days. */
const LoginCore=(()=>{
 "use strict";
 const VERSION=1;
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
 const fresh=()=>({version:VERSION,totalClaims:0,lastClaimDay:null});
 function valid(state){
  return !!state&&typeof state==="object"&&!Array.isArray(state)&&
   state.version===VERSION&&Number.isSafeInteger(state.totalClaims)&&
   state.totalClaims>=0&&(state.lastClaimDay===null||isDay(state.lastClaimDay))&&
   (state.totalClaims===0)===(state.lastClaimDay===null);
 }
 function current(progress,day){
  if(!isDay(day)||!progress||progress.saveVersion!==3||
     (progress.login!==undefined&&!valid(progress.login)))return null;
  const state=progress.login??fresh();
  const alreadyClaimed=state.lastClaimDay===day;
  const clockBack=state.lastClaimDay!==null&&day<state.lastClaimDay;
  const available=!alreadyClaimed&&!clockBack&&state.totalClaims<Number.MAX_SAFE_INTEGER;
  // On day 7, keep the completed week visible until the next local date.
  const doneWeek=alreadyClaimed&&state.totalClaims>0&&state.totalClaims%7===0;
  const claimedThisCycle=doneWeek?7:state.totalClaims%7;
  const nextIndex=state.totalClaims%7;
  return {state,available,alreadyClaimed,clockBack,claimedThisCycle,
   nextDay:nextIndex+1,reward:REWARDS[nextIndex]};
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
  progress.login={version:VERSION,totalClaims:view.state.totalClaims+1,lastClaimDay:day};
  return {day:view.nextDay,...reward};
 }
 return Object.freeze({VERSION,REWARDS,fresh,valid,current,claim});
})();
