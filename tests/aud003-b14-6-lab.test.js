/* B14.6 isolated lab smoke. Run from repository root: node tests/aud003-b14-6-lab.test.js */
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const lab=require("../combat-lab-real/engine.js");
const source=lab.files.map(f=>fs.readFileSync(f,"utf8")).join("\n");
for(const mode of ["direct","hidden","visible"])test(mode+" complete and finite",()=>{
 const api=lab.make(source,mode);for(const squad of lab.squads)for(const scenario of Object.keys(lab.scenarios)){
  const b=lab.start(api,squad,scenario,7);let turns=0;while(b.active&&turns++<120){const p=lab.plan(api,b,mode==="visible");assert.ok(lab.step(api,b,p.abilityId,p.targetIndex,p.enemy));}
  assert.equal(b.active,false);lab.validate(b);
 }
});
test("hidden and visible use same combat rules for identical commands",()=>{
 const a=lab.make(source,"hidden"),c=lab.make(source,"visible");
 const b=lab.start(a,lab.squads[0],"rush",7),d=lab.start(c,lab.squads[0],"rush",7);
 let turns=0;while(b.active&&turns++<120){const p=lab.plan(a,b,false);assert.ok(lab.step(a,b,p.abilityId,p.targetIndex,p.enemy));assert.ok(lab.step(c,d,p.abilityId,p.targetIndex,p.enemy));assert.deepEqual(b.fighters.map(f=>[f.id,f.hp,f.protection,f.meter,f.b14Prepared]),d.fighters.map(f=>[f.id,f.hp,f.protection,f.meter,f.b14Prepared]));}
 assert.equal(b.active,false);assert.equal(b.winner,d.winner);
});
test("browser script syntax",()=>{new Function(fs.readFileSync("combat-lab-real/ui.js","utf8"));});
