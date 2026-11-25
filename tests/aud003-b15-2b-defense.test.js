"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),lab=require("../combat-lab-real/engine.js"),runner=require("../docs/research/aud003-b15-2b-defense.js");
const source=lab.files.map(f=>fs.readFileSync(path.join(root,f),"utf8")).join("\n"),labSource=fs.readFileSync(path.join(root,"combat-lab-real/engine.js"),"utf8");
test("B15.2B direct real-core guard, reaction, CD, taunt, root, death, wave contracts",()=>assert.equal(runner.contracts(source,labSource).length,23));
test("B15.2B finite matrix for all candidates and holdout refinements",()=>{
 assert.equal(runner.experiment(source,labSource,1).battles,474);
 assert.equal(runner.experiment(source,labSource,1,true).battles,306);
});
test("source mismatch fails closed",()=>assert.throws(()=>runner.setup(source.replace('return typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability;','return ability;'),labSource,"both","early"),/anchor/));
