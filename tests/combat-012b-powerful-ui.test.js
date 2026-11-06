"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const html=read("index.html"),css=read("styles.css");
for(const id of ["basicAbilityBtn","specialAbilityBtn","powerfulAbilityBtn","powerfulAbilitySlot","abilityOptions"])
 assert.ok(html.includes('id="'+id+'"'),"real HTML must include "+id);
assert.match(html,/id="powerfulAbilitySlot"[^>]*hidden/);
assert.match(css,/\.battle-screen \.ability-slot\[hidden\]\{display:none!important\}/);
assert.match(css,/\.battle-screen \.ability-options\.has-powerful/);
const src=["initiative-model.js","ability-data.js","combat-core.js","combat-log.js",
 "progress-core.js","save-core.js","mission-data.js","campaign-core.js","campaign-data.js",
 "battle-speed.js","animation-profiles.js","battle-animation.js","game.js"]
 .map(read).join("\n");
const ids=["heroList","combatants","battleStatus","turnChip","actionTitle","actionHint",
 "battleRetryBtn","basicAbilityBtn","specialAbilityBtn","powerfulAbilityBtn",
 "powerfulAbilitySlot","abilityOptions","basicAbilitySlot","specialAbilitySlot",
 "abilityTooltip","abilityTooltipTitle","abilityTooltipText",
 "battleMessage","battle","renderCanvas","battleLogSummary","battleLogEntries",
 "arenaIndicators","startBattle","campaignBattle","campaignMissions","missionResultBack",
 "missionResultRetry","missionResultHome","missionResult","missionResultTitle","missionResultText",
 "campaignMissionStatus","campaignSaveStatus","squad","squadBack","squadStart","squadCount",
 "squadRoster","squadSlots","squadHint","detailBack","detailHome","detailUpgrade"];
const el=id=>({
 id,innerHTML:"",textContent:"",disabled:false,hidden:false,handlers:{},dataset:{},style:{},
 classList:{active:id==="battle",contains(x){return !!this[x]},add(x){this[x]=true},
  remove(x){this[x]=false},toggle(x,v){this[x]=!!v}},
 addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)}
});
const els=Object.fromEntries(ids.map(id=>[id,el(id)]));
const document={
 hidden:false,
 querySelector:q=>els[q.slice(1)],
 querySelectorAll:q=>q===".screen"?[els.battle,els.squad]:[],
 addEventListener(){}
};
const api=vm.runInNewContext(src+
 "\n({resetBattle,getBattle:()=>state,chooseParty:ids=>{selectedPartyIds=ids},selectArenaTarget,showAbilityTooltip,BattleAnimation,AbilityData})",
 {document,window:{addEventListener(){}}});
function click(id){const f=els[id].handlers.click;assert.ok(f?.length,"missing click handler for "+id);f[f.length-1]();}
const powerfulCases=[
 ["kael","Учебный бастион","self"],
 ["lyra","Учебная метка","enemy"],
 ["darin","Учебный натиск","enemy"],
 ["medic-demo","Учебное исцеление отряда","all-allies"],
 ["test-area-damage","Учебный мощный удар","enemy"]
];
for(const [id,name,target] of powerfulCases){
 assert.equal(api.AbilityData.get({id},"powerful")?.name,name,
  "every playable ally has a temporary powerful skill: "+id);
 assert.equal(api.AbilityData.get({id},"powerful").target,target);
 api.chooseParty([id]);api.resetBattle();
 assert.equal(els.powerfulAbilitySlot.hidden,false,"third button visible for "+id);
 assert.equal(els.abilityOptions.classList["has-powerful"],true);
 assert.equal(els.powerfulAbilityBtn.disabled,false,"powerful ready on first turn: "+id);
 assert.match(els.powerfulAbilityBtn.textContent,new RegExp(name));
 assert.equal((els.arenaIndicators.innerHTML.match(/arena-focus-cursor locked/g)||[]).length,1,
  "one primary enemy cursor on "+id+"'s turn");
}
assert.equal(api.AbilityData.get({id:"unknown"},"powerful"),null);
api.chooseParty(["test-area-damage"]);api.resetBattle();
let b=api.getBattle(),actor=b.fighters[0];
// Keep this UI test about button/cooldown behavior, not enemy kill speed.
for(const foe of b.fighters.filter(h=>h.side==="enemy"))foe.atk=1;
assert.equal(b.fighters[b.currentActor].id,actor.id);
assert.equal(els.powerfulAbilitySlot.hidden,false);
assert.equal(els.abilityOptions.classList["has-powerful"],true);
assert.equal(els.powerfulAbilityBtn.disabled,false);
assert.match(els.powerfulAbilityBtn.textContent,/Учебный мощный удар/);
assert.equal((els.arenaIndicators.innerHTML.match(/arena-focus-cursor locked/g)||[]).length,1,
 "third button must not introduce multi-target cursors on turn start");
