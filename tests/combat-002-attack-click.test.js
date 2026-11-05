"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const sources = ["initiative-model.js", "ability-data.js","combat-core.js", "progress-core.js", "mission-data.js","campaign-core.js","campaign-data.js","game.js"]
 .map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
const ids = ["heroList","combatants","battleStatus","turnChip","actionTitle","actionHint","attackBtn",
 "battleMessage","battle","renderCanvas","startBattle","campaignBattle","missionResultBack","missionResultRetry","missionResultHome","missionResult","missionResultTitle","missionResultText","campaignMissionStatus","campaignSaveStatus","squad","squadBack","squadStart","squadCount","squadRoster","squadSlots","squadHint","detailBack","detailHome","detailUpgrade","basicAbilityBtn","specialAbilityBtn"];
const elements = Object.fromEntries(ids.map(id => [id, {
 innerHTML:"", textContent:"", disabled:false, handlers:{},
 classList: { active:id==="battle", contains(name){return !!this[name]},
   add(name){this[name]=true}, remove(name){this[name]=false}, toggle(name,value){this[name]=!!value} },
 addEventListener(name, callback){(this.handlers[name] ||= []).push(callback)}
}]));
const document = {
 hidden:false, querySelector(selector){return elements[selector.slice(1)]},
 querySelectorAll(selector){return selector===".screen" ? [elements.battle,elements.squad] : []},
 addEventListener(){}
};
const window = {addEventListener(){}};
const context = vm.createContext({document,window});
const api = vm.runInContext(sources+"\n({getBattle:()=>state,resetBattle})",context);
api.resetBattle();
const attackClick = elements.attackBtn.handlers.click[0];
assert.ok(attackClick, "attack button must have a click listener");
const hpBefore = api.getBattle().fighters[3].hp;
attackClick();
assert.ok(api.getBattle().fighters[3].hp < hpBefore, "click must deal damage");
let clicks = 1;
while (api.getBattle().active && clicks++ < 30) attackClick();
assert.equal(api.getBattle().winner,"ally");
assert.equal(elements.attackBtn.textContent,"Сыграть снова");
attackClick();
assert.equal(elements.squad.classList.active,true,"replay returns to prebattle selection");
api.resetBattle();
assert.equal(api.getBattle().turn,1,"fresh battle resets turns");
assert.equal(api.getBattle().fighters[3].hp,hpBefore,"replay resets enemy HP");
console.log("Combat-002 attack button regression passed");
