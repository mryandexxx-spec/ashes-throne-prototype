"use strict";
// ARTSAVASKILLS001: deterministic mechanics; percentages are test coefficients.
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const modules=["skill-core.js","ability-data.js","initiative-model.js","battle-rng.js",
 "combat-status-core.js","combat-core.js","hero-profile-data.js","ability-info.js","combat-log.js"];
const api=vm.runInNewContext(modules.map(read).join("\n")+
 "\n({SkillCore,AbilityData,CombatCore,CombatStatusCore,HeroProfileData,AbilityInfo,CombatLog})");
const {SkillCore:Skill,AbilityData:Abilities,CombatCore:Combat,
 CombatStatusCore:Statuses,AbilityInfo:Info}=api;
const level=(id,n)=>({id,skillLevels:{basic:n,special:n,powerful:n,passive:n}});
const mk=(id,side="ally",extra={})=>({
 id,name:id,side,hp:800,atk:30,physicalAttack:30,physicalDefense:0,magicDefense:0,
 protection:0,maxProtection:0,speed:100,accuracy:0,evasion:0,critChance:0,
 critDamage:150,defensePenetration:0,debuffPotency:30,debuffResistance:0,
 combatProfile:"stats002c",tags:side==="ally"?["gardens-over-abyss"]:[],
 skillLevels:{basic:1,special:1,powerful:1,passive:1},...extra
});
function create(fighters,leaderId=null){return Combat.createBattle(fighters,[],{leaderId});}
function act(b,id,slot,targetId){
 const i=b.fighters.findIndex(x=>x.id===id),j=b.fighters.findIndex(x=>x.id===targetId);
 assert.ok(i>=0&&j>=0);
 b.currentActor=i;b.fighters[i].meter=1000;
 return Combat.performActorAbility(b,slot,j);
}
function fighter(b,id){return b.fighters.find(x=>x.id===id)}
test("unique playable skills and L1-L6 curves are exposed through the existing system",()=>{
 const slots={art:["Сбить шаг","Страховочный узел","Снять нагрузку","Знать предел","Работа по риску"],
  sava:["Отметить момент","Передать сигнал","Согласованный шаг","Заметить вовремя","Полевая координация"]};
 for(const [id,names] of Object.entries(slots)){
  for(const [i,slot] of ["basic","special","powerful","passive","leader"].entries()){
   const skill=Abilities.get({...level(id,1),combatProfile:"stats002c"},slot);
   assert.equal(skill.name,names[i]);
   const detail=Info.format({...level(id,1),combatProfile:"stats002c"},slot);
   assert.equal(detail.status,"available");assert.ok(detail.description.length>50);
  }
  for(let n=1;n<=6;n++){
   for(const slot of ["basic","special","powerful","passive"])
    assert.equal(Info.format({...level(id,n),combatProfile:"stats002c"},slot).status,"available");
  }
 }
 assert.equal(Abilities.get(level("art",1),"special").kind,"insurance");
 assert.equal(Abilities.get(level("sava",1),"special").kind,"signal");
 assert.equal(Abilities.get(level("sava",1),"powerful").kind,"coordinate");
 assert.ok(Abilities.get(level("art",6),"special").insurancePercent>
   Abilities.get(level("art",1),"special").insurancePercent);
 assert.ok(Abilities.get(level("sava",6),"special").signalMeter>
   Abilities.get(level("sava",1),"special").signalMeter);
 assert.ok(Abilities.get(level("sava",6),"powerful").coordinationDamagePercent>
   Abilities.get(level("sava",1),"powerful").coordinationDamagePercent);
 assert.equal(Abilities.get(level("sava",1),"powerful").defenseComboEnabled,undefined);
 assert.equal(Abilities.get(level("sava",3),"powerful").defenseComboEnabled,true);
 assert.ok(Skill.PASSIVE_IDS.includes("art")&&Skill.PASSIVE_IDS.includes("sava"));
 assert.equal(Skill.validPassiveLevels({ren:1,nada:1}),true,
  "old genuine save layouts remain valid");
 assert.equal(Skill.validPassiveLevels({ren:1,nada:1,liora:1,art:2,sava:6}),true);
 assert.equal(Skill.validPassiveLevels({ren:1,nada:1,unknown:1}),false);
});
test("Art insurance triggers only on residual single-target HP damage; Liora guard first",()=>{
 const b=create([mk("art"),mk("liora"),mk("ren"),mk("enemy","enemy",{atk:60,physicalAttack:60})]);
 assert.equal(act(b,"art","special","art"),false,"cannot insure himself");
 assert.equal(act(b,"art","special","liora"),true);
 assert.equal(fighter(b,"liora").insurance.ownerId,"art");
 fighter(b,"liora").guardHits=1;fighter(b,"liora").protection=40;fighter(b,"liora").maxProtection=40;
 const oldArt=fighter(b,"art").hp;
 assert.equal(act(b,"enemy","basic","liora"),true);
 assert.equal(fighter(b,"art").hp,oldArt,"guard and Protection consume the hit first");
 assert.ok(fighter(b,"liora").insurance);
 fighter(b,"liora").protection=0;fighter(b,"liora").guardHits=0;
 assert.equal(act(b,"enemy","basic","liora"),true);
 assert.ok(fighter(b,"art").hp<oldArt);
 assert.equal(fighter(b,"liora").insurance,undefined);
 assert.ok(b.events.some(e=>e.type==="insurance-triggered"));
 assert.equal(fighter(b,"art").tacticalFocus.enemyId,"enemy");
 assert.ok(Combat.activeEffects(fighter(b,"art")).some(e=>e.type==="tactical-focus"));
 assert.equal(act(b,"art","basic","enemy"),true);
 assert.equal(fighter(b,"art").tacticalFocus,undefined);
});
test("Art disruption blocks secondary enemy effects, not the attack or Nada's read-move",()=>{
 const enemy=mk("test-area-weaken","enemy",{hp:1500,atk:15,physicalAttack:15,speed:1});
 const b=create([mk("art"),mk("nada"),enemy]);
 assert.equal(act(b,"art","powerful",enemy.id),true);
 assert.ok(Statuses.read(fighter(b,enemy.id),"disrupted-plan"));
 assert.equal(Statuses.applyReadMove(fighter(b,enemy.id),3,3),true);
 assert.equal(act(b,enemy.id,"special","art"),true);
 assert.equal(Statuses.read(fighter(b,enemy.id),"disrupted-plan"),null);
 assert.ok(b.events.some(e=>e.type==="disrupted-plan"));
 assert.ok(!b.events.some(e=>e.effect==="weaken"&&e.actorId===enemy.id));
 assert.equal(Statuses.read(fighter(b,enemy.id),"read-move"),null,
  "only Nada's independent mitigation spends its three marks on this enemy action");
});
test("Sava signals a chosen ally, advances initiative without granting a free action",()=>{
 const b=create([mk("sava"),mk("ren"),mk("art"),mk("enemy","enemy",{speed:1})]);
 fighter(b,"ren").meter=100;
 assert.equal(act(b,"sava","special","sava"),false,"signal is for another ally");
 assert.equal(act(b,"sava","special","ren"),true);
 assert.ok(fighter(b,"ren").meter>=300);
 assert.ok(fighter(b,"ren").fieldSignal);
 const beforeTurn=b.turn;
 assert.equal(act(b,"ren","basic","enemy"),true);
 assert.equal(fighter(b,"ren").fieldSignal,undefined);
 assert.equal(b.turn,beforeTurn+1);
});
test("L1 Sava attack window requires two different allies striking the same target",()=>{
 const b=create([mk("sava"),mk("nada"),mk("ren"),mk("foe","enemy",{hp:2000,speed:1})]);
 assert.equal(act(b,"sava","powerful","sava"),true);
 assert.ok(b.coordinatedWindow);
 assert.equal(act(b,"nada","basic","foe"),true);
 assert.equal(b.coordinatedWindow.first.actorId,"nada");
 assert.equal(act(b,"ren","basic","foe"),true);
 assert.equal(b.coordinatedWindow,null);
 assert.ok(b.events.some(e=>e.type==="coordinated-completion"&&e.kind==="attack"));
 assert.ok(CombatLogSummary(b).includes("Согласованный шаг"));
});
test("a different target cannot complete the attack pair; high-level defensive chains can",()=>{
 const b=create([mk("sava"),mk("nada"),mk("ren"),
  mk("foe-a","enemy",{hp:2000,speed:1}),mk("foe-b","enemy",{hp:2000,speed:1})]);
 assert.equal(act(b,"sava","powerful","sava"),true);
 assert.equal(act(b,"nada","basic","foe-a"),true);
 assert.equal(act(b,"ren","basic","foe-b"),true);
 assert.ok(b.coordinatedWindow,"a strike on B cannot finish a chain started against A");
 const c=create([mk("sava","ally",{skillLevels:{basic:3,special:3,powerful:3,passive:3}}),
  mk("liora"),mk("ren"),mk("foe","enemy",{hp:2000,speed:1})]);
 assert.equal(act(c,"sava","powerful","sava"),true);
 assert.equal(act(c,"liora","powerful","liora"),true);
 assert.equal(c.coordinatedWindow.first.kind,"defense");
 assert.equal(act(c,"ren","basic","foe"),true);
 assert.equal(c.coordinatedWindow,null);
 assert.ok(c.events.some(e=>e.type==="coordinated-completion"&&e.kind==="defense"));
});
test("independent leader identities remain playable with no magic or free turns",()=>{
 const a=create([mk("art"),mk("liora"),mk("sava"),mk("foe","enemy",{hp:2000,speed:1})],"art");
 assert.equal(Abilities.get(fighter(a,"art"),"leader").name,"Работа по риску");
 const b=create([mk("sava"),mk("art"),mk("liora"),mk("foe","enemy",{hp:2000,speed:1})],"sava");
 assert.equal(Abilities.get(fighter(b,"sava"),"leader").name,"Полевая координация");
 assert.equal(Abilities.get(fighter(b,"liora"),"leader").name,"Опора отряда");
});
function CombatLogSummary(b){return api.CombatLog.lines(b.events,b.fighters).join(" | ");}
