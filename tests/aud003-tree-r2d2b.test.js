"use strict";const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const files=["initiative-model.js","ability-data.js","skill-core.js","combat-status-core.js","npc-enemy-data.js","enemy-decision.js","battle-rng.js","combat-core.js","hero-collection-core.js","star-core.js","gear-data.js","progress-core.js","progress-v3-core.js","hero-stats-core.js","hero-stats-profiles.js","hero-stats-combat-bridge.js","main-campaign-core.js","art-adventure-core.js"];
const {P,S,C,A,M,T,N}=vm.runInNewContext(files.map(f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8")).join("\n")+"\n({P:ProgressV3Core,S:StarCore,C:CombatCore,A:AbilityData,M:MainCampaignCore,T:ArtAdventureCore,N:NpcEnemyData})");
const heroes=["ren","art","nada","liora","sava"].map(id=>({id,name:id,side:"ally"}));
function setup(unlocked=true){
 const m=new Map(),storage={fail:false,getItem:k=>m.get(k)??null,setItem(k,v){if(this.fail)throw Error("disk");m.set(k,v)}};
 const profile=P.fresh(heroes,0);
 if(unlocked){S.directGrant(profile,"nada");profile.rewardReceipts=M.MISSIONS.map(x=>({id:x.receipt,sourceId:x.id,day:"2026-11-26",count:1}));for(const x of M.MISSIONS)storage.setItem(x.key,JSON.stringify(x.id===M.ID?{version:1,best:3}:{version:1,missionId:x.id,best:3}));}
 storage.setItem(P.KEY,JSON.stringify(profile));let unknown=0;const make=()=>T.create({heroes,storageProvider:()=>storage,onUnknown:()=>unknown++});
 return {storage,make,unknown:()=>unknown};
}
function play(b){
 C.advanceToPlayerTurn(b);
 for(let i=0;i<100&&b.active;i++){const f=b.fighters[b.currentActor],en=b.fighters.filter(x=>x.side==="enemy"&&x.hp>0).sort((a,b)=>a.hp+a.protection-b.hp-b.protection)[0];let id="basic";for(const k of ["powerful","special"]){if(C.abilityReady(b,k)&&A.get(f,k)?.kind==="damage"&&A.get(f,k)?.target==="enemy"){id=k;break;}}assert.equal(C.performActorAbility(b,id,b.fighters.indexOf(en)),true);}
 assert.equal(b.active,false);
}

const x=setup().make(),attempt=x.start("hold",3001);play(attempt.battle);assert.equal(x.complete(attempt.battle).ok,true);
const party=attempt.battle.fighters.filter(f=>f.side==="ally").map(f=>({...f,hp:f.maxHp,protection:f.maxProtection}));
assert.equal(Object.keys(T.loadout(x.read(),party)).length,0);
for(const [node,id,event] of [["guardian-2","art-intercept","trust-intercept-armed"],["command-2","art-reserve","trust-reserve-transferred"]]){
 assert.equal(x.equip(node).ok,true);const options=T.loadout(x.read(),party);
 assert.equal(options.trustPersonal.length,1);assert.equal(options.trustPersonal[0],id);assert.equal(options.treeR1,true);
 assert.equal(Object.keys(T.loadout(x.read(),party.filter(f=>f.id!=="art"))).length,0);
 const b=C.createBattle([...party,...M.enemiesFor(M.II_ID,N)],[],{combat2:true,...options,leaderId:null,rngSeed:7,hitChecks:true,critChecks:true});
 C.advanceToPlayerTurn(b);let used=false;
 for(let i=0;i<25&&b.active;i++){
  const actor=b.fighters[b.currentActor],ren=b.fighters.findIndex(f=>f.id==="ren"),fallback={abilityId:"basic",targetIndex:b.fighters.findIndex(f=>f.side==="enemy"&&f.hp>0)};
  const before=JSON.stringify(b);const plan=T.autoPlan(b,fallback);assert.equal(JSON.stringify(b),before);
  if(plan.abilityId===id){assert.equal(actor.id,"art");assert.ok(C.personalPreview(b,id,plan.targetIndex));assert.equal(C.performAutoAction(b,plan),true);assert.ok(b.events.some(e=>e.type===event));assert.equal(b.trustPersonalCooldown[id],2);used=true;break;}
  if(actor.id==="art"&&id==="art-intercept"&&!used){
   // Test targeted threatened ally in a native snapshot: only the planning
   // scenario is set; execution uses CombatCore and records real events.
   const enemy=b.fighters[fallback.targetIndex];enemy.combat2Prepared="ren";
   const proposed=T.autoPlan(b,fallback);assert.equal(proposed.abilityId,id);assert.equal(proposed.targetIndex,ren);
   assert.equal(C.performAutoAction(b,proposed),true);assert.ok(b.events.some(e=>e.type===event));assert.equal(b.trustPersonalCooldown[id],2);used=true;break;
  }
  assert.equal(C.performAutoAction(b,fallback),true);
 }
 assert.equal(used,true,id+" should be used by planner when appropriate");
}
assert.equal(x.equip(null).ok,true);assert.equal(Object.keys(T.loadout(x.read(),party)).length,0);
console.log("R2/D2B exclusive persisted loadout, native auto legality and actual effect events passed");
