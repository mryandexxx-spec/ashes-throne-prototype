"use strict";
const assert=require("node:assert/strict"),M=require("../design/aud003-c4r-contract.js");
const all={owned:true,level:85,stars:7,gear:13,skills:{basic:6,special:6,powerful:6,passive:6}};
for(const hero of Object.keys(M.ACTIONS)){
 for(let r=1;r<=5;r++){
  const g=M.GATES[r],key=M.KEY_SKILL[hero],p={owned:true,level:g.level,stars:g.stars,gear:g.gear,skills:{[key]:g.skill}};
  assert.equal(M.qualify(hero,p,r),true);
  for(const k of ["level","stars","gear"])assert.equal(M.qualify(hero,{...p,[k]:p[k]-1},r),false);
  assert.equal(M.qualify(hero,{...p,skills:{[key]:g.skill-1}},r),false);
  assert.equal(M.qualify(hero,{...p,owned:false},r),false);
  assert.equal(M.rankAfter(hero,r-1,p,r,5),r);
  assert.equal(M.rankAfter(hero,r,p,1,1),r); // earned rank never revoked
 }
 assert.equal(M.rankAfter(hero,1,all,1,5),1); // purchases alone
 assert.equal(M.rankAfter(hero,1,all,2,1),1); // context not ready
 assert.equal(M.rankAfter(hero,1,all,5,5),1); // no pre-bank later proofs
 assert.equal(M.rankAfter(hero,1,all,2,5),2); // one earned step only
 assert.equal(M.rankAfter(hero,2,all,2,5),2); // same proof is not enough for III
}
const enemies=[{id:"guard",hp:30},{id:"signal",hp:20}],links=[{target:"signal",protector:"guard"}];
assert.deepEqual(M.screenedTargets(enemies,links),["guard"]);
assert.deepEqual(M.screenedTargets(enemies,links,true),["guard","signal"]);
assert.deepEqual(M.screenedTargets([{id:"guard",hp:0},enemies[1]],links),["signal"]);
const threat={targetId:"ren",artId:"art",protectedId:"ren",artHp:1,armed:true,area:false,redirectable:true,rootRedirected:false};
assert.deepEqual(M.intercept(threat),{targetId:"art",armed:false,rootRedirected:true});
for(const patch of [{area:true},{redirectable:false},{rootRedirected:true},{artHp:0},{targetId:"nada"}])
 assert.equal(M.intercept({...threat,...patch}).targetId,patch.targetId??"ren");
const plan={committed:true,primary:"strike",alternate:"brace",used:false};assert.equal(M.fallback(plan).selected,"brace");assert.equal(M.fallback(plan).enemyTurns,1);assert.equal(M.fallback(M.fallback(plan)),null);assert.equal(M.fallback({...plan,alternate:null}),null);
const unit={id:"ren",hp:5};assert.equal(M.shelter(unit,true),null);const covered=M.shelter(unit,false);assert.equal(covered.targetable,false);assert.equal(M.shelter(covered,false),null);assert.equal(M.releaseShelter(covered).actionsGranted,0);
let swaps=0;
for(const speedA of [80,100,120])for(const speedB of [80,100,120])for(const meterA of [0,300,600,900])for(const meterB of [0,300,600,900]){
 const a={id:"a",hp:1,speed:speedA,meter:meterA},b={id:"b",hp:1,speed:speedB,meter:meterB};
 const out=M.swap(a,b);if(out){swaps++;assert.equal(out[0].meter+out[1].meter,meterA+meterB);assert.ok(out.every(x=>x.meter<1000));assert.equal(out[0].speed,speedA);assert.equal(out[1].speed,speedB);}
}
assert.ok(swaps>0);assert.equal(M.swap({id:"a",hp:1,speed:100,meter:1000},{id:"b",hp:1,speed:100,meter:0}),null);
for(let ally=1;ally<=20;ally++)for(let art=1;art<=20;art++)for(let d=ally;d<=ally+30;d++){
 const out=M.lastLine(ally,art,d);assert.equal(out.transferred,Math.min(art,d-ally+1));assert.ok(out.allyHp>=0&&out.artHp>=0);assert.equal(out.allyHp,art>=d-ally+1?1:0);
}
assert.equal(M.lastLine(10,5,9),null);
assert.equal(M.recover({hp:0,maxHp:100,outcome:"dead"}),null);const revived=M.recover({hp:0,maxHp:100,outcome:"recoverable-ko"});assert.equal(revived.hp,20);assert.equal(revived.meter,0);assert.equal(revived.failedProofStillFailed,true);
let b={team:false,ultimate:false,actions:0,wave:1};assert.equal(M.spend(b,"team",false),b);b=M.spend(b,"team",true);b={...b,wave:2};assert.equal(M.spend(b,"team",true),b);b=M.spend(b,"ultimate",true);assert.equal(b.actions,2);assert.equal(M.spend(b,"ultimate",true),b);
assert.equal(new Set(Object.values(M.ACTIONS).flatMap(Object.values)).size,15);
console.log("C4/R contract: 25 rank thresholds, 144 readiness cases ("+swaps+" legal reversals), 12400 lethal cases, 15 distinct IDs and two battle budgets; passed.");
