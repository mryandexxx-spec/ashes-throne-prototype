/* AUD003-B15.2A: isolated real-core Ren/Nada ablation. No production imports or save writes.
 * Run from repository root: node docs/research/aud003-b15-2a-read-move.js [count]
 * B14.6 is the same-pressure reference, NOT live production. Art/Sava/Liora remain B14.6.
 */
"use strict";
const VARIANTS=["b14","b15","b15-no-share","b15-nada3","b15-ren12"];
const TIERS={
 early:{skill:1,level:2,stars:1,rush:.90,mixed:.72},
 trained:{skill:6,level:12,stars:1,rush:1.12,mixed:.90}
};
const SQUADS=[
 ["ren","art"],["ren","art","nada"],["ren","liora","nada"],
 ["art","nada","sava"],["liora","nada","sava"],["ren","art","sava"],
 ["b14-striker","art","nada"],["b14-striker","art","sava"],
 ["b14-striker","b14-medic","b14-breaker"]
];
function replaceOnce(s,a,b){if(s.split(a).length!==2)throw Error("B15.2A anchor: "+a);return s.replace(a,b);}
function kit(actor,id,base,v){
 if(!base||!["ren","nada"].includes(actor?.id))return base;
 const level=actor.skillLevels?.[id]??1;
 if(!Number.isInteger(level)||level<1||level>6)throw Error("skill level");
 const i=level-1, ren=actor.id==="ren";
 const damage=ren?{basic:[1,1.05,1.1,1.1,1.18,1.25],special:[1.05,1.1,1.15,1.2,1.25,1.3],powerful:[1.55,1.6,1.65,1.7,1.78,1.85]}:
 {basic:[.8,.85,.9,.95,1,1.05],special:[.7,.74,.78,.82,.86,.9],powerful:[.5,.54,.58,.62,.66,.7]};
 if(id==="passive"){
  const rules={...base.combatRules};
  if(ren){rules.readMoveBonusPercentPerStack=v==="b15-ren12"?12:[8,8,9,9,10,10][i];rules.gardensEvasionBonus=[5,5,6,6,7,8][i];}
  else rules.gardensAccuracyBonus=[5,5,6,6,7,8][i];
  return {...base,combatRules:rules};
 }
 if(!damage[id])return base;
 const a={...base,multiplier:damage[id][i],cooldown:{basic:0,special:2,powerful:3}[id]};
 if(ren){
  if(id==="basic"){if(level>=4)a.onHitStatus={type:"slowed",amount:20,turns:level===6?2:1};else delete a.onHitStatus;}
  if(id==="special")a.weakening=2;
  if(id==="powerful")delete a.followUpStatusAll;
 }else{
  a.onHitStatus={type:"read-move",stacks:id==="basic"?1:2,turns:2};
  // Deliberately low-damage three-stack alternative, not a non-damaging skill:
  // native hit/resist contract still applies. An exact non-damaging variant is future work.
  if(v==="b15-nada3"&&id==="special"){a.multiplier=[.25,.27,.29,.31,.33,.35][i];a.cooldown=3;a.onHitStatus.stacks=3;}
 }
 return a;
}
function setup(source,labSource,variant,tier){
 if(!VARIANTS.includes(variant)||!TIERS[tier])throw Error("invalid configuration");
 const t=TIERS[tier];
 let s=source,l=labSource;
 l=replaceOnce(l,"skillLevels:{basic:1,special:1,powerful:1,passive:1}","skillLevels:"+JSON.stringify({basic:t.skill,special:t.skill,powerful:t.skill,passive:t.skill}));
 l=replaceOnce(l,"{level:2,stars:1}","{level:"+t.level+",stars:"+t.stars+"}");
 l=replaceOnce(l,'const scale=scenario==="rush"?.90:.72;', 'const scale=scenario==="rush"?'+t.rush+':'+t.mixed+';');
 if(variant!=="b14"){
  s=replaceOnce(s,'return typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability;',
    'return ('+kit.toString()+')(actor,abilityId,typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability,'+JSON.stringify(variant)+');');
  l=replaceOnce(l,"shared:12","shared:"+(variant==="b15-no-share"?0:10));
  // Shared bonus only on the real primary action. The existing B14.6 assist
  // emits separate damage but is not a root ability. Do not award it this bonus.
  l=replaceOnce(l,'actor.side==="ally"&&actor.id!=="ren"&&actor.id!=="nada"&&CombatStatusCore.read(target,"read-move")?.stacks>0',
    'actor.side==="ally"&&actor.id!=="ren"&&actor.id!=="nada"&&battle.events.some(e=>e.type==="ability"&&e.actorId===actor.id&&e.targetId===target.id)&&CombatStatusCore.read(target,"read-move")?.stacks>0');
 }
 const lab=new Function("module",l+"\nreturn B146;")({exports:{}});
 return {lab,api:lab.make(s,"visible")};
}
const sum=(xs,f)=>xs.reduce((n,x)=>n+f(x),0);
function run(ctx,squad,scenario,seed,policy="tactical"){
 const {lab,api}=ctx,b=lab.start(api,squad,scenario,seed);
 const allies=()=>b.fighters.filter(f=>f.side==="ally"),max=sum(allies(),f=>f.maxHp+f.maxProtection);
 let actions=0,marks=0,predicted=0,nadaSpecial=0,nadaSpecialPredicted=0,renDamage=0,otherDamage=0;
 const trace=[];
 while(b.active&&actions<160){
  const actor=b.fighters[b.currentActor];
  const target=b.fighters.flatMap((f,i)=>f.side==="enemy"&&f.hp>0?[i]:[]).sort((i,j)=>b.fighters[i].hp+b.fighters[i].protection-b.fighters[j].hp-b.fighters[j].protection||i-j)[0];
  const p=policy==="basic"?{abilityId:"basic",targetIndex:target,enemy:target}:lab.plan(api,b,true);
  if(!p||!lab.step(api,b,p.abilityId,p.targetIndex,p.enemy))throw Error("illegal "+JSON.stringify({squad,scenario,seed,policy,actor:actor?.id,p}));
  actions++;
  if(actor.id==="nada"&&p.abilityId==="special")nadaSpecial++;
  for(const e of b.events){
   if(e.type==="effect"&&e.effect==="read-move")marks++;
   if(e.type==="read-move-predicted"){predicted++;if(actor.id==="nada"&&p.abilityId==="special")nadaSpecialPredicted++;}
   if(e.type==="damage"&&e.actorId==="ren")renDamage+=e.amount;
   if(e.type==="damage"&&e.actorId&&e.actorId!=="ren"&&allies().some(f=>f.id===e.actorId))otherDamage+=e.amount;
  }
  trace.push([actor.id,p.abilityId,p.targetIndex,b.fighters.map(f=>[f.id,f.hp,f.protection,f.meter,api.T.read(f,"read-move")?.stacks??0])]);
 }
 if(b.active)throw Error("turn limit "+JSON.stringify({squad,scenario,seed,policy}));
 lab.validate(b);
 return {win:b.winner==="ally",quality:b.winner==="ally"&&allies().every(f=>f.hp>0),pool:sum(allies(),f=>f.hp+f.protection)/max,actions,marks,predicted,nadaSpecial,nadaSpecialPredicted,renDamage,otherDamage,trace};
}
function summarize(rows){const out={n:rows.length,w:sum(rows,r=>+r.win),q:sum(rows,r=>+r.quality)};
 for(const k of ["pool","actions","marks","predicted","nadaSpecial","nadaSpecialPredicted","renDamage","otherDamage"])out[k]=+(sum(rows,r=>r[k])/rows.length).toFixed(3);
 return out;}
