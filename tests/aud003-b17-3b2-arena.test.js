"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const files=["initiative-model.js","ability-data.js","battle-rng.js","combat-status-core.js","combat-core.js","auto-decision.js","enemy-decision.js","npc-enemy-data.js","gear-data.js","hero-stats-core.js","hero-stats-profiles.js","hero-stats-combat-bridge.js","progress-core.js","skill-core.js","star-core.js","progress-v3-core.js","main-campaign-core.js","combat-2-hud/model.js","combat2-arena-pilot.js"];
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const {P,C,A,H}=new Function(files.map(read).join("\n")+"\nreturn {P:Combat2ArenaPilot,C:CombatCore,A:AutoDecision,H:Combat2HUD};")();
function run(scenario,tier,seed){
 const s=P.setup({scenario,tier,seed}),b=C.createBattle(s.lineup,s.waves,s.options);C.advanceToPlayerTurn(b);
 const events={};let n=0;while(b.active&&n++<240){assert.ok(C.performAutoAction(b,A.chooseAction(b)),scenario+" "+tier);for(const e of b.events)events[e.type]=(events[e.type]??0)+1;}
 assert.equal(b.active,false,scenario+" "+tier);
 return {winner:b.winner,wave:b.wave,actions:b.allyActions,events,remaining:b.fighters.map(f=>[f.id,f.hp,f.protection])};
}
test("native 3D fixture factory: actual equipment progression, no input mutation, fixed campaign candidates",()=>{
 const s=P.setup({scenario:"full",tier:"uneven",seed:7});
 assert.deepEqual(s.lineup.filter(f=>f.side==="ally").map(f=>[f.id,f.level,f.gearTier]),[["ren",85,13],["art",15,7],["nada",2,1],["liora",15,7],["sava",2,1]]);
 assert.equal(s.lineup.filter(f=>f.side==="enemy").length,5);
 assert.deepEqual(P.setup({scenario:"armored",tier:"max"}).lineup,P.setup({scenario:"armored",tier:"early"}).lineup);
 assert.deepEqual(P.setup({scenario:"armored"}).lineup.filter(f=>f.side==="enemy").map(f=>[f.hp,f.protection,f.physicalAttack]),[[82,15,14],[75,20,34]]);
 assert.equal(P.setup({scenario:"boss",tier:"max"}).lineup.find(f=>f.archetypeId==="npc-watch-captain").debuffResistance,80);
 assert.throws(()=>P.setup({scenario:"unknown"}));assert.throws(()=>P.setup({tier:"unknown"}));assert.throws(()=>P.setup({seed:-1}));
 for(const tier of ["early","mid","max"]){const x=H.buildSetup({preset:"full",tier,seed:7}),y=P.setup({scenario:"full",tier,seed:7});assert.deepEqual(y.lineup,x.lineup);assert.deepEqual(y.options,x.options);}
});
test("28 seed-7 native fixtures complete; repeated battles deterministic; waves, defeat and resistance exercised",()=>{
 let total=0,wins=0,losses=0;
 for(const tier of Object.keys(P.tiers))for(const scenario of Object.keys(P.scenarios)){
  const a=run(scenario,tier,7);total++;if(a.winner==="ally")wins++;else losses++;
  if(scenario==="loss")assert.equal(a.winner,"enemy");
  if(scenario==="waves"){assert.equal(a.winner,"ally");assert.equal(a.wave,2);assert.equal(a.events["wave-start"],1);}
  if(scenario==="boss")assert.ok(a.events["status-resisted"]>0);
 }
 assert.deepEqual([total,wins,losses],[28,22,6]);
 assert.deepEqual(run("loss","early",7),run("loss","early",7));
});
test("arena route remains explicit and outside all existing reward-bearing flags",()=>{
 const g=read("game.js"),h=read("index.html");
 assert.match(g,/const COMBAT2_ARENA=COMBAT2_PILOT&&/);
 assert.match(g,/squadReturnScreen="combat2Arena";showScreen\("battle"\)/);
 assert.match(g,/if\(battleIsCombat2Arena\)\{\s*const setup=Combat2ArenaPilot.setup\(combat2ArenaConfig\)/);
 assert.match(g,/CombatCore.createBattle\(lineup,setup.waves,setup.options\)/);
 assert.match(g,/if\(battleIsCombat2Arena\)\{showScreen\("combat2ArenaSetup"\)/);
 assert.match(h,/id="combat2ArenaSetup" class="screen"/);
 assert.match(g,/if\(\(ready&&combat2EntryFrames>=2\)\|\|combat2EntryFrames>=12\)/);
});

test("B17.4A: candidate descriptions match all six skill levels, never leak legacy effects",()=>{
 const {D,I}=new Function(["ability-data.js","skill-core.js","ability-info.js"].map(read).join("\n")+"\nreturn {D:AbilityData,I:AbilityInfo};")();
 for(let level=1;level<=6;level++){
  const hero=id=>({id,side:"ally",combat2:true,skillLevels:{basic:level,special:level,powerful:level,passive:level}});
  const art=hero("art"),sava=hero("sava");
  assert.equal(I.format(art,"leader").status,"not-assigned");
  assert.equal(I.format(sava,"leader").status,"not-assigned");
  assert.equal(I.format(hero("liora"),"leader").status,"available");
  assert.match(I.format(art,"special").description,/65%.*Protection|Protection.*65%/);
  assert.match(I.format(art,"passive").description,/40%.*85%.*Protection/);
  assert.match(I.format(art,"powerful").description,/обычную атаку/);
  const d=D.get(sava,"special"),p=D.get(sava,"powerful"),b=D.get(sava,"basic"),passive=D.get(sava,"passive");
  assert.ok(I.format(sava,"special").description.includes(String(d.signalMeter)));
  assert.ok(I.format({...sava,combat2Boost:50},"special").description.includes(String(d.signalMeter+50)));
  assert.ok(I.format(sava,"basic").description.includes(String(b.nextAllyMeter)));
  assert.ok(I.format(sava,"powerful").description.includes(Math.round(p.combat2Assist*100)+"%"));
  assert.match(I.format(sava,"powerful").description,/до крита/);
  assert.ok(I.format(sava,"passive").description.includes("+"+passive.combatRules.combat2Boost));
  for(const h of [art,sava]){
   const legacy={...h,combat2:false};assert.equal(I.format(legacy,"leader").status,"available");
   assert.notEqual(I.format(legacy,"passive").description,I.format(h,"passive").description);
   assert.notEqual(I.format(legacy,"special").description,I.format(h,"special").description);
  }
 }
});
