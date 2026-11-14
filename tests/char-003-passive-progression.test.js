"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const modules=["gear-data.js","hero-collection-core.js","skill-core.js",
 "star-core.js","progress-core.js","save-core.js","progress-v3-core.js",
 "ability-data.js","ability-info.js"];
const a=vm.runInNewContext(modules.map(read).join("\n")+
 "\n({SkillCore,ProgressCore,ProgressV3Core,AbilityData,AbilityInfo})");
const roster=["kael","lyra","darin","medic-demo","test-area-damage","ren","nada","liora"]
 .map(id=>({id,side:"ally"}));
function profile(){
 const fresh=a.ProgressV3Core.fresh(roster,1000);
 const p=a.ProgressV3Core.toRuntime(fresh,roster);
 assert.ok(p);
 return {fresh,p};
}
test("CHAR003 previous v3 saves have implicit L1 passives without rewriting old fields",()=>{
 const {fresh,p}=profile();
 assert.equal(fresh.passiveLevels,undefined);
 assert.equal(p.passiveLevels,undefined);
 assert.equal(a.SkillCore.level(p,"ren","passive"),1);
 assert.equal(a.SkillCore.level(p,"nada","passive"),1);
 assert.equal(a.SkillCore.level(p,"kael","passive"),null);
 assert.equal(a.ProgressV3Core.fromRuntime(p).passiveLevels,undefined);
});
test("CHAR003 upgrades both passive skills with existing costs and unlock levels",()=>{
 const {p}=profile();
 p.currency=10000;p.levels.ren=85;p.levels.nada=85;
 a.SkillCore.grantTest(p);
 for(const id of ["ren","nada"]){
  for(let next=2;next<=6;next++){
   const before=p.currency,price=a.SkillCore.cost(p,id,"passive");
   assert.equal(price.to,next);
   assert.equal(a.SkillCore.blocked(p,id,"passive"),"");
   const changed=a.SkillCore.upgrade(p,id,"passive");
   assert.equal(changed.level,next);
   assert.equal(before-p.currency,price.currency);
   assert.equal(a.SkillCore.level(p,id,"passive"),next);
  }
  assert.equal(a.SkillCore.cost(p,id,"passive"),null);
  assert.equal(a.SkillCore.upgrade(p,id,"passive"),null);
 }
 assert.equal(a.SkillCore.level(p,"liora","passive"),1); // LIORA001: newly playable passive, old saves imply L1.
});
test("CHAR003 refuses wrong hero level, insufficient materials and invalid upgrades atomically",()=>{
 const {p}=profile();
 p.currency=10000;
 const old=JSON.stringify(p);
 assert.match(a.SkillCore.blocked(p,"ren","passive"),/уровень героя 2/);
 assert.equal(a.SkillCore.upgrade(p,"ren","passive"),null);
 assert.equal(JSON.stringify(p),old);
 p.levels.ren=85;
 assert.equal(a.SkillCore.upgrade(p,"ren","passive").level,2);
 assert.match(a.SkillCore.blocked(p,"ren","passive"),/материал/);
 const balance=p.currency;
 assert.equal(a.SkillCore.upgrade(p,"ren","passive"),null);
 assert.equal(p.currency,balance);
 p.passiveLevels={ren:7,nada:1};
 assert.match(a.SkillCore.blocked(p,"ren","passive"),/повреждены/);
 assert.equal(a.SkillCore.upgrade(p,"ren","passive"),null);
});
test("CHAR003 real passive descriptions and combat rules scale at levels 1–6",()=>{
 for(let level=1;level<=6;level++){
  const ren={id:"ren",skillLevels:{passive:level}},nada={id:"nada",skillLevels:{passive:level}};
  const r=a.AbilityData.get(ren,"passive"),n=a.AbilityData.get(nada,"passive");
  assert.equal(r.combatRules.readMoveBonusPercentPerStack,11+level);
  assert.equal(r.combatRules.gardensEvasionBonus,[8,8,9,10,11,12][level-1]);
  assert.equal(n.combatRules.gardensAccuracyBonus,7+level);
  assert.match(a.AbilityInfo.format(ren,"passive").description,new RegExp("\\+"+(11+level)+"%"));
  assert.match(a.AbilityInfo.format(nada,"passive").description,new RegExp("\\+"+(7+level)+" п.п."));
 }
 const story=a.AbilityData.get({id:"trial-ren",skillLevels:{passive:6}},"passive");
 assert.equal(story.combatRules.bonusVsDebuffedPercent,15);
});
test("CHAR003 v3 saves and reloads both passive levels, rejects corrupt and preserves active levels",()=>{
 const {fresh,p}=profile();p.currency=5000;p.levels.ren=85;p.levels.nada=85;
 a.SkillCore.grantTest(p);
 for(let i=0;i<5;i++)a.SkillCore.upgrade(p,"ren","passive");
 for(let i=0;i<2;i++)a.SkillCore.upgrade(p,"nada","passive");
 assert.equal(a.SkillCore.level(p,"ren","passive"),6);
 assert.equal(a.SkillCore.level(p,"nada","passive"),3);
 const encoded=a.ProgressV3Core.fromRuntime(p);
 assert.equal(encoded.passiveLevels.ren,6);
 const restored=a.ProgressV3Core.toRuntime(encoded,roster);
 assert.equal(restored.passiveLevels.ren,6);
 assert.equal(restored.passiveLevels.nada,3);
 assert.equal(restored.skillLevels,undefined);
 const bad=JSON.parse(JSON.stringify(encoded));bad.passiveLevels.nada=99;
 assert.equal(a.ProgressV3Core.validateActive(bad,roster),null);
 const map=new Map([[a.ProgressV3Core.KEY,JSON.stringify(fresh)]]);
 const storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
 assert.equal(a.ProgressV3Core.persist(p,()=>storage),true);
 const loaded=a.ProgressV3Core.toRuntime(JSON.parse(map.get(a.ProgressV3Core.KEY)),roster);
 assert.equal(a.SkillCore.level(loaded,"ren","passive"),6);
 assert.equal(a.SkillCore.level(loaded,"nada","passive"),3);
});
test("CHAR003 card and skill dialog expose only actual playable passives",()=>{
 const source=read("game.js");
 assert.match(source,/SkillCore\.UPGRADABLE_IDS\.includes\(info\.id\)/);
 assert.match(source,/SkillCore\.UPGRADABLE_IDS\.map\(id=>\[id,SkillCore\.level/);
 assert.match(source,/SkillCore\.level\(progress,selectedHeroId,id\)===null/);
});

test("CHAR003 real battle Ren passive scales only off read-move marks",()=>{
 const src=["initiative-model.js","battle-rng.js","combat-status-core.js",
  "skill-core.js","ability-data.js","ability-info.js","combat-core.js"].map(read).join("\n");
 const core=vm.runInNewContext(src+"\n({CombatCore,CombatStatusCore})");
 const fighter=(id,side,atk,passive)=>({
  id,name:id,side,hp:1000,atk,physicalAttack:atk,speed:side==="ally"?150:20,
  physicalDefense:0,magicDefense:0,protection:0,maxProtection:0,
  accuracy:0,evasion:0,critChance:0,critDamage:150,defensePenetration:0,
  debuffPotency:25,debuffResistance:0,combatProfile:"stats002c",
  tags:id==="ren"?["gardens-over-abyss"]:[],
  skillLevels:{basic:1,special:1,powerful:1,passive}
 });
 function damage(level,marks,generic=false){
  const battle=core.CombatCore.createBattle([fighter("ren","ally",100,level),
   fighter("dummy","enemy",0,1)]);
  core.CombatCore.advanceToPlayerTurn(battle);
  if(marks)core.CombatStatusCore.applyReadMove(battle.fighters[1],marks,2);
  if(generic)battle.fighters[1].weakenAttacks=2;
  assert.equal(core.CombatCore.performPlayerAbility(battle,"basic"),true);
  return 1000-battle.fighters[1].hp;
 }
 assert.equal(damage(1,0),100);
 assert.equal(damage(6,0,true),100);
 assert.equal(damage(1,4),148);
 assert.equal(damage(3,4),156);
 assert.equal(damage(6,4),168);
});
