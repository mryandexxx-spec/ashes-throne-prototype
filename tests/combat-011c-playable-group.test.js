"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const src=["initiative-model.js","ability-data.js","combat-core.js","combat-log.js",
 "progress-core.js","save-core.js","mission-data.js","campaign-core.js","campaign-data.js",
 "battle-speed.js","animation-profiles.js","battle-animation.js","game.js"]
 .map(read).join("\n");
const ids=["heroList","combatants","battleStatus","turnChip","actionTitle","actionHint",
 "battleRetryBtn","basicAbilityBtn","specialAbilityBtn","battleMessage","battle",
 "renderCanvas","battleLogSummary","battleLogEntries","arenaIndicators","startBattle",
 "campaignBattle","campaignMissions","missionResultBack","missionResultRetry","missionResultHome",
 "missionResult","missionResultTitle","missionResultText","campaignMissionStatus","campaignSaveStatus",
 "squad","squadBack","squadStart","squadCount","squadRoster","squadSlots","squadHint",
 "detailBack","detailHome","detailUpgrade"];
const el=id=>({
 id,innerHTML:"",textContent:"",disabled:false,hidden:false,handlers:{},dataset:{},style:{},
 classList:{active:id==="battle",contains(x){return !!this[x]},add(x){this[x]=true},
  remove(x){this[x]=false},toggle(x,v){this[x]=!!v}},
 addEventListener(name,fn){(this.handlers[name]??=[]).push(fn)}
});
const elements=Object.fromEntries(ids.map(id=>[id,el(id)]));
const document={
 hidden:false,
 querySelector:s=>elements[s.slice(1)],
 querySelectorAll:s=>s===".screen"?[elements.battle,elements.squad]:[],
 addEventListener(){}
};
const api=vm.runInNewContext(src+
 "\n({getBattle:()=>state,resetBattle,chooseParty:ids=>{selectedPartyIds=ids},HEROES,AbilityData,CombatCore,CombatLog,BattleAnimation,SaveCore})",
 {document,window:{addEventListener(){}}});
const click=id=>{const handlers=elements[id].handlers.click;assert.ok(handlers?.length,id+" click");handlers[handlers.length-1]();};
assert.equal(api.HEROES.filter(h=>h.id==="test-area-damage").length,1);
assert.equal(api.AbilityData.get({id:"test-area-damage"},"special").target,"all-enemies");
assert.equal(api.HEROES.filter(h=>h.side==="ally").length,5);
api.chooseParty(["test-area-damage"]);
api.resetBattle();
const b=api.getBattle();
assert.equal(b.fighters[0].id,"test-area-damage");
assert.equal(b.fighters[b.currentActor].id,"test-area-damage");
assert.equal(elements.specialAbilityBtn.disabled,false);
assert.match(elements.specialAbilityBtn.textContent,/Учебный широкий удар/);
assert.match(elements.actionHint.textContent,/всех живых врагов/);
assert.equal((elements.arenaIndicators.innerHTML.match(/arena-focus-cursor group/g)||[]).length,2,
 "all living enemies are marked, not only the selected target");
const hp=b.fighters.filter(h=>h.side==="enemy").map(h=>h.hp);
click("specialAbilityBtn");
const actual=b.fighters.filter(h=>h.side==="enemy").map(h=>h.hp);
assert.deepEqual(actual,hp.map(x=>x-20),"one tap damages both enemies");
assert.equal(b.allyActions,1);
assert.equal(b.fighters[0].specialCooldown,2);
assert.equal(b.events.filter(e=>e.type==="damage"&&e.actorId==="test-area-damage").length,2);
assert.match(elements.battleLogEntries.textContent,/Вестник Конклава/);
assert.match(elements.battleLogEntries.textContent,/Теневой клинок/);
assert.match(elements.battleLogEntries.textContent,/−20 HP/);
assert.equal(elements.specialAbilityBtn.disabled,true,"cooldown disables skill");
assert.equal((elements.arenaIndicators.innerHTML.match(/arena-focus-cursor group/g)||[]).length,0,
 "group target markers disappear on cooldown");
api.BattleAnimation.clear();
api.BattleAnimation.enqueue(b.events);
assert.ok(api.BattleAnimation.pending()>=5,"caster and both enemy hit reactions are queued");
api.resetBattle();
assert.equal(api.getBattle().fighters[0].specialCooldown,0);
assert.equal(elements.specialAbilityBtn.disabled,false);
assert.equal((elements.arenaIndicators.innerHTML.match(/arena-focus-cursor group/g)||[]).length,2);

const old=[
 {id:"kael",side:"ally"},{id:"lyra",side:"ally"},{id:"darin",side:"ally"},
 {id:"medic-demo",side:"ally"},{id:"test-area-damage",side:"ally"}
];
const prior={version:1,materials:11,levels:{kael:3,lyra:2,darin:1,"medic-demo":2}};
const migrated=api.SaveCore.validate(prior,old);
assert.equal(migrated.materials,11,"save retains materials");
assert.equal(migrated.levels["medic-demo"],2);
assert.equal(migrated.levels["test-area-damage"],1,"training hero starts at level one");
assert.equal(api.SaveCore.validate({...prior,levels:{...prior.levels,unknown:1}},old),null);
console.log("Combat-011C playable group skill, targets, cooldown, log, animations and save migration passed");
