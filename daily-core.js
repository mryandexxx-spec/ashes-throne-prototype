/* Daily-001: minimal real-activity tasks; stored atomically in progress.v3. */
const DailyCore=(()=>{
 "use strict";
 const IDS=Object.freeze(["hero-level","equip-item","campaign-battle"]);
 const TASKS=Object.freeze([
  Object.freeze({id:"hero-level",label:"Повысить уровень любого героя",currency:200,xp:15,materials:Object.freeze({Fe:2})}),
  Object.freeze({id:"equip-item",label:"Изготовить и установить предмет снаряжения",currency:200,xp:15,materials:Object.freeze({Le:2})}),
  Object.freeze({id:"campaign-battle",label:"Завершить бой кампании",currency:250,xp:20,materials:Object.freeze({Cl:3})})
 ]);
 const empty=day=>({day,counts:{"hero-level":0,"equip-item":0,"campaign-battle":0},claimed:[]});
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
     Object.keys(state.counts).length!==IDS.length)return false;
  return IDS.every(id=>Object.prototype.hasOwnProperty.call(state.counts,id)&&
   (state.counts[id]===0||state.counts[id]===1)&&
   (!state.claimed.includes(id)||state.counts[id]===1));
 }
 function today(progress,day){
  if(!isDay(day)||!progress||progress.saveVersion!==3)return false;
  if(progress.daily===undefined){progress.daily=empty(day);return true;}
  if(!valid(progress.daily))return false;
  if(day<progress.daily.day)return false; // Do not roll back clock to farm rewards.
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
 return Object.freeze({TASKS,IDS,empty,valid,localDay,today,record,unclaimedCount,claim});
})();
