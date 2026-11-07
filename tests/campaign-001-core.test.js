"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=["mission-data.js","campaign-core.js"].map(name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8")).join("\n");
const core=vm.runInNewContext(source+"\nCampaignCore");
const map=new Map();
const storage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};
const get=()=>storage;
let result=core.load(get);
assert.equal(result.available,true);
assert.equal(result.campaign.completed[core.MISSION_ID],false);
assert.equal(core.complete(result.campaign,{active:false,winner:"enemy"}),false);
assert.equal(core.complete(result.campaign,{active:true,winner:"ally"}),false);
assert.equal(core.complete(result.campaign,{active:false,winner:"ally"}),true);
assert.equal(core.complete(result.campaign,{active:false,winner:"ally"}),false);
assert.equal(core.save(result.campaign,get),true);
assert.equal(core.load(get).campaign.completed[core.MISSION_ID],true);
assert.equal(map.size,1,"mission state is isolated from Save-001");
const bad=[
 "{broken",
 JSON.stringify({version:2,completed:{"black-pass-ambush":true}}),
 JSON.stringify({version:1,completed:{"black-pass-ambush":"true"}}),
 JSON.stringify({version:1,completed:{}}),
 JSON.stringify({version:1,completed:{"black-pass-ambush":true,other:true}})
];
for(const value of bad){
 map.set(core.KEY,value);
 assert.equal(core.load(get).campaign.completed[core.MISSION_ID],false);
}
assert.equal(core.load(()=>{throw Error("Safari blocked");}).available,false);
assert.equal(core.save(core.fresh(),()=>({setItem(){throw Error("quota");}})),false);
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,"..","package.json"),"utf8"));
assert.equal(pkg.version,"0.3.32");
assert.match(html,/id="buildVersion"[^>]*>Прототип · v0[.]3[.]32 · CBA015E/);
assert.match(html,/src="campaign-core.js"/);
console.log("Campaign-001 persistence, corrupt data handling and build version passed");
