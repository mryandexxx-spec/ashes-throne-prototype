/* Daily-001: minimal real-activity tasks; stored atomically in progress.v3. */
const DailyCore=(()=>{
 "use strict";
 const LEGACY_IDS=Object.freeze(["hero-level","equip-item","campaign-battle"]);
 const IDS=Object.freeze([...LEGACY_IDS,"tactical-participation","onslaught-participation"]);
 const TASKS=Object.freeze([
  Object.freeze({id:"hero-level",label:"Повысить уровень любого героя",currency:200,xp:15,materials:Object.freeze({Fe:2})}),
  Object.freeze({id:"equip-item",label:"Изготовить и установить предмет снаряжения",currency:200,xp:15,materials:Object.freeze({Le:2})}),
  Object.freeze({id:"campaign-battle",label:"Завершить бой кампании",currency:250,xp:20,materials:Object.freeze({Cl:3})}),
  // Temporary pilot rewards reuse existing small daily bundles, not a new economy.
  Object.freeze({id:"tactical-participation",label:"Участвовать в тактической задаче",currency:200,xp:15,materials:Object.freeze({Fe:2})}),
  Object.freeze({id:"onslaught-participation",label:"Участвовать в Натиске",currency:200,xp:15,materials:Object.freeze({Le:2})})
 ]);
 const empty=day=>({day,counts:Object.fromEntries(IDS.map(id=>[id,0])),claimed:[]});
 const isDay=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T12:00:00Z"));
 const localDay=(date=new Date())=>{
  if(!(date instanceof Date)||!Number.isFinite(date.getTime()))return null;
  const n=v=>String(v).padStart(2,"0");
  return date.getFullYear()+"-"+n(date.getMonth()+1)+"-"+n(date.getDate());
 };
 function valid(state){
  if(!state||typeof state!=="object"||Array.isArray(state)||!isDay(state.day)||
     !state.counts||typeof state.counts!=="object"||Array.isArray(state.counts)||
     !Array.isArray(state.claimed)||state.claimed.length>IDS.length||
     new Set(state.claimed).size!==state.claimed.length||
     state.claimed.some(id=>!IDS.includes(id))||
     ![IDS.length,LEGACY_IDS.length].includes(Object.keys(state.counts).length))return false;
  const keys=Object.keys(state.counts);
  const recognized=keys.length===LEGACY_IDS.length?LEGACY_IDS:IDS;
  if(keys.some(id=>!recognized.includes(id))||state.claimed.some(id=>!recognized.includes(id)))return false;
  return recognized.every(id=>Object.prototype.hasOwnProperty.call(state.counts,id)&&
   (state.counts[id]===0||state.counts[id]===1)&&
   (!state.claimed.includes(id)||state.counts[id]===1));
 }
 function today(progress,day){
  if(!isDay(day)||!progress||progress.saveVersion!==3)return false;
  if(progress.daily===undefined){progress.daily=empty(day);return true;}
  if(!valid(progress.daily))return false;
  if(day<progress.daily.day)return false; // Do not roll back clock to farm rewards.
  if(Object.keys(progress.daily.counts).length===LEGACY_IDS.length){
   // Same-day non-destructive migration of existing 3-task profiles.
   for(const id of IDS)if(!Object.prototype.hasOwnProperty.call(progress.daily.counts,id))
    progress.daily.counts[id]=0;
  }
  if(day>progress.daily.day)progress.daily=empty(day);
  return true;
 }
 function record(progress,id,day){
  if(!IDS.includes(id)||!today(progress,day))return false;
  if(progress.daily.counts[id]===1)return false;
  progress.daily.counts[id]=1;
  return true;
 }
 // Read-only counter: never initialize or reset daily state merely to display a badge.
 function unclaimedCount(progress,day){
  if(!isDay(day)||!progress||progress.saveVersion!==3)return 0;
  const state=progress.daily;
  if(!state||!valid(state)||state.day!==day)return 0;
  return IDS.filter(id=>state.counts[id]===1&&!state.claimed.includes(id)).length;
 }
 function claimAll(progress,day){
  // Fully atomic in memory: preflight each reward on a candidate, then apply
  // only when all claims are valid. Caller persists with a single save.
  if(!progress||progress.saveVersion!==3)return null;
  const clone=JSON.parse(JSON.stringify(progress));
  if(!today(clone,day))return null;
  const pending=IDS.filter(id=>clone.daily.counts[id]===1&&!clone.daily.claimed.includes(id));
  if(!pending.length)return null;
  let currency=0,xp=0;
  const materials={};
  for(const id of pending){
   const reward=claim(clone,id,day);
   if(!reward)return null;
   currency+=reward.currency;xp+=reward.xp;
   for(const [key,qty] of Object.entries(reward.materials))
    materials[key]=(materials[key]||0)+qty;
  }
  progress.currency=clone.currency;
  progress.accountXp=clone.accountXp;
  progress.materials=clone.materials;
  progress.daily=clone.daily;
  return {ids:pending,currency,xp,materials};
 }
 function claim(progress,id,day){
  const task=TASKS.find(t=>t.id===id);
  if(!task||!today(progress,day)||progress.daily.counts[id]!==1||
    progress.daily.claimed.includes(id)||
    !Number.isSafeInteger(progress.currency+task.currency)||
    !Number.isSafeInteger(progress.accountXp+task.xp)||
    !progress.materials||Object.entries(task.materials).some(([key,amount])=>
     !Number.isSafeInteger(progress.materials[key])||
     !Number.isSafeInteger(progress.materials[key]+amount)))return null;
  progress.currency+=task.currency;
  progress.accountXp+=task.xp;
  for(const [key,amount] of Object.entries(task.materials))progress.materials[key]+=amount;
  progress.daily.claimed.push(id);
  return {currency:task.currency,xp:task.xp,materials:task.materials};
 }
 return Object.freeze({TASKS,IDS,empty,valid,localDay,today,record,unclaimedCount,claim,claimAll});
})();
