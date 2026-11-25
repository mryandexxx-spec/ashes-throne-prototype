/* AUD003-A [RESEARCH] Reproduce isolated actual-core baseline from repository root.
 * node docs/research/aud003-baseline.js
 * Explicit combat profiles, no SaveCore/browser; R1, skill1, no gear; FP L1 both, campaign Ren L2 Art L1.
 */
const fs=require("node:fs"),vm=require("node:vm");
const files=["initiative-model.js","combat-status-core.js","ability-data.js","battle-rng.js","combat-core.js","auto-decision.js","enemy-decision.js","npc-enemy-data.js","hero-stats-profiles.js"];
const {C,A,N,H}=vm.runInNewContext(files.map(x=>fs.readFileSync(x,"utf8")).join("\n")+"\n({C:CombatCore,A:AutoDecision,N:NpcEnemyData,H:HeroStatsProfiles})");
const hero=(id,l=1)=>{let p=H[id],s=Object.fromEntries(Object.entries(p.combatStats).map(([k,v])=>[k,Math.round(v+(l-1)*(p.growth.level[k]||0))]));return {id,name:id,side:"ally",tags:["gardens-over-abyss"],...s,atk:s.physicalAttack,maxProtection:s.protection,combatProfile:"stats002c",level:l,skillLevels:{basic:1,special:1,powerful:1,passive:1,leader:1}}};
function run(m,policy,seed,choice,solo=false){
 let fp=m===0,party=fp?[hero("art"),hero("ren")]:solo?[hero("art")]:[hero("ren",2),hero("art")];
 if(fp&&choice==="survey")party[0].speed+=30;
 if(fp&&choice==="cover"){party[1].protection+=35;party[1].maxProtection+=35}
 let specs=fp?[[62,8,null],[52,6,null]]:m===1?[[90,15,14],[65,10,19]]:[[82,15,14],[75,10,19]];
 let enemies=specs.map(([hp,protection,atk],i)=>{let n=N.spawn(["npc-pass-guard","npc-trail-interceptor"][i],{instanceId:"npc-audit-"+i});atk=atk??Math.round(n.physicalAttack*.7);return {...n,hp,protection,maxProtection:protection,atk,physicalAttack:atk}});
 let b=C.createBattle([...party,...enemies],[],{leaderId:fp?null:party[0].id,...(fp?{tacticalObjective:{kind:"hold-or-defeat",protectAllyId:"ren",allyActionsToHold:6}}:{}),rngSeed:seed,hitChecks:true,critChecks:true,penetrationChecks:true,statusChecks:true});
 C.advanceToPlayerTurn(b);let used={basic:0,special:0,powerful:0},n=0;
 while(b.active&&n++<120){
  let actor=b.fighters[b.currentActor],a="basic";
  if(policy==="auto"){let plan=A.chooseAction(b);used[plan.abilityId]++;if(!C.performAutoAction(b,plan))throw Error("auto");continue}
  if(policy==="tactical"){if(actor.id==="art"&&C.abilityReady(b,"special")&&b.fighters.some(f=>f.id==="ren"&&f.hp>0))a="special";else if(C.abilityReady(b,"powerful"))a="powerful";else if(actor.id==="ren"&&C.abilityReady(b,"special"))a="special"}
  let mode=C.abilityTargetSide(b,a),living=b.fighters.flatMap((f,i)=>f.hp>0?[i]:[]);
  let target=mode==="enemy"?living.filter(i=>b.fighters[i].side==="enemy").sort((i,j)=>b.fighters[i].hp+b.fighters[i].protection-b.fighters[j].hp-b.fighters[j].protection)[0]:mode==="ally"?living.find(i=>b.fighters[i].id==="ren"):b.currentActor;
  used[a]++;if(!C.performActorAbility(b,a,target))throw Error(JSON.stringify({a,mode,target}))
 }
 let allies=b.fighters.filter(f=>f.side==="ally");return {win:b.winner==="ally",end:!b.active,n:b.allyActions,perfect:b.winner==="ally"&&allies.every(f=>f.hp>0)&&b.allyActions<=10,hp:allies.reduce((s,f)=>s+f.hp+(f.protection||0),0)/party.reduce((s,f)=>s+f.hp+f.protection,0),used}
}
const mean=(a,f)=>+(a.reduce((s,x)=>s+f(x),0)/a.length).toFixed(3);
for(let m of [0,1,2])for(let choice of m===0?["neutral","survey","cover"]:["none"])for(let policy of ["basic","tactical","auto"]){
 let rows=Array.from({length:100},(_,i)=>run(m,policy,Math.imul(i+1,0x9e3779b1)>>>0,choice));
 console.log(JSON.stringify({m,choice,policy,wins:rows.filter(x=>x.win).length,ends:rows.filter(x=>x.end).length,perfect:rows.filter(x=>x.perfect).length,actions:mean(rows,x=>x.n),hp:mean(rows,x=>x.hp),special:mean(rows,x=>x.used.special),powerful:mean(rows,x=>x.used.powerful)}))
}
for(let m of [1,2]){let rows=Array.from({length:100},(_,i)=>run(m,"basic",Math.imul(i+1,0x9e3779b1)>>>0,"none",true));console.log(JSON.stringify({m,solo:"art",wins:rows.filter(x=>x.win).length,ends:rows.filter(x=>x.end).length,actions:mean(rows,x=>x.n)}))}