api.showAbilityTooltip("powerful");
assert.equal(els.abilityTooltip.hidden,false);
assert.equal(els.abilityTooltipTitle.textContent,"Учебный мощный удар");
assert.match(els.abilityTooltipText.textContent,/150%/);
assert.match(els.abilityTooltipText.textContent,/Цель: противник/);
assert.match(els.abilityTooltipText.textContent,/Перезарядка: 2/);
assert.equal(b.allyActions,0,"hint must never cast");
assert.equal(api.selectArenaTarget({metadata:{fighterId:"shade"}}),true);
assert.equal(b.fighters[b.selectedEnemy].id,"shade");
const ves=b.fighters.find(f=>f.id==="ves"),shade=b.fighters.find(f=>f.id==="shade");
const beforeVes=ves.hp,beforeShade=shade.hp;
click("powerfulAbilityBtn");
assert.equal(shade.hp,beforeShade-30,"selected primary enemy takes 150% of attack");
assert.equal(ves.hp,beforeVes,"powerful single-target strike must not hit other enemies");
assert.equal(b.allyActions,1);
assert.equal(actor.powerfulCooldown,2);
assert.equal(actor.specialCooldown,0);
assert.equal(els.powerfulAbilityBtn.disabled,true);
assert.match(els.powerfulAbilityBtn.textContent,/· 2/);
assert.match(els.battleLogEntries.textContent,/Учебный мощный удар/);
assert.equal(b.events.filter(e=>e.type==="damage"&&e.actorId===actor.id).length,1);
assert.equal((els.arenaIndicators.innerHTML.match(/arena-focus-cursor locked/g)||[]).length,1,
 "single primary cursor remains after casting");
api.BattleAnimation.clear();api.BattleAnimation.enqueue(b.events);
assert.ok(api.BattleAnimation.pending()>=2,"powerful cast animates caster and hit");
const actions=b.allyActions;
click("powerfulAbilityBtn");
assert.equal(b.allyActions,actions,"cooldown blocks repeated UI cast");
click("specialAbilityBtn");
assert.equal(actor.specialCooldown,2,"existing group special still works");
assert.equal(actor.powerfulCooldown,1,"special decrements powerful cooldown");
assert.equal(b.allyActions,2);
click("basicAbilityBtn");
assert.equal(actor.powerfulCooldown,0);
assert.equal(actor.specialCooldown,1);
assert.equal(els.powerfulAbilityBtn.disabled,false);
api.resetBattle();
assert.equal(api.getBattle().fighters[0].powerfulCooldown,0);
assert.equal(els.powerfulAbilityBtn.disabled,false,"replay restores readiness");
// Test the actual powerful button handler for every playable role.
api.chooseParty(["kael"]);api.resetBattle();
b=api.getBattle();
const kael=b.fighters[0];
click("powerfulAbilityBtn");
assert.ok(b.events.some(e=>e.type==="effect"&&e.targetId===kael.id&&e.effect==="guard"&&e.stacks===3),
 "guardian powerful self-guard applies to its caster");
assert.equal(kael.powerfulCooldown,2);

api.chooseParty(["lyra"]);api.resetBattle();
b=api.getBattle();
const lyra=b.fighters[0],marked=b.fighters.find(f=>f.id==="ves");
const hpMarked=marked.hp;
click("powerfulAbilityBtn");
assert.equal(marked.hp,hpMarked-Math.round(lyra.atk*1.5));
assert.ok(b.events.some(e=>e.type==="effect"&&e.targetId===marked.id&&e.effect==="weaken"&&e.stacks===2),
 "scout powerful attack also applies weakening");
assert.equal(lyra.powerfulCooldown,2);

api.chooseParty(["darin"]);api.resetBattle();
b=api.getBattle();
const darin=b.fighters[0],struck=b.fighters.find(f=>f.id==="ves");
const beforeStrike=struck.hp;
click("powerfulAbilityBtn");
assert.equal(struck.hp,beforeStrike-darin.atk*2,"swordsman powerful attack doubles damage");
assert.equal(darin.powerfulCooldown,2);

api.chooseParty(["medic-demo"]);api.resetBattle();
b=api.getBattle();
const medic=b.fighters[0];
const hpMedic=medic.hp;
click("powerfulAbilityBtn");
assert.ok(medic.hp>=hpMedic,"group healing never injures its caster");
assert.equal(medic.powerfulCooldown,2);
assert.equal(b.events.filter(e=>e.type==="heal"&&e.actorId===medic.id).length,1);
assert.equal((els.arenaIndicators.innerHTML.match(/arena-focus-cursor locked/g)||[]).length,1,
 "all-allies powerful must not create extra enemy target cursors");
console.log("Combat-012B five playable powerful skills, button clicks, cooldown, tooltip, layout and replay passed");
