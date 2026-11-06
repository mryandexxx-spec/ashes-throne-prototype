"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const pkg=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));
assert.match(html,new RegExp('id="buildVersion"[^>]*>Прототип · v'+pkg.version.replaceAll(".","\\.")+' · CBA008E'));
assert.match(html,/id="battleLog"/);
assert.match(html,/id="battleLogEntries"/);
assert.match(html,/src="combat-log.js"/);
const source=["ability-data.js","combat-log.js"].map(f=>fs.readFileSync(path.join(root,f),"utf8")).join("\n");
const {CombatLog}=vm.runInNewContext(source+"\n({CombatLog})");
const fighters=[{id:"kael",name:"Каэль Ворон"},{id:"lyra",name:"Лира Соль"},{id:"enemy",name:"Вестник Конклава"}];
const events=[
 {type:"ability",actorId:"lyra",targetId:"enemy",abilityId:"special"},
 {type:"damage",actorId:"lyra",targetId:"enemy",amount:31,remainingHp:59},
 {type:"effect",actorId:"lyra",targetId:"enemy",effect:"weaken",stacks:2},
 {type:"ability",actorId:"enemy",targetId:"kael",abilityId:"basic"},
 {type:"damage",actorId:"enemy",targetId:"kael",amount:18,remainingHp:102},
 {type:"death",targetId:"enemy"},
 {type:"battle-end",winner:"ally"}
];
const log=CombatLog.lines(events,fighters);
assert.equal(log.length,7);
assert.match(log[0],/Лира Соль.*Ослабляющий удар.*Вестник Конклава/);
assert.match(log[1],/31 HP.*59/);
assert.match(log[2],/Ослабление ×2/);
assert.match(log[3],/Вестник Конклава.*Базовая атака.*Каэль Ворон/);
assert.match(log[4],/18 HP.*102/);
assert.match(log[5],/повержен/);
assert.equal(log[6],"Победа отряда");
assert.equal(CombatLog.lines([{type:"battle-end",winner:"enemy"}],fighters)[0],"Поражение отряда");
assert.equal(CombatLog.lines([{type:"unknown"}],fighters).length,0);
assert.equal(CombatLog.lines([],fighters).length,0);
console.log("Combat-Log-001 readable events and visible version contract passed");
