"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname,"..");
const scripts = ["initiative-model.js","ability-data.js","combat-core.js","progress-core.js","mission-data.js","campaign-core.js","campaign-data.js","battle-speed.js","animation-profiles.js","battle-animation.js","game.js"]
 .map(name=>fs.readFileSync(path.join(root,name),"utf8")).join("\n");
const ids=["heroList","combatants","battleStatus","turnChip","actionTitle","actionHint",
 "battleRetryBtn","basicAbilityBtn","specialAbilityBtn","battleMessage","battle",
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
const enemy=getBattle().fighters[getBattle().selectedEnemy];
const enemyHp=enemy.hp;
click("specialAbilityBtn");
assert.equal(enemy.hp,enemyHp-Math.round(31*100/(100+enemy.physicalDefense)),"tapping typed skill casts at focused enemy with physical defense");
assert.equal(getBattle().fighters[1].specialCooldown,2);
assert.equal(elements.specialAbilityBtn.classList.selected,false,"damaging skill does not stay armed");
let steps=0;
while(getBattle().active&&getBattle().fighters[getBattle().currentActor].id!=="lyra"&&steps++<20)
 click("basicAbilityBtn");
assert.ok(getBattle().active&&steps<20,"Lyra should get another turn");
assert.equal(elements.specialAbilityBtn.disabled,true,"special skill respects cooldown");
const turns=getBattle().turn;
click("specialAbilityBtn");
assert.equal(getBattle().turn,turns,"cooldown skill cannot trigger attack");
assert.equal(CombatCore.performPlayerAbility(getBattle(),"special"),false);
click("basicAbilityBtn");
assert.equal(getBattle().fighters[1].specialCooldown,1);
steps=0;
while(getBattle().active&&getBattle().fighters[getBattle().currentActor].id!=="lyra"&&steps++<20)
 click("basicAbilityBtn");
if(getBattle().active){
 click("basicAbilityBtn");
 assert.equal(getBattle().fighters[1].specialCooldown,0);
}
resetBattle();
assert.equal(getBattle().fighters[1].specialCooldown,0,"reset clears cooldown");
assert.equal(elements.specialAbilityBtn.disabled,false);
console.log("Combat-003 direct ability and cooldown tests passed");
