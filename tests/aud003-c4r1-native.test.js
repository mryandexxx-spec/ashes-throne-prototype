"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","skill-core.js","combat-status-core.js","battle-rng.js","npc-enemy-data.js","enemy-decision.js","combat-core.js","lab-command-loop/r1.js"].map(p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8")).join("\n");
const {C,N,A,L}=vm.runInNewContext(src+"\n({C:CombatCore,N:NpcEnemyData,A:AbilityData,L:TrustR1Lab})");
const unit=(id,side,hp,atk,speed,prot=0,def=0)=>({id,name:id,side,hp,atk,speed,physicalAttack:atk,magicAttack:atk,physicalDefense:def,magicDefense:def,protection:prot,maxProtection:prot,accuracy:10,evasion:5,critChance:5,critDamage:150,defensePenetration:0,debuffPotency:10,debuffResistance:10});
const find=(b,id)=>b.fighters.find(f=>f.id===id), idx=(b,id)=>b.fighters.findIndex(f=>f.id===id), use=(b,id,target)=>C.performActorAbility(b,id,idx(b,target));
function make(ids=["ren-bypass","art-intercept"],opts={}){const b=C.createBattle([unit("ren","ally",150,40,150,20,0),unit("art","ally",200,30,140,30,100),unit("ves","enemy",300,40,90,10),unit("shade","enemy",300,40,85)],[],{combat2:true,...(ids?{trustPersonal:ids}:{}),...opts});C.advanceToPlayerTurn(b);return b}
const no=make(null);find(no,"ves").guardHits=2;assert.equal(use(no,"ren-bypass","ves"),false);assert.equal(no.allyActions,0);
const ids=["ren-bypass","art-intercept"],b=make(ids);ids.pop();assert.equal(b.trustPersonal.length,2);const e=find(b,"ves");e.guardHits=2;
assert.equal(use(b,"ren-bypass","shade"),false);assert.equal(b.allyActions,0);assert.equal(C.personalPreview(b,"ren-bypass",idx(b,"ves")).guardPreserved,2);
assert.equal(use(b,"ren-bypass","ves"),true);assert.equal(e.hp,270);assert.equal(e.protection,0);assert.equal(e.guardHits,2);assert.equal(b.allyActions,1);assert.equal(b.trustPersonalCooldown["ren-bypass"],2);assert.equal(b.events.filter(x=>x.type==="trust-bypass").length,1);assert.equal(b.fighters[b.currentActor].id,"art");
assert.equal(use(b,"art-intercept","art"),false);assert.equal(use(b,"art-intercept","ren"),true);assert.equal(b.allyActions,2);
const redirects=b.events.filter(x=>x.type==="trust-intercept-resolved");assert.equal(redirects.length,1);assert.equal(redirects[0].protectedId,"ren");assert.equal(redirects[0].targetId,"art");
assert.ok(b.events.some(x=>x.type==="damage"&&x.actorId===redirects[0].sourceId&&x.targetId==="art"));assert.equal(b.trustIntercept,undefined);assert.equal(b.trustPersonalCooldown["art-intercept"],2);
const plain=make();find(plain,"ves").guardHits=2;assert.equal(use(plain,"basic","ves"),true);assert.equal(find(plain,"ves").guardHits,1);assert.ok(find(plain,"ves").hp>270);
assert.throws(()=>make(["ren-bypass","ren-bypass"]));assert.throws(()=>make(["art-intercept"],{tacticalTrust:{artTechnique:"standard"}}));
function forcedEnemy({area=false,miss=false,lethal=false}={}){
 const foes=[unit("ren","ally",150,40,80,20),unit("art","ally",200,30,150,30,100),{...N.spawn("npc-ridge-slinger",{instanceId:"foe"}),speed:50}];if(area)foes[2].npcAbilities={...foes[2].npcAbilities,basic:{id:"basic",kind:"damage",target:"all-enemies",damageType:"physical",multiplier:1,cooldown:0}};
 const x=C.createBattle(foes,[],{combat2:true,trustPersonal:["art-intercept"],...(miss?{hitChecks:true,rngSeed:7}:{})});C.advanceToPlayerTurn(x);assert.equal(x.fighters[x.currentActor].id,"art");assert.equal(use(x,"art-intercept","ren"),true);
 // Select a legal enemy command before Art's next turn; explicit fixture only.
 x.currentActor=idx(x,"foe");find(x,"foe").meter=1000;if(lethal){find(x,"art").hp=1;find(x,"art").protection=0;}
 assert.equal(use(x,"basic","ren"),true);
 if(area){assert.ok(x.events.some(e=>e.type==="damage"&&e.targetId==="ren"));assert.equal(x.events.filter(e=>e.type==="trust-intercept-resolved").length,0);}
 else {assert.ok(x.events.some(e=>e.type==="trust-intercept-resolved"&&e.targetId==="art"));if(lethal)assert.ok(x.events.some(e=>e.type==="death"&&e.targetId==="art"));}
 return x;
}
forcedEnemy({area:true});forcedEnemy({lethal:true});forcedEnemy({miss:true});
const stats=[];
for(const scenario of Object.keys(L.SCENARIOS))for(const enabled of [false,true]){
 const lab=L.create(C,A,N);assert.equal(lab.start(scenario,enabled),true);
 for(let i=0;i<150&&lab.view().active;i++){
  const v=lab.view(),foe=v.fighters.filter(f=>f.side==="enemy"&&f.hp>0).sort((a,b)=>a.hp-b.hp)[0],ren=v.fighters.find(f=>f.id==="ren"),personal=v.actions.find(a=>a.id==="ren-bypass"||a.id==="art-intercept"),power=v.actions.find(a=>a.id==="powerful"),special=v.actions.find(a=>a.id==="special");
  let id="basic",target=foe.id;
  if(v.actor==="ren"&&personal?.targets.includes(foe.id)){id=personal.id;}
  else if(v.actor==="art"&&personal?.targets.includes("ren")&&ren.hp<ren.maxHp*.8&&v.fighters.find(f=>f.id==="art").hp>ren.hp){id=personal.id;target="ren";}
  else if(v.actor==="art"&&special?.targets.includes("ren")&&ren.protection<10){id="special";target="ren";}
  else if(power?.targets.includes(foe.id)){id="powerful";}
  else if(special?.targets.includes(foe.id)){id="special";}
  assert.equal(lab.action(id,target),true);
 }
 const v=lab.view();assert.equal(v.active,false);assert.ok(v.last);stats.push({scenario,enabled,...v.last});
}
console.log(JSON.stringify(stats));console.log("C4/R1 native personal actions, native NPC AI, lifecycle and matched scenario execution passed");
