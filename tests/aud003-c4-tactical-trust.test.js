"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-status-core.js","combat-core.js","lab-command-loop/command-loop.js"].map(p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8")).join("\n");
const {C,A,L}=vm.runInNewContext(src+"\n({C:CombatCore,A:AbilityData,L:CommandLoopLab})");
const fighter=(id,side,hp,atk,speed,protection=30)=>({id,name:id,side,hp,atk,speed,physicalAttack:atk,magicAttack:atk,physicalDefense:0,magicDefense:0,protection,maxProtection:protection});
const squad=()=>[fighter("art","ally",200,40,150),fighter("ren","ally",200,50,120),fighter("ves","enemy",300,20,90,0),fighter("shade","enemy",300,20,85,0)];
function battle(cfg,waves=[]){const b=C.createBattle(squad(),waves,{combat2:true,...(cfg?{tacticalTrust:cfg}:{})});C.advanceToPlayerTurn(b);return b}
function get(b,id){return b.fighters.find(f=>f.id===id)}
function use(b,id,target){return C.performActorAbility(b,id,b.fighters.findIndex(f=>f.id===target))}
for(const [mode,hits,second,restore] of [["standard",1,0,26],["focused",2,0,0],["shared",1,1,0]]){
 const b=battle({artTechnique:mode});const art=get(b,"art"),ren=get(b,"ren");ren.protection=0;
 assert.equal(b.fighters[b.currentActor].id,"art");
 const pre=C.trustCoverPreview(b,art,ren);assert.equal(pre.rows[0].guardHits,hits);assert.equal(pre.rows[0].restored,restore);
 assert.equal(use(b,"special","ren"),true);assert.equal(b.allyActions,1);assert.equal(ren.guardHits,hits);assert.equal(art.guardHits,second);assert.equal(ren.protection,restore);assert.equal(art.specialCooldown,2);
 assert.equal(b.events.filter(e=>e.type==="trust-technique").length,mode==="standard"?0:1);
}
const plain=battle();assert.equal(use(plain,"trust-plan","ves"),false);assert.equal(plain.allyActions,0);
const cfg={artTechnique:"shared",planPartnerId:"ren"},b=battle(cfg);cfg.artTechnique="focused";cfg.planPartnerId=null;assert.equal(b.tacticalTrust.artTechnique,"shared");assert.equal(b.tacticalTrust.planPartnerId,"ren");
assert.equal(C.trustPlanPreview(b,0),null);assert.equal(use(b,"trust-plan","ren"),false);assert.equal(b.trustPlanUsed,false);
const before=get(b,"ren").meter,preview=C.trustPlanPreview(b,2);assert.equal(preview.partnerId,"ren");assert.equal(preview.ability.multiplier,.55);
assert.equal(use(b,"trust-plan","ves"),true);assert.equal(b.allyActions,1);assert.equal(b.trustPlanUsed,true);
assert.equal(b.events.filter(e=>e.type==="trust-plan").length,1);assert.equal(b.events.filter(e=>e.type==="damage"&&e.actorId==="art"&&e.targetId==="ves").length,1);assert.equal(b.events.filter(e=>e.type==="damage"&&e.actorId==="ren"&&e.assist&&e.depth===1).length,1);
assert.equal(b.events.filter(e=>e.type==="ability"&&e.actorId==="ren").length,0);assert.ok(get(b,"ren").meter>=before);assert.equal(use(b,"trust-plan","ves"),false);
const dead=battle({planPartnerId:"ren"});get(dead,"ren").hp=0;assert.equal(C.trustPlanPreview(dead,2),null);assert.equal(use(dead,"trust-plan","ves"),false);assert.equal(dead.allyActions,0);assert.equal(dead.trustPlanUsed,false);
assert.throws(()=>C.createBattle(squad(),[],{tacticalTrust:{artTechnique:"shared"}}));assert.throws(()=>battle({planPartnerId:"ves"}));
const l=L.create(C,A);assert.equal(l.configure("focused",false),false);assert.equal(l.configure("standard",true),false);
function play(id){assert.equal(l.start(id),true);for(let n=0;n<60&&l.view().active;n++){const v=l.view(),enemy=v.fighters.find(f=>f.id==="shade"&&f.hp>0)||v.fighters.find(f=>f.side==="enemy"&&f.hp>0),s=v.actions.find(a=>a.id==="special"),special=v.actor==="art"?s?.targets.includes("ren"):s?.targets.includes(enemy.id);assert.equal(l.action(special?"special":"basic",special&&v.actor==="art"?"ren":enemy.id),true);}assert.equal(l.view().active,null);}
play("agreement");assert.equal(l.view().rank,2);assert.equal(l.configure("shared",true),false);assert.equal(l.configure("focused",false),true);play("joint");play("field");assert.equal(l.view().rank,3);assert.equal(l.configure("shared",true),true);assert.equal(l.start("standard"),true);assert.equal(l.configure("standard",false),false);assert.equal(l.view().technique,"shared");assert.equal(l.action("basic","shade"),true);assert.equal(l.view().actor,"art");assert.ok(l.view().actions.find(a=>a.id==="trust-plan").targets.includes("shade"));assert.equal(l.action("trust-plan","shade"),true);assert.equal(l.view().planUsed,true);
console.log("C4 native alternate covers, plan snapshot, one action and rank locks passed");
