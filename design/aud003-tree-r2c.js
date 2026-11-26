/* R2/C1 — offline native combat comparison, no live save. */
const TreeR2C=(()=>{
"use strict";
const heroes=["ren","art","nada","liora","sava"].map(id=>({id,side:"ally"}));
const builds={base:null,guardian:"art-intercept",commander:"art-reserve"};
const seeds={development:[11,29,53,71,97,131],heldout:[2017,2029,2053,2071,2097,2131]};
const policies=["rush","reactive","protect"];
const profiles={starter:{art:1,ren:1,nada:1,skill:1},pilot:{art:3,ren:1,nada:1,skill:2},team6:{art:6,ren:6,nada:6,skill:2}};
const p=ProgressV3Core.toRuntime(ProgressV3Core.fresh(heroes,0),heroes);
if(!HeroCollectionCore.owned(p,"nada"))StarCore.directGrant(p,"nada");
const ops=[
 {id:"escort4",squad:["ren","art","nada"],...TreeR1.MISSIONS.operation1,level:4},
 {id:"escort20",squad:["ren","art","nada"],...TreeR1.MISSIONS.operation1,level:20},
 {id:"waves8",squad:["ren","art","nada"],...TreeR1.MISSIONS.operation2,level:8},
 {id:"support8",squad:["ren","art","nada"],...TreeR1.MISSIONS.operation3,level:8},
 {id:"duo8",squad:["ren","art"],enemies:["npc-trail-interceptor","npc-ridge-slinger"],level:8,objective:{kind:"protect-and-defeat",protectAllyId:"ren"}},
 {id:"duo20",squad:["ren","art"],enemies:["npc-trail-interceptor","npc-ridge-slinger"],level:20,objective:{kind:"protect-and-defeat",protectAllyId:"ren"}}
];
function fighter(id,profile){
 const gear=ProgressCore.gearBonuses(p,id),q=profiles[profile];
 return HeroStatsCombatBridge.apply({id,name:id,side:"ally",skillLevels:Object.fromEntries(["basic","special","powerful","passive"].map(k=>[k,k==="special"&&(profile==="team6"||id==="art")?q.skill:1]))},{level:q[id],stars:StarCore.rankOf(p,id),gearPercent:{hp:gear.hp,atk:gear.atk},gearStats:gear.stats??{}},HeroStatsProfiles[id],HeroStatsCore);
}
function make(spec,profile,build,seed){
 const spawn=(list,w)=>list.map((id,i)=>NpcEnemyData.spawn(id,{instanceId:"w"+w+"-"+i,level:spec.level,skillLevel:1}));
 return CombatCore.createBattle([...spec.squad.map(id=>fighter(id,profile)),...spawn(spec.enemies,1)],(spec.waves??[]).map((w,i)=>spawn(w,i+2)),{combat2:true,treeR1:true,hitChecks:true,critChecks:true,rngSeed:seed,...(builds[build]?{trustPersonal:[builds[build]]}:{}),...(spec.objective?{tacticalObjective:spec.objective}:{})});
}
const living=(b,side)=>b.fighters.filter(f=>f.side===side&&f.hp>0);
const energy=f=>f.hp+f.protection;
function choose(b,build,policy,c){
 const actor=b.fighters[b.currentActor],enemies=living(b,"enemy"),allies=living(b,"ally").filter(f=>f.id!==actor.id);
 const threatened=f=>enemies.filter(e=>e.combat2Prepared===f.id).length;
 const focus=enemies.slice().sort((x,y)=>(policy==="rush"?0:((y.combat2Prepared?1:0)-(x.combat2Prepared?1:0)))||energy(x)-energy(y)||x.index-y.index)[0];
 const idx=f=>b.fighters.indexOf(f),action=(id,f)=>({id,index:idx(f)}),ready=id=>CombatCore.abilityReady(b,id);
 if(actor.id==="art"&&builds[build]){
  const possible=allies.map(f=>({f,preview:CombatCore.personalPreview(b,builds[build],idx(f))})).filter(x=>x.preview);
  if(possible.length)c.opportunity++;
  if(policy!=="rush")for(const {f,preview} of possible.sort((x,y)=>threatened(y.f)-threatened(x.f)||energy(x.f)-energy(y.f))){
   const threat=threatened(f),missing=f.maxProtection-f.protection;
   const ordinaryRestore=ready("special")?(CombatCore.trustCoverPreview(b,actor,f)?.rows?.[0]?.restored??0):0;
   if(build==="guardian"&&energy(actor)>Math.max(30,actor.maxHp*.45)&&!b.trustIntercept&&(threat>0&&(!f.guardHits||energy(f)<f.maxHp*.65)||policy==="protect"&&energy(f)<f.maxHp*.65&&!f.guardHits)){
    c.used++;return action(builds[build],f);
   }
   if(build==="commander"&&energy(actor)-preview.amount>actor.maxHp*.38&&preview.amount>=Math.max(8,ordinaryRestore+4)&&(threat>0||missing>=f.maxProtection*.5&&policy==="protect"||energy(f)<f.maxHp*.7)){
    c.used++;return action(builds[build],f);
   }
  }
 }
 if(actor.id==="art"&&policy!=="rush"&&ready("special")){
  const t=allies.slice().sort((x,y)=>threatened(y)-threatened(x)||energy(x)-energy(y))[0];
  if(t&&(threatened(t)>0&&!t.guardHits||t.maxProtection-t.protection>=Math.max(10,t.maxProtection*(policy==="protect"?.3:.65))&&energy(t)<t.maxHp+(policy==="protect"?t.maxProtection*.5:0))&&CombatCore.trustCoverPreview(b,actor,t)){
   c.cover++;return action("special",t);
  }
 }
 for(const id of ["powerful","special","basic"]){const a=AbilityData.get(actor,id);if(ready(id)&&a?.kind==="damage"&&["enemy","all-enemies"].includes(a.target)&&focus)return action(id,focus);}
 if(focus&&ready("basic"))return action("basic",focus);
 throw Error("No legal action "+actor.id);
}
function finish(b,spec,adventure){
 const allies=b.fighters.filter(f=>f.side==="ally"),both=["ren","art"].every(id=>allies.some(f=>f.id===id&&f.hp>0)),remainingEnemies=living(b,"enemy").length,noEnemies=remainingEnemies===0;
 const win=!b.active&&b.winner==="ally";
 let eligible=win,bag=null;
 if(adventure){
  eligible=win&&both&&(spec.objective.kind==="protect-and-defeat"?b.tacticalOutcome==="protected-victory"&&noEnemies:
   b.tacticalOutcome==="held"&&b.allyActions>=spec.objective.allyActionsToHold||b.tacticalOutcome==="defeated-attackers"&&noEnemies);
  if(eligible)bag=noEnemies?"recovered":"left";
 }
 return {eligible,bag,win,allAlive:allies.every(f=>f.hp>0),deaths:allies.filter(f=>f.hp<=0).length,
  hp:allies.reduce((n,f)=>n+f.hp,0),protection:allies.reduce((n,f)=>n+f.protection,0),renHp:allies.find(f=>f.id==="ren")?.hp??0,
  artHp:allies.find(f=>f.id==="art")?.hp??0,actions:b.allyActions,outcome:b.tacticalOutcome??null,remainingEnemies};
}
function run(spec,profile,build,policy,seed,adventure=false){
 const b=make(spec,profile,build,seed),c={opportunity:0,used:0,cover:0,redirected:0,redirectHp:0,redirectProtection:0,transferred:0};
 function record(){for(const e of b.events){if(e.type==="trust-intercept-resolved")c.redirected++;if(e.type==="tree-r1-redirect-damage"){c.redirectHp+=e.hpDamage;c.redirectProtection+=e.protectionDamage;}if(e.type==="trust-reserve-transferred")c.transferred+=e.amount;}}
 CombatCore.advanceToPlayerTurn(b);record();
 for(let i=0;b.active&&i<160;i++){const a=choose(b,build,policy,c);if(!CombatCore.performActorAbility(b,a.id,a.index))throw Error("Rejected "+JSON.stringify({id:spec.id,profile,build,policy,seed,a,actor:b.fighters[b.currentActor]?.id}));record();}
 if(b.active)throw Error("Exceeded action budget "+spec.id);
 const out={id:spec.id,profile,build,policy,seed,...finish(b,spec,adventure),...c};
 if(out.redirected>out.used||out.used>out.opportunity)throw Error("Event accounting "+JSON.stringify(out));
 return out;
}
function matrix(){
 const rows=[],routes=[];
 for(const [split,ss] of Object.entries(seeds))for(const seed of ss){
  for(const spec of ops)for(const profile of Object.keys(profiles))for(const policy of policies)for(const build of Object.keys(builds))rows.push({split,...run(spec,profile,build,policy,seed)});
  for(const profile of Object.keys(profiles))for(const policy of policies){
   const common={squad:["ren","art"],enemies:["npc-trail-interceptor","npc-ridge-slinger"],level:1};
   routes.push({split,...run({...common,id:"direct",objective:{kind:"protect-and-defeat",protectAllyId:"ren"}},profile,"base",policy,seed,true)});
   for(const n of [4,6,8,10])routes.push({split,...run({...common,id:"hold"+n,objective:{kind:"hold-or-defeat",protectAllyId:"ren",allyActionsToHold:n}},profile,"base",policy,seed,true)});
  }
 }
 return {rows,routes};
}
function aggregate(rows,keys){
 const groups=new Map();
 for(const x of rows){const key=keys.map(k=>x[k]).join("|");if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x);}
 return [...groups].map(([key,a])=>{const avg=k=>Math.round(a.reduce((n,x)=>n+Number(x[k]),0)/a.length*100)/100;return {key,n:a.length,success:avg("eligible"),allAlive:avg("allAlive"),deaths:avg("deaths"),hp:avg("hp"),protection:avg("protection"),renHp:avg("renHp"),artHp:avg("artHp"),actions:avg("actions"),available:avg("opportunity"),used:avg("used"),redirected:avg("redirected"),redirectHp:avg("redirectHp"),transferred:avg("transferred"),recovered:a.filter(x=>x.bag==="recovered").length,left:a.filter(x=>x.bag==="left").length};});
}
function verify(rows,routes){
 const rush=rows.filter(x=>x.policy==="rush"),signature=x=>JSON.stringify([x.win,x.actions,x.hp,x.protection,x.deaths,x.renHp,x.artHp]);
 let mismatch=0;for(let i=0;i<rush.length;i+=3)if(!rush.slice(i,i+3).every(x=>signature(x)===signature(rush[i])))mismatch++;
 if(rows.length!==1944||routes.length!==540||mismatch||!rows.some(x=>x.redirected>0)||!rows.some(x=>x.transferred>0)||!routes.some(x=>x.eligible&&x.cover===0)||!routes.every(x=>x.used===0&&x.transferred===0&&x.redirected===0&&(!x.eligible||x.allAlive)&&(x.bag!=="recovered"||x.remainingEnemies===0)&&(x.bag!=="left"||x.outcome==="held"&&x.remainingEnemies>0)))throw Error("matrix invariant");
 return mismatch;
}
return {matrix,run,finish,aggregate,verify,ops,profiles,seeds,policies};
})();
