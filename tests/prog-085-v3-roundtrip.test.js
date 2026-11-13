"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const scripts=["gear-data.js","hero-collection-core.js","skill-core.js","star-core.js",
 "progress-core.js","save-core.js","progress-v3-core.js"];
const source=scripts.map(file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8")).join("\n");
const api=vm.runInNewContext(source+"\n({ProgressCore,ProgressV3Core})");
const roster=["kael","lyra","darin","medic-demo","test-area-damage","ren","nada"]
 .map(id=>({id,side:"ally"}));

test("PROG085 v3 roundtrip preserves L85 Ren/Nada and mannequin L1",()=>{
 const fresh=api.ProgressV3Core.fresh(roster,123456);
 const progress=api.ProgressV3Core.toRuntime(fresh,roster);
 assert.ok(progress);
 progress.accountXp=api.ProgressCore.xpThresholdForLevel(85);
 progress.currency=500000;
 assert.equal(api.ProgressCore.upgradeMany(progress,"ren",85).to,85);
 assert.equal(api.ProgressCore.upgradeMany(progress,"nada",85).to,85);
 const encoded=api.ProgressV3Core.fromRuntime(progress);
 assert.ok(encoded);
 const restored=api.ProgressV3Core.toRuntime(encoded,roster);
 assert.ok(restored);
 assert.equal(restored.levels.ren,85);
 assert.equal(restored.levels.nada,85);
 assert.equal(restored.levels.kael,1);
 const map=new Map([[api.ProgressV3Core.KEY,JSON.stringify(fresh)]]);
 const store={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
 assert.equal(api.ProgressV3Core.persist(progress,()=>store),true);
 const readBack=api.ProgressV3Core.toRuntime(JSON.parse(map.get(api.ProgressV3Core.KEY)),roster);
 assert.equal(readBack.levels.ren,85);
 assert.equal(readBack.levels.nada,85);
 assert.equal(readBack.accountXp,progress.accountXp);
 assert.equal(readBack.currency,progress.currency);
});
test("PROG085 old manikins cannot get L16 through v3 import",()=>{
 const fresh=api.ProgressV3Core.fresh(roster,123456);
 fresh.heroes.kael.level=16;
 assert.equal(api.ProgressV3Core.validateActive(fresh,roster),null);
 const ren=api.ProgressV3Core.fresh(roster,123456);
 ren.heroes.ren.level=85;
 assert.ok(api.ProgressV3Core.validateActive(ren,roster));
});
