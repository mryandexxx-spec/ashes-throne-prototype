"use strict";
const fs=require("node:fs"),path=require("node:path"),{test}=require("node:test"),assert=require("node:assert/strict");
const E=require("../lab-combat-2/engine.js"),S=require("../lab-combat-2/source-snapshot.json"),P=require("../lab-combat-2/parts-snapshot.json"),cal=require("../lab-combat-2/calibration.json");
const files=Object.keys(S.blobs).filter(x=>!["gear-data.js","progress-core.js","progress-v3-core.js","combat-lab-real/engine.js"].includes(x));
const load=source=>new Function(source+"\nreturn {C:CombatCore,D:AbilityData,A:AutoDecision,N:NpcEnemyData,T:CombatStatusCore};")();
const api=load(files.map(f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8")).join("\n"));
const old=load(S.source),ctx=E.setup(E.loadSources(S.labSource,S.source,S.extra,P.parts),"sava");
function verify(api,old,E,ctx,cal){
 const check=(x,msg)=>{if(!x)throw Error(msg);},equal=(a,b,msg)=>check(JSON.stringify(a)===JSON.stringify(b),msg+" "+JSON.stringify([a,b]).slice(0,1800));
 const C=api.C, D=api.D, native={...ctx,api:{...ctx.api,...api,C:{...C,createBattle:(h,w,o)=>C.createBattle(h,w,{...o,combat2:true})}}};
 const normalized=(b,isNative)=>({active:b.active,winner:b.winner,turn:b.turn,wave:b.wave,actions:b.allyActions,actor:b.currentActor,priority:b.priorityCleared??null,rng:b.rng??null,f:b.fighters.map(f=>[f.id,f.hp,f.protection,+f.meter.toFixed(8),f.specialCooldown,f.powerfulCooldown,f.guardHits,f.weakenAttacks,f.effects,f.hp>0?(isNative?f.combat2Prepared:f.b14Prepared)??null:null,(isNative?f.combat2Boost:f.b15SignalBoost)??null,!!(isNative?f.combat2ReactUsed:f.b14ReactUsed)])});
 let battles=0,commands=0,diffs=[],autoChoices=0,events={};
 for(const tier of ["early","mid","max","uneven"])for(const [squad,scenario] of [["starter","rush"],["three","duel"],["tempo","rush"],["full","area"],["full","waves"],["full","priority"]])for(const seed of [7,89217]){
  const opts={tier,squad,scenario,seed,scale:E.pressure(cal.selected,tier,squad,scenario,"normal")};
  const l=E.create(ctx,opts),b=E.create(native,opts);
  let n=0;
  while(true){
   const x=normalized(l,false),y=normalized(b,true);
   if(JSON.stringify(x)!==JSON.stringify(y)){const fields=Object.keys(x).filter(k=>JSON.stringify(x[k])!==JSON.stringify(y[k]));diffs.push({opts,n,fields,first:x.f.find((q,i)=>JSON.stringify(q)!==JSON.stringify(y.f[i])),other:y.f.find((q,i)=>JSON.stringify(q)!==JSON.stringify(x.f[i]))});break;}
   if(!l.active){battles++;commands+=n;break;}
   check(n++<240,"command cap");const p=E.plan(ctx,l);
   const before=JSON.stringify(b),auto=api.A.chooseAction(b);
   equal([auto.abilityId,auto.targetIndex,auto.helperIndex??null],[p.abilityId,p.targetIndex,p.helper??null],"auto policy");check(before===JSON.stringify(b),"auto mutated");autoChoices++;

   check(E.step(ctx,l,p.abilityId,p.targetIndex,p.helper,p.enemy),"lab illegal");
   check(C.chooseEnemy(b,p.enemy)&&C.performActorAbility(b,p.abilityId,p.targetIndex,p.helper),"native illegal "+JSON.stringify({opts,n,p}));
   for(const e of b.events)if(e.type.startsWith("combat2-")||e.assist)events[e.type]=(events[e.type]??0)+1;
  }
 }
 const heroes=["sava","ren","art","liora","nada"].map(id=>({...ctx.profiles.early[id].hero,id})),foe={...api.N.spawn("npc-pass-guard",{instanceId:"foe"}),hp:1000,protection:50,maxProtection:50,speed:1};
 const fixture=(options={},wave=[])=>C.createBattle([...heroes,foe],wave,{combat2:true,...options});
 const b=fixture(),idx=id=>b.fighters.findIndex(f=>f.id===id),f=id=>b.fighters[idx(id)],ready=(id,backup)=>{b.fighters.forEach(x=>x.meter=0);f(id).meter=1000;f(backup).meter=1000;b.currentActor=idx(id)};
 const done=[];const test=(name,fn)=>{fn();done.push(name);};
 test("explicit mode only; default replay equals baseline",()=>{
  const x=C.createBattle([...heroes,foe],[],{rngSeed:42,hitChecks:true,critChecks:true}),y=old.C.createBattle([...heroes,foe],[],{rngSeed:42,hitChecks:true,critChecks:true});
  C.advanceToPlayerTurn(x);old.C.advanceToPlayerTurn(y);
  for(let n=0;n<30&&x.active;n++){equal(x,y,"default state");const p=old.A.chooseAction(y);check(C.performAutoAction(x,p)&&old.C.performAutoAction(y,p),"default execute");}equal(x,y,"default final");
  check(!C.createBattle([{...heroes[0],combat2:true},foe]).fighters[0].combat2,"spoofed mode");
  check(D.get(x.fighters[0],"powerful").kind==="coordinate","default kit");
 });
 test("leader eligibility opt-in",()=>{check(D.get(f("art"),"leader")===null&&D.get(f("sava"),"leader")===null&&D.get(f("liora"),"leader"),"leader definitions");});
 test("helper invalid command atomic",()=>{ready("sava","ren");const before=JSON.stringify(b);for(const h of [undefined,idx("sava"),idx("foe"),"1"]){check(!C.performActorAbility(b,"powerful",idx("foe"),h),"bad helper accepted");check(before===JSON.stringify(b),"mutation");}});
 test("joint hit root, cap, helper unchanged, passive",()=>{const helper=f("ren");helper.physicalAttack=189;helper.specialCooldown=2;helper.weakenAttacks=1;const before=[helper.meter,helper.specialCooldown,helper.weakenAttacks];check(C.performActorAbility(b,"powerful",idx("foe"),idx("ren")),"joint");equal([helper.meter,helper.specialCooldown,helper.weakenAttacks],before,"helper");const hits=b.events.filter(e=>e.assist&&e.type==="damage");check(hits.length===1&&hits[0].depth===1&&hits[0].raw<=f("sava").physicalAttack,"hit/cap");check(hits[0].rootId===b.events.find(e=>e.type==="ability").rootId,"root");check(f("sava").combat2Boost===50,"boost");});
 test("signal rejects ready target and consumes boost once",()=>{ready("sava","liora");f("ren").meter=1000;let before=JSON.stringify(b);check(!C.performActorAbility(b,"special",idx("ren"))&&before===JSON.stringify(b),"zero gain");f("ren").meter=700;before=JSON.stringify(b);const p=C.previewSignal(b,f("sava"),300,f("ren"));check(p.gain===250&&before===JSON.stringify(b),"preview");check(C.performActorAbility(b,"special",idx("ren"))&&f("ren").meter===950&&!f("sava").combat2Boost&&!f("ren").fieldSignal,"signal");});
 test("Art restore without HP transfer",()=>{ready("art","liora");f("ren").protection=0;const hp=f("art").hp;check(C.performActorAbility(b,"special",idx("ren")),"cover");check(f("ren").guardHits===1&&f("ren").protection===Math.round(f("art").physicalAttack*.65)&&!f("ren").insurance&&f("art").hp===hp,"cover result");});
 test("primary kill does not retarget helper; wave clears boost",()=>{const next={...foe,id:"next"};const x=fixture({},[[next]]),a=x.fighters[0],h=x.fighters[1];a.meter=h.meter=1000;x.currentActor=0;x.fighters[5].hp=1;x.fighters[5].protection=0;a.combat2Boost=50;check(C.performActorAbility(x,"powerful",5,1),"wave kill");check(x.wave===2&&!a.combat2Boost&&!x.events.some(e=>e.assist&&e.type==="damage"),"wave cleanup");});
 test("automatic helper selection valid",()=>{const x=fixture();x.fighters[0].meter=x.fighters[1].meter=1000;x.currentActor=0;const before=JSON.stringify(x),p=api.A.chooseAction(x);check(before===JSON.stringify(x)&&p.abilityId==="powerful"&&p.helperIndex!==undefined,"auto plan");check(C.performAutoAction(x,p),"auto execute");});
 return {battles,commands,diffs,autoChoices,events,contracts:done};
}
test("native opt-in Combat 2.0 direct contracts and lab command replay",()=>{const result=verify(api,old,E,ctx,cal);assert.equal(result.contracts.length,8);assert.equal(result.diffs.length,0,JSON.stringify(result.diffs.slice(0,3)));assert.equal(result.battles,48);assert.equal(result.autoChoices,result.commands);assert.ok(result.events["combat2-threat-prepared"]>0);assert.ok(result.events["combat2-threat-resolved"]>0);assert.ok(result.events["combat2-threat-cancelled"]>0);assert.ok(result.events["combat2-cover"]>0);});
