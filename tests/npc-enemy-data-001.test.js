"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const kit=vm.runInNewContext(
 ["initiative-model.js","ability-data.js","combat-core.js","enemy-decision.js",
  "npc-enemy-data.js"].map(read).join("\n")+"\n({NpcEnemyData,AbilityData,CombatCore,EnemyDecision})");
const {NpcEnemyData:N,AbilityData:A,CombatCore:C,EnemyDecision:E}=kit;
const ally=(id="ren",hp=140,speed=100)=>({id,name:id,hp,atk:25,physicalAttack:25,speed,side:"ally"});
const battle=roster=>C.createBattle(roster);
function ready(b,index){
 b.currentActor=index;
 b.fighters[index].meter=1000;
}
function choose(b,index){
 const before=JSON.stringify(b);
 const action=E.chooseAction(b,index);
 assert.equal(JSON.stringify(b),before,"AI must not mutate fight planning state");
 return action;
}
test("NPCDATA001: ten different non-recruitable archetypes with full 14-stat base data",()=>{
 const all=N.all();
 assert.equal(all.length,10);
 assert.equal(new Set(all.map(x=>x.archetypeId)).size,10);
 assert.equal(all.filter(x=>x.speciesId==="human").length,6);
 assert.equal(all.filter(x=>x.speciesId==="sarkh").length,2);
 assert.equal(all.filter(x=>x.speciesId==="laun").length,2);
 assert.equal(all.filter(x=>x.combatRole==="healer").length,2);
 for(const spec of all){
  assert.deepEqual(Object.keys(spec.stats).sort(),Array.from(N.STAT_KEYS).sort());
  assert.equal(Object.keys(spec.equipment).length,6);
  assert.equal(spec.stats.magicAttack,0);
  assert.equal(spec.abilities.basic.cooldown,0);
  assert.equal(spec.abilities.basic.damageType,"physical");
  assert.ok(["aggressive","guardian","support","tactical"].includes(spec.aiProfile));
  assert.equal(Object.isFrozen(spec),true);
 }
 assert.equal(N.get("npc-unknown"),null);
});
test("NPCDATA001: independent instances, strict levels, stars, G tiers and no race factions",()=>{
 const first=N.spawn("npc-field-medic",{instanceId:"npc-healer-a"});
 const second=N.spawn("npc-field-medic",{instanceId:"npc-healer-b",level:8,stars:3,gearTier:2,skillLevel:4});
 assert.notEqual(first.id,second.id);
 assert.equal(first.side,"enemy");
 assert.equal(first.archetypeId,second.archetypeId);
 assert.equal(first.factionId,null);
 assert.equal(first.speciesId,"human");
 assert.equal(second.gearTier,2);
 assert.equal(first.speed,second.speed,"level and star do not change initiative speed");
 assert.ok(second.hp>first.hp);
 assert.ok(second.physicalAttack>first.physicalAttack);
 assert.equal(first.magicAttack,0);
 assert.equal(first.protection,first.maxProtection);
 assert.equal(second.npcAbilities.special.healAmount,36+Math.round(7*.8+3*5));
 assert.equal(first.npcAbilities.special.healAmount,36);
 assert.equal(Object.isFrozen(first.npcAbilities.special),true);
 assert.equal(first.npcAbilities.special.healAmount,36,"new spawn does not mutate frozen kit");
});
test("NPCDATA001: reject invalid, polluted or out-of-range instance configs",()=>{
 for(const opts of [{level:0},{level:86},{level:1.1},{stars:0},{stars:8},
  {gearTier:14},{skillLevel:0},{skillLevel:7},{instanceId:""},{instanceId:"a b"},
  {instanceId:"../../test"},[],null]){
  assert.equal(N.spawn("npc-laun-physician",opts),null,JSON.stringify(opts));
 }
 assert.equal(N.spawn("missing"),null);
 assert.notEqual(N.spawn("npc-laun-physician",{level:85,stars:7,gearTier:13,skillLevel:6}),null);
});
test("NPCDATA001: NPC abilities are isolated from ally identities and existing demo IDs",()=>{
 const medic=N.spawn("npc-laun-physician");
 assert.equal(A.get(medic,"special").kind,"heal");
 assert.equal(A.get(medic,"special").target,"ally");
 assert.equal(A.get(medic,"special").healAmount,44);
 assert.equal(A.get(medic,"powerful").target,"all-allies");
 assert.equal(A.get(medic,"passive").name,"Осторожность");
 assert.equal(A.get({...medic,side:"ally"},"special").kind,"damage",
  "no NPC kit for a recruitable side");
 assert.equal(A.get({id:"ves",side:"enemy",atk:18},"special").name,"Особый удар");
 assert.equal(A.get({id:"ren",side:"ally",atk:27},"special").name,"Найти брешь");
});
test("NPCDATA001: human medic heals teammate via shared enemy AI and cooldown",()=>{
 const medic=N.spawn("npc-field-medic");
 const guard=N.spawn("npc-pass-guard");
 const b=battle([ally(),medic,guard]);
 ready(b,1);
 b.fighters[2].hp=25;
 const plan=choose(b,1);
 assert.equal(plan.abilityId,"special");
 assert.equal(plan.targetIndex,2);
 assert.equal(C.performActorAbility(b,plan.abilityId,plan.targetIndex),true);
 assert.equal(b.fighters[2].hp,61);
 assert.equal(b.fighters[1].specialCooldown,2);
 assert.equal(b.fighters[0].hp,140,"healer never heals player");
 assert.equal(b.allyActions,0,"enemy heals do not spend player actions");
 ready(b,1);
 assert.equal(choose(b,1).abilityId,"basic","cooldown prevents repeat");
});
test("NPCDATA001: laun physician group-heals multiple living allies, never revives",()=>{
 const medic=N.spawn("npc-laun-physician");
 const front=N.spawn("npc-laun-ford-guard");
 const courier=N.spawn("npc-sarkh-land-courier");
 const b=battle([ally(),medic,front,courier]);
 ready(b,1);
 b.fighters[1].hp=40;
 b.fighters[2].hp=40;
 b.fighters[3].hp=0;
 const plan=choose(b,1);
 assert.equal(plan.abilityId,"powerful");
 assert.equal(C.performActorAbility(b,plan.abilityId,plan.targetIndex),true);
 assert.equal(b.fighters[1].hp,64);
 assert.equal(b.fighters[2].hp,64);
 assert.equal(b.fighters[3].hp,0);
 assert.equal(b.fighters[0].hp,140);
 assert.equal(b.fighters[1].powerfulCooldown,4);
});
test("NPCDATA001: guardian activates defend; offensive NPC applies weakening",()=>{
 const defender=N.spawn("npc-pass-guard");
 let b=battle([ally(),defender]);
 ready(b,1);
 b.fighters[1].hp=45;
 let plan=choose(b,1);
 assert.equal(plan.abilityId,"special");
 assert.equal(C.performActorAbility(b,plan.abilityId,plan.targetIndex),true);
 assert.equal(b.fighters[1].guardHits,2);
 const scout=N.spawn("npc-sarkh-land-courier");
 b=battle([ally(),scout]);
 ready(b,1);
 plan=choose(b,1);
 assert.equal(plan.abilityId,"powerful","uninjured fast NPC prioritises damage");
 b.fighters[1].powerfulCooldown=2;
 plan=choose(b,1);
 assert.equal(plan.abilityId,"special","weakening remains tactical fallback");
 assert.equal(C.performActorAbility(b,plan.abilityId,plan.targetIndex),true);
 assert.ok(b.fighters[0].weakenAttacks>0);
});
test("NPCDATA001: NPCs survive real initiative, a second wave and combat termination",()=>{
 const first=N.spawn("npc-pass-guard",{instanceId:"npc-wave-a"});
 const second=N.spawn("npc-laun-physician",{instanceId:"npc-wave-b"});
 const b=C.createBattle([ally("hero",200,200),first],[[second]]);
 C.advanceToPlayerTurn(b);
 assert.equal(b.currentActor,0);
 assert.equal(C.performActorAbility(b,"basic",1),true);
 assert.equal(b.active,true);
 // A reproducible player-victory shortcut is checked through normal actions.
 for(let i=0;i<50&&b.active;i++){
  C.advanceToPlayerTurn(b);
  if(!b.active)break;
  const actor=b.fighters[b.currentActor];
  if(actor.side!=="ally")throw Error("unexpected enemy turn returned");
  const target=b.fighters.findIndex(f=>f.side==="enemy"&&f.hp>0);
  if(target<0)break;
  C.performActorAbility(b,"basic",target);
 }
 assert.ok(["ally","enemy"].includes(b.winner),"battle must terminate");
 assert.equal(N.spawn("npc-field-medic").npcAbilities.special.healAmount,36,
  "fresh later spawn is not modified by previous battle");
});

