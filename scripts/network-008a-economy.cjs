"use strict";
/* NET-008A upper-bound material projection, NOT production player retention forecast.
 * Assumes every available clue awards precisely the material most needed,
 * every battle is won, no campaign drops, no energy, XP/skill/star gates,
 * no clock exploitation, and deterministic fractions of 4 clues/day.
 * Never writes progress. Use to falsify optimistic G8/G13 balance claims. */
const Gear=require("../gear-data.js");
const Weekly=require("../weekly-threat-core.js");
const MAIN=["melee","support","tank","tank","support"];
const SECOND=["melee","ranged","mage","support","tank"];
const stages=Weekly.TIERS;
const ids=Gear.MATERIALS;
const zero=()=>Object.fromEntries(ids.map(id=>[id,0]));
function demand(classes,highestTier){
 if(!Array.isArray(classes)||!classes.length||!Number.isInteger(highestTier)||
    highestTier<1||highestTier>13)throw Error("INVALID_DEMAND");
 const out=zero();
 for(const cls of classes)for(let tier=1;tier<=highestTier;tier++)
  for(const slot of Gear.SLOTS){
   const items=Gear.offered(cls,slot.id,tier);
   if(items.length!==1)throw Error("AMBIGUOUS_RECIPE "+cls+"/"+tier+"/"+slot.id);
   for(const [id,n] of Object.entries(items[0].ingredients))out[id]+=n;
  }
 return out;
}
function simulate({classes,highestTier,visits=1,stars=3,weekFrom=1,maxDays=365}){
 if(![.25,.5,1].includes(visits)||![0,1,3].includes(stars)||
    !Number.isInteger(weekFrom)||weekFrom<1)throw Error("INVALID_ASSUMPTIONS");
 const needed=demand(classes,highestTier),earned=zero();
 const weekReward=zero();
 for(const stage of stages.slice(0,stars===0?0:stars===1?1:3))
  for(const [id,n] of Object.entries(stage.materials))weekReward[id]+=n;
 let clues=0,firstDay=null;const checkpoints=[];
 for(let day=1;day<=maxDays;day++){
  const dayClues=Math.floor(day*4*visits)-Math.floor((day-1)*4*visits);
  for(let k=0;k<dayClues;k++){
   const count=clues<50?8:clues<150?12:18;
   const wanted=ids.filter(id=>earned[id]<needed[id])
    .sort((a,b)=>(needed[b]-earned[b])-(needed[a]-earned[a]))[0];
   if(wanted)earned[wanted]+=count;clues++;
  }
  if(day%7===0&&day>=weekFrom*7)
   for(const id of ids)earned[id]+=weekReward[id];
  if([7,30,45,60,90,120,150,180].includes(day)){
   const remaining=Object.fromEntries(ids.map(id=>[id,Math.max(0,needed[id]-earned[id])]));
   checkpoints.push({day,remainingTotal:Object.values(remaining).reduce((a,b)=>a+b,0),
    largestDeficit:Math.max(...Object.values(remaining)),clues});
  }
  if(ids.every(id=>earned[id]>=needed[id])){firstDay=day;break;}
 }
 return {classes,highestTier,visits,stars,weekFrom,firstDay,needed,checkpoints};
}
if(require.main===module){
 const scenarios=[
  {name:"main5-full",classes:MAIN,visits:1,stars:3,weekFrom:1},
  {name:"main5-half",classes:MAIN,visits:.5,stars:1,weekFrom:2},
  {name:"main5-quarter",classes:MAIN,visits:.25,stars:1,weekFrom:2},
  {name:"ten-full",classes:[...MAIN,...SECOND],visits:1,stars:3,weekFrom:1},
  {name:"ten-half",classes:[...MAIN,...SECOND],visits:.5,stars:1,weekFrom:2}
 ];
 for(const s of scenarios)for(const highestTier of [8,13]){
  const {firstDay,needed,checkpoints}=simulate({...s,highestTier});
  console.log(JSON.stringify({scenario:s.name,highestTier,firstDay,
   requiredMaterials:Object.values(needed).reduce((a,b)=>a+b,0),needed,
   checkpoints:checkpoints.filter(x=>[30,90,150].includes(x.day))}));
 }
}
module.exports={MAIN,SECOND,demand,simulate};