function contracts(source,labSource){
 const checks=[];
 const check=(label,p)=>{if(!p)throw Error(label);checks.push(label);};
 const c=setup(source,labSource,"b15","early"),d=c.api.D,t=c.api.T;
 const hero=(id,level)=>({id,side:"ally",skillLevels:{basic:level,special:level,powerful:level,passive:level}});
 check("Ren slow begins L4",!d.get(hero("ren",3),"basic").onHitStatus&&d.get(hero("ren",4),"basic").onHitStatus.amount===20);
 check("Ren L6 synergy max 40%",d.get(hero("ren",6),"passive").combatRules.readMoveBonusPercentPerStack*4===40);
 check("Nada two stacks CD2",d.get(hero("nada",6),"special").onHitStatus.stacks===2&&d.get(hero("nada",6),"special").cooldown===2);
 const a=setup(source,labSource,"b15-nada3","early");
 check("alternative three stacks CD3",a.api.D.get(hero("nada",1),"special").onHitStatus.stacks===3&&a.api.D.get(hero("nada",1),"special").cooldown===3);
 check("owner leader rule",d.get(hero("art",1),"leader")===null&&d.get(hero("sava",1),"leader")===null);
 const b=c.lab.start(c.api,["ren","art","nada"],"rush",701);
 const enemy=b.fighters.find(f=>f.side==="enemy");
 check("stack cap",t.applyReadMove(enemy,3,2)&&t.applyReadMove(enemy,2,2)&&t.read(enemy,"read-move").stacks===4);
 check("spend three retains one",t.spendReadMove(enemy,3)&&t.read(enemy,"read-move").stacks===1);
 check("expiry after two own turns",t.tickOwnTurn(enemy)&&t.read(enemy,"read-move").remaining===1&&t.tickOwnTurn(enemy)&&t.read(enemy,"read-move")===null);
 const x=run(c,["ren","art","nada"],"rush",701),y=run(c,["ren","art","nada"],"rush",701);
 check("same seed identical command/state trace",JSON.stringify(x)===JSON.stringify(y));
 // Source drift fails closed: validate that the patch is not silently skipped.
 let failed=false;try{setup(source.replace('return typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability;','return ability;'),labSource,"b15","early");}catch{failed=true;}
 check("missing anchor rejects candidate",failed);
 return checks;
}
function experiment(source,labSource,count=20){
 if(!Number.isInteger(count)||count<1||count>60)throw Error("count");
 const seeds=Array.from({length:count},(_,i)=>Math.imul(i+17131,0x9e3779b1)>>>0);
 const checks=contracts(source,labSource),cells=[];
 for(const tier of Object.keys(TIERS))for(const variant of VARIANTS){
  const ctx=setup(source,labSource,variant,tier);
  for(const squad of SQUADS)for(const scenario of ["rush","mixed"]){
   const runs=seeds.map(seed=>run(ctx,squad,scenario,seed));
   cells.push({tier,variant,squad:squad.join("+"),scenario,policy:"tactical",...summarize(runs)});
   if(variant==="b15"){
    const basics=seeds.map(seed=>run(ctx,squad,scenario,seed,"basic"));
    cells.push({tier,variant,squad:squad.join("+"),scenario,policy:"basic",...summarize(basics)});
   }
  }
 }
 return {checks,seedCount:count,seeds,tiers:TIERS,battles:sum(cells,c=>c.n),cells};
}
if(typeof module!=="undefined")module.exports={setup,kit,run,experiment,contracts,VARIANTS,TIERS,SQUADS};
if(typeof require!=="undefined"&&typeof module!=="undefined"&&require.main===module){
 const fs=require("node:fs"),lab=require("../../combat-lab-real/engine.js");
 const source=lab.files.map(f=>fs.readFileSync(f,"utf8")).join("\n"),labSource=fs.readFileSync("combat-lab-real/engine.js","utf8");
 console.log(JSON.stringify(experiment(source,labSource,Number(process.argv[2]||20)),null,2));
}
