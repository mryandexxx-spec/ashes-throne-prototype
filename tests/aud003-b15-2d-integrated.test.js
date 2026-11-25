"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),E=require("../lab-combat-2/engine.js"),A=require("../lab-combat-2/source-snapshot.json"),P=require("../lab-combat-2/parts-snapshot.json"),cal=require("../lab-combat-2/calibration.json");
const input=E.loadSources(A.labSource,A.source,A.extra,P.parts);
test("B15.2D pinned snapshots and real gear progression",()=>{
 assert.equal(A.baseCommit,P.baseCommit);assert.equal(A.baseCommit,cal.baseCommit);
 const ctx=E.setup(input,"art-only");
 assert.equal(ctx.profiles.early.ren.items,6);assert.equal(ctx.profiles.mid.ren.items,42);assert.equal(ctx.profiles.max.ren.items,78);
 assert.equal(ctx.profiles.uneven.ren.hero.physicalAttack,189);assert.equal(ctx.profiles.uneven.sava.hero.physicalAttack,27);
 assert.equal(ctx.profiles.max.ren.hero.speed,150);
 assert.equal(ctx.api.D.get({id:"art",side:"ally"},"leader"),null);assert.equal(ctx.api.D.get({id:"sava",side:"ally"},"leader"),null);
});
test("combined guard + meter + assist use distinct primitives and one root",()=>{
 const ctx=E.setup(input,"scaled-group"),b=E.create(ctx,{tier:"early",squad:"full",scenario:"duel",scale:1,seed:7}),C=ctx.api.C;
 b.hitChecks=b.critChecks=b.statusChecks=false;
 const index=id=>b.fighters.findIndex(f=>f.id===id),f=id=>b.fighters[index(id)];
 function ready(id,backup){b.fighters.forEach(f=>f.meter=0);f(id).meter=1000;f(backup).meter=1000;b.currentActor=index(id);}
 const en=index("w1-e0");
 ready("art","liora");f("ren").protection=0;
 assert.ok(E.step(ctx,b,"special",index("ren"),undefined,en));
 assert.equal(f("ren").b15Guards[0].kind,"art");assert.ok(f("ren").protection>0);
 const guard=JSON.stringify(f("ren").b15Guards);
 ready("sava","liora");f("ren").meter=600;
 assert.ok(E.step(ctx,b,"special",index("ren"),undefined,en));assert.equal(f("ren").meter,850);
 assert.equal(JSON.stringify(f("ren").b15Guards),guard);assert.equal(b.b15Stats.signalUsed,1);
 assert.equal(b.b15Stats.artGranted,1);assert.equal(b.b15Stats.undefinedGranted,undefined);
 ready("sava","ren");f("sava").powerfulCooldown=0;f("ren").specialCooldown=2;
 const meter=f("ren").meter,actions=b.allyActions;
 assert.equal(E.legal(ctx,b,"powerful",en,index("sava"),en),false);
 assert.equal(E.step(ctx,b,"powerful",en,index("sava"),en),false);assert.equal(b.allyActions,actions);
 assert.ok(E.step(ctx,b,"powerful",en,index("ren"),en));assert.equal(b.allyActions,actions+1);
 assert.equal(f("ren").meter,meter);assert.equal(f("ren").specialCooldown,2);
 const root=b.events.find(e=>e.type==="ability"&&e.actorId==="sava"),hits=b.events.filter(e=>e.assist&&e.type==="damage");
 assert.equal(hits.length,1);assert.equal(hits[0].rootId,root.rootId);assert.equal(hits[0].depth,1);
});
test("actual equal-size squads, unique wave instances and cleanup",()=>{
 const ctx=E.setup(input,"art-only");
 for(const squad of ["starter","three","four","full"]){
  const b=E.create(ctx,{tier:"early",squad,scenario:"duel",scale:1,seed:10});
  assert.equal(b.fighters.filter(f=>f.side==="ally").length,b.fighters.filter(f=>f.side==="enemy").length);
 }
 const b=E.create(ctx,{squad:"full",scenario:"waves",scale:1,seed:7});
 const before=b.fighters.filter(f=>f.side==="enemy").map(f=>f.id);const sava=b.fighters.find(f=>f.id==="sava");sava.b15SignalBoost=50;
 const ren=b.fighters.find(f=>f.id==="ren");ren.b15Guards=[{kind:"art",owner:"art",turns:2,hits:1,capDamage:10,fraction:.4}];
 b.fighters.filter(f=>f.side==="enemy").forEach(f=>f.hp=0);ctx.api.C.advanceToPlayerTurn(b);
 assert.equal(b.wave,2);assert.ok(b.fighters.filter(f=>f.side==="enemy").every(f=>!before.includes(f.id)));assert.equal(ren.b15Guards,undefined);assert.equal(sava.b15SignalBoost,undefined);
});
test("deterministic full mixed-kit trace and paired progression smoke",()=>{
 const ctx=E.setup(input,"art-only"),o={tier:"mid",squad:"full",scenario:"waves",scale:E.pressure(cal.selected,"mid","full","waves"),seed:27181};
 assert.deepEqual(E.run(ctx,o,"tactical",true),E.run(ctx,o,"tactical",true));
 assert.equal(E.experiment(input,cal.selected,1).battles,684);
 assert.equal(E.experiment(input,cal.selected,1,true).battles,748);
 assert.equal(E.followup(input,cal.selected,1).battles,408);
});
test("missing source patch fails closed",()=>assert.throws(()=>E.setup(E.loadSources(A.labSource,A.source.replace('return typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability;','return ability;'),A.extra,P.parts),"full"),/anchor/));
