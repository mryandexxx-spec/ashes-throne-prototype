"use strict";const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const files=["initiative-model.js","ability-data.js","skill-core.js","combat-status-core.js","npc-enemy-data.js","enemy-decision.js","battle-rng.js","combat-core.js","hero-collection-core.js","star-core.js","gear-data.js","progress-core.js","progress-v3-core.js","hero-stats-core.js","hero-stats-profiles.js","hero-stats-combat-bridge.js","lab-command-loop/tree-r1.js","design/aud003-tree-r2c.js"];
const api=vm.runInNewContext(files.map(f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8")).join("\n")+"\nTreeR2C");
const {rows,routes}=api.matrix();api.verify(rows,routes);
console.log("R2/C1 operations",JSON.stringify(api.aggregate(rows.filter(x=>x.policy!=="rush"),["id","build"])));console.log("R2/C1 adventure",JSON.stringify(api.aggregate(routes,["id","profile"])));console.log("R2/C1 split",JSON.stringify(api.aggregate(rows.filter(x=>x.policy!=="rush"),["split","build"])));
