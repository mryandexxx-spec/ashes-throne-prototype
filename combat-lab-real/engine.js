/* Isolated B14.6 laboratory; not loaded by production. B14.3 assist results invalid. */
const B146=(()=>{
 const files=["initiative-model.js","combat-status-core.js","ability-data.js","battle-rng.js","combat-core.js","auto-decision.js","enemy-decision.js","npc-enemy-data.js","hero-stats-core.js","hero-stats-profiles.js","star-core.js","hero-stats-combat-bridge.js","skill-core.js"];
 const basePatch=function patch(src,c){
 const replace=(a,b)=>{if(src.split(a).length!==2)throw Error("anchor "+a);src=src.replace(a,b)};
 replace('  art:Object.freeze({id:"leader",name:"Работа по риску",\n   combatRules:Object.freeze({tagId:"gardens-over-abyss",insuranceAllyMeter:90})}),\n  sava:Object.freeze({id:"leader",name:"Полевая координация",\n   combatRules:Object.freeze({tagId:"gardens-over-abyss",coordinationAllyMeter:90})}),','');
 replace('function rawGet(actor,abilityId){','function rawGet(actor,abilityId){\n  if(actor?.id==="b14-striker"){if(["basic","special","powerful"].includes(abilityId))return {...typedBasic,id:abilityId,name:"Role fixture",multiplier:{basic:1,special:1.25,powerful:1.6}[abilityId],cooldown:{basic:0,special:2,powerful:3}[abilityId]};return null;}');
 if(c.art==="recover"){
 replace('target.insurance={ownerId:actor.id,percent:ability.insurancePercent,','target.guardHits=Math.max(target.guardHits,1);\n      target.protection=Math.min(target.maxProtection,target.protection+Math.round(actor.physicalAttack*.65));\n      target.insurance={ownerId:actor.id,percent:ability.insurancePercent,');
 replace('remaining:ability.insuranceTurns,afterMeter:ability.afterInterceptMeter??0};','remaining:ability.insuranceTurns,afterMeter:ability.afterInterceptMeter??0};\n      delete target.insurance;');
 }
 if(c.art==="absorb"){
 replace('protector.hp=Math.max(0,protector.hp-redirected);','const intercepted=Math.min(redirected,protector.protection??0);protector.protection-=intercepted;\n    protector.hp=Math.max(0,protector.hp-(redirected-intercepted));');
 replace('amount:redirected,remainingHp:protector.hp,hpDamage:redirected','amount:redirected,remainingHp:protector.hp,hpDamage:redirected-intercepted,protectionDamage:intercepted');
 }
 if(c.shared)replace('const percent=passiveDamageBonusPercent(battle,actor,target);','const percent=passiveDamageBonusPercent(battle,actor,target)+(actor.side==="ally"&&actor.id!=="ren"&&actor.id!=="nada"&&CombatStatusCore.read(target,"read-move")?.stacks>0?B14.shared:0);');
 if(c.meter!==null)replace('target.meter=Math.min(1000,target.meter+ability.signalMeter);',`target.meter=Math.min(1000,target.meter+B14.meter);
      const foe=battle.fighters[actorTargetIndices(battle,battle.currentActor,"enemy",battle.selectedEnemy)[0]];
      if(B14.damage>0&&foe&&foe.side==="enemy"&&foe.hp>0&&rollToHit(battle,target,foe,"physical")){
        const oldHp=foe.hp,oldProtection=foe.protection;
        const raw=Math.round(bonusDamage(battle,target,foe,effectiveStat(battle,target,"physicalAttack")*B14.damage));
        const amount=dealDamage(target,foe,rollCriticalDamage(battle,target,foe,raw,"physical"),false,"physical",penetrationEnabled(battle,"physical")?target.defensePenetration:0,battle,false);
        if(!Number.isFinite(amount)||!Number.isFinite(foe.hp))throw Error("nonfinite assist");
        emit(battle,"damage",{actorId:target.id,targetId:foe.id,amount,remainingHp:foe.hp,...typedDamageFields(foe,"physical",oldHp,oldProtection)});
        if(foe.hp===0)emit(battle,"death",{targetId:foe.id});
      }`);
 return "const B14="+JSON.stringify(c)+";\n"+src;
};
 const extra=function extra(src,c){
 const rep=(a,b)=>{if(src.split(a).length!==2)throw Error("anchor "+a);src=src.replace(a,b)};
 rep('function rawGet(actor,abilityId){','function rawGet(actor,abilityId){\n  if(["b14-medic","b14-breaker"].includes(actor?.id)){\n   if(abilityId==="basic")return {...typedBasic,multiplier:.85};\n   if(actor.id==="b14-medic"){if(abilityId==="special")return {id:"special",name:"Role heal",kind:"heal",target:"ally",healAmount:Math.round(actor.physicalAttack*1.6),cooldown:2};if(abilityId==="powerful")return {id:"powerful",name:"Role rally",kind:"heal",target:"all-allies",healAmount:Math.round(actor.physicalAttack*.75),cooldown:3};}\n   if(actor.id==="b14-breaker"){if(abilityId==="special")return {...typedBasic,id:"special",multiplier:.9,disruptTurns:2,disruptDelay:0,cooldown:2};if(abilityId==="powerful")return {...typedBasic,id:"powerful",multiplier:1.3,cooldown:3};}\n   return null;\n  }');
 rep('function dealDamage(attacker,target,rawDamage,consumeWeakening=true,type="legacy",penetration=0,battle=null,canInsurance=false){','function dealDamage(attacker,target,rawDamage,consumeWeakening=true,type="legacy",penetration=0,battle=null,canInsurance=false){\n    if(!Number.isFinite(rawDamage))throw Error("nonfinite raw damage");');
 if(c.hybrid)rep('if(B14.damage>0&&foe&&foe.side==="enemy"&&foe.hp>0&&rollToHit(battle,target,foe,"physical")){',`if(foe&&foe.side==="enemy"&&foe.hp>0&&rollToHit(battle,actor,foe,"physical")){
        const oh=foe.hp,op=foe.protection;
        const raw=Math.round(bonusDamage(battle,actor,foe,effectiveStat(battle,actor,"physicalAttack")*B14.hybrid));
        const dealt=dealDamage(actor,foe,rollCriticalDamage(battle,actor,foe,raw,"physical"),true,"physical",penetrationEnabled(battle,"physical")?actor.defensePenetration:0,battle,false);
        emit(battle,"damage",{actorId:actor.id,targetId:foe.id,amount:dealt,remainingHp:foe.hp,...typedDamageFields(foe,"physical",oh,op)});
        if(foe.hp===0)emit(battle,"death",{targetId:foe.id});
      }
      if(B14.damage>0&&foe&&foe.side==="enemy"&&foe.hp>0&&rollToHit(battle,target,foe,"physical")){`);
 if(c.telegraph){
 rep('const plan=typeof EnemyDecision!=="undefined"\n        ?EnemyDecision.chooseAction(battle,actorIndex):null;',`let plan=typeof EnemyDecision!=="undefined"
        ?EnemyDecision.chooseAction(battle,actorIndex):null;
      const counts=battle.b14Counts??=({prepared:0,resolved:0,cancelled:0,reacted:0});
      if(actor.b14Prepared){
        const prepared=actor.b14Prepared;delete actor.b14Prepared;
        const target=battle.fighters.findIndex(f=>f.id===prepared&&f.side==="ally"&&f.hp>0);
        if(CombatStatusCore.read(actor,"disrupted-plan")){\n          CombatStatusCore.remove(actor,"disrupted-plan");delete actor.tacticalDisruptDelay;actor.powerfulCooldown=AbilityData.get(actor,"powerful").cooldown;counts.cancelled++;(battle.b14Trace??=[]).push("Срыв подготовки: "+actor.name);plan={abilityId:"basic",targetIndex:target>=0?target:targetIndex};\n        }else if(target>=0&&actorAbilityReady(battle,actorIndex,"powerful")){
          plan={abilityId:"powerful",targetIndex:target};counts.resolved++;(battle.b14Trace??=[]).push("Опасная атака: "+actor.name+" → "+battle.fighters[actorTargetIndices(battle,actorIndex,"enemy",target)[0]].name);
          battle.b14Resolving=true;
        }else{counts.cancelled++;actor.powerfulCooldown=AbilityData.get(actor,"powerful").cooldown;plan={abilityId:"basic",targetIndex:targetIndex};}
      }else if(["npc-ridge-slinger","npc-trail-interceptor"].includes(actor.archetypeId)&&plan?.abilityId==="powerful"&&AbilityData.get(actor,"powerful")?.kind==="damage"&&AbilityData.get(actor,"powerful")?.target==="enemy"){
        actor.b14Prepared=battle.fighters[actorTargetIndices(battle,actorIndex,"enemy",plan.targetIndex)[0]].id;counts.prepared++;actor.specialCooldown=Math.max(0,actor.specialCooldown-1);(battle.b14Trace??=[]).push("Подготовка: "+actor.name);
        InitiativeModel.finishTurn(battle.fighters,actor.id);
        tickActorStatuses(actor);battle.turn++;battle.currentActor=-1;
        continue;
      }`);
 rep('if(!battle.active)return battle;\n    }\n    throw Error("Turn guard reached: check initiative and actors");','battle.b14Resolving=false;\n      if(!battle.active)return battle;\n    }\n    throw Error("Turn guard reached: check initiative and actors");');
 if(c.react){
 rep('if(target.guardHits>0){\n      damage=Math.round(damage*0.5);',`if(battle?.b14Resolving&&attacker.side==="enemy"&&target.side==="ally"&&damage>0){
      const art=battle.fighters.find(f=>f.id==="art"&&f.hp>0&&f.id!==target.id&&!f.b14ReactUsed&&f.protection>0);
      if(art){
        const blocked=Math.min(Math.round(damage*.40),Math.round(art.physicalAttack*.85),art.protection*2);
        if(blocked>0){art.protection-=Math.ceil(blocked/2);damage-=blocked;art.b14ReactUsed=true;battle.b14Counts.reacted++;(battle.b14Trace??=[]).push("Арт прикрыл "+target.name+" (−"+blocked+" урона)");}
      }
    }
    if(target.guardHits>0){
      damage=Math.round(damage*0.5);`);
 rep('if(actor.side!=="ally")return;\n    if(actor.id==="sava"','if(actor.side!=="ally")return;\n    if(actor.id==="art")actor.b14ReactUsed=false;\n    if(actor.id==="sava"');
 }}
 if(c.stable)rep('const byLowestHp=(a,b)=>battle.fighters[a].hp-battle.fighters[b].hp||a-b;','const byLowestHp=(a,b)=>battle.fighters[a].hp-battle.fighters[b].hp||battle.fighters[a].id.localeCompare(battle.fighters[b].id);');
 return src;
};
 const names={ren:"Рен",art:"Арт",nada:"Нада",liora:"Лиора",sava:"Сава","b14-striker":"Атакующий*","b14-medic":"Лекарь*","b14-breaker":"Прерыватель*"};
 const squads=[["ren","art","nada"],["ren","liora","nada"],["art","nada","sava"],["liora","nada","sava"],["ren","art","sava"],["b14-striker","art","b14-breaker"],["b14-striker","b14-medic","b14-breaker"],["ren","nada"],["ren","art","nada","liora","sava"],["liora","b14-striker","b14-medic","sava"]];
 const scenarios={rush:["npc-trail-interceptor","npc-trail-interceptor","npc-ridge-slinger"],mixed:["npc-pass-guard","npc-trail-interceptor","npc-field-medic"],hold:["npc-trail-interceptor","npc-ridge-slinger","npc-pass-guard"],priority:["npc-pass-guard","npc-trail-interceptor","npc-field-medic"]};
 function make(source,mode="visible"){
  if(!["visible","hidden","direct"].includes(mode))throw Error("mode");
  const config={art:"recover",meter:0,damage:.55,shared:12,hybrid:.8,stable:true,telegraph:mode!=="direct",react:mode!=="direct"};
  return new Function(extra(basePatch(source,config),config)+"\nreturn {C:CombatCore,A:AutoDecision,N:NpcEnemyData,H:HeroStatsProfiles,S:HeroStatsCore,B:HeroStatsCombatBridge,D:AbilityData,T:CombatStatusCore};")();
 }
 function start(api,squad,scenario,seed=7){
  const {C,N,H,S,B,D}=api;
  const hero=id=>{const source=id==="b14-striker"?"ren":id==="b14-medic"?"nada":id==="b14-breaker"?"art":id;
   return {...B.apply({id:source,name:names[id],side:"ally",tags:id.startsWith("b14-")?[]:["gardens-over-abyss"],skillLevels:{basic:1,special:1,powerful:1,passive:1}}, {level:2,stars:1},H[source],S),id};};
  const scale=scenario==="rush"?.90:.72;
  const party=squad.map(hero),foes=scenarios[scenario].map((id,i)=>{const n=N.spawn(id,{instanceId:"b146-"+i});return {...n,name:n.name+" "+(i+1),hp:Math.round(n.hp*scale),protection:Math.round(n.protection*scale),maxProtection:Math.round(n.protection*scale),physicalAttack:Math.round(n.physicalAttack*scale),atk:Math.round(n.physicalAttack*scale),assaultFocus:scenario==="hold"};});
  if(D.get(hero("art"),"leader")||D.get(hero("sava"),"leader"))throw Error("leader constraint");
  const tacticalObjective=scenario==="hold"?{kind:"hold-or-defeat",protectAllyId:squad.includes("nada")?"nada":squad[0],allyActionsToHold:8}:scenario==="priority"?{kind:"priority-first",priorityEnemyId:"b146-2"}:undefined;
  const b=C.createBattle([...party,...foes],[],{leaderId:null,rngSeed:seed,hitChecks:true,critChecks:true,penetrationChecks:true,statusChecks:true,...(tacticalObjective?{tacticalObjective}:{})}); C.advanceToPlayerTurn(b);validate(b);return b;
 }
 function validate(b){for(const f of b.fighters)if(!Number.isFinite(f.hp)||f.hp<0||f.hp>f.maxHp||!Number.isFinite(f.protection)||f.protection<0||f.protection>f.maxProtection||!Number.isFinite(f.meter)||f.meter<0)throw Error("invalid fighter");if(b.events.some(e=>e.type==="damage"&&!Number.isFinite(e.amount)))throw Error("invalid damage");}
 function plan(api,b,aware){
  const {C,A,D,T}=api,actor=b.fighters[b.currentActor],living=(s)=>b.fighters.flatMap((f,i)=>f.side===s&&f.hp>0?[i]:[]),foes=living("enemy"),allies=living("ally"),others=allies.filter(i=>i!==b.currentActor);
  const focus=foes.find(i=>b.fighters[i].id===b.tacticalObjective?.priorityEnemyId),threat=aware?foes.find(i=>b.fighters[i].b14Prepared):undefined;
  const target=focus??foes.slice().sort((i,j)=>b.fighters[i].hp+b.fighters[i].protection-b.fighters[j].hp-b.fighters[j].protection)[0],ready=id=>C.abilityReady(b,id);
  if((actor.id==="art"||actor.id==="b14-breaker")&&threat!==undefined&&(focus===undefined||focus===threat)){const id=actor.id==="art"?"powerful":"special";if(ready(id))return {abilityId:id,targetIndex:threat,enemy:threat};}
  if(actor.id==="art"&&ready("special")&&others.length){const t=others.find(i=>b.fighters[i].id===b.fighters[threat]?.b14Prepared)??others.slice().sort((i,j)=>b.fighters[i].hp-b.fighters[j].hp)[0];if(!b.fighters[t].guardHits&&b.fighters[t].protection<b.fighters[t].maxProtection*.45)return {abilityId:"special",targetIndex:t,enemy:target};}
  if(actor.id==="sava"&&ready("special")&&others.length){const t=others.slice().sort((i,j)=>b.fighters[j].physicalAttack-b.fighters[i].physicalAttack)[0];return {abilityId:"special",targetIndex:t,enemy:target};}
  if(actor.id==="nada"&&ready("special")&&(T.read(b.fighters[focus??threat??target],"read-move")?.stacks??0)<2)return {abilityId:"special",targetIndex:focus??threat??target,enemy:target};
  const a=A.chooseAction(b),def=D.get(actor,a.abilityId);
  if(focus!==undefined&&def.target==="all-enemies")return {abilityId:"basic",targetIndex:focus,enemy:focus};
  return {...a,targetIndex:focus!==undefined&&def.target==="enemy"?focus:a.targetIndex,enemy:target};
 }
 function step(api,b,id,t,enemy){const {C}=api;if(!b.active||!C.abilityReady(b,id))return false;if(enemy!==undefined&&!C.chooseEnemy(b,enemy))return false;const ok=C.performActorAbility(b,id,t);validate(b);return ok;}
 async function load(){return (await Promise.all(files.map(async f=>{const res=await fetch("../"+f);if(!res.ok)throw Error(f+" "+res.status);return res.text();}))).join("\n");}
 return {files,names,squads,scenarios,make,start,step,plan,validate,load};
})(); 
if(typeof module!=="undefined"&&module.exports)module.exports=B146;
