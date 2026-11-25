"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),lab=require("../combat-lab-real/engine.js"),runner=require("../docs/research/aud003-b15-2c-sava.js");
const read=f=>fs.readFileSync(path.join(root,f),"utf8"),source=lab.files.map(read).join("\n"),labSource=read("combat-lab-real/engine.js"),extra=runner.EXTRA.map(read).join("\n");
test("B15.2C real CTB and assist contracts, equipment, death and wave cleanup",()=>assert.equal(runner.contracts(source,labSource,extra).length,23));
test("B15.2C all candidate and holdout cells complete one seed",()=>{
 assert.equal(runner.experiment(source,labSource,extra,1).battles,648);
 assert.equal(runner.experiment(source,labSource,extra,1,true).battles,384);
});
test("B15.2C anchor drift fails closed",()=>assert.throws(()=>runner.setup(source.replace('return typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability;','return ability;'),labSource,extra,"full"),/anchor/));
