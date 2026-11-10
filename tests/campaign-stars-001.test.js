"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const source=["mission-data.js","campaign-core.js"].map(n=>fs.readFileSync(path.join(root,n),"utf8")).join("\n");
const {MissionData,CampaignCore}=vm.runInNewContext(source+"\n({MissionData,CampaignCore})");
const id=CampaignCore.MISSION_ID;
const mission=MissionData.get(id);
assert.equal(mission.chapterId,"chapter-1");
assert.equal(mission.branchId,"main");
assert.equal(mission.stars.length,3);
assert.equal(mission.stars[2].conditions[2].type,"max-ally-actions");
assert.equal(mission.stars[2].conditions[2].limit,8);
const fighters=[{id:"kael",side:"ally",hp:30},{id:"lyra",side:"ally",hp:2},{id:"ves",side:"enemy",hp:0}];
const battle=(actions,won=true)=>({active:false,winner:won?"ally":"enemy",fighters:fighters.map(f=>({...f})),allyActions:actions});
assert.equal(MissionData.score(id,battle(8)),3,"8 accepted ally actions is eligible");
assert.equal(MissionData.score(id,battle(9)),2,"9 ally actions is too many for third star");
const loss=battle(5);loss.fighters[1].hp=0;
assert.equal(MissionData.score(id,loss),1,"one fallen ally means only one star");
assert.equal(MissionData.score(id,battle(2,false)),0);
assert.equal(MissionData.score("missing-mission",battle(1)),0);
const campaign=CampaignCore.fresh();
assert.equal(campaign.bestStars[id],0);
assert.equal(CampaignCore.recordResult(campaign,id,battle(9)).earned,2);
assert.equal(campaign.bestStars[id],2);
assert.equal(CampaignCore.recordResult(campaign,id,loss).improved,false,"lower result must not downgrade best");
assert.equal(CampaignCore.recordResult(campaign,id,battle(8)).improved,true);
assert.equal(campaign.bestStars[id],3);
const map=new Map();
const storage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};
assert.equal(CampaignCore.save(campaign,()=>storage),true);
assert.equal(CampaignCore.load(()=>storage).campaign.bestStars[id],3);
assert.equal(map.size,1);
map.set(CampaignCore.KEY,JSON.stringify({version:1,completed:{[id]:true}}));
const legacy=CampaignCore.load(()=>storage).campaign;
assert.equal(legacy.completed[id],true,"legacy completion must survive");
assert.equal(legacy.bestStars[id],1,"legacy completion cannot infer unknown higher stars");
assert.equal(CampaignCore.save(legacy,()=>storage),true);
assert.equal(CampaignCore.load(()=>storage).campaign.bestStars[id],1);
for(const bad of [
 {version:2,completed:{[id]:true},bestStars:{[id]:9}},
 {version:2,completed:{[id]:false},bestStars:{[id]:3}},
 {version:2,completed:{[id]:true},bestStars:{[id]:"3"}}
]){
 map.set(CampaignCore.KEY,JSON.stringify(bad));
 assert.equal(CampaignCore.load(()=>storage).campaign.bestStars[id],0);
}
assert.equal(CampaignCore.load(()=>{throw Error("Safari unavailable");}).available,false);
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
assert.equal(pkg.version,"0.3.104");
assert.match(html,/id="buildVersion"[^>]*>Прототип · v0[.]3[.]104 · RENGLB003/);
assert.match(html,/src="mission-data.js"/);
// Count only accepted player actions in the actual combat engine.
const combatSrc=["initiative-model.js","ability-data.js","combat-core.js"]
 .map(n=>fs.readFileSync(path.join(root,n),"utf8")).join("\n");
const core=vm.runInNewContext(combatSrc+"\nCombatCore");
const fightersForBattle=[
 {id:"kael",name:"Каэль",side:"ally",role:"Страж",hp:1000,atk:1,speed:200},
 {id:"ves",name:"Вестник",side:"enemy",role:"Противник",hp:1000,atk:1,speed:60}
];
const real=core.createBattle(fightersForBattle);
assert.equal(real.allyActions,0);
core.advanceToPlayerTurn(real);
assert.equal(real.allyActions,0,"enemy automatic actions do not count");
assert.equal(core.performPlayerAbility(real,"not-an-ability"),false);
assert.equal(real.allyActions,0,"invalid action does not count");
assert.equal(core.performPlayerAbility(real,"basic"),true);
assert.equal(real.allyActions,1);
assert.equal(core.performPlayerAbility(real,"special"),true,"guard counts as an ally action");
assert.equal(real.allyActions,2);
assert.equal(core.chooseEnemy(real,500),false);
assert.equal(real.allyActions,2,"target selection does not count");

console.log("Campaign-Stars-001 8/9 boundary, all-alive, no downgrade, old saves and version passed");
