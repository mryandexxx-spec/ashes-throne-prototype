"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.join(__dirname,"..");
const src=["initiative-model.js","combat-core.js","progress-core.js","game.js"]
 .map(n=>fs.readFileSync(path.join(root,n),"utf8")).join("\n");
const ids=["heroList","combatants","battleStatus","turnChip","actionTitle","actionHint",
 "attackBtn","basicAbilityBtn","specialAbilityBtn","battleMessage","battle",
 "renderCanvas","startBattle","campaignBattle","squad","squadBack","squadStart","squadCount","squadRoster","squadSlots","squadHint","detailBack","detailHome","detailUpgrade"];
const elem=()=>({
 innerHTML:"",textContent:"",disabled:false,handlers:{},dataset:{},
 classList:{active:false,contains(n){return !!this[n]},add(n){this[n]=true},
 remove(n){this[n]=false},toggle(n,v){this[n]=!!v}},
 addEventListener(n,fn){(this.handlers[n]??=[]).push(fn)}
});
const els=Object.fromEntries(ids.map(id=>[id,elem()]));
els.battle.classList.active=true;
const fighterNodes=Array.from({length:5},(_,i)=>{
 const el=elem();el.dataset.index=String(i);return el;
});
const document={
 hidden:false,
 querySelector(q){return els[q.slice(1)]},
 querySelectorAll(q){
  if(q===".screen")return [els.battle,els.squad];
  if(q===".fighter.ally")return fighterNodes.slice(0,3);
  if(q===".fighter.enemy")return fighterNodes.slice(3);
  return [];
 },
 addEventListener(){}
};
const api=vm.runInNewContext(src+"\n({getBattle:()=>state,resetBattle,CombatCore})",
 {document,window:{addEventListener(){}}});
const click=id=>{
 const f=els[id].handlers.click;
 assert.ok(f&&f.length,id+" should have click handler");
 f[f.length-1]();
};
const clickFighter=i=>{
 const f=fighterNodes[i].handlers.click;
 assert.ok(f&&f.length,"fighter "+i+" should be interactive");
 f[f.length-1]();
};
api.resetBattle();
assert.equal(api.getBattle().fighters[api.getBattle().currentActor].id,"lyra");
click("specialAbilityBtn");
assert.match(els.actionTitle.textContent,/Ослабляющий удар/);
clickFighter(4);
assert.equal(api.getBattle().selectedEnemy,4);
click("attackBtn");
assert.ok(api.getBattle().fighters[4].weakenAttacks>=0 && api.getBattle().fighters[4].weakenAttacks<=2);
assert.equal(api.getBattle().fighters[4].hp,47,"Lyra deals basic 31 damage to selected enemy");
assert.equal(els.specialAbilityBtn.classList.selected,false);
api.resetBattle();
let steps=0;
while(api.getBattle().active && api.getBattle().fighters[api.getBattle().currentActor].id!=="kael" && steps++<12)
 click("attackBtn");
assert.ok(api.getBattle().active && steps<12,"Kael must get a turn");
click("specialAbilityBtn");
assert.equal(els.attackBtn.textContent,"Применить");
clickFighter(1);
assert.equal(api.getBattle().selectedAlly,1);
assert.match(els.actionHint.textContent,/Лира/);
click("attackBtn");
assert.equal(api.getBattle().fighters[1].guardHits,2);
assert.equal(els.attackBtn.textContent,"Атаковать");
api.resetBattle();
assert.equal(api.getBattle().fighters[1].guardHits,0);
assert.equal(els.specialAbilityBtn.disabled,false);
console.log("Combat-003B actual button and ally/enemy target tests passed");
