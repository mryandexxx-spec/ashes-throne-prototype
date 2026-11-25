/* B15.2D: combine previously verified research patches into one actual CombatCore.
   No production imports, persistence or rewards. Browser and Node share this adapter. */
(function(root){"use strict";
const PARTS=["docs/research/aud003-b15-2a-read-move.js","docs/research/aud003-b15-2b-defense.js","docs/research/aud003-b15-2c-sava.js"];
const EXTRA=["gear-data.js","progress-core.js","progress-v3-core.js"];
const VARIANTS={
 legacy:{label:"Текущие навыки + подготовка",legacy:true},
 ref:{label:"B14.6 — контроль"},
 full:{label:"B15 — полный кандидат",def:"both",sava:"cap",marks:"b15"},
 bridge:{label:"B15 — осторожный",def:"both-recover",sava:"cap",preserve:true,share:10},
 recover:{label:"B15 — усиленное прикрытие",def:"both-recover",sava:"cap",preserve:true,share:10,recovery:.65},
 sava:{label:"B14.6 + новый Сава",sava:"cap"},
 "bridge-noshare":{label:"Осторожный без общего бонуса",def:"both-recover",sava:"cap",preserve:true,share:0},
 "recover-nopassive":{label:"Прикрытие без пассива Савы",def:"both-recover",sava:"nopassive",preserve:true,share:10,recovery:.65,cap:1},
 scaled:{label:"Защита от Protection",def:"both-recover",sava:"cap",preserve:true,share:10,recovery:.65,scaled:true},
 "scaled-group":{label:"Protection + 2 заряда на L4",def:"both-recover",sava:"cap",preserve:true,share:10,recovery:.65,scaled:true,group2:true},
 "art-only":{label:"Новая страховка Арта",def:"art",sava:"cap",preserve:true,share:10,recovery:.65,scaled:true},
 "liora-only":{label:"Новая защита Лиоры",def:"liora",sava:"cap",preserve:true,share:10,scaled:true,group2:true}
};
const SQUADS={
 starter:["ren","art"],three:["ren","art","nada"],tempo:["ren","art","sava"],support:["art","nada","sava"],
 four:["liora","ren","nada","sava"],full:["ren","art","nada","liora","sava"],
 alternative:["b14-striker","art","nada","liora","sava"],
 independent:["b14-striker","art","b14-breaker","liora","sava"]
};
const SCENARIOS={
 duel:{label:"Равный отряд",kind:"fight"},rush:{label:"Две опасные угрозы",kind:"rush"},area:{label:"Массовый удар",kind:"area"},
 waves:{label:"Две волны",kind:"waves"},hold:{label:"Удержать союзника",kind:"hold"},priority:{label:"Лекарь первым",kind:"priority"}
};
const CELLS=[["starter","duel"],["starter","rush"],["three","rush"],["tempo","rush"],["support","hold"],["support","rush"],["four","area"],["full","duel"],["full","rush"],["full","area"],["full","waves"],["full","hold"],["full","priority"],["alternative","duel"],["alternative","rush"],["alternative","waves"],["independent","duel"],["independent","rush"],["independent","waves"]];
const FAMILIES={
 fight:["npc-trail-interceptor","npc-pass-guard","npc-ridge-slinger","npc-field-medic","npc-watch-captain"],
 rush:["npc-trail-interceptor","npc-ridge-slinger","npc-trail-interceptor","npc-pass-guard","npc-watch-captain"],
 area:["npc-ridge-slinger","npc-trail-interceptor","npc-pass-guard","npc-field-medic","npc-watch-captain"],
 hold:["npc-trail-interceptor","npc-ridge-slinger","npc-pass-guard","npc-watch-captain","npc-field-medic"],
 priority:["npc-field-medic","npc-pass-guard","npc-trail-interceptor","npc-ridge-slinger","npc-watch-captain"]
};
const TIER_LABEL={early:"L2 · 1★ · G1",mid:"L15 · 3★ · G7",max:"L85 · 7★ · G13",uneven:"L15 · 3★ · G13 Рен / G1 остальные"};
const sum=(a,f)=>a.reduce((n,x)=>n+f(x),0);
function rep(s,a,b,n=1){if(s.split(a).length!==n+1)throw Error("B15.2D anchor "+a);return s.split(a).join(b);}
function moduleFrom(code,patch=false){
 if(patch){
  // Export the existing setup() patch stage rather than its final engine.
  // The original skill adapter is applied once, in a composed wrapper.
  const lines=code.split("\n"),hits=lines.filter(x=>x.includes("s=rep(s,")&&x.includes("return typeof SkillCore"));
  if(hits.length!==1)throw Error("kit patch anchor");
  code=rep(code,hits[0],"");
  const tail=code.match(/ const lab=new Function\("module",l\+"\\nreturn B146;"\)\(\{exports:\{\}\}\);\n return \{lab,api:lab\.make\([^\n]+,"visible"\),c\};/);
  if(!tail)throw Error("setup tail");
  code=rep(code,tail[0]," return {s,l,c};");
 }
 const m={exports:{}};new Function("module",code+"\nmodule.exports.kit=kit;")(m);return m.exports;
}
function loadSources(labSource,source,extra,parts){
 if(parts.length!==3)throw Error("parts");
 const lab=new Function("module",labSource+"\nreturn B146;")({exports:{}});
 const [marks,def,sava]=[moduleFrom(parts[0]),moduleFrom(parts[1],true),moduleFrom(parts[2],true)];
 return {lab,labSource,source,extra,marks,def,sava};
}
function combinedKit(actor,id,base,c,markKit,defKit,savaKit){
 let a=base;
 if(c.marks)a=markKit(actor,id,a,c.marks);
 if(c.defConfig)a=defKit(actor,id,a,c.defConfig);
 if(c.savaConfig)a=savaKit(actor,id,a,c.savaConfig);
 if(c.preserve&&["art","liora"].includes(actor.id)&&a?.kind==="damage"&&base?.kind==="damage")a={...a,multiplier:base.multiplier};
 if(c.recovery&&actor.id==="art"&&id==="special"&&a?.b15Guard)a={...a,b15Guard:{...a.b15Guard,recover:c.recovery}};
 if(c.group2&&actor.id==="liora"&&id==="powerful"&&a?.b15Guard&&(actor.skillLevels?.powerful??1)>=4)a={...a,guardHits:2,b15Guard:{...a.b15Guard,hits:2}};
 return a;
}
function setup(input,variant){
 const v=VARIANTS[variant];if(!v)throw Error("variant");
 const {marks,def,sava}=input;let s=input.source,l=input.labSource,dc=null,sc=null;
 if(v.def){const p=def.setup(s,l,v.def,"early");
  // Defense and signal slices both used b15grant locally. Namespace before composition.
  s=p.s.replace(/\bb15(count|prune|grant|guard|react|finish|cross|disrupt)\b/g,(_,name)=>"b15Def"+name);l=p.l;dc=p.c;
  if(v.scaled){
   s=rep(s,"capDamage:Math.round(owner.physicalAttack*g.cap)","capDamage:Math.round(Math.max(owner.physicalAttack*g.cap,owner.maxProtection*.45))");
   s=rep(s,"Math.round(owner.physicalAttack*g.recover)","Math.round(Math.max(owner.physicalAttack*g.recover,owner.maxProtection*.30))");
   s=rep(s,"Math.round(art.physicalAttack*rules.cap)","Math.round(Math.max(art.physicalAttack*rules.cap,art.maxProtection*.35))");
  }
 }
 const p=sava.setup(s,l,input.extra,v.sava??"ref");s=p.s;l=p.l;sc=p.c;
 if(v.cap){s=rep(s,'const B15SAVA='+JSON.stringify(sc)+';','const B15SAVA='+JSON.stringify({...sc,cap:v.cap})+';');sc={...sc,cap:v.cap};}
 if(v.legacy){
  l=rep(l,'art:"recover",meter:0,damage:.55,shared:12,hybrid:.8,stable:true,telegraph:mode!=="direct",react:mode!=="direct"','art:"legacy",meter:null,damage:0,shared:0,hybrid:0,stable:true,telegraph:mode!=="direct",react:false');
 }
 if(v.marks||v.share!==undefined){
  l=rep(l,"shared:12","shared:"+(v.share??10));
  l=rep(l,'actor.side==="ally"&&actor.id!=="ren"&&actor.id!=="nada"&&CombatStatusCore.read(target,"read-move")?.stacks>0','actor.side==="ally"&&actor.id!=="ren"&&actor.id!=="nada"&&battle.events.some(e=>e.type==="ability"&&e.actorId===actor.id&&e.targetId===target.id)&&CombatStatusCore.read(target,"read-move")?.stacks>0');
 }
 if(v.marks||dc||sc.candidate){
  const c={...v,defConfig:dc,savaConfig:sc};
  s=rep(s,'return typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability;', 'return ('+combinedKit.toString()+')(actor,abilityId,typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability,'+JSON.stringify(c)+','+marks.kit.toString()+','+def.kit.toString()+','+sava.kit.toString()+');');
 }
 const lab=new Function("module",l+"\nreturn B146;")({exports:{}}),api=lab.make(input.extra+"\n"+s,"visible");
 const ctx={api,lab,c:sc,variant,v,input};ctx.profiles=Object.fromEntries(Object.keys(sava.TIERS).map(tier=>[tier,sava.gearProfiles(ctx,tier)]));return ctx;
}
function create(ctx,{tier="early",squad="full",scenario="duel",seed=7,scale=1,order="normal",leader=false}={}){
 const {api,profiles}=ctx;const config=ctx.input.sava.TIERS[tier],ids=SQUADS[squad],kind=SCENARIOS[scenario]?.kind;
 if(!config||!ids||!kind||!Number.isFinite(scale)||scale<=0||!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error("invalid battle options");
 let slots=ids.slice();if(order==="allies"||order==="both")slots.reverse();
 if((leader||order==="liora-first")&&slots.includes("liora"))slots=["liora",...slots.filter(id=>id!=="liora")];
 const party=slots.map(id=>{const src=id==="b14-striker"?"ren":id==="b14-medic"?"nada":id==="b14-breaker"?"art":id;return {...profiles[tier][src].hero,id,name:ctx.lab.names[id],tags:id.startsWith("b14-")?[]:profiles[tier][src].hero.tags};});
 function foes(w,k,n){
  const family=FAMILIES[k],list=family.slice(0,n).map((id,i)=>{
   const enemy=api.N.spawn(id,{instanceId:"w"+w+"-e"+i}),f=scale*.75,offense=scale*({early:1.35,mid:1.45,max:2.65,uneven:1.65}[tier]);
   const npcAbilities=k==="area"&&i===0?{...enemy.npcAbilities,powerful:{...enemy.npcAbilities.powerful,target:"all-enemies",multiplier:.72}}:enemy.npcAbilities;
   return {...enemy,npcAbilities,name:enemy.name+" "+(i+1),hp:Math.max(1,Math.round(enemy.hp*f)),protection:Math.round(enemy.protection*f),maxProtection:Math.round(enemy.protection*f),physicalAttack:Math.max(1,Math.round(enemy.physicalAttack*offense)),atk:Math.max(1,Math.round(enemy.physicalAttack*offense)),assaultFocus:k==="hold"};
  });if(order==="enemies"||order==="both")list.reverse();return list;
 }
 const count=party.length,first=kind==="waves"?foes(1,"rush",Math.min(count,3)):foes(1,kind,count),waves=kind==="waves"?[foes(2,"area",Math.min(count,4))]:[];
 const objective=kind==="hold"?{kind:"hold-or-defeat",protectAllyId:slots.includes("nada")?"nada":slots[0],allyActionsToHold:8}:kind==="priority"?{kind:"priority-first",priorityEnemyId:"w1-e0"}:undefined;
 const b=api.C.createBattle([...party,...first],waves,{leaderId:leader&&slots[0]==="liora"?"liora":null,rngSeed:seed,hitChecks:true,critChecks:true,penetrationChecks:true,statusChecks:true,...(objective?{tacticalObjective:objective}:{})});
 api.C.advanceToPlayerTurn(b);ctx.lab.validate(b);return b;
}
function plan(ctx,b,mode="tactical"){
 const {api,lab}=ctx,actor=b.fighters[b.currentActor],allies=b.fighters.flatMap((f,i)=>f.side==="ally"&&f.hp>0?[i]:[]),foes=b.fighters.flatMap((f,i)=>f.side==="enemy"&&f.hp>0?[i]:[]);
 const pool=i=>b.fighters[i].hp+b.fighters[i].protection,ratio=i=>pool(i)/(b.fighters[i].maxHp+b.fighters[i].maxProtection),others=allies.filter(i=>i!==b.currentActor),focus=foes.find(i=>!b.priorityCleared&&b.fighters[i].id===b.tacticalObjective?.priorityEnemyId);
 const enemy=focus??foes.slice().sort((a,z)=>pool(a)-pool(z)||a-z)[0],ready=id=>api.C.abilityReady(b,id),pick=(abilityId,targetIndex,helper)=>({abilityId,targetIndex,enemy,helper});
 if(mode==="basic")return pick("basic",enemy);
 const threats=foes.filter(i=>b.fighters[i].b14Prepared),taunter=allies.find(i=>api.T.read(b.fighters[i],"taunt")),warned=threats.map(i=>taunter??allies.find(j=>b.fighters[j].id===b.fighters[i].b14Prepared)).filter(i=>i!==undefined);
 const guards=i=>b.fighters[i].guardHits+(b.fighters[i].b15Guards??[]).reduce((n,g)=>n+g.hits,0);
 if(actor.id==="art"){
  const threat=threats.find(i=>focus===undefined||focus===i);
  if(threat!==undefined&&ready("powerful"))return pick("powerful",threat);
  const t=others.slice().sort((a,z)=>(warned.includes(z)?1:0)-(warned.includes(a)?1:0)||ratio(a)-ratio(z))[0];
  if(t!==undefined&&ready("special")&&!guards(t)&&(warned.includes(t)||ratio(t)<.6))return pick("special",t);
  if(ready("powerful"))return pick("powerful",enemy);return pick("basic",enemy);
 }
 if(actor.id==="liora"){
  const area=foes.some(i=>api.D.get(b.fighters[i],"powerful")?.target==="all-enemies"&&b.fighters[i].powerfulCooldown===0);
  const endangered=allies.filter(i=>!guards(i)&&(ratio(i)<.7||warned.includes(i)||area));
  if(ready("powerful")&&endangered.length>=2&&(area||warned.length>=2||endangered.length>=3))return pick("powerful",b.currentActor);
  if(ready("special")&&!api.T.read(actor,"taunt")&&ratio(b.currentActor)>.45&&others.some(i=>warned.includes(i)||ratio(i)<.65))return pick("special",b.currentActor);
  if(ready("powerful")&&endangered.length>=2)return pick("powerful",b.currentActor);
  return pick("basic",enemy);
 }
 if(actor.id==="sava"){
  if(ctx.v.legacy){
   if(ready("powerful")&&others.length>=2&&!b.coordinatedWindow)return pick("powerful",b.currentActor);
   const t=others.filter(i=>b.fighters[i].meter<850).sort((a,z)=>b.fighters[z].physicalAttack-b.fighters[a].physicalAttack)[0];
   if(t!==undefined&&ready("special"))return pick("special",t);
   return pick("basic",enemy);
  }
  const p=ctx.input.sava.plan(ctx,b,mode),d=api.D.get(actor,p.abilityId);
  return {...p,enemy,targetIndex:d.target==="enemy"?enemy:p.targetIndex};
 }
 // Use existing planner for Ren/Nada/fixtures, with safe priority objective.
 const p=lab.plan(api,b,true),d=api.D.get(actor,p.abilityId);
 return focus!==undefined&&d.target==="all-enemies"?pick("basic",focus):{...p,enemy,targetIndex:focus!==undefined&&d.target==="enemy"?focus:p.targetIndex};
}
function legal(ctx,b,abilityId,target,helper,enemy){
 if(!b.active||!ctx.api.C.abilityReady(b,abilityId))return false;
 const a=b.fighters[b.currentActor],d=ctx.api.D.get(a,abilityId),targets=ctx.api.C.actorTargetIndices(b,b.currentActor,d.target,target);
 if(!targets.length)return false;
 if(["insurance","signal"].includes(d.kind)&&targets[0]===b.currentActor)return false;
 if(d.b15Signal){const f=b.fighters[targets[0]];if(f.meter>=950)return false;}
 if(d.b15Assist&&(!Number.isInteger(helper)||b.fighters[helper]?.side!=="ally"||b.fighters[helper]?.hp<=0||helper===b.currentActor))return false;
 return Number.isInteger(enemy)&&b.fighters[enemy]?.side==="enemy"&&b.fighters[enemy].hp>0;
}
function step(ctx,b,abilityId,target,helper,enemy){
 if(!legal(ctx,b,abilityId,target,helper,enemy))return false;
 if(!ctx.api.C.chooseEnemy(b,enemy))return false;
 const ok=ctx.api.C.performActorAbility(b,abilityId,target,helper);if(!ok)return false;
 ctx.lab.validate(b);
 if(b.fighters.some(f=>(f.b15Guards??[]).some(g=>!["art","liora"].includes(g.kind)||!Number.isInteger(g.hits)||g.hits<=0||!Number.isInteger(g.turns)||g.turns<=0||!Number.isFinite(g.capDamage)||g.capDamage<0||!Number.isFinite(g.fraction))||f.hp<=0&&f.b15Guards?.length)||b.events.some(e=>e.assist&&e.depth!==1)||Object.keys(b.b15Stats??{}).some(k=>k.includes("undefined")))throw Error("invalid derived state");
 return true;
}
function run(ctx,opts,mode="tactical",trace=false){
 const b=create(ctx,opts),allies=()=>b.fighters.filter(f=>f.side==="ally"),max=sum(allies(),f=>f.maxHp+f.maxProtection),usage={},events={},traces=[];
 let actions=0;
 while(b.active&&actions<240){
  const a=b.fighters[b.currentActor],p=plan(ctx,b,mode);
  if(!step(ctx,b,p.abilityId,p.targetIndex,p.helper,p.enemy))throw Error("illegal "+JSON.stringify({variant:ctx.variant,opts,actor:a.id,p}));
  actions++;usage[a.id+":"+p.abilityId]=(usage[a.id+":"+p.abilityId]??0)+1;
  for(const e of b.events){if(["read-move-predicted","wave-start","death","miss","status-resisted","b15-meter"].includes(e.type))events[e.type]=(events[e.type]??0)+1;}
  if(trace)traces.push({actor:a.id,p,turn:b.turn,wave:b.wave,events:b.events.map(e=>({...e})),fighters:b.fighters.map(f=>({id:f.id,hp:f.hp,protection:f.protection,meter:f.meter,guards:f.b15Guards?.map(g=>({...g})),prepared:f.b14Prepared}))});
 }
 if(b.active)throw Error("turn cap "+JSON.stringify({variant:ctx.variant,opts}));
 return {w:+(b.winner==="ally"),q:+(b.winner==="ally"&&allies().every(f=>f.hp>0)),pool:sum(allies(),f=>f.hp+f.protection)/max,actions,wave:b.wave,usage,events,stats:b.b15Stats??{},threat:b.b14Counts??{},...(trace?{traces}:{})};
}
function summarize(rows){
 const n=rows.length,o={n,w:sum(rows,x=>x.w),q:sum(rows,x=>x.q),pool:+(sum(rows,x=>x.pool)/n).toFixed(3),actions:+(sum(rows,x=>x.actions)/n).toFixed(3),wave2:sum(rows,x=>+(x.wave===2)),usage:{},stats:{},threat:{},events:{}};
 for(const k of ["usage","stats","threat","events"])for(const row of rows)for(const [id,v] of Object.entries(row[k]))o[k][id]=(o[k][id]??0)+v;return o;
}
function calibrate(input,count=8){
 const ctx=setup(input,"ref"),seeds=Array.from({length:count},(_,i)=>Math.imul(i+91321,0x9e3779b1)>>>0),rows=[],selected={};
 for(const [tier,t] of Object.entries(input.sava.TIERS)){
  selected[tier]={};
  for(const squad of ["starter","three","four","full"]){
   const n=SQUADS[squad].length,options=[];
   for(const factor of [.55,.75,.95,1.15,1.4,1.7,2.05,2.5,3]){
    const scale=+(t.pressure*factor).toFixed(3),results=summarize(seeds.map(seed=>run(ctx,{tier,squad,scenario:"duel",scale,seed})));
    const score=Math.abs(results.w/count-.82)*1.8+Math.abs(results.q/count-.55)+Math.abs(results.pool-.52)*.6+Math.max(0,results.actions-(n*8+4))*.015;
    options.push({tier,squad,size:n,scale,score,...results});
   }
   options.sort((a,z)=>a.score-z.score||a.scale-z.scale);selected[tier][n]=options[0].scale;rows.push(...options);
  }
 }
 return {seeds,selected,rows,battles:rows.length*count};
}
function pressure(cal,tier,squad,scenario,difficulty="hard"){
 const n=SQUADS[squad].length,base=cal[tier][n],factor=scenario==="waves"?.88:scenario==="hold"?1.18:scenario==="priority"?.9:scenario==="rush"?1.0:scenario==="area"?1.0:1;
 return +(base*factor*(difficulty==="normal"?.78:1)).toFixed(3);
}
function experiment(input,cal,count=20,holdout=false){
 const seeds=Array.from({length:count},(_,i)=>Math.imul(i+(holdout?102133:101031),0x9e3779b1)>>>0),cells=[];
 const variants=holdout?["ref","bridge","recover","sava","recover-nopassive","scaled","scaled-group","art-only","liora-only"]:["legacy","ref","full","bridge","recover","sava","bridge-noshare"];
 const selected=holdout?CELLS.filter(([s,k])=>!["four","support"].includes(s)||k==="hold"):CELLS;
 for(const variant of variants){const ctx=setup(input,variant);
  for(const tier of Object.keys(input.sava.TIERS))for(const [squad,scenario] of selected){
   const modes=variant==="recover"||variant==="ref"?["tactical","basic"]:["tactical"];
   for(const mode of modes){const scale=pressure(cal,tier,squad,scenario),opts={tier,squad,scenario,scale,order:holdout?"both":"normal"};
    const results=summarize(seeds.map(seed=>run(ctx,{...opts,seed},mode)));
    cells.push({tier,variant,squad,scenario,mode,scale,...results});
   }
  }
 }
 return {seeds,holdout,battles:sum(cells,c=>c.n),cells};
}
function followup(input,cal,count=20){
 const seeds=Array.from({length:count},(_,i)=>Math.imul(i+120211,0x9e3779b1)>>>0),cells=[];
 const selected=[["starter","duel"],["three","rush"],["tempo","rush"],["support","hold"],["full","duel"],["full","rush"],["full","area"],["full","waves"],["alternative","duel"],["independent","duel"],["independent","waves"]];
 for(const variant of ["ref","sava","scaled-group","art-only","liora-only"]){
  const ctx=setup(input,variant);
  for(const tier of ["early","mid","max","uneven"])for(const [squad,scenario] of selected){
   const modes=variant==="sava"||variant==="scaled-group"?["tactical","basic"]:["tactical"];
   for(const mode of modes){
    const scale=pressure(cal,tier,squad,scenario,"normal")*(squad==="support"?.70:1);
    cells.push({tier,variant,squad,scenario,mode,scale,difficulty:"normal",...summarize(seeds.map(seed=>run(ctx,{tier,squad,scenario,scale,seed},mode)))});
   }
  }
  // Single-axis ally-slot and enemy-slot checks (same seed & pressure).
  for(const tier of ["early","max"])for(const squad of ["full","independent"])for(const order of ["normal","allies","enemies","both"]){
   const scenario="duel",scale=pressure(cal,tier,squad,scenario);
   cells.push({tier,variant,squad,scenario,mode:"tactical",order,scale,difficulty:"hard-permutation",...summarize(seeds.map(seed=>run(ctx,{tier,squad,scenario,scale,seed,order})))});
  }
  // Leadership must compare identical Liora-first order, not slot change.
  for(const tier of ["early","max"])for(const leader of [false,true]){
   const scenario="area",squad="full",scale=pressure(cal,tier,squad,scenario);
   cells.push({tier,variant,squad,scenario,mode:"tactical",leader,scale,difficulty:"leader",...summarize(seeds.map(seed=>run(ctx,{tier,squad,scenario,scale,seed,order:"liora-first",leader})))});
  }
 }
 return {seeds,battles:sum(cells,c=>c.n),cells};
}
const exported={PARTS,EXTRA,VARIANTS,SQUADS,SCENARIOS,CELLS,TIER_LABEL,loadSources,setup,create,plan,legal,step,run,summarize,calibrate,pressure,experiment,followup};
if(typeof module!=="undefined")module.exports=exported;else root.B15D=exported;
})(typeof globalThis!=="undefined"?globalThis:this);
