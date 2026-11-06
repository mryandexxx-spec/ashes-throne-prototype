"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname,"..");
const scripts = ["initiative-model.js","ability-data.js","combat-core.js","progress-core.js","mission-data.js","campaign-core.js","campaign-data.js","battle-speed.js","battle-animation.js","game.js"]
 .map(name=>fs.readFileSync(path.join(root,name),"utf8")).join("\n");
const ids=["heroList","combatants","battleStatus","turnChip","actionTitle","actionHint",
 "attackBtn","basicAbilityBtn","specialAbilityBtn","battleMessage","battle",
 "renderCanvas","startBattle","campaignBattle","campaignMissions","missionResultBack","missionResultRetry","missionResultHome","missionResult","missionResultTitle","missionResultText","campaignMissionStatus","campaignSaveStatus","squad","squadBack","squadStart","squadCount","squadRoster","squadSlots","squadHint","detailBack","detailHome","detailUpgrade"];
const elements=Object.fromEntries(ids.map(id=>[id,{
 innerHTML:"",textContent:"",disabled:false,handlers:{},
 classList:{active:id==="battle",contains(n){return !!this[n]},add(n){this[n]=true},
   remove(n){this[n]=false},toggle(n,yes){this[n]=!!yes}},
 addEventListener(n,callback){(this.handlers[n]??=[]).push(callback)}
}]));
const document={
 hidden:false,querySelector(q){return elements[q.slice(1)]},
 querySelectorAll(q){return q===".screen"?[elements.battle,elements.squad]:[]},
 addEventListener(){}
};
const window={addEventListener(){}};
const ctx=vm.createContext({document,window});
const {getBattle,resetBattle,CombatCore}=vm.runInContext(scripts+
 "\n({getBattle:()=>state,resetBattle,CombatCore})",ctx);

resetBattle();
assert.equal(getBattle().fighters[getBattle().currentActor].id,"lyra");
assert.equal(elements.specialAbilityBtn.disabled,false);
const click=id=>elements[id].handlers.click[0]();
click("specialAbilityBtn");
assert.equal(elements.specialAbilityBtn.classList.selected,true);
click("attackBtn");
assert.equal(getBattle().fighters[3].hp,59,"Lyra special deals 31 basic damage");
assert.ok(getBattle().fighters[3].weakenAttacks>=1 && getBattle().fighters[3].weakenAttacks<=2,"weakening applies; AI may advance");
assert.equal(getBattle().fighters[1].specialCooldown,2);
assert.equal(elements.specialAbilityBtn.classList.selected,false);
let steps=0;
while(getBattle().active && getBattle().fighters[getBattle().currentActor].id!=="lyra" && steps++<20)
 click("attackBtn");
assert.ok(getBattle().active && steps<20);
assert.equal(elements.specialAbilityBtn.disabled,true);
assert.equal(CombatCore.performPlayerAbility(getBattle(),"special"),false);
click("attackBtn");
assert.equal(getBattle().fighters[1].specialCooldown,1);
steps=0;
while(getBattle().active && getBattle().fighters[getBattle().currentActor].id!=="lyra" && steps++<20)
 click("attackBtn");
if(getBattle().active){
 click("attackBtn");
 assert.equal(getBattle().fighters[1].specialCooldown,0);
}
resetBattle();
assert.equal(getBattle().fighters[1].specialCooldown,0,"reset clears cooldown");
assert.equal(elements.specialAbilityBtn.disabled,false);
console.log("Combat-003 ability selection and cooldown tests passed");
