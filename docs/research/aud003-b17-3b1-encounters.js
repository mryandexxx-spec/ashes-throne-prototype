"use strict";
// B17.3B1: research only. Reads actual game hero progression and native combat;
// no simulation-specific combat rules, reward or state mutation during combat.
const files=["initiative-model.js","ability-data.js","battle-rng.js","combat-status-core.js","combat-core.js","auto-decision.js","enemy-decision.js","npc-enemy-data.js","gear-data.js","hero-stats-core.js","hero-stats-profiles.js","hero-stats-combat-bridge.js","progress-core.js","skill-core.js","star-core.js","progress-v3-core.js","main-campaign-core.js"];
function build(source,game){
 const extract=(start,end)=>{const a=game.indexOf(start),b=game.indexOf(end,a+1);if(a<0||b<=a)throw Error("missing "+start);return game.slice(a,b);};
 const heroes=extract("const HEROES = [","// NPCDATA001:"),progressed=extract("function progressedHero(","function progressedEnemy(");
 return new Function(source+"\n"+heroes+"\nconst ALLIES=HEROES.filter(h=>h.side==='ally');let progress;\n"+progressed+`
const C=CombatCore,D=AbilityData,A=AutoDecision,N=NpcEnemyData,T=CombatStatusCore;
function party(level=2,kit=false){
 progress=ProgressV3Core.toRuntime(ProgressV3Core.fresh(ALLIES,100),ALLIES);
 progress.levels.ren=level;
 if(kit){progress.currency=100000;for(const m of GearData.MATERIALS)progress.materials[m]=100000;for(const id of ["ren","art"])for(const slot of GearData.SLOTS){const item=ProgressCore.itemOffer(progress,id,slot.id)[0];if(!item||!ProgressCore.equipItem(progress,id,item.id))throw Error("gear");}}
 return ["ren","art"].map(id=>progressedHero(ALLIES.find(h=>h.id===id)));
}
const G="npc-pass-guard",I="npc-trail-interceptor",R="npc-ridge-slinger",M="npc-field-medic",S="npc-route-signaller";
const candidates=[
 ["actual",[]],["trained-duo",[G,I]],["crossfire",[G,R]],["two-threats",[I,R]],
 ["support",[G,I,M]],["signal",[G,I,S]],["ambush",[I,R,G]],
 ["duo-weakguard",[G,I],[{hp:82,protection:15,physicalAttack:14}]],
 ["duo-fastguard",[G,I],[{hp:82,protection:15,physicalAttack:14,speed:155}]],["medic-light",[M,I]],
 // Second screening: retain the original two archetypes and their abilities.
 // Fixed authored instance parameters, not adaptive player scaling.
 ["duo-light",[G,I],[{hp:82,protection:15,physicalAttack:14},{hp:80,protection:12,physicalAttack:28}]],
 ["duo-striker",[G,I],[{hp:82,protection:15,physicalAttack:14},{hp:80,protection:12,physicalAttack:34}]],
 ["duo-armored",[G,I],[{hp:82,protection:15,physicalAttack:14},{hp:75,protection:20,physicalAttack:34}]],
 ["duo-early-threat",[G,I],[{hp:82,protection:15,physicalAttack:14},{hp:75,protection:10,physicalAttack:29,speed:160}]]
];
function enemies(id,archetypes,overrides=[]){
 if(id==="actual")return MainCampaignCore.enemiesFor(MainCampaignCore.II_ID,N);
 return archetypes.map((a,i)=>{const npc=N.spawn(a,{instanceId:"research-"+i}),o=overrides[i]||{};return {...npc,...o,maxProtection:o.protection??npc.maxProtection,atk:o.physicalAttack??npc.physicalAttack};});
}
function choose(b,policy){
 const a=b.fighters[b.currentActor],en=b.fighters.filter(f=>f.side==="enemy"&&f.hp>0).sort((a,z)=>a.hp+a.protection-z.hp-z.protection),target=en[0];
 const pick=(abilityId,f)=>({abilityId,targetIndex:b.fighters.indexOf(f)});
 const ready=id=>C.abilityReady(b,id);
 if(policy==="basic")return pick("basic",target);
 if(policy==="native")return A.chooseAction(b);
 if(policy==="damage")return pick(ready("powerful")?"powerful":a.id==="ren"&&ready("special")?"special":"basic",target);
 const threat=en.find(f=>f.combat2Prepared),ally=b.fighters.find(f=>f.side==="ally"&&f.hp>0&&f.id!==a.id);
 if(a.id==="art"){
  if(threat&&ready("powerful"))return pick("powerful",threat);
  if(policy==="cover"&&ally&&ready("special")&&threat?.combat2Prepared===ally.id&&!ally.guardHits)return pick("special",ally);
  if(policy==="cover"&&ally&&ready("special")&&ally.maxProtection-ally.protection>=Math.round(a.physicalAttack*.65)&&!ally.guardHits)return pick("special",ally);
  return pick(ready("powerful")?"powerful":"basic",target);
 }
 const focus=policy==="priority"?(en.find(f=>f.archetypeId===M)??threat??target):target;
 return pick(ready("powerful")?"powerful":ready("special")?"special":"basic",focus);
}
function create(candidate,seed,level=2,kit=false){
 const b=C.createBattle([...party(level,kit),...enemies(...candidate)],[],{combat2:true,leaderId:null,rngSeed:seed,hitChecks:true,critChecks:true,penetrationChecks:true,statusChecks:true});
 C.advanceToPlayerTurn(b);return b;
}
function terminal(b,policy){
 let threats=0,cancels=0,reacts=0,restores=0,actions=0,opportunities=0;
 while(b.active&&actions++<160){
  const actor=b.fighters[b.currentActor];
  if(actor.id==="art"&&C.abilityReady(b,"powerful")&&C.abilityReady(b,"special")&&b.fighters.some(f=>f.side==="enemy"&&f.hp>0&&f.combat2Prepared==="ren"))opportunities++;
  const cmd=choose(b,policy);if(!C.performActorAbility(b,cmd.abilityId,cmd.targetIndex,cmd.helperIndex))throw Error("illegal");
  for(const e of b.events){if(e.type==="combat2-threat-prepared")threats++;if(e.type==="combat2-threat-cancelled")cancels++;if(e.type==="combat2-cover")reacts++;if(e.type==="combat2-protection")restores+=e.amount;}
 }
 if(b.active)throw Error("not terminal");const al=b.fighters.filter(f=>f.side==="ally");return {w:b.winner==="ally",stars:MainCampaignCore.score(b),actions:b.allyActions,hp:al.reduce((n,f)=>n+f.hp,0),dead:al.filter(f=>f.hp===0).length,threats,cancels,reacts,restores,opportunities};
}
function simulate(candidate,seed,policy,level=2,kit=false){return terminal(create(candidate,seed,level,kit),policy);}
function branch(candidate,seed){
 const b=create(candidate,seed);let n=0;
 while(b.active&&n++<160){
  const actor=b.fighters[b.currentActor],threat=b.fighters.findIndex(f=>f.side==="enemy"&&f.hp>0&&f.combat2Prepared==="ren"),ren=b.fighters.findIndex(f=>f.id==="ren"&&f.hp>0);
  if(actor.id==="art"&&threat>=0&&ren>=0&&C.abilityReady(b,"special")&&C.abilityReady(b,"powerful")){
   const variants={};for(const [id,target] of [["basic",threat],["special",ren],["powerful",threat]]){
    const clone=JSON.parse(JSON.stringify(b));if(!C.performActorAbility(clone,id,target))throw Error("illegal branch");
    const events=clone.events.map(e=>e.type),foe=clone.fighters[threat],ally=clone.fighters[ren];
    variants[id]={now:{renHp:ally.hp,renProtection:ally.protection,guard:ally.guardHits,enemyHp:foe.hp,prepared:foe.combat2Prepared??null,events},end:terminal(clone,"native")};
   }
   return {at:b.allyActions,variants};
  }
  const cmd=choose(b,"native");if(!C.performActorAbility(b,cmd.abilityId,cmd.targetIndex,cmd.helperIndex))throw Error("branch path illegal");
 }
 return null;
}
return {candidates,simulate,party,branch,enemies};`)();
}
const policies=["basic","damage","native","cover","priority"];
function aggregate(a){
 const sum=k=>a.reduce((n,x)=>n+x[k],0);
 return {n:a.length,wins:sum("w"),three:a.filter(x=>x.stars===3).length,meanActions:+(sum("actions")/a.length).toFixed(2),meanHp:+(sum("hp")/a.length).toFixed(2),dead:sum("dead"),threats:sum("threats"),cancels:sum("cancels"),reacts:sum("reacts"),restored:sum("restores"),opportunities:sum("opportunities")};
}
function run(api,{start=1001,count=64,ids=api.candidates.map(c=>c[0]),level=2,kit=false,selectedPolicies=policies}={}){
 return ids.map(id=>{const c=api.candidates.find(x=>x[0]===id);if(!c)throw Error("unknown "+id);return {id,stats:Object.fromEntries(selectedPolicies.map(p=>[p,aggregate(Array.from({length:count},(_,i)=>api.simulate(c,start+i,p,level,kit)))]))};});
}
function branches(api,id,start=7001,count=64){
 const c=api.candidates.find(x=>x[0]===id);const a=Array.from({length:count},(_,i)=>api.branch(c,start+i)).filter(Boolean);
 return {id,seeds:count,eligible:a.length,choices:Object.fromEntries(["basic","special","powerful"].map(k=>[k,a.length?aggregate(a.map(x=>x.variants[k].end)):null])),examples:a.slice(0,2)};
}
if(typeof module!=="undefined")module.exports={files,build,run,branches};
if(typeof require!=="undefined"&&require.main===module){
 const fs=require("node:fs"),path=require("node:path"),root=path.resolve(__dirname,"../..");
 const read=f=>fs.readFileSync(path.join(root,f),"utf8"),api=build(files.map(read).join("\n"),read("game.js"));
 const ids=["actual","duo-light","duo-striker","duo-armored","duo-early-threat","two-threats"];
 console.log(JSON.stringify({screen:run(api),holdout:run(api,{start:7001,ids}),branches:ids.map(id=>branches(api,id)),progression:run(api,{start:7001,ids,level:3,kit:true,selectedPolicies:["basic","native","cover"]})},null,2));
}
