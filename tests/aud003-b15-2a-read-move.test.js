"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),lab=require("../combat-lab-real/engine.js"),runner=require("../docs/research/aud003-b15-2a-read-move.js");
const source=lab.files.map(f=>fs.readFileSync(path.join(root,f),"utf8")).join("\n"),labSource=fs.readFileSync(path.join(root,"combat-lab-real/engine.js"),"utf8");
function fixture(variant,squad,id){
 const ctx=runner.setup(source,labSource,variant,"early"),{api}=ctx,b=ctx.lab.start(api,squad,"rush",42);
 b.hitChecks=b.critChecks=b.statusChecks=false;b.events=[];b.fighters.forEach(f=>{f.meter=0});
 const i=b.fighters.findIndex(f=>f.id===id);assert.ok(i>=0);b.currentActor=i;b.fighters[i].meter=1000;
 const backup=b.fighters.findIndex((f,j)=>f.side==="ally"&&j!==i);b.fighters[backup].meter=1000;return {b,api,i};
}
function hit(variant,id,marks){
 const {b,api,i}=fixture(variant,[id,"art","nada"],id),j=b.fighters.findIndex(f=>f.side==="enemy");
 if(marks)assert.equal(api.T.applyReadMove(b.fighters[j],marks,2),true);
 assert.equal(api.C.performActorAbility(b,id==="ren"?"powerful":"basic",j),true);
 return b.events.find(e=>e.type==="damage"&&e.actorId===id).amount;
}
function enemy(marks){
 const {b,api,i}=fixture("b15",["ren","art","nada"],"b146-0");
 if(marks)assert.equal(api.T.applyReadMove(b.fighters[i],marks,2),true);
 assert.equal(api.C.performActorAbility(b,"powerful",0),true);
 return {damage:b.events.find(e=>e.type==="damage"&&e.actorId==="b146-0").amount,stacks:api.T.read(b.fighters[i],"read-move")?.stacks??0,predicted:b.events.some(e=>e.type==="read-move-predicted"),cd:b.fighters[i].powerfulCooldown};
}
test("B15.2A isolated candidate contracts",()=>assert.equal(runner.contracts(source,labSource).length,10));
test("real action preserves Ren-specific mark payoff and optional team sharing",()=>{
 assert.ok(hit("b15","ren",4)>hit("b15","ren",0));
 assert.ok(hit("b15","b14-striker",4)>hit("b15","b14-striker",0));
 assert.equal(hit("b15-no-share","b14-striker",4),hit("b15","b14-striker",0));
});
test("enemy powerful really spends three marks and reduces damage without denying action",()=>{
 const a=enemy(0),b=enemy(4);assert.ok(b.damage<a.damage);assert.equal(b.stacks,1);assert.equal(b.predicted,true);assert.equal(b.cd,a.cd);assert.ok(b.cd>0);
});
test("all matrix variants complete one seed with finite state",()=>{
 assert.equal(runner.experiment(source,labSource,1).battles,216);
 assert.equal(runner.refine(source,labSource,1).battles,84);
});
