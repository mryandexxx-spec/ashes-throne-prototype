"use strict";const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const files=["initiative-model.js","ability-data.js","skill-core.js","combat-status-core.js","npc-enemy-data.js","enemy-decision.js","battle-rng.js","combat-core.js","hero-collection-core.js","star-core.js","gear-data.js","progress-core.js","progress-v3-core.js","hero-stats-core.js","hero-stats-profiles.js","hero-stats-combat-bridge.js","main-campaign-core.js","art-adventure-core.js"];
const {P,S,C,A,M,T}=vm.runInNewContext(files.map(f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8")).join("\n")+"\n({P:ProgressV3Core,S:StarCore,C:CombatCore,A:AbilityData,M:MainCampaignCore,T:ArtAdventureCore})");
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
const locked=setup(false).make();assert.equal(locked.start("hold",3001).code,"ADVENTURE_LOCKED");assert.equal(locked.equip("guardian-2").ok,false);
const x=setup(),s=x.make();const before=s.read();assert.equal(s.start("bad",3001).ok,false);
let launched=s.start("hold",3001);assert.equal(launched.ok,true);assert.equal(s.read().artPath.phase,"pending");assert.equal(s.read().saveRevision,before.saveRevision+1);assert.equal(T.view(s.read()).earned.length,0);assert.equal(s.start("hold",3001).ok,false);assert.equal(s.complete({...launched.battle}).code,"UNKNOWN_ATTEMPT");assert.equal(s.complete(launched.battle).code,"OBJECTIVE_NOT_MET");assert.equal(s.equip("guardian-2").ok,false);
const reload=x.make();assert.equal(reload.complete(launched.battle).code,"UNKNOWN_ATTEMPT");assert.equal(T.view(reload.read()).earned.length,0);
assert.equal(s.abandon(launched.battle),true);assert.equal(s.complete(launched.battle).ok,false);
launched=reload.start("hold",3001);assert.equal(launched.ok,true);play(launched.battle);assert.equal(launched.battle.winner,"ally");assert.equal(reload.complete(launched.battle).ok,true);const saved=reload.read(),v=T.view(saved);assert.equal(v.earned.length,2);assert.equal(v.selected,null);assert.equal(v.outcome,"left");assert.equal(saved.currency,before.currency);assert.equal(saved.energy.value,before.energy.value);assert.equal(saved.rewardReceipts.length,before.rewardReceipts.length);assert.equal(reload.complete(launched.battle).ok,false);assert.equal(reload.start("direct",3001).ok,false);
assert.equal(reload.equip("guardian-2").ok,true);const again=x.make();assert.equal(T.view(again.read()).selected,"guardian-2");assert.equal(T.loadout(again.read(),[{id:"art",side:"ally",hp:1}]).trustPersonal[0],"art-intercept");assert.equal(Object.keys(T.loadout(again.read(),[])).length,0);assert.equal(again.equip("command-2").ok,true);assert.equal(T.view(again.read()).outcome,"left");assert.equal(again.equip(null).ok,true);
const damaged=P.fromRuntime(again.read());damaged.artPath.selected="fake";assert.equal(P.validateActive(damaged,heroes),null);damaged.artPath.selected=null;damaged.rewardReceipts=[];assert.equal(P.validateActive(damaged,heroes),null);
const fail=setup(),f=fail.make();const attempt=f.start("hold",3001);play(attempt.battle);fail.storage.fail=true;assert.equal(f.complete(attempt.battle).code,"SAVE_OUTCOME_UNKNOWN");assert.equal(f.blocked(),true);assert.equal(fail.unknown(),1);assert.equal(T.view(fail.make().read()).earned.length,0);
const writeFail=setup();writeFail.storage.fail=true;assert.equal(writeFail.make().start("hold",3001).ok,false);assert.equal(T.view(writeFail.make().read()).earned.length,0);
const direct=setup().make();let won=false;for(const seed of [3001,3011,3019,3037]){const a=direct.start("direct",seed);assert.equal(a.ok,true);play(a.battle);const result=direct.complete(a.battle);if(result.ok){won=true;assert.equal(T.view(result.progress).outcome,"recovered");break;}assert.equal(direct.abandon(a.battle),true);}assert.equal(won,true);
console.log("R2/D1 native encounter, pending/reload/abandon, atomic first outcome, no currency, selection roundtrip, save failure passed");
