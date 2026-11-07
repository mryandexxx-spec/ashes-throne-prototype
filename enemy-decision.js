/* Combat-015E: deterministic tactical planning for every enemy.
 * Aggressive is the universal default; optional explicit profiles remain
 * available for technical testing and later design, not mission wiring.
 */
const EnemyDecision=(()=>{
 "use strict";
 const PROFILES=Object.freeze(["ordinary","aggressive","guardian","support","tactical"]);
 const HEAL_RATIO=0.70;
 const GUARD_RATIO=0.60;
 const hpRatio=f=>f.maxHp>0?f.hp/f.maxHp:1;
 function chooseAction(battle,actorIndex){
   const actor=battle?.fighters?.[actorIndex];
   if(!actor||actor.side!=="enemy"||
      !CombatCore.actorAbilityReady(battle,actorIndex,"basic"))return null;
   const opponents=CombatCore.actorTargetIndices(battle,actorIndex,"all-enemies",actorIndex);
   const allies=CombatCore.actorTargetIndices(battle,actorIndex,"all-allies",actorIndex);
   if(!opponents.length)return null;
   // A stable tie break always uses the fighter's original roster index.
   const byLowestHp=(a,b)=>battle.fighters[a].hp-battle.fighters[b].hp||a-b;
   const byLowestRatio=(a,b)=>hpRatio(battle.fighters[a])-hpRatio(battle.fighters[b])||a-b;
   const first=opponents[0];
   const weak=opponents.slice().sort(byLowestHp)[0];
   const can=id=>CombatCore.actorAbilityReady(battle,actorIndex,id);
   const ability=id=>can(id)?AbilityData.get(actor,id):null;
   const decision=(abilityId,targetIndex)=>({abilityId,targetIndex});
   const profile=PROFILES.includes(actor.aiProfile)?actor.aiProfile:"aggressive";
   if(profile==="ordinary")return decision("basic",first);
   const candidates=[];
   for(const id of ["special","powerful"]){
     const def=ability(id);
     if(!def||!["damage","heal","guard"].includes(def.kind))continue;
     const targetMode=def.target;
     const targetable=targetMode==="self"?[actorIndex]:
       targetMode==="enemy"||targetMode==="all-enemies"?opponents:
       targetMode==="ally"||targetMode==="all-allies"?allies:[];
     if(!targetable.length)continue;
     const supporting=targetMode==="ally"||targetMode==="self"||targetMode==="all-allies";
     const attacking=targetMode==="enemy"||targetMode==="all-enemies";
     if(def.kind==="heal"&&supporting&&Number.isFinite(def.healAmount)&&def.healAmount>0){
       const needy=targetable.filter(i=>battle.fighters[i].hp<battle.fighters[i].maxHp&&
         hpRatio(battle.fighters[i])<=HEAL_RATIO);
       if(!needy.length||(targetMode==="all-allies"&&needy.length<2))continue;
       const target=needy.slice().sort(byLowestRatio)[0];
       candidates.push({abilityId:id,targetIndex:targetMode==="ally"?target:actorIndex,
         priority:targetMode==="all-allies"?105:100,role:"support"});
     }else if(def.kind==="guard"&&supporting&&Number.isSafeInteger(def.guardHits)&&def.guardHits>0){
       const needy=targetable.filter(i=>hpRatio(battle.fighters[i])<=GUARD_RATIO&&
         !battle.fighters[i].guardHits);
       if(!needy.length||(targetMode==="all-allies"&&needy.length<2))continue;
       const target=needy.slice().sort(byLowestRatio)[0];
       candidates.push({abilityId:id,targetIndex:targetMode==="ally"?target:actorIndex,
         priority:targetMode==="all-allies"?85:80,role:"guardian"});
     }else if(def.kind==="damage"&&attacking&&Number.isFinite(def.multiplier)&&def.multiplier>0){
       const group=targetMode==="all-enemies"&&targetable.length>=2;
       const unweakened=targetable.filter(i=>!battle.fighters[i].weakenAttacks);
       const weakening=Number.isSafeInteger(def.weakening)&&def.weakening>0&&unweakened.length>0;
       const stronger=def.multiplier>1;
       if(!group&&!stronger&&!weakening)continue;
       const chosen=weakening&&!stronger?unweakened.slice().sort(byLowestHp)[0]:weak;
       // Higher raw multiplier breaks ties between two offensive abilities.
       candidates.push({abilityId:id,targetIndex:chosen,
         priority:group?70:stronger?60+Math.min(9,Math.round((def.multiplier-1)*10)):50,
         role:"attack"});
     }
   }
   let allowed;
   switch(profile){
     case "guardian":allowed=candidates.filter(x=>x.role==="guardian");break;
     case "support":allowed=candidates.filter(x=>x.role==="support");break;
     case "aggressive":allowed=candidates.filter(x=>x.role==="attack");break;
     default:allowed=candidates;
   }
   const picked=allowed.reduce((best,next)=>!best||next.priority>best.priority?next:best,null);
   if(picked)return decision(picked.abilityId,picked.targetIndex);
   // Aggressive and tactical enemies target vulnerable heroes; guardians,
   // supporters and ordinary fighters retain predictable first-alive fallback.
   return decision("basic",["aggressive","tactical"].includes(profile)?weak:first);
 }
 return Object.freeze({profiles:PROFILES,chooseAction});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=EnemyDecision;
