/* AUD003-B14.1 research only: actual main CombatCore, synthetic fixtures. Run from repository root: node docs/research/aud003-b14-real-core.js [seedCount]. */
const fs=require("node:fs"),vm=require("node:vm");
const files=["initiative-model.js","combat-status-core.js","ability-data.js","battle-rng.js","combat-core.js","auto-decision.js","enemy-decision.js","npc-enemy-data.js","hero-stats-core.js","hero-stats-profiles.js","star-core.js","hero-stats-combat-bridge.js"];
const src=files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
const count=Number(process.argv[2]||8);if(!Number.isSafeInteger(count)||count<1||count>200)throw Error("seedCount 1..200");
const research=function research(C,A,N,H,S,B,D,E,seedCount=8){
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
   if(policy==="role"){
     const others=allies.filter(i=>i!==ai), ready=id=>C.abilityReady(b,id);
     const weak=others.slice().sort((i,j)=>byPool(b,i,j))[0];
     if(actor.id==="art"&&ready("special")&&others.length){
       const t=protectedIndex!==undefined&&protectedIndex!==ai?protectedIndex:weak;
       if(!b.fighters[t].insurance&&(protectedIndex===t||b.fighters[t].hp/b.fighters[t].maxHp<.75))return pick("special",t);
     }
     if(actor.id==="sava"&&ready("powerful")&&others.length>=2&&!b.coordinatedWindow)return pick("powerful",ai);
     if(actor.id==="sava"&&ready("special")){
       const t=others.filter(i=>b.fighters[i].meter>=500&&b.fighters[i].meter<850).sort((i,j)=>b.fighters[j].meter-b.fighters[i].meter)[0];
       if(t!==undefined)return pick("special",t);
     }
     if(actor.id==="nada"&&ready("special"))return pick("special",focus??target);
     if(actor.id==="liora"&&protectedIndex!==undefined&&ready("special")&&actor.hp/actor.maxHp>.55)return pick("special",ai);
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
 const seeds=Array.from({length:seedCount},(_,i)=>Math.imul(i+183,0x9e3779b1)>>>0);
 const mean=(rows,key)=>+(rows.reduce((v,x)=>v+x[key],0)/rows.length).toFixed(3);
 const summarize=rows=>({n:rows.length,wins:rows.filter(x=>x.win).length,quality:rows.filter(x=>x.quality).length,ended:rows.filter(x=>x.end).length,hp:mean(rows,"hp"),actions:mean(rows,"commands"),usage:rows.reduce((v,x)=>{for(const [k,n] of Object.entries(x.usage))v[k]=(v[k]||0)+n;return v;},{}),outcomes:rows.reduce((v,x)=>{const k=x.outcome||"none";v[k]=(v[k]||0)+1;return v;},{})});
 const rows=[];
 for(const squad of squads)for(const scenario of Object.keys(scenarios)){
   if(scenario==="hold"&&!squad.includes("nada"))continue;
   for(const policy of ["basic","auto","objective","role"])rows.push({squad:squad.join("+"),scenario,policy,...summarize(seeds.map(seed=>run(squad,scenario,policy,seed)))});
 }
 const fairness=[];
 for(const squad of squads)for(const scenario of ["mixed","rush"]){
   const a=seeds.map(seed=>run(squad,scenario,"role",seed)),b=seeds.map(seed=>run(squad,scenario,"role",seed,{reverse:true}));
   fairness.push({squad:squad.join("+"),scenario,winA:a.filter(x=>x.win).length,winB:b.filter(x=>x.win).length,changed:seeds.filter((_,i)=>a[i].win!==b[i].win).length,hpA:mean(a,"hp"),hpB:mean(b,"hp")});
 }
 const progression=[];
 for(const id of ids){const a=hero(id,{level:2,stars:1}),b=hero(id,{level:5,stars:3,gearStats:{hp:10,physicalAttack:3}});if(a.speed!==b.speed||b.hp<=a.hp||b.physicalAttack<=a.physicalAttack)throw Error("progression invariant "+id);progression.push({id,base:[a.hp,a.physicalAttack,a.speed,a.protection],stress:[b.hp,b.physicalAttack,b.speed,b.protection]});}
 const stress=[];
 for(const scenario of ["mixed","rush","hold","priority"]){const squad=squads[0];stress.push({scenario,base:summarize(seeds.map(seed=>run(squad,scenario,"role",seed))),progress:summarize(seeds.map(seed=>run(squad,scenario,"role",seed,{progress:{level:5,stars:3,gearStats:{hp:10,physicalAttack:3}}})))});}
 return {seedCount,seeds,rows,fairness,progression,stress,totalBattles:rows.length*seedCount+fairness.length*2*seedCount+stress.length*2*seedCount};
};
const output=vm.runInNewContext(src+"\n("+research.toString()+")(CombatCore,AutoDecision,NpcEnemyData,HeroStatsProfiles,HeroStatsCore,HeroStatsCombatBridge,AbilityData,EnemyDecision,"+count+")");
console.log(JSON.stringify(output,null,2));
