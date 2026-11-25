/* B15.2C real-core Sava + actual equipped G1/G7/G13 item history. Research only. */
"use strict";
const EXTRA=["gear-data.js","progress-core.js","progress-v3-core.js"];
const CONFIGS={ref:{},window:{window:true},meter:{candidate:true,meterOnly:true},full:{candidate:true},cap:{candidate:true,cap:1},nopassive:{candidate:true,noPassive:true},nosignal:{candidate:true,noSignal:true},hybrid:{candidate:true,hybrid:true}};
const TIERS={early:{level:2,skill:1,stars:1,gear:1,pressure:1.08},mid:{level:15,skill:6,stars:3,gear:7,pressure:3.1},max:{level:85,skill:6,stars:7,gear:13,pressure:6.6},uneven:{level:15,skill:6,stars:3,gear:1,helperGear:13,pressure:2.3}};
const SQUADS=[["ren","sava"],["ren","art","sava"],["art","nada","sava"],["liora","nada","sava"],["ren","nada","sava"],["b14-striker","art","sava"],["liora","b14-striker","b14-medic","sava"],["ren","art","nada","liora","sava"],["ren","art","nada"]];
const ENEMIES={rush:["npc-trail-interceptor","npc-trail-interceptor","npc-ridge-slinger"],mixed:["npc-pass-guard","npc-trail-interceptor","npc-field-medic"],five:["npc-pass-guard","npc-trail-interceptor","npc-ridge-slinger","npc-field-medic","npc-trail-interceptor"]};
function rep(s,a,b,n=1){if(s.split(a).length!==n+1)throw Error("B15.2C anchor "+a);return s.split(a).join(b);}
function kit(actor,id,base,c){
 if(!base||actor.id!=="sava"||!c.candidate)return base;
 const i=(actor.skillLevels?.[id]??1)-1,curve=a=>a[i];
 if(!Number.isInteger(i)||i<0||i>5)throw Error("skill");
 if(id==="basic")return {...base,multiplier:curve([.75,.78,.82,.85,.88,.92]),nextAllyMeter:curve([50,55,60,65,70,75])};
 if(id==="special")return {...base,signalMeter:curve([250,260,270,280,290,300]),signalTurns:1,cooldown:2,b15Signal:true};
 if(id==="powerful")return {id,name:base.name,kind:"damage",target:"enemy",damageType:"physical",multiplier:c.meterOnly?1.2:curve([.8,.82,.84,.86,.88,.9]),cooldown:3,weakening:0,b15Assist:c.meterOnly?0:curve([.5,.52,.54,.56,.58,.6])};
 if(id==="passive")return {...base,combatRules:{b15Boost:c.noPassive?0:curve([50,55,60,65,70,80])}};
 return base;
}
function primitives(){
 function b15count(b,k,n=1){const s=b.b15Stats??={};s[k]=(s[k]??0)+n;}
 function b15cap(old,add){return Math.max(old,Math.min(950,old+add));}
 function b15time(b,f){return Math.max(0,(1000-f.meter)/effectiveStat(b,f,"speed"));}
 function b15preview(b,actor,amount,target){
  const alive=b.fighters.filter(f=>f.hp>0);
  const before=alive.map(f=>({...f,meter:f.id===actor.id&&b.currentActor===f.index&&f.meter>=1000-1e-8?Math.max(0,f.meter-1000):f.meter}));
  const after=before.map(f=>({...f,meter:f.id===target.id?b15cap(f.meter,amount):f.meter}));
  const speed=f=>effectiveStat(b,f,"speed");
  const nextBefore=InitiativeModel.nextActor(before.map(f=>({...f})),speed)?.id,nextAfter=InitiativeModel.nextActor(after.map(f=>({...f})),speed)?.id;
  const foe=before.filter(f=>f.side==="enemy").sort((a,z)=>b15time(b,a)-b15time(b,z)||a.index-z.index)[0];
  const t0=before.find(f=>f.id===target.id),t1=after.find(f=>f.id===target.id);
  const precedes=(a,z)=>b15time(b,a)<b15time(b,z)-1e-8||(Math.abs(b15time(b,a)-b15time(b,z))<=1e-8&&a.index<z.index);
  return {gain:t1.meter-t0.meter,changed:nextBefore!==nextAfter,cross:!!foe&&!precedes(t0,foe)&&precedes(t1,foe),nextBefore,nextAfter};
 }
 function b15grant(b,actor,target,amount,kind){
  const p=b15preview(b,actor,amount,target);if(p.gain<=0)return false;
  target.meter=b15cap(target.meter,amount);b15count(b,kind+"Used");b15count(b,kind+"Gain",p.gain);
  if(p.changed)b15count(b,kind+"NextChanged");if(p.cross)b15count(b,kind+"EnemyCrossed");
  b.events.push({type:"b15-meter",actorId:actor.id,targetId:target.id,amount:p.gain,kind,...p});return true;
 }
 function b15helper(b,actor,index){const f=b.fighters[index];return f&&f.side==="ally"&&f.hp>0&&f.id!==actor.id?f:null;}
 function b15validateAssist(b,actor,ability,target,helper){
  if(!helper||!Number.isFinite(helper.physicalAttack)||helper.physicalAttack<0||!validHitProfile(b,helper,[target],"physical")||!validCriticalProfile(b,helper,[target],"physical")||!validPenetrationProfile(b,helper,"physical"))return false;
  if(b.hitChecks||b.critChecks){let rng;try{rng=BattleRng.snapshot(b)}catch{return false;}
   const draws=2*((hitCheckEnabled(b,"physical")?1:0)+(critCheckEnabled(b,"physical")?1:0));if(rng.draws>Number.MAX_SAFE_INTEGER-draws)return false;}
  return true;
 }
 function b15assist(b,actor,target,helper,ability){
  if(!helper||helper.hp<=0||actor.hp<=0||target.hp<=0){b15count(b,"assistSkippedDead");return;}
  const rootId="w"+b.wave+"-t"+b.turn+"-"+actor.id,props={rootId,parentId:rootId,sourceId:actor.id,actorId:helper.id,targetId:target.id,depth:1,assist:true};
  b15count(b,"assistAttempts");
  // Ordinary hit and critical rolls, no helper ability/personal mark bonus or trigger dispatch.
  const oldEvents=b.events.length;
  if(!rollToHit(b,helper,target,"physical")){for(const e of b.events.slice(oldEvents))Object.assign(e,props);return;}
  const cap=B15SAVA.cap?actor.physicalAttack*B15SAVA.cap:Infinity;
  const raw=Math.round(Math.min(effectiveStat(b,helper,"physicalAttack")*ability.b15Assist,cap));
  const oldHp=target.hp,oldProt=target.protection;
  const rolled=rollCriticalDamage(b,helper,target,raw,"physical");
  for(const e of b.events.slice(oldEvents))Object.assign(e,props);
  const damage=dealDamage(helper,target,rolled,false,"physical",penetrationEnabled(b,"physical")?helper.defensePenetration:0,b,false);
  const fields=typedDamageFields(target,"physical",oldHp,oldProt),useful=fields.hpDamage+fields.protectionDamage;
  b.events.push({type:"damage",...props,amount:damage,remainingHp:target.hp,...fields});
  b15count(b,"assistHits");b15count(b,"assistRaw",raw);b15count(b,"assistUseful",useful);b15count(b,"assistOverkill",Math.max(0,damage-useful));
  if(target.hp===0){b.events.push({type:"death",targetId:target.id,...props});b15count(b,"assistKills");}
  if(useful>0){const boost=passiveCombatRules(actor)?.b15Boost??0;if(boost){actor.b15SignalBoost=boost;b15count(b,"boostEarned");}}
 }
}
function setup(source,labSource,extraSource,variant){
 const c=CONFIGS[variant];if(!c)throw Error("config");
 let s=source,l=labSource;
 if(c.window||c.candidate){l=rep(l,'meter:0,damage:.55,shared:12,hybrid:.8','meter:null,damage:0,shared:12,hybrid:0');}
 if(c.candidate){
  s=rep(s,'return typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability;', 'return ('+kit.toString()+')(actor,abilityId,typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability,'+JSON.stringify(c)+');');
  const helpers=primitives.toString().slice(primitives.toString().indexOf("{")+1,primitives.toString().lastIndexOf("}"));
  s=rep(s,'  function grantTacticalMeter(battle,owner,amount,excludedIds=[]){','  const B15SAVA='+JSON.stringify(c)+';\n'+helpers+'\n  function grantTacticalMeter(battle,owner,amount,excludedIds=[]){');
  s=rep(s,'  function performActorAbility(battle,abilityId,primaryIndex) {','  function performActorAbility(battle,abilityId,primaryIndex,helperIndex) {');
  s=rep(s,'    const type=ability.kind==="damage"?AbilityData.damageType(ability):null;\n    if(type&&type!=="legacy"&&!validTypedTarget(target,type))return false;','    const helper=ability.b15Assist?b15helper(battle,actor,helperIndex):null;\n    if(ability.b15Assist&&!b15validateAssist(battle,actor,ability,target,helper))return false;\n    if(ability.b15Signal&&(B15SAVA.noSignal||b15cap(target.meter,ability.signalMeter+(actor.b15SignalBoost??0))<=target.meter))return false;\n    const type=ability.kind==="damage"?AbilityData.damageType(ability):null;\n    if(type&&type!=="legacy"&&!validTypedTarget(target,type))return false;');
  s=rep(s,'      target.fieldSignal={ownerId:actor.id,remaining:ability.signalTurns};\n      target.meter=Math.min(1000,target.meter+ability.signalMeter);','      if(ability.b15Signal){const boosted=actor.b15SignalBoost??0;b15grant(battle,actor,target,ability.signalMeter+boosted,"signal");if(boosted)b15count(battle,"boostSpent");delete actor.b15SignalBoost;}else{target.fieldSignal={ownerId:actor.id,remaining:ability.signalTurns};target.meter=Math.min(1000,target.meter+ability.signalMeter);}');
  s=rep(s,'    if(ability.kind!=="damage"||!hitCheckEnabled(battle,type)||','    if(ability.b15Assist)b15assist(battle,actor,target,helper,ability);\n    if(ability.kind!=="damage"||!hitCheckEnabled(battle,type)||');
  // B14.6 extra() also patches the finishTacticalAction prefix. Preserve its anchor.
  s=rep(s,'      grantTacticalMeter(battle,actor,ability.nextAllyMeter);','      {const other=battle.fighters.filter(f=>f.side==="ally"&&f.hp>0&&f.id!==actor.id&&f.meter<950).sort((a,z)=>b15time(battle,a)-b15time(battle,z)||a.index-z.index)[0];if(other)b15grant(battle,actor,other,ability.nextAllyMeter,"basicMeter");}');
  s=rep(s,'    if(["insurance","signal"].includes(ability.kind)&&\n       !battle.fighters.some(f=>f.side===actor.side&&f.hp>0&&f.id!==actor.id))','    if(ability.b15Signal&&(B15SAVA.noSignal||!battle.fighters.some(f=>f.side==="ally"&&f.hp>0&&f.id!==actor.id&&f.meter<950)))return false;\n    if(ability.b15Assist&&!battle.fighters.some(f=>f.side==="ally"&&f.hp>0&&f.id!==actor.id))return false;\n    if(["insurance","signal"].includes(ability.kind)&&\n       !battle.fighters.some(f=>f.side===actor.side&&f.hp>0&&f.id!==actor.id))');
  s=rep(s,'    battle.events.push({type, ...properties});','    battle.events.push({type, ...properties});\n    if(type==="wave-start")for(const f of battle.fighters)delete f.b15SignalBoost;\n    if(type==="death"){const f=battle.fighters.find(f=>f.id===properties.targetId);if(f)delete f.b15SignalBoost;}');
  s=rep(s,'    activePassiveModifiers, activeLeaderModifiers, effectiveStat','    b15preview, b15cap, activePassiveModifiers, activeLeaderModifiers, effectiveStat');
 }
 l=rep(l,'T:CombatStatusCore};','T:CombatStatusCore,I:InitiativeModel,G:GearData,P:ProgressCore,V:ProgressV3Core,Star:StarCore};');
 const lab=new Function("module",l+"\nreturn B146;")({exports:{}});
 return {lab,api:lab.make(source===s?extraSource+"\n"+s:extraSource+"\n"+s,"visible"),c};
}
function gearProfiles(ctx,tier){
 const {api}=ctx,{G,P,V,Star,H,S,B}=api,t=TIERS[tier];if(!t)throw Error("tier");
 const ids=Star.PLAYABLE,roster=ids.map(id=>({id,side:"ally"})),p=V.toRuntime(V.fresh(roster,100),roster);
 if(!p)throw Error("fresh gear runtime");
 p.currency=100000000;for(const id of G.MATERIALS)p.materials[id]=1000000;
 const out={};
 for(const id of ids){
  p.heroStars[id].rank=t.stars;p.levels[id]=t.level;
  const gear=t.helperGear&&id==="ren"?t.helperGear:t.gear;
  for(let n=1;n<=gear;n++){
   for(const slot of G.SLOTS){const item=P.itemOffer(p,id,slot.id)[0];if(!item||!P.equipItem(p,id,item.id))throw Error("equip "+id+" "+n+" "+slot.id);}
   if(n<gear&&!P.promoteGear(p,id))throw Error("promotion");
  }
  const bonus=P.gearBonuses(p,id);
  const hero=B.apply({id,side:"ally",name:ctx.lab.names[id],tags:["gardens-over-abyss"],skillLevels:{basic:t.skill,special:t.skill,powerful:t.skill,passive:t.skill}},{level:t.level,stars:t.stars,gearPercent:bonus,gearStats:bonus.stats},H[id],S);
  if(P.gearInstalled(p,id)!==gear*6||hero.speed!==H[id].combatStats.speed)throw Error("gear contract");
  out[id]={hero,gear,items:P.gearInstalled(p,id),bonus};
 }
 return out;
}
function start(ctx,profiles,tier,squad,scenario,seed,reverse=false){
 const {api}=ctx,t=TIERS[tier];
 const party=squad.map(id=>{const src=id==="b14-striker"?"ren":id==="b14-medic"?"nada":id==="b14-breaker"?"art":id;return {...profiles[src].hero,id,name:ctx.lab.names[id],tags:id.startsWith("b14-")?[]:profiles[src].hero.tags};});
 const foes=ENEMIES[scenario].map((id,i)=>{const n=api.N.spawn(id,{instanceId:"b15c-"+i}),scale=t.pressure*(scenario==="mixed"?.82:scenario==="five"?1.0:1);
  // pressure fixtures use the real NPC factory, scaled HP/Protection/ATK only; not final NPC progression.
  return {...n,hp:Math.round(n.hp*scale),protection:Math.round(n.protection*scale),maxProtection:Math.round(n.protection*scale),physicalAttack:Math.round(n.physicalAttack*scale),atk:Math.round(n.physicalAttack*scale)};});
 if(reverse)foes.reverse();
 const b=api.C.createBattle([...party,...foes],[],{leaderId:null,rngSeed:seed,hitChecks:true,critChecks:true,penetrationChecks:true,statusChecks:true});
 api.C.advanceToPlayerTurn(b);ctx.lab.validate(b);return b;
}
function plan(ctx,b,mode="tactical"){
 const {api,lab,c}=ctx,actor=b.fighters[b.currentActor],foes=b.fighters.flatMap((f,i)=>f.side==="enemy"&&f.hp>0?[i]:[]),others=b.fighters.flatMap((f,i)=>f.side==="ally"&&f.hp>0&&i!==b.currentActor?[i]:[]);
 const pool=i=>b.fighters[i].hp+b.fighters[i].protection,enemy=foes.slice().sort((a,z)=>pool(a)-pool(z)||a-z)[0],ready=id=>api.C.abilityReady(b,id),pick=(abilityId,targetIndex,helper)=>({abilityId,targetIndex,enemy,helper});
 if(mode==="basic")return pick("basic",enemy);
 if(actor.id!=="sava")return lab.plan(api,b,true);
 if(!c.candidate){
  if(c.window&&others.length){if(ready("powerful")&&others.length>=2&&!b.coordinatedWindow)return pick("powerful",b.currentActor);
   const t=others.filter(i=>b.fighters[i].meter<850).sort((a,z)=>b.fighters[z].physicalAttack-b.fighters[a].physicalAttack)[0];if(t!==undefined&&ready("special"))return pick("special",t);}
  if(!c.window&&others.length&&ready("special"))return pick("special",others.slice().sort((a,z)=>b.fighters[z].physicalAttack-b.fighters[a].physicalAttack)[0]);
  return pick("basic",enemy);
 }
 const helper=others.slice().sort((a,z)=>b.fighters[z].physicalAttack-b.fighters[a].physicalAttack||a-z)[0];
 const signal=api.D.get(actor,"special"),options=others.map(i=>({i,...api.C.b15preview(b,actor,signal.signalMeter+(actor.b15SignalBoost??0),b.fighters[i])})).filter(x=>x.gain>0).sort((a,z)=>Number(z.cross)-Number(a.cross)||Number(z.changed)-Number(a.changed)||z.gain-a.gain||a.i-z.i);
 const power=api.D.get(actor,"powerful"),basic=api.D.get(actor,"basic"),estimated=actor.physicalAttack*power.multiplier+(helper===undefined?0:Math.min(b.fighters[helper].physicalAttack*(power.b15Assist??0),c.cap?actor.physicalAttack*c.cap:Infinity));
 const killWindow=pool(enemy)>actor.physicalAttack*basic.multiplier&&pool(enemy)<=estimated*.85;
 if(ready("powerful")&&(!power.b15Assist||helper!==undefined)&&killWindow)return pick("powerful",enemy,helper);
 if(ready("special")&&options[0]&&(options[0].cross||(c.hybrid&&options[0].changed)))return pick("special",options[0].i);
 if(ready("powerful")&&(!power.b15Assist||helper!==undefined)&&pool(enemy)>actor.physicalAttack*basic.multiplier*.8)return pick("powerful",enemy,helper);
 return pick("basic",enemy);
}
const sum=(a,f)=>a.reduce((n,x)=>n+f(x),0);
function run(ctx,profiles,tier,squad,scenario,seed,mode="tactical",reverse=false){
 const {api,lab}=ctx,b=start(ctx,profiles,tier,squad,scenario,seed,reverse),allies=()=>b.fighters.filter(f=>f.side==="ally"),max=sum(allies(),f=>f.maxHp+f.maxProtection);
 let actions=0;const usage={},trace=[];
 while(b.active&&actions<180){
  const actor=b.fighters[b.currentActor],p=plan(ctx,b,mode);if(!p||!api.C.abilityReady(b,p.abilityId)||!api.C.chooseEnemy(b,p.enemy??p.targetIndex)||!api.C.performActorAbility(b,p.abilityId,p.targetIndex,p.helper))throw Error("illegal "+JSON.stringify({tier,squad,scenario,seed,actor:actor.id,p}));
  lab.validate(b);actions++;if(actor.id==="sava")usage[p.abilityId]=(usage[p.abilityId]??0)+1;
  if(b.events.some(e=>e.assist&&e.depth!==1))throw Error("assist depth");
  if(b.fighters.some(f=>f.meter<0||!Number.isFinite(f.meter)))throw Error("invalid meter");
  trace.push([actor.id,p.abilityId,b.fighters.map(f=>[f.id,f.hp,f.protection,f.meter])]);
 }
 if(b.active)throw Error("turn limit "+JSON.stringify({tier,squad,scenario,seed}));
 return {w:+(b.winner==="ally"),q:+(b.winner==="ally"&&allies().every(f=>f.hp>0)),pool:sum(allies(),f=>f.hp+f.protection)/max,actions,usage,stats:b.b15Stats??{},trace};
}
function summarize(rows){const n=rows.length,out={n,w:sum(rows,x=>x.w),q:sum(rows,x=>x.q),pool:+(sum(rows,x=>x.pool)/n).toFixed(3),actions:+(sum(rows,x=>x.actions)/n).toFixed(3),usage:{},stats:{}};
 for(const k of ["usage","stats"])for(const row of rows)for(const [id,v] of Object.entries(row[k]))out[k][id]=(out[k][id]??0)+v;
 return out;
}
function experiment(source,labSource,extraSource,count=20,holdout=false){
 if(!Number.isInteger(count)||count<1||count>60)throw Error("count");
 const seeds=Array.from({length:count},(_,i)=>Math.imul(i+(holdout?82121:73139),0x9e3779b1)>>>0),cells=[],gear={};
 for(const variant of holdout?["ref","full","cap","hybrid"]:Object.keys(CONFIGS)){
  const ctx=setup(source,labSource,extraSource,variant);
  for(const tier of Object.keys(TIERS)){
   const profiles=gearProfiles(ctx,tier);if(!gear[tier])gear[tier]=Object.fromEntries(Object.entries(profiles).map(([id,p])=>[id,{gear:p.gear,items:p.items,bonus:p.bonus,hp:p.hero.hp,attack:p.hero.physicalAttack,protection:p.hero.protection,speed:p.hero.speed}]));
   for(const squad of SQUADS){
    if(holdout&&!squad.includes("sava"))continue;
    for(const scenario of squad.length>=4?["rush","five"]:["rush","mixed"]){
     const modes=variant==="full"&&!holdout?["tactical","basic"]:["tactical"];
     for(const mode of modes)cells.push({tier,variant,squad:squad.join("+"),scenario,mode,...summarize(seeds.map(seed=>run(ctx,profiles,tier,squad,scenario,seed,mode,holdout)))});
    }
   }
  }
 }
 return {seeds,tiers:TIERS,holdout,gear,battles:sum(cells,c=>c.n),cells};
}
module.exports={EXTRA,CONFIGS,TIERS,SQUADS,setup,gearProfiles,start,plan,run,experiment};
if(typeof require!=="undefined"&&require.main===module){const fs=require("node:fs"),lab=require("../../combat-lab-real/engine.js");console.log(JSON.stringify(experiment(lab.files.map(f=>fs.readFileSync(f,"utf8")).join("\n"),fs.readFileSync("combat-lab-real/engine.js","utf8"),EXTRA.map(f=>fs.readFileSync(f,"utf8")).join("\n"),Number(process.argv[2]||20),process.argv[3]==="holdout"),null,2));}
