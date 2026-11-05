/* Campaign-Stars-001: mission-specific criteria live in data, not combat logic.
   Later chapters and branches can define different rule combinations. */
const MissionData=(()=>{
 "use strict";
 const missions=Object.freeze({
  "black-pass-ambush":Object.freeze({
   id:"black-pass-ambush",chapterId:"chapter-1",branchId:"main",
   title:"Засада у Чёрного перевала",
   stars:Object.freeze([
    Object.freeze({conditions:Object.freeze([{type:"victory"}]),hint:"Победить"}),
    Object.freeze({conditions:Object.freeze([{type:"victory"},{type:"all-allies-alive"}]),hint:"Победить без потерь"}),
    Object.freeze({conditions:Object.freeze([{type:"victory"},{type:"all-allies-alive"},{type:"max-ally-actions",limit:8}]),hint:"Победить без потерь за 8 действий союзников или меньше"})
   ])
  })
 });
 const predicates=Object.freeze({
  victory:(battle)=>!battle.active&&battle.winner==="ally",
  "all-allies-alive":(battle)=>battle.fighters.filter(f=>f.side==="ally").every(f=>f.hp>0),
  "max-ally-actions":(battle,condition)=>Number.isSafeInteger(battle.allyActions)&&battle.allyActions<=condition.limit
 });
 function get(id){return missions[id]||null;}
 function score(id,battle){
  const mission=get(id);
  if(!mission||!battle)return 0;
  let earned=0;
  for(const star of mission.stars){
   if(!star.conditions.every(rule=>predicates[rule.type]&&predicates[rule.type](battle,rule)))break;
   earned++;
  }
  return earned;
 }
 return Object.freeze({get,score,all:()=>Object.values(missions)});
})();
