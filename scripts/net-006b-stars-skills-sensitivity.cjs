"use strict";
/* NET-006B [ПРЕДЛОЖЕНИЕ]: conditional star and skill-material sensitivity.
 * All payout rates are unapproved assumptions. NO live reward or save writes.
 * Run: node scripts/net-006b-stars-skills-sensitivity.cjs
 */
const StarCore=require("../star-core.js");
const SkillCore=require("../skill-core.js");
const PLAYER={
 casual:{login:0.55,clues:1},
 regular:{login:0.90,clues:3},
 intensive:{login:1,clues:4}
};
const sum=(a,b)=>a+b;
const ABILITY_COST=SkillCore.STEPS.slice(1).reduce((tot,step)=>{
 tot.currency+=step.currency;
 for(const k of SkillCore.RESOURCE_IDS)tot[k]+=(step.materials[k]||0);
 return tot;
},{currency:0,manual1:0,manual2:0,seal:0});
function requirements(heroCount){
 if(![5,10].includes(heroCount))throw Error("Only current roster cohorts");
 // 3 active skills for all 10, plus one passive for 5 (ren/nada/liora/art/sava).
 const abilities=heroCount*3+5;
 return {heroCount,abilities,skillCurrency:abilities*ABILITY_COST.currency,
  manual1:abilities*ABILITY_COST.manual1,
  manual2:abilities*ABILITY_COST.manual2,
  seal:abilities*ABILITY_COST.seal,
  shardsForOneDirectJoin:StarCore.TOTAL-StarCore.usedThrough(1),
  shardsForOneClosedHero:StarCore.TOTAL};
}
function calendar({activity="regular",heroes=5,manual1PerLogin=2,
 manual2PerLogin=2,weeklySeals=2}={}){
 const p=PLAYER[activity],need=requirements(heroes);
 if(!p||![manual1PerLogin,manual2PerLogin,weeklySeals].every(v=>
  Number.isSafeInteger(v)&&v>0))throw Error("Invalid rate");
 const weeklyAttendance=1-Math.pow(1-p.login,7);
 return {activity,heroes,sourceHypothesis:{manual1PerLogin,manual2PerLogin,weeklySeals},
  manual1Days:Math.ceil(need.manual1/(p.login*manual1PerLogin)),
  manual2Days:Math.ceil(need.manual2/(p.login*manual2PerLogin)),
  sealDays:Math.ceil(7*need.seal/(weeklyAttendance*weeklySeals)),
  bottleneckDays:Math.ceil(Math.max(need.manual1/(p.login*manual1PerLogin),
   need.manual2/(p.login*manual2PerLogin),7*need.seal/(weeklyAttendance*weeklySeals)))};
}
function rand(seed){
 let s=seed>>>0;
 return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};
}
/* Approximate P1 x4 focus and guarantee at most the third arrival for same order.
 * During material-priority sessions, shard order is interrupted and guarantee resets.
 * This is a conditional sensitivity on claim throughput, not NetworkCore simulation:
 * board content and some incidental cross-type rewards are intentionally omitted. */
function shardRun({seed=1,activity="regular",focusFraction=1,heroes=1,
 shardsPerHit=4,days=720}={}){
 const p=PLAYER[activity],random=rand(seed);
 if(!p||!Number.isInteger(heroes)||heroes<1||heroes>10||
  !(focusFraction>0&&focusFraction<=1)||!Number.isInteger(shardsPerHit)||
  shardsPerHit<1)throw Error("Invalid shard scenario");
 const stock=Array(heroes).fill(0),needed=StarCore.TOTAL-StarCore.usedThrough(1);
 let visits=0,focusVisits=0,misses=0,order=-1,materialClues=0,shardClues=0;
 for(let day=1;day<=days;day++){
  if(random()>=p.login)continue;
  visits++;
  const focus=Math.floor(visits*focusFraction)>Math.floor((visits-1)*focusFraction);
  if(!focus){misses=0;order=-1;materialClues+=p.clues;continue;}
  const hero=focusVisits%heroes;
  focusVisits++;
  if(order!==hero)misses=0;
  order=hero;
  for(let i=0;i<p.clues;i++){
   shardClues++;
   const hit=misses>=2||random()<1/3;
   if(hit){stock[hero]+=shardsPerHit;misses=0;}
   else misses++;
  }
  if(stock.every(n=>n>=needed))
   return {day,stock:stock.slice(),shardClues,materialClues,focusVisits};
 }
 return {day:null,stock:stock.slice(),shardClues,materialClues,focusVisits};
}
function percentile(values,p){
 const ordered=values.slice().sort((a,b)=>a-b),k=(values.length-1)*p;
 const low=Math.floor(k),high=Math.ceil(k);
 return ordered[low]+(ordered[high]-ordered[low])*(k-low);
}
function batch(input,seeds=120){
 const rows=Array.from({length:seeds},(_,i)=>shardRun({...input,seed:i+1}));
 const values=rows.map(x=>x.day??721);
 return {input,windowDays:720,succeeded:rows.filter(x=>x.day!==null).length+"/"+seeds,
  p10:Math.round(percentile(values,.1)),median:Math.round(percentile(values,.5)),
  p90:Math.round(percentile(values,.9))};
}
function selfTest(){
 const check=(condition,msg)=>{if(!condition)throw Error("Test: "+msg);};
 check(StarCore.TOTAL===330,"330 shards");
 check(StarCore.usedThrough(1)===10,"first join costs 10");
 check(ABILITY_COST.currency===1800,"full skill currency");
 check(ABILITY_COST.manual1===5,"basic manuals");
 check(ABILITY_COST.manual2===8,"advanced manuals");
 check(ABILITY_COST.seal===1,"mastery seal");
 check(requirements(5).abilities===20,"five hero ability counts");
 check(requirements(10).abilities===35,"ten hero ability counts");
 check(requirements(5).skillCurrency===36000,"five skills currency");
 check(requirements(10).skillCurrency===63000,"ten skills currency");
 check(JSON.stringify(shardRun({seed:17}))===JSON.stringify(shardRun({seed:17})),
  "seeded trajectories stable");
 return "11/11 shard and skill research checks passed";
}
function report(){
 selfTest();
 return {skillCost:ABILITY_COST,required5:requirements(5),required10:requirements(10),
  hypotheticalManualFlow:Object.keys(PLAYER).flatMap(activity=>
   [5,10].map(heroes=>calendar({activity,heroes}))),
  sensitivity:[
   batch({activity:"casual",focusFraction:1,heroes:1,shardsPerHit:4}),
   batch({activity:"regular",focusFraction:1,heroes:1,shardsPerHit:2}),
   batch({activity:"regular",focusFraction:1,heroes:1,shardsPerHit:4}),
   batch({activity:"regular",focusFraction:1,heroes:1,shardsPerHit:6}),
   batch({activity:"regular",focusFraction:1/3,heroes:1,shardsPerHit:4}),
   batch({activity:"regular",focusFraction:1/3,heroes:2,shardsPerHit:4}),
   batch({activity:"intensive",focusFraction:1/3,heroes:1,shardsPerHit:4}),
  ]};
}
module.exports={PLAYER,ABILITY_COST,requirements,calendar,shardRun,batch,selfTest,report};
if(require.main===module){
 if(process.argv.includes("--self-test"))console.log(selfTest());
 else console.log(JSON.stringify(report(),null,2));
}
