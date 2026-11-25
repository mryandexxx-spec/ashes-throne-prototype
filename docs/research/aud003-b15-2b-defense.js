/* B15.2B isolated real-core defense candidate. No production import. */
"use strict";
const CONFIGS={
 ref:{},art:{art:true,react:true},guard:{art:true,react:false},
 liora:{liora:true},both:{art:true,react:true,liora:true},
 "both-noreact":{art:true,react:false,liora:true},
 "both-leader5":{art:true,react:true,liora:true,leader:5},
 "both-leader10":{art:true,react:true,liora:true,leader:10},
 "ref-leader10":{leader:10},
 "both-flex":{art:true,react:true,liora:true,artCap:true},
 "both-recover":{art:true,react:true,liora:true,recover:true},
 "both-earlypassive":{art:true,react:true,liora:true,earlyPassive:true}
};
const TIERS={early:{skill:1,level:2,rush:.9,hold:1.05,area:.95},trained:{skill:6,level:12,rush:1.12,hold:1.30,area:1.15}};
const SQUADS=[["ren","art"],["ren","art","nada"],["ren","liora","nada"],["art","nada","sava"],["liora","nada","sava"],["ren","art","liora"],["b14-striker","liora","b14-medic","sava"],["ren","art","nada","liora","sava"]];
function rep(s,a,b,n=1){if(s.split(a).length!==n+1)throw Error("B15.2B anchor "+a);return s.split(a).join(b);}
function kit(actor,id,base,c){
 if(!base||actor.side!=="ally")return base;
 const i=(actor.skillLevels?.[id]??1)-1,curve=a=>a[i];
 if(i<0||i>5)throw Error("skill");
 if(actor.id==="liora"&&id==="leader"&&c.leader!==undefined)return {...base,modifiers:base.modifiers.map(m=>({...m,value:c.leader}))};
 if(actor.id==="art"&&c.art){
  if(id==="passive")return {...base,combatRules:{b15React:!!c.react,fraction:curve([.4,.42,.44,.46,.48,.5]),cap:curve([.6,.65,.7,.75,.8,.9])}};
  if(id==="basic")return {...base,multiplier:curve([1,1.04,1.08,1.12,1.18,1.24])};
  if(id==="special")return {...base,insurancePercent:curve([40,42,44,46,48,50]),insuranceTurns:2,cooldown:2,b15Guard:{kind:"art",hits:1,turns:2,fraction:curve(c.artCap?[.5,.52,.54,.56,.58,.6]:[.4,.42,.44,.46,.48,.5]),cap:curve(c.artCap?[1.1,1.15,1.2,1.25,1.3,1.4]:[.8,.85,.9,.95,1,1.1]),recover:c.recover?.35:0}};
  if(id==="powerful"){const a={...base,multiplier:curve([1.05,1.09,1.13,1.17,1.21,1.25]),cooldown:3,weakening:0,b15Disrupt:true};delete a.disruptTurns;delete a.disruptDelay;return a;}
 }
 if(actor.id==="liora"&&c.liora){
  const group={kind:"liora",hits:1,turns:2,fraction:curve([.3,.32,.34,.36,.38,.4]),cap:curve([.65,.7,.75,.8,.85,.9])};
  if(id==="passive")return {...base,combatRules:{b15Threshold:curve(c.earlyPassive?[45,45,48,48,50,50]:[35,35,38,38,40,40]),b15Guard:group}};
  if(id==="basic")return {...base,multiplier:curve([.9,.95,1,1.04,1.08,1.15])};
  if(id==="special")return {...base,guardHits:2,tauntTurns:2,cooldown:3,b15Guard:{kind:"liora",hits:2,turns:2,fraction:curve([.35,.38,.4,.42,.45,.48]),cap:.9}};
  if(id==="powerful")return {...base,guardHits:1,cooldown:3,b15Guard:group};
 }
 return base;
}
// Injected into CombatCore closure. All state lives on the battle or fighters.
function primitives(){
 function b15count(b,k,n=1){const s=b.b15Stats??={};s[k]=(s[k]??0)+n;}
 function b15prune(b){for(const f of b.fighters){if(!f.b15Guards)continue;f.b15Guards=f.b15Guards.filter(g=>f.hp>0&&g.hits>0&&g.turns>0&&b.fighters.some(o=>o.id===g.owner&&o.hp>0));}}
 function b15grant(b,owner,target,g){
  if(!target||target.hp<=0||owner.hp<=0)return false;
  b15prune(b);
  if(g.kind==="art")for(const f of b.fighters)if(f.b15Guards)f.b15Guards=f.b15Guards.filter(x=>x.kind!=="art"||x.owner!==owner.id);
  const fresh={...g,owner:owner.id,capDamage:Math.round(owner.physicalAttack*g.cap),turns:g.turns+(owner===target?1:0)};
  const old=(target.b15Guards??=[]).find(x=>x.kind===g.kind&&x.owner===owner.id);
  // Same-owner group guard cannot overwrite a stronger self stance.
  if(old&&old.hits>=fresh.hits&&old.fraction>=fresh.fraction&&old.capDamage>=fresh.capDamage&&old.turns>=fresh.turns)return false;
  if(old&&old.hits>fresh.hits&&old.fraction>=fresh.fraction&&old.capDamage>=fresh.capDamage)return false;
  target.b15Guards=target.b15Guards.filter(x=>x!==old);target.b15Guards.push(fresh);
  b15count(b,g.kind+"Granted",g.hits);
  if(g.recover>0){const restored=Math.max(0,Math.min(target.maxProtection-target.protection,Math.round(owner.physicalAttack*g.recover)));target.protection+=restored;b15count(b,"artRestored",restored);}
  return true;
 }
 function b15guard(b,target,damage,direct){
  b15prune(b);
  const gs=(target.b15Guards??[]).filter(g=>g.kind!=="art"||direct);
  if(!gs.length){if(target.guardHits>0){target.guardHits--;const after=Math.round(damage*.5);b15count(b,"nativeGuardBlocked",damage-after);return after;}return damage;}
  if(damage<=0)return damage;
  const options=gs.map(g=>({g,blocked:Math.min(damage,Math.round(damage*g.fraction),g.capDamage)}));
  if(target.guardHits>0)options.push({g:null,blocked:damage-Math.round(damage*.5)});
  options.sort((a,z)=>z.blocked-a.blocked||String(a.g?.owner??"native").localeCompare(String(z.g?.owner??"native")));
  const best=options[0];if(!best||best.blocked<=0)return damage;
  if(best.g){if(target.side==="ally"&&damage>=target.hp+target.protection&&damage-best.blocked<target.hp+target.protection)b15count(b,best.g.kind+"LocalLethalGuard");best.g.hits--;b15count(b,best.g.kind+"GuardBlocked",best.blocked);b15count(b,best.g.kind+"GuardUsed");if(best.g.kind==="art"&&b.b15Root)b.b15Root.artGuard=true;}
  else{target.guardHits--;b15count(b,"nativeGuardBlocked",best.blocked);}
  b15prune(b);return damage-best.blocked;
 }
 function b15react(b,attacker,target,hpLoss,direct){
  const root=b.b15Root;
  if(!B15DEF.react||!direct||!b.b14Resolving||root?.id!=="powerful"||root.actor!==attacker.id||root.artGuard||root.reacted||hpLoss<=0||attacker.side!=="enemy"||target.side!=="ally")return hpLoss;
  const art=b.fighters.find(f=>f.id==="art"&&f.hp>0&&f.id!==target.id&&f.protection>0&&!f.b15ReactUsed);
  if(!art)return hpLoss;
  const rules=passiveCombatRules(art),n=Math.min(hpLoss,Math.round(hpLoss*rules.fraction),Math.round(art.physicalAttack*rules.cap),art.protection);
  if(n<=0)return hpLoss;
  if(hpLoss>=target.hp&&hpLoss-n<target.hp)b15count(b,"artLocalLethalReact");art.protection-=n;art.b15ReactUsed=true;root.reacted=true;b15count(b,"artReactBlocked",n);b15count(b,"artReactUsed");return hpLoss-n;
 }
 function b15finish(b,actor){
  const root=b.b15Root;
  if(B15DEF.liora&&root?.cross?.length){
   const l=b.fighters.find(f=>f.id==="liora"&&f.hp>0&&!(f.emergencyGuardCooldown>0));
   if(l){
    const rules=passiveCombatRules(l),eligible=root.cross.map(id=>b.fighters.find(f=>f.id===id)).filter(f=>f&&f.hp>0&&f.id!==l.id);
    eligible.sort((a,z)=>a.hp/a.maxHp-z.hp/z.maxHp||a.id.localeCompare(z.id));
    if(eligible.length&&b15grant(b,l,eligible[0],rules.b15Guard)){l.emergencyGuardCooldown=3;b15count(b,"lioraPassiveUsed");}
   }
  }
  if(actor.id==="art"&&B15DEF.art)actor.b15ReactUsed=false;
  if(actor.b15Guards)for(const g of actor.b15Guards)g.turns--;
  b15prune(b);delete b.b15Root;
 }
 function b15cross(b,target,old){
  if(!B15DEF.liora||!b?.b15Root||target.side!=="ally"||target.hp<=0||old<=target.hp)return;
  const l=b.fighters.find(f=>f.id==="liora"&&f.hp>0&&f.id!==target.id);
  const threshold=l&&passiveCombatRules(l)?.b15Threshold;
  if(threshold&&old*100>threshold*target.maxHp&&target.hp*100<=threshold*target.maxHp)b.b15Root.cross.push(target.id);
 }
 function b15disrupt(b,actor,target){
  if(target.hp<=0)return;
  if(target.b14Prepared){
   if(b.statusChecks===true&&!BattleRng.roll(b,statusChance(actor,target)).hit){b15count(b,"artDisruptResisted");return;}
   CombatStatusCore.apply(target,"disrupted-plan",0,2);target.tacticalDisruptDelay=0;b15count(b,"artDisruptApplied");
  }else{applyNegativeStatus(b,actor,target,Math.max(1,target.weakenAttacks),"physical",false);b15count(b,"artFallbackAttempt");}
 }
}
function setup(source,labSource,variant,tier,options={}){
 const c=CONFIGS[variant],t=TIERS[tier];if(!c||!t)throw Error("config");
 let s=source,l=labSource;
 l=rep(l,"skillLevels:{basic:1,special:1,powerful:1,passive:1}","skillLevels:"+JSON.stringify({basic:t.skill,special:t.skill,powerful:t.skill,passive:t.skill}));
 l=rep(l,"{level:2,stars:1}","{level:"+t.level+",stars:1}");
 l=rep(l,'const scale=scenario==="rush"?.90:.72;', 'const scale=('+JSON.stringify({rush:t.rush,hold:t.hold,area:t.area,mixed:.72,priority:.72})+')[scenario];');
 l=rep(l,'const scenarios={rush:', 'const scenarios={area:["npc-ridge-slinger","npc-trail-interceptor","npc-ridge-slinger"],rush:');
 l=rep(l,'return {...n,name:n.name+" "+(i+1),hp:', 'return {...n,...(scenario==="area"&&i===0?{npcAbilities:{...n.npcAbilities,powerful:{...n.npcAbilities.powerful,target:"all-enemies",multiplier:.72}}}:{}),name:n.name+" "+(i+1),hp:');
 l=rep(l,'const b=C.createBattle([...party,...foes],[],{leaderId:null,','const b=C.createBattle([...party,...'+(options.reverse?'foes.reverse()':'foes')+'],[],{leaderId:'+(c.leader?'squad.includes("liora")?"liora":null':'null')+',');
 s=rep(s,'return typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability;', 'return ('+kit.toString()+')(actor,abilityId,typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability,'+JSON.stringify(c)+');');
 if(c.art||c.liora){
  const helpers=primitives.toString().slice(primitives.toString().indexOf("{")+1,primitives.toString().lastIndexOf("}"));
  s=rep(s,'  function dealDamage(attacker,target,rawDamage,consumeWeakening=true,type="legacy",penetration=0,battle=null,canInsurance=false){','  const B15DEF='+JSON.stringify(c)+';\n'+helpers+'\n  function dealDamage(attacker,target,rawDamage,consumeWeakening=true,type="legacy",penetration=0,battle=null,canInsurance=false){\n    const b15old=target.hp;');
  s=rep(s,'    if(target.guardHits>0){\n      damage=Math.round(damage*0.5);\n      target.guardHits--;\n    }','    if(battle)damage=b15guard(battle,target,damage,canInsurance);else if(target.guardHits>0){damage=Math.round(damage*.5);target.guardHits--;}');
  s=rep(s,'insuranceRedirect(battle,attacker,target,hpLoss):hpLoss','b15react(battle,attacker,target,insuranceRedirect(battle,attacker,target,hpLoss),canInsurance):hpLoss');
  s=rep(s,'    if(target.hp===0){\n      target.guardHits=0;','    b15cross(battle,target,b15old);\n    if(target.hp===0){\n      delete target.b15Guards;target.guardHits=0;');
  s=rep(s,'    battle.events.push({type, ...properties});','    battle.events.push({type, ...properties});\n    if(type==="ability")battle.b15Root={actor:properties.actorId,id:properties.abilityId,cross:[]};\n    if(type==="wave-start")for(const f of battle.fighters)delete f.b15Guards;');
  s=rep(s,'    syncLeaderProtection(battle);\n    // Wrong first kill','    b15prune(battle);syncLeaderProtection(battle);\n    // Wrong first kill');
  s=rep(s,'    finishAbilityCooldowns(actor,ability);','    b15finish(battle,actor);\n    finishAbilityCooldowns(actor,ability);',2);
  l=rep(l,'react:mode!=="direct"','react:false');
  if(!c.art){
   s=rep(s,'    if(battle)damage=b15guard(battle,target,damage,canInsurance);',`    if(battle?.b14Resolving&&attacker.side==="enemy"&&target.side==="ally"&&damage>0){
      const art=battle.fighters.find(f=>f.id==="art"&&f.hp>0&&f.id!==target.id&&!f.b14ReactUsed&&f.protection>0);
      if(art){const blocked=Math.min(Math.round(damage*.40),Math.round(art.physicalAttack*.85),art.protection*2);if(blocked>0){art.protection-=Math.ceil(blocked/2);damage-=blocked;art.b14ReactUsed=true;battle.b14Counts.reacted++;}}
    }
    if(battle)damage=b15guard(battle,target,damage,canInsurance);`);
   s=rep(s,'if(actor.id==="art"&&B15DEF.art)actor.b15ReactUsed=false;','if(actor.id==="art")actor.b14ReactUsed=false;');
  }
  if(c.art){
   l=rep(l,'art:"recover"','art:"candidate"');
   s=rep(s,'target.insurance={ownerId:actor.id,percent:ability.insurancePercent,\n       remaining:ability.insuranceTurns,afterMeter:ability.afterInterceptMeter??0};','if(ability.b15Guard)b15grant(battle,actor,target,ability.b15Guard);else target.insurance={ownerId:actor.id,percent:ability.insurancePercent,\n       remaining:ability.insuranceTurns,afterMeter:ability.afterInterceptMeter??0};');
   s=rep(s,'      if(ability.disruptTurns&&target.hp>0','      if(ability.b15Disrupt)b15disrupt(battle,actor,target);\n      if(ability.disruptTurns&&target.hp>0');
   s=rep(s,'(ability.weakening>0||(ability.followUpEffects||[]).some(e=>e.status==="weaken"))','(ability.b15Disrupt||ability.weakening>0||(ability.followUpEffects||[]).some(e=>e.status==="weaken"))');
   s=rep(s,'if(ability.weakening>0)draws+=recipients.length;','if(ability.b15Disrupt||ability.weakening>0)draws+=recipients.length;');
   s=rep(s,'const direct=ability.weakening>0?recipients.length:0;','const direct=ability.b15Disrupt||ability.weakening>0?recipients.length:0;');
  }
  if(c.liora){
   s=rep(s,'target.guardHits=ability.guardHits;','if(ability.b15Guard)b15grant(battle,actor,target,ability.b15Guard);else target.guardHits=ability.guardHits;',2);
   // Native aura adds initial bonus once, subsequent death clamps without subtracting an already-spent amount.
   s=rep(s,'recipient.protection=Math.max(0,Math.min(recipient.maxProtection,recipient.protection+diff));','recipient.protection=Math.max(0,Math.min(recipient.maxProtection,recipient.protection+(recipient.leaderProtectionBonus===undefined?Math.max(0,diff):0)));');
  }
 }
 const lab=new Function("module",l+"\nreturn B146;")({exports:{}});
 return {lab,api:lab.make(s,"visible"),c};
}
const sum=(a,f)=>a.reduce((n,x)=>n+f(x),0);
function policy(ctx,b,mode){
 const {lab,api}=ctx,actor=b.fighters[b.currentActor],living=side=>b.fighters.flatMap((f,i)=>f.side===side&&f.hp>0?[i]:[]),enemies=living("enemy"),allies=living("ally"),others=allies.filter(i=>i!==b.currentActor);
 const pool=i=>b.fighters[i].hp+b.fighters[i].protection,ratio=i=>pool(i)/(b.fighters[i].maxHp+b.fighters[i].maxProtection),foe=enemies.slice().sort((a,z)=>pool(a)-pool(z)||a-z)[0],ready=id=>api.C.abilityReady(b,id);
 const pick=(abilityId,targetIndex)=>({abilityId,targetIndex,enemy:foe});
 if(mode==="basic")return pick("basic",foe);
 if(mode==="original")return lab.plan(api,b,true);
 const threatened=enemies.filter(i=>b.fighters[i].b14Prepared),threat=threatened[0],taunter=allies.find(i=>api.T.read(b.fighters[i],"taunt")),warned=threatened.map(i=>taunter??allies.find(j=>b.fighters[j].id===b.fighters[i].b14Prepared)).filter(i=>i!==undefined);
 const guards=i=>b.fighters[i].guardHits+(b.fighters[i].b15Guards??[]).reduce((n,g)=>n+g.hits,0);
 if(actor.id==="art"){
  if(threat!==undefined&&ready("powerful"))return pick("powerful",threat);
  const t=others.slice().sort((a,z)=>(warned.includes(z)?1:0)-(warned.includes(a)?1:0)||ratio(a)-ratio(z))[0];
  if(t!==undefined&&ready("special")&&!guards(t)&&(warned.includes(t)||ratio(t)<.60))return pick("special",t);
  if(ready("powerful"))return pick("powerful",foe);
  return pick("basic",foe);
 }
 if(actor.id==="liora"){
  const area=enemies.some(i=>api.D.get(b.fighters[i],"powerful")?.target==="all-enemies"&&b.fighters[i].powerfulCooldown===0);
  const endangered=allies.filter(i=>!guards(i)&&(ratio(i)<.7||warned.includes(i)||area));
  if(ready("powerful")&&endangered.length>=2&&(area||warned.length>=2||endangered.length>=3))return pick("powerful",b.currentActor);
  if(ready("special")&&!api.T.read(actor,"taunt")&&ratio(b.currentActor)>.45&&others.some(i=>warned.includes(i)||ratio(i)<.65))return pick("special",b.currentActor);
  if(ready("powerful")&&endangered.length>=2)return pick("powerful",b.currentActor);
  return pick("basic",foe);
 }
 return lab.plan(api,b,true);
}
function run(ctx,squad,scenario,seed,mode="tactical"){
 const order=squad.includes("liora")?["liora",...squad.filter(id=>id!=="liora")]:squad;
 const {lab,api}=ctx,b=lab.start(api,order,scenario,seed),allies=()=>b.fighters.filter(f=>f.side==="ally"),max=sum(allies(),f=>f.maxHp+f.maxProtection);
 let actions=0,defense=0,tauntActions=0,areaHits=0,damage=0;
 while(b.active&&actions<160){
  const actor=b.fighters[b.currentActor],p=policy(ctx,b,mode);
  if(["liora","art"].includes(actor.id)&&p.abilityId==="special"||actor.id==="liora"&&p.abilityId==="powerful")defense++;
  if(actor.id==="liora"&&p.abilityId==="special")tauntActions++;
  if(!p||!lab.step(api,b,p.abilityId,p.targetIndex,p.enemy))throw Error("illegal "+JSON.stringify({squad,scenario,seed,mode,actor:actor.id,p}));
  actions++;
  for(const e of b.events){if(e.type==="ability"&&e.targetIds?.length>1&&b.fighters.find(f=>f.id===e.actorId)?.side==="enemy")areaHits++;if(e.type==="damage"&&allies().some(f=>f.id===e.targetId))damage+=e.hpDamage??0;}
 }
 if(b.active)throw Error("turn limit "+JSON.stringify({squad,scenario,seed,mode}));
 lab.validate(b);
 return {w:+(b.winner==="ally"),q:+(b.winner==="ally"&&allies().every(f=>f.hp>0)),pool:sum(allies(),f=>f.hp+f.protection)/max,actions,defense,tauntActions,areaHits,damage,stats:b.b15Stats??{},threat:b.b14Counts??{}};
}
function summarize(rows){const n=rows.length,out={n,w:sum(rows,x=>x.w),q:sum(rows,x=>x.q)};
 for(const k of ["pool","actions","defense","tauntActions","areaHits","damage"])out[k]=+(sum(rows,x=>x[k])/n).toFixed(3);
 for(const k of ["stats","threat"]){out[k]={};for(const x of rows)for(const [id,v] of Object.entries(x[k]))out[k][id]=(out[k][id]??0)+v;}
 return out;
}
function experiment(source,labSource,count=20,holdout=false){
 const seeds=Array.from({length:count},(_,i)=>Math.imul(i+(holdout?61139:41131),0x9e3779b1)>>>0),cells=[];
 for(const tier of Object.keys(TIERS))for(const variant of (holdout?["ref","both","both-leader10","both-noreact","both-flex","both-recover","both-earlypassive"]:Object.keys(CONFIGS).filter(v=>!["both-flex","both-recover","both-earlypassive"].includes(v)))){
  const ctx=setup(source,labSource,variant,tier,{reverse:holdout});
  for(const squad of SQUADS){
   if(variant.includes("leader")&&!squad.includes("liora"))continue;
   for(const scenario of ["rush","hold","area"]){
    if(holdout&&squad.length===2&&scenario==="area")continue;
    const modes=variant==="ref"&&!holdout?["tactical","original"]:variant==="both"&&!holdout?["tactical","basic"]:["tactical"];
    for(const mode of modes)cells.push({tier,variant,squad:squad.join("+"),scenario,mode,...summarize(seeds.map(seed=>run(ctx,squad,scenario,seed,mode)))});
   }
  }
 }
 return {seeds,tiers:TIERS,holdout,battles:sum(cells,c=>c.n),cells};
}
module.exports={setup,kit,policy,run,experiment,CONFIGS,TIERS,SQUADS};
if(typeof require!=="undefined"&&require.main===module){const fs=require("node:fs"),lab=require("../../combat-lab-real/engine.js");console.log(JSON.stringify(experiment(lab.files.map(f=>fs.readFileSync(f,"utf8")).join("\n"),fs.readFileSync("combat-lab-real/engine.js","utf8"),Number(process.argv[2]||20),process.argv[3]==="holdout"),null,2));}