test("NPCDATA001: test-only meshes match exact battle IDs without changing HEROES or save rosters",()=>{
 const game=read("game.js");
 const html=read("index.html");
 const version=JSON.parse(read("package.json")).version;
 assert.ok(game.includes("const COMBAT_VISUALS=HEROES.concat(NPC_PILOT_VISUALS.filter(Boolean));"));
 assert.ok(game.includes("COMBAT_VISUALS.forEach((h,i)=>{"),"Babylon creates reserved NPC meshes");
 assert.ok(game.includes("for(const h of COMBAT_VISUALS){"),"visibility sync includes pilot enemies");
 assert.ok(game.includes("NpcEnemyData.spawn(enemy.archetypeId,{instanceId:enemy.id})"),
  "the battle ID matches the pickable capsule metadata");
 assert.ok(game.includes("const ENEMIES=HEROES.filter(h=>h.side===\"enemy\");"),
  "legacy mission pool and saved IDs remain unchanged");
 assert.ok(game.includes("if(battleIsLoreTraining&&NPC_PILOT_ENABLED)"),
  "NPCs only participate in explicit training");
 assert.ok(html.includes("npc-enemy-data.js?v="+version));
 assert.ok(html.indexOf("npc-enemy-data.js")<html.indexOf("game.js?v="+version));
 const ids=["npc-pass-guard","npc-sarkh-land-courier","npc-laun-physician"];
 for(let i=0;i<ids.length;i++){
  const instanceId=ids[i]+"-training-"+(i+1);
  const spawned=N.spawn(ids[i],{instanceId});
  assert.equal(spawned.id,instanceId);
 }
});
