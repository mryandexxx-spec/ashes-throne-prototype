"use strict";
const {test}=require("node:test"),fs=require("node:fs"),path=require("node:path");
const files=["initiative-model.js","ability-data.js","battle-rng.js","combat-status-core.js","network-score-core.js","combat-core.js","auto-decision.js","enemy-decision.js","npc-enemy-data.js","gear-data.js","hero-stats-core.js","hero-stats-profiles.js","hero-stats-combat-bridge.js","progress-core.js","skill-core.js","star-core.js","progress-v3-core.js","main-campaign-core.js","combat-2-hud/model.js","combat2-arena-pilot.js"];
const {C,N,P}=new Function(files.map(f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8")).join("\n")+"\nreturn {C:CombatCore,N:NetworkScoreCore,P:Combat2ArenaPilot};")();
function verify(C,N,P){
 const setup=P.setup({scenario:"full",tier:"early",seed:7});
 const heroes=setup.lineup.filter(f=>f.side==="ally"&&["sava","ren"].includes(f.id));
 const foe={...setup.lineup.find(f=>f.side==="enemy"),id:"objective",hp:1000,maxHp:1000,protection:0,maxProtection:0,physicalDefense:0,speed:1};
 const check=(x,msg)=>{if(!x)throw Error(msg);};
 function run(hp,withScore=true){
  const b=C.createBattle([...heroes,{...foe,hp,maxHp:hp}],[],{combat2:true});
  const a=b.fighters.find(f=>f.id==="sava"),h=b.fighters.find(f=>f.id==="ren");
  a.meter=h.meter=1000;b.currentActor=b.fighters.indexOf(a);
  if(withScore)check(N.attach(b,{first:[foe],binding:{wave:0}}),"attach");
  check(C.performActorAbility(b,"powerful",2,b.fighters.indexOf(h)),"command");
  return b;
 }
 const control=run(1000);
 const primary=control.events.find(e=>e.type==="damage"&&!e.assist).hpDamage;
 check(primary>0&&control.events.some(e=>e.type==="damage"&&e.assist),"fixture both hits");
 check(control.networkScoreMetrics.enemyDeaths.length===0,"nonlethal");
 for(const [hp,assist] of [[1,false],[primary+1,true]]){
  const b=run(hp);check(!b.active&&b.winner==="ally"&&b.allyActions===1,"terminal");
  const death=b.events.filter(e=>e.type==="death"&&e.targetId==="objective");
  check(death.length===1&&!!death[0].assist===assist,"one death, correct attribution");
  if(assist)check(death[0].depth===1&&death[0].sourceId==="sava"&&death[0].actorId==="ren","assist attribution");
  const summary=N.summarize(b,0);check(summary?.objectiveDone&&summary.score===100,"score parity");
  N.observe(b,"death","objective");check(b.networkScoreMetrics.enemyDeaths.length===1,"dedup");
  const unscored=run(hp,false);check(!unscored.active&&unscored.winner==="ally"&&JSON.stringify(unscored.events)===JSON.stringify(b.events),"no-score event parity");
 }
 return {primary,nonlethal:true,primaryKO:true,assistKO:true,score:100};
}
test("B17.4B: secondary KO is durable without redispatching passive triggers",()=>verify(C,N,P));
