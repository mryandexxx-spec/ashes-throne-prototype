"use strict";
const assert=require("node:assert/strict"),M=require("../design/aud003-c4r-review.js"),I=require("../initiative-model.js"),N=require("../npc-enemy-data.js");
let syncs=0,rejected=0;
for(const sa of [60,100,160])for(const sb of [60,100,160])for(const ma of [0,100,500,900])for(const mb of [0,100,500,900]){
 const a={id:"a",index:0,hp:10,speed:sa,meter:ma},b={id:"b",index:1,hp:10,speed:sb,meter:mb},out=M.synchronize(a,b);
 if(!out){rejected++;continue}syncs++;
 assert.ok(Math.abs(out[0].meter+out[1].meter-ma-mb)<1e-7);
 const t=(1000-out[0].meter)/sa;assert.ok(Math.abs(t-(1000-out[1].meter)/sb)<1e-8);
 const state=out.map(x=>({...x}));const foe={id:"enemy",index:2,hp:10,speed:100,meter:1000-Math.min(t/2,5)*100};state.push(foe);
 assert.equal(I.nextActor(state).id,"enemy");I.finishTurn(state,"enemy");
 // Observe native nextActor, not a forced consecutive fake turn.
 for(let n=0;n<8&&state[0].meter<1000-1e-8;n++){const k=I.nextActor(state);if(k.id==="enemy")I.finishTurn(state,k.id);else break}
 assert.ok(Math.abs(state[0].meter-state[1].meter)<1e-6);assert.ok(state[0].meter>=1000-1e-8);
 const first=I.nextActor(state);assert.equal(first.id,"a");I.finishTurn(state,"a");const second=I.nextActor(state);assert.equal(second.id,"b");I.finishTurn(state,"b");
}
assert.equal(syncs+rejected,144);assert.ok(syncs>0&&rejected>0);
let transfers=0;
for(let d=0;d<=20;d++)for(let r=0;r<=20;r++)for(let q=1;q<=20;q++){
 const a={id:"art",hp:1,protection:d},b={id:"ally",hp:1,protection:r,maxProtection:20},x=M.redirectProtection(a,b,q);
 if(d===0||r===20){assert.equal(x,null);continue}
 transfers++;assert.equal(x.donor.protection+x.receiver.protection,d+r);assert.ok(x.donor.protection>=0&&x.receiver.protection<=20);assert.equal(x.amount,Math.min(d,20-r,q));
}
for(let a=1;a<=20;a++)for(let b=1;b<=20;b++)for(let d=a;d<=a+30;d++){
 const x=M.lethalTransfer(a,b,d),need=d-a+1;
 assert.equal(x.success,b>=need);assert.equal(x.artHp,b>=need?b-need:b);assert.equal(x.allyHp,b>=need?1:0);
}
const w={selected:"team",used:false,actions:0};assert.equal(M.reserve(w,"ultimate",true),w);assert.equal(M.reserve(w,"team",false),w);
const spent=M.reserve(w,"team",true);assert.equal(spent.actions,1);assert.equal(M.reserve({...spent,wave:2},"team",true).actions,1);
const unit={id:"ren",hp:5,meter:700};assert.equal(M.retreat(unit,0,false),null);assert.equal(M.retreat(unit,1,true),null);
const tucked=M.retreat(unit,1,false);assert.equal(tucked.singleTargetable,false);assert.equal(tucked.areaTargetable,true);assert.equal(M.returnAtReady(tucked),null);
assert.equal(M.returnAtReady({...tucked,meter:1000}).singleTargetable,true);
assert.equal(M.rescue({hp:0,maxHp:100,outcome:"dead"},"recoverable-ko",true,false),null);
assert.equal(M.rescue({hp:0,maxHp:100,outcome:"recoverable-ko"},"recoverable-ko",true,true),null);
assert.equal(M.rescue({hp:0,maxHp:100,outcome:"recoverable-ko"},"recoverable-ko",false,false),null);
assert.equal(M.rescue({hp:0,maxHp:100,outcome:"recoverable-ko"},"recoverable-ko",true,false).koRecorded,true);
const candidates=[{abilityId:"basic",legal:true,meaningful:true},{abilityId:"heal",legal:true,meaningful:false},{abilityId:"guard",legal:false,meaningful:true},{abilityId:"powerful",legal:true,meaningful:true}];
assert.equal(M.alternative(candidates[0],candidates).abilityId,"powerful");assert.equal(M.alternative(candidates[0],candidates.slice(0,3)),null);
const actor={id:"sava",hp:10,meter:1000},partner={id:"art",hp:10,meter:800,speed:110},skill={id:"special",ready:true,legal:true};
assert.equal(M.relay(actor,partner,skill,false).partnerMeter,800);assert.equal(M.relay(actor,partner,skill,false).turnCost,1);
for(const p of [{used:true},{id:"basic"},{id:"powerful"},{recursive:true},{extraAction:true},{ready:false},{legal:false}])assert.equal(M.relay(actor,partner,{...skill,...p},!!p.used),null);
assert.equal(M.relay(actor,{...partner,meter:1000},skill,false),null);
assert.equal(M.useGuardBypass({id:"guard",hp:10,guardHits:0}),null);assert.equal(M.useGuardBypass({id:"guard",hp:10,guardHits:2}).guardHitsAfter,2);
const catalog=N.all(),guard=catalog.filter(n=>Object.values(n.abilities).some(a=>a.kind==="guard")).length,heal=catalog.filter(n=>Object.values(n.abilities).some(a=>a.kind==="heal")).length;
assert.equal(catalog.length,10);assert.equal(guard,5);assert.equal(heal,2);
console.log("C4/R review: "+syncs+"/144 legal native scheduler fixtures, "+rejected+" rejected; "+transfers+" conserved protection transfers; 12400 lethal cases; 5/10 NPC guard-capable; 2/10 heal-capable; contract checks passed.");
