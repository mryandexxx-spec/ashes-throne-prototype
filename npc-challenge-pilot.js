/* NPCCHALLENGE004–006 — [PROPOSAL] opt-in T-01…T-03/N-01…N-03.
 * Reward-free training previews. Base challenge scoring remains untouched;
 * daily tasks, saves, progression and normal non-NPC opponents are untouched.
 */
const NpcChallengePilot=(()=>{
 "use strict";
 const unit=(archetypeId,instanceId,hp,protection)=>Object.freeze({
  archetypeId,instanceId,hp,protection,
  level:1,stars:1,gearTier:1,skillLevel:1
 });
 const catalog=Object.freeze({
  "T-01":Object.freeze({
   id:"T-01",kind:"tactical",label:"NPC-ПРОБА · первая цель",
   encounterTag:"noncanonical-demo-training",
   enemyIds:Object.freeze([
    unit("npc-route-signaller","npc-t01-signaller",55,6),
    unit("npc-trail-interceptor","npc-t01-interceptor",66,8)
   ]),
   priorityId:"npc-t01-signaller",futureWaves:Object.freeze([])
  }),
  // T-02 is about disabling the fast attacker before the slower guard.
  "T-02":Object.freeze({
   id:"T-02",kind:"tactical",label:"NPC-ПРОБА · быстрая угроза",
   encounterTag:"noncanonical-demo-training",
   enemyIds:Object.freeze([
    unit("npc-trail-interceptor","npc-t02-interceptor",70,6),
    unit("npc-pass-guard","npc-t02-guard",78,12)
   ]),
   priorityId:"npc-t02-interceptor",futureWaves:Object.freeze([])
  }),
  // T-03 reverses the familiar target-first rule: keep the healer last.
  "T-03":Object.freeze({
   id:"T-03",kind:"tactical",label:"NPC-ПРОБА · последняя цель",
   encounterTag:"noncanonical-demo-training",
   objective:Object.freeze({kind:"priority-last-solo"}),
   enemyIds:Object.freeze([
    unit("npc-ridge-slinger","npc-t03-slinger",65,6),
    unit("npc-pass-guard","npc-t03-guard",85,14),
    unit("npc-field-medic","npc-t03-medic",55,5)
   ]),
   priorityId:"npc-t03-medic",futureWaves:Object.freeze([])
  }),
  "N-01":Object.freeze({
   id:"N-01",kind:"onslaught",label:"NPC-ПРОБА · две волны",
   encounterTag:"noncanonical-demo-training",
   enemyIds:Object.freeze([
    unit("npc-pass-guard","npc-n01-guard",68,12),
    unit("npc-field-medic","npc-n01-medic",50,5)
   ]),
   priorityId:null,
   futureWaves:Object.freeze([Object.freeze([
    unit("npc-ridge-slinger","npc-n01-slinger",65,5)
   ])])
  }),
  // N-02 escalates from two harassers to a guarded field medic.
  "N-02":Object.freeze({
   id:"N-02",kind:"onslaught",label:"NPC-ПРОБА · смена караула",
   encounterTag:"noncanonical-demo-training",
   enemyIds:Object.freeze([
    unit("npc-ridge-slinger","npc-n02-slinger",60,5),
    unit("npc-route-signaller","npc-n02-signaller",52,4)
   ]),
   priorityId:null,
   futureWaves:Object.freeze([Object.freeze([
    unit("npc-watch-captain","npc-n02-captain",90,12),
    unit("npc-field-medic","npc-n02-medic",45,4)
   ])])
  }),
  // N-03 tests retaining HP across three rounds, not a short action count.
  "N-03":Object.freeze({
   id:"N-03",kind:"onslaught",label:"NPC-ПРОБА · запас сил",
   encounterTag:"noncanonical-demo-training",
   objective:Object.freeze({kind:"final-team-hp",minimumHealthPercent:95}),
   enemyIds:Object.freeze([
    unit("npc-ridge-slinger","npc-n03-slinger",56,5),
    unit("npc-pass-guard","npc-n03-guard",67,9)
   ]),
   priorityId:null,
   futureWaves:Object.freeze([
    Object.freeze([
     unit("npc-field-medic","npc-n03-medic",42,3),
     unit("npc-route-signaller","npc-n03-signaller",43,4)
    ]),
    Object.freeze([unit("npc-watch-captain","npc-n03-captain",92,13)])
   ])
  })
 });
 const get=id=>Object.prototype.hasOwnProperty.call(catalog,id)?catalog[id]:null;
 const definitions=p=>[...p.enemyIds,...p.futureWaves.flat()];
 function make(def){
  if(typeof NpcEnemyData==="undefined")return null;
  const base=NpcEnemyData.spawn(def.archetypeId,{
   instanceId:def.instanceId,level:def.level,stars:def.stars,
   gearTier:def.gearTier,skillLevel:def.skillLevel
  });
  if(!base||!Number.isSafeInteger(def.hp)||def.hp<1||def.hp>base.hp||
     !Number.isSafeInteger(def.protection)||def.protection<0||
     def.protection>base.protection)return null;
  return {...base,hp:def.hp,protection:def.protection,
   maxProtection:def.protection};
 }
 function valid(plan){
  const all=definitions(plan);
  const ids=all.map(e=>e.instanceId);
  return new Set(ids).size===ids.length&&
   (plan.priorityId===null||ids.includes(plan.priorityId))&&
   (plan.objective===undefined||
    plan.id==="T-03"&&plan.objective.kind==="priority-last-solo"||
    plan.id==="N-03"&&plan.objective.kind==="final-team-hp"&&
     plan.objective.minimumHealthPercent===95);
 }
 function spawn(id){
  const plan=get(id);
  if(!plan||!valid(plan))return null;
  const items=plan.enemyIds.map(make);
  return items.some(x=>!x)?null:items;
 }
 function spawnWaves(id){
  const plan=get(id);
  if(!plan||!valid(plan))return null;
  const waves=plan.futureWaves.map(w=>w.map(make));
  return waves.some(w=>w.some(x=>!x))?null:waves;
 }
 function trackerTargets(id){
  const plan=get(id);
  if(!plan||!valid(plan))return null;
  return Object.freeze({
   challengeId:id,
   enemyIds:Object.freeze(definitions(plan).map(x=>x.instanceId)),
   priorityId:plan.priorityId
  });
 }
 function visuals(){
  if(typeof NpcEnemyData==="undefined")return [];
  return Object.values(catalog).flatMap(p=>definitions(p).map(make)).filter(Boolean);
 }
 const lateGoal=id=>id==="T-03"?
  "2★: перевязчик погиб последним и отдельно; 3★: дополнительно все герои живы.":
  id==="N-03"?
  "3★: все герои живы, суммарное здоровье отряда не ниже 95% от максимума.":null;
 function criteria(id){
  if(id==="T-03")return Object.freeze([
   "1★ — победить",
   "2★ — оставить Полевого перевязчика последним и победить отдельно от остальных",
   "3★ — дополнительно сохранить всех союзников"
  ]);
  if(id==="N-03")return Object.freeze([
   "1★ — преодолеть все 3 волны",
   "2★ — не потерять ни одного героя",
   "3★ — завершить бой с ≥95% суммарного HP отряда"
  ]);
  return null;
 }
 function goal(id){
  if(id==="T-03")return "Цель: уничтожь остальных противников, оставив Полевого перевязчика последним. Сражайся с ним отдельно.";
  if(id==="N-03")return "Цель: пройди 3 волны. Для 3★ сохрани всех героев и не меньше 95% суммарного HP отряда.";
  return null;
 }
 function healthPercent(battle){
  if(!battle||!Array.isArray(battle.fighters))return null;
  const allies=battle.fighters.filter(f=>f.side==="ally");
  if(!allies.length||allies.some(f=>!Number.isFinite(f.maxHp)||f.maxHp<=0||
    !Number.isFinite(f.hp)||f.hp<0||f.hp>f.maxHp))return null;
  const sumHp=allies.reduce((v,f)=>v+f.hp,0);
  const sumMax=allies.reduce((v,f)=>v+f.maxHp,0);
  return {current:sumHp,maximum:sumMax,percent:Math.round(1000*sumHp/sumMax)/10};
 }
 function score(id,battle,tracker){
  const plan=get(id);
  if(!plan||typeof ChallengeCore==="undefined")return 0;
  // All previously accepted previews delegate to unchanged v1 challenge scoring.
  if(id!=="T-03"&&id!=="N-03")return ChallengeCore.score(id,battle,tracker);
  if(!battle||battle.active||battle.winner!=="ally"||
     !Array.isArray(battle.fighters)||!tracker||tracker.id!==id||tracker.invalid||
     !valid(plan)||!Array.isArray(tracker.enemyIds)||
     tracker.enemyIds.length!==definitions(plan).length||
     !definitions(plan).every((item,i)=>tracker.enemyIds[i]===item.instanceId)||
     !Array.isArray(tracker.killGroups))return 0;
  const allies=battle.fighters.filter(f=>f.side==="ally");
  if(!allies.length)return 0;
  const allAlive=allies.every(f=>Number.isFinite(f.hp)&&f.hp>0);
  if(id==="T-03"){
   if(battle.wave!==1||battle.totalWaves!==1)return 0;
   const groups=tracker.killGroups.filter(group=>Array.isArray(group)&&group.length);
   const fallen=groups.flat();
   const planned=definitions(plan).map(x=>x.instanceId);
   if(fallen.length!==planned.length||new Set(fallen).size!==planned.length||
      !fallen.every(x=>planned.includes(x)))return 0;
   const last=groups.at(-1);
   if(last.length!==1||last[0]!==plan.priorityId)return 1;
   return allAlive?3:2;
  }
  if(battle.wave!==3||battle.totalWaves!==3)return 0;
  if(!allAlive)return 1;
  const hp=healthPercent(battle);
  return hp&&hp.current*100>=hp.maximum*plan.objective.minimumHealthPercent?3:2;
 }
 function resultText(id,battle,tracker){
  if(id==="T-03"){
   const stars=score(id,battle,tracker);
   return stars>=2?
    "Лекарь остался последней целью и погиб отдельно.":
    "Для 2★ оставь лекаря последним и устрани его отдельным действием.";
  }
  if(id==="N-03"){
   const hp=healthPercent(battle);
   return "Суммарное HP отряда в финале: "+
    (hp?hp.percent.toFixed(1)+"%":"недоступно")+
    ". Для 3★ нужны все союзники и минимум 95%.";
  }
  return null;
 }
 return Object.freeze({get,spawn,spawnWaves,trackerTargets,visuals,criteria,goal,score,healthPercent,resultText});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NpcChallengePilot;
