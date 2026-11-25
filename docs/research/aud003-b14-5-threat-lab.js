/* AUD003-B14.5 research only; no production mutation. Prior B14.3 assist numbers invalid. */
const fs=require("node:fs"),vm=require("node:vm");
const files=["initiative-model.js","combat-status-core.js","ability-data.js","battle-rng.js","combat-core.js","auto-decision.js","enemy-decision.js","npc-enemy-data.js","hero-stats-core.js","hero-stats-profiles.js","star-core.js","hero-stats-combat-bridge.js","skill-core.js"];
const source=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
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
        if(target>=0&&actorAbilityReady(battle,actorIndex,"powerful")){
          plan={abilityId:"powerful",targetIndex:target};counts.resolved++;
          battle.b14Resolving=true;
        }else{counts.cancelled++;plan={abilityId:"basic",targetIndex:targetIndex};}
      }else if(plan?.abilityId==="powerful"&&AbilityData.get(actor,"powerful")?.kind==="damage"&&AbilityData.get(actor,"powerful")?.target==="enemy"){
        actor.b14Prepared=battle.fighters[plan.targetIndex].id;counts.prepared++;
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
        if(blocked>0){art.protection-=Math.ceil(blocked/2);damage-=blocked;art.b14ReactUsed=true;battle.b14Counts.reacted++;}
      }
    }
    if(target.guardHits>0){
      damage=Math.round(damage*0.5);`);
 rep('if(actor.side!=="ally")return;\n    if(actor.id==="sava"','if(actor.side!=="ally")return;\n    if(actor.id==="art")actor.b14ReactUsed=false;\n    if(actor.id==="sava"');
 }}
 if(c.stable)rep('const byLowestHp=(a,b)=>battle.fighters[a].hp-battle.fighters[b].hp||a-b;','const byLowestHp=(a,b)=>battle.fighters[a].hp-battle.fighters[b].hp||battle.fighters[a].id.localeCompare(battle.fighters[b].id);');
 return src;
};
const research=function research(C,A,N,H,S,B,D,E,seedCount=16,config={}){
 const ids=["ren","art","nada","liora","sava"];
 const squads=[["ren","art","nada"],["ren","liora","nada"],["art","nada","sava"],["liora","nada","sava"],["ren","art","sava"],["b14-striker","art","nada"],["b14-striker","liora","sava"],["ren","nada"],["b14-striker","nada"],["ren","art","nada","liora","sava"],["b14-striker","b14-medic","b14-breaker"],["art","b14-striker","b14-breaker"],["liora","b14-striker","b14-medic","sava"],["b14-striker","b14-medic","b14-breaker","art","sava"]];
 const hero=(id,progress={level:2,stars:1})=>{const source=id==="b14-striker"?"ren":id==="b14-medic"?"nada":id==="b14-breaker"?"art":id;return {...B.apply({id:source,name:id,side:"ally",tags:id.startsWith("b14-")?[]:["gardens-over-abyss"],skillLevels:{basic:1,special:1,powerful:1,passive:1,...(source==="liora"?{leader:1}:{})}},progress,H[source],S),id};};
 if(D.get(hero("art"),"leader")!==null||D.get(hero("sava"),"leader")!==null)throw Error("owner leader rule");
 const guard="npc-pass-guard",rush="npc-trail-interceptor",medic="npc-field-medic",slinger="npc-ridge-slinger";
 const scenarios={mixed:[guard,rush,medic],rush:[rush,rush,slinger],hold:[rush,slinger,guard],priority:[guard,rush,medic]};
 const npc=(id,i,scale,focus)=>{const n=N.spawn(id,{instanceId:"b14-"+i});return {...n,hp:Math.round(n.hp*scale),protection:Math.round(n.protection*scale),maxProtection:Math.round(n.protection*scale),physicalAttack:Math.round(n.physicalAttack*scale),atk:Math.round(n.physicalAttack*scale),assaultFocus:focus};};
 const living=(b,side)=>b.fighters.flatMap((f,i)=>f.side===side&&f.hp>0?[i]:[]);
 const byPool=(b,i,j)=>b.fighters[i].hp+(b.fighters[i].protection||0)-b.fighters[j].hp-(b.fighters[j].protection||0)||b.fighters[i].id.localeCompare(b.fighters[j].id);
 function plan(b,policy){
   const ai=b.currentActor,actor=b.fighters[ai],enemy=living(b,"enemy"),allies=living(b,"ally");
   const focus=enemy.find(i=>b.fighters[i].id===b.tacticalObjective?.priorityEnemyId);
   const protectedIndex=allies.find(i=>b.fighters[i].id===b.tacticalObjective?.protectAllyId);
   const target=enemy.slice().sort((i,j)=>byPool(b,i,j))[0];
   const threat=enemy.find(i=>b.fighters[i].b14Prepared);
   const pick=(abilityId,targetIndex)=>({abilityId,targetIndex});
   if(policy==="basic")return pick("basic",target);
   const auto=A.chooseAction(b);
   if(policy==="auto")return auto;
   if(policy==="role"||policy==="candidate"){
     const others=allies.filter(i=>i!==ai), ready=id=>C.abilityReady(b,id);
     const weak=others.slice().sort((i,j)=>byPool(b,i,j))[0];
     if(actor.id==="b14-breaker"&&threat!==undefined&&ready("special")&&(focus===undefined||focus===threat))return pick("special",threat);
     if(actor.id==="b14-medic"&&ready("special")&&allies.some(i=>b.fighters[i].hp/b.fighters[i].maxHp<.65))return pick("special",allies.slice().sort((i,j)=>b.fighters[i].hp/b.fighters[i].maxHp-b.fighters[j].hp/b.fighters[j].maxHp)[0]);
     if(actor.id==="art"&&config.telegraph&&threat!==undefined&&ready("powerful")&&(focus===undefined||focus===threat))return pick("powerful",threat);
     if(actor.id==="art"&&ready("special")&&others.length){
       const warned=others.find(i=>b.fighters[i].id===b.fighters[threat]?.b14Prepared);
       const t=warned??(protectedIndex!==undefined&&protectedIndex!==ai?protectedIndex:weak);
       if(!b.fighters[t].insurance&&b.fighters[t].guardHits===0&&b.fighters[t].protection<b.fighters[t].maxProtection*.45&&b.fighters[t].hp/b.fighters[t].maxHp>.12)return pick("special",t);
     }
     if(actor.id==="sava"&&policy==="role"&&ready("powerful")&&others.length>=2&&!b.coordinatedWindow)return pick("powerful",ai);
     if(actor.id==="sava"&&ready("special")){
       const t=others.filter(i=>b.fighters[i].meter>=(config.hybrid?200:500)&&b.fighters[i].meter<850).sort((i,j)=>b.fighters[j].physicalAttack-b.fighters[i].physicalAttack||b.fighters[j].meter-b.fighters[i].meter)[0];
       if(t!==undefined)return pick("special",t);
     }
     if(actor.id==="nada"&&ready("special")&&(CombatStatusCore.read(b.fighters[focus??threat??target],"read-move")?.stacks??0)<2)return pick("special",focus??threat??target);
     if(actor.id==="liora"&&policy==="role"&&protectedIndex!==undefined&&ready("special")&&actor.hp/actor.maxHp>.55)return pick("special",ai);
   }
   if(focus!==undefined){
     const def=D.get(actor,auto.abilityId);
     if(def.target==="all-enemies")return pick("basic",focus);
     if(def.target==="enemy")return pick(auto.abilityId,focus);
   }
   return auto;
 }
 const events=["field-signal-used","coordinated-attack","coordinated-defense"];
 function run(squad,scenario,policy,seed,opts={}){
   const order=opts.leader&&squad.includes("liora")?["liora",...squad.filter(id=>id!=="liora")]:squad;
   const party=order.map(id=>hero(id,opts.progress));
   let enemies=scenarios[scenario].map((id,i)=>npc(id,i,opts.scale??.72,scenario==="hold"));
   if(opts.reverse)enemies.reverse();
   const tactic=scenario==="hold"?{kind:"hold-or-defeat",protectAllyId:"nada",allyActionsToHold:8}:scenario==="priority"?{kind:"priority-first",priorityEnemyId:"b14-2"}:undefined;
   const waves=opts.waves?[[npc(guard,3,.65,false),npc(rush,4,.65,false)]]:[];
   const b=C.createBattle([...party,...enemies],waves,{leaderId:opts.leader&&squad.includes("liora")?"liora":null,rngSeed:seed,hitChecks:true,critChecks:true,penetrationChecks:true,statusChecks:true,...(tactic?{tacticalObjective:tactic}:{})});
   C.advanceToPlayerTurn(b);
   const usage={},eventCounts={};let commands=0,opportunities=0;
   while(b.active&&commands<120){
     const actor=b.fighters[b.currentActor],p=plan(b,policy);if(b.fighters.some(f=>f.hp>0&&f.b14Prepared))opportunities++;
     const priority=b.fighters.findIndex(f=>f.hp>0&&f.id===b.tacticalObjective?.priorityEnemyId);
     const foe=priority>=0?priority:living(b,"enemy").sort((i,j)=>byPool(b,i,j))[0];
     if(foe!==undefined)C.chooseEnemy(b,foe);
     if(!actor||!p||!C.abilityReady(b,p.abilityId))throw Error("invalid plan "+JSON.stringify({squad,scenario,policy,seed,p}));
     const kind=D.get(actor,p.abilityId).kind;
     if(!C.performActorAbility(b,p.abilityId,p.targetIndex))throw Error("rejected "+JSON.stringify({squad,scenario,policy,seed,p,actor:actor.id,kind}));
     for(const f of b.fighters){if(!Number.isFinite(f.hp)||f.hp<0||f.hp>f.maxHp||!Number.isFinite(f.protection)||f.protection<0||f.protection>f.maxProtection||!Number.isFinite(f.meter)||f.meter<0)throw Error("bad fighter "+JSON.stringify(f));}if(b.events.some(e=>e.type==="damage"&&!Number.isFinite(e.amount)))throw Error("bad damage");
     commands++;usage[kind]=(usage[kind]||0)+1;
     for(const e of b.events)eventCounts[e.type]=(eventCounts[e.type]||0)+1;
   }
   const ally=b.fighters.filter(f=>f.side==="ally"),max=party.reduce((v,f)=>v+f.hp+f.protection,0);
   const hp=ally.reduce((v,f)=>v+f.hp+(f.protection||0),0)/max;
   return {opportunities,counts:b.b14Counts??{},win:b.winner==="ally",end:!b.active,quality:b.winner==="ally"&&ally.every(f=>f.hp>0),hp,commands,usage,eventCounts,outcome:b.tacticalOutcome};
 }
 const seeds=Array.from({length:seedCount},(_,i)=>Math.imul(i+5987,0x9e3779b1)>>>0);
 const mean=(rows,key)=>+(rows.reduce((v,x)=>v+x[key],0)/rows.length).toFixed(3);
 const summarize=rows=>({n:rows.length,wins:rows.filter(x=>x.win).length,quality:rows.filter(x=>x.quality).length,ended:rows.filter(x=>x.end).length,hp:mean(rows,"hp"),actions:mean(rows,"commands"),opportunities:mean(rows,"opportunities"),counts:rows.reduce((v,x)=>{for(const [k,n] of Object.entries(x.counts))v[k]=(v[k]||0)+n;return v;},{}),usage:rows.reduce((v,x)=>{for(const [k,n] of Object.entries(x.usage))v[k]=(v[k]||0)+n;return v;},{}),outcomes:rows.reduce((v,x)=>{const k=x.outcome||"none";v[k]=(v[k]||0)+1;return v;},{})});
 const rows=[];
 for(const squad of squads)for(const scenario of ["rush","mixed","hold","priority"]){
   if(scenario==="hold"&&!squad.includes("nada"))continue;
   const scale=scenario==="rush"?.90:.72;
   rows.push({squad:squad.join("+"),scenario,scale,...summarize(seeds.map(seed=>run(squad,scenario,"candidate",seed,{scale})))});
 }
 const stress=[];
 if(config.label==="full")for(const squad of squads.filter(s=>s.length>=3))for(const mode of ["reverse","gear-leader","waves"]){
   const options=mode==="reverse"?{reverse:true,scale:.90}:mode==="gear-leader"?{scale:.90,leader:true,progress:{level:5,stars:3,gearStats:{hp:10,physicalAttack:3}}}:{scale:.65,waves:true,leader:true};
   stress.push({squad:squad.join("+"),mode,...summarize(seeds.map(seed=>run(squad,"rush","candidate",seed,options)))});
 }
 return {config,seedCount,seeds,rows,stress,totalBattles:(rows.length+stress.length)*seedCount};
};
const configs=[{"label":"reference","art":"recover","meter":100,"damage":0.55,"shared":12},{"label":"hybrid","art":"recover","meter":0,"damage":0.55,"shared":12,"hybrid":0.8},{"label":"telegraph","art":"recover","meter":100,"damage":0.55,"shared":12,"telegraph":true},{"label":"react","art":"recover","meter":100,"damage":0.55,"shared":12,"telegraph":true,"react":true},{"label":"full","art":"recover","meter":0,"damage":0.55,"shared":12,"telegraph":true,"react":true,"hybrid":0.8,"stable":true}];
const count=Number(process.argv[2]||16);if(!Number.isSafeInteger(count)||count<1||count>100)throw Error("count");
console.log(JSON.stringify(configs.map(c=>vm.runInNewContext(extra(basePatch(source,c),c)+"\n("+research.toString()+")(CombatCore,AutoDecision,NpcEnemyData,HeroStatsProfiles,HeroStatsCore,HeroStatsCombatBridge,AbilityData,EnemyDecision,"+count+","+JSON.stringify(c)+")")),null,2));
