/* B14.3 experimental in-memory patch of actual CombatCore; NOT production. */
const fs=require("node:fs"),vm=require("node:vm");
const files=["initiative-model.js","combat-status-core.js","ability-data.js","battle-rng.js","combat-core.js","auto-decision.js","enemy-decision.js","npc-enemy-data.js","hero-stats-core.js","hero-stats-profiles.js","star-core.js","hero-stats-combat-bridge.js"];
const source=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
const patch=function patch(src,variant){
 const replace=(a,b)=>{if(src.split(a).length!==2)throw Error("anchor "+a);src=src.replace(a,b)};
 if(variant.includes("art")){
 replace('target.insurance={ownerId:actor.id,percent:ability.insurancePercent,','target.guardHits=Math.max(target.guardHits,2);\n      target.protection=Math.min(target.maxProtection,target.protection+Math.round(actor.physicalAttack*.85));\n      target.insurance={ownerId:actor.id,percent:ability.insurancePercent,');
 // keep redirect unchanged? remove insurance for variant: guard + protection only, not also transfer.
 replace('remaining:ability.insuranceTurns,afterMeter:ability.afterInterceptMeter??0};','remaining:ability.insuranceTurns,afterMeter:ability.afterInterceptMeter??0};\n      delete target.insurance;');
 }
 if(variant.includes("swap")){
 replace('target.meter=Math.min(1000,target.meter+ability.signalMeter);','actor.b14Swap=Math.max(0,Math.min(1000,target.meter));\n      target.meter=Math.max(target.meter,actor.meter);');
 replace('if(actor.side!=="ally")return;\n    if(actor.id==="sava"','if(actor.side!=="ally")return;\n    if(actor.b14Swap!==undefined){actor.meter+=actor.b14Swap;delete actor.b14Swap;}\n    if(actor.id==="sava"');
 }
 if(variant.includes("assist")){
 replace('target.meter=Math.min(1000,target.meter+ability.signalMeter);',`target.meter=Math.min(1000,target.meter+ability.signalMeter);
      const foe=battle.fighters[battle.selectedEnemy];
      if(foe&&foe.side==="enemy"&&foe.hp>0&&rollToHit(battle,target,foe,"physical")){
        const oldHp=foe.hp,oldProtection=foe.protection;
        const raw=Math.round(effectiveStat(battle,target,"physicalAttack")*.85);
        const amount=dealDamage(target,foe,rollCriticalDamage(battle,target,raw,"physical"),false,"physical",penetrationEnabled(battle,"physical")?target.defensePenetration:0,battle,false);
        emit(battle,"damage",{actorId:target.id,targetId:foe.id,amount,remainingHp:foe.hp,...typedDamageFields(foe,"physical",oldHp,oldProtection)});
        if(foe.hp===0)emit(battle,"death",{targetId:foe.id});
      }`);
 }
 return src;
};
const research=function research(C,A,N,H,S,B,D,E,seedCount=16,variant="base"){
 const ids=["ren","art","nada","liora","sava"];
 const squads=[["ren","art","nada"],["ren","liora","nada"],["art","nada","sava"],["liora","nada","sava"],["ren","art","sava"]];
 const hero=(id,progress={level:2,stars:1})=>B.apply({id,name:id,side:"ally",tags:["gardens-over-abyss"],skillLevels:{basic:1,special:1,powerful:1,passive:1,leader:1}},progress,H[id],S);
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
   const pick=(abilityId,targetIndex)=>({abilityId,targetIndex});
   if(policy==="basic")return pick("basic",target);
   const auto=A.chooseAction(b);
   if(policy==="auto")return auto;
   if(policy==="role"||policy==="candidate"){
     const others=allies.filter(i=>i!==ai), ready=id=>C.abilityReady(b,id);
     const weak=others.slice().sort((i,j)=>byPool(b,i,j))[0];
     if(actor.id==="art"&&ready("special")&&others.length){
       const t=protectedIndex!==undefined&&protectedIndex!==ai?protectedIndex:weak;
       if(policy==="candidate"&&variant.includes("art") ? (b.fighters[t].guardHits===0&&b.fighters[t].protection<b.fighters[t].maxProtection*.45&&b.fighters[t].hp/b.fighters[t].maxHp>.12) : (!b.fighters[t].insurance&&(protectedIndex===t||b.fighters[t].hp/b.fighters[t].maxHp<.75)))return pick("special",t);
     }
     if(actor.id==="sava"&&policy==="role"&&ready("powerful")&&others.length>=2&&!b.coordinatedWindow)return pick("powerful",ai);
     if(actor.id==="sava"&&ready("special")){
       const t=others.filter(i=>policy==="candidate"&&variant.includes("swap")?b.fighters[i].meter>=250&&b.fighters[i].meter<900:b.fighters[i].meter>=500&&b.fighters[i].meter<850).sort((i,j)=>b.fighters[j].physicalAttack-b.fighters[i].physicalAttack||b.fighters[j].meter-b.fighters[i].meter)[0];
       if(t!==undefined)return pick("special",t);
     }
     if(actor.id==="nada"&&policy==="role"&&ready("special"))return pick("special",focus??target);
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
   const party=squad.map(id=>hero(id,opts.progress));
   let enemies=scenarios[scenario].map((id,i)=>npc(id,i,opts.scale??.72,scenario==="hold"));
   if(opts.reverse)enemies.reverse();
   const tactic=scenario==="hold"?{kind:"hold-or-defeat",protectAllyId:"nada",allyActionsToHold:8}:scenario==="priority"?{kind:"priority-first",priorityEnemyId:"b14-2"}:undefined;
   const b=C.createBattle([...party,...enemies],[],{leaderId:null,rngSeed:seed,hitChecks:true,critChecks:true,penetrationChecks:true,statusChecks:true,...(tactic?{tacticalObjective:tactic}:{})});
   C.advanceToPlayerTurn(b);
   const usage={},eventCounts={};let commands=0;
   while(b.active&&commands<120){
     const actor=b.fighters[b.currentActor],p=plan(b,policy);
     const priority=b.fighters.findIndex(f=>f.hp>0&&f.id===b.tacticalObjective?.priorityEnemyId);
     const foe=priority>=0?priority:living(b,"enemy").sort((i,j)=>byPool(b,i,j))[0];
     if(foe!==undefined)C.chooseEnemy(b,foe);
     if(!actor||!p||!C.abilityReady(b,p.abilityId))throw Error("invalid plan "+JSON.stringify({squad,scenario,policy,seed,p}));
     const kind=D.get(actor,p.abilityId).kind;
     if(!C.performActorAbility(b,p.abilityId,p.targetIndex))throw Error("rejected "+JSON.stringify({squad,scenario,policy,seed,p,actor:actor.id,kind}));
     commands++;usage[kind]=(usage[kind]||0)+1;
     for(const e of b.events)eventCounts[e.type]=(eventCounts[e.type]||0)+1;
   }
   const ally=b.fighters.filter(f=>f.side==="ally"),max=party.reduce((v,f)=>v+f.hp+f.protection,0);
   const hp=ally.reduce((v,f)=>v+f.hp+(f.protection||0),0)/max;
   return {win:b.winner==="ally",end:!b.active,quality:b.winner==="ally"&&ally.every(f=>f.hp>0),hp,commands,usage,eventCounts,outcome:b.tacticalOutcome};
 }
 const seeds=Array.from({length:seedCount},(_,i)=>Math.imul(i+1781,0x9e3779b1)>>>0);
 const mean=(rows,key)=>+(rows.reduce((v,x)=>v+x[key],0)/rows.length).toFixed(3);
 const summarize=rows=>({n:rows.length,wins:rows.filter(x=>x.win).length,quality:rows.filter(x=>x.quality).length,ended:rows.filter(x=>x.end).length,hp:mean(rows,"hp"),actions:mean(rows,"commands"),usage:rows.reduce((v,x)=>{for(const [k,n] of Object.entries(x.usage))v[k]=(v[k]||0)+n;return v;},{}),outcomes:rows.reduce((v,x)=>{const k=x.outcome||"none";v[k]=(v[k]||0)+1;return v;},{})});
 const rows=[];
 for(const squad of squads)for(const scenario of Object.keys(scenarios)){
   if(scenario==="hold"&&!squad.includes("nada"))continue;
   for(const scale of scenario==="rush"?[.72,.90]:[.72]){
     for(const policy of variant==="base"?["objective","role","candidate"]:["candidate"])rows.push({squad:squad.join("+"),scenario,scale,policy,...summarize(seeds.map(seed=>run(squad,scenario,policy,seed,{scale})))});
   }
 }
 return {variant,seedCount,seeds,rows,totalBattles:rows.length*seedCount};
};
const variants=["base","art","swap","assist","art-swap","art-assist"];
const count=Number(process.argv[2]||16);if(!Number.isSafeInteger(count)||count<1||count>100)throw Error("count");
console.log(JSON.stringify(variants.map(v=>vm.runInNewContext(patch(source,v)+"\n("+research.toString()+")(CombatCore,AutoDecision,NpcEnemyData,HeroStatsProfiles,HeroStatsCore,HeroStatsCombatBridge,AbilityData,EnemyDecision,"+count+","+JSON.stringify(v)+")")),null,2));
