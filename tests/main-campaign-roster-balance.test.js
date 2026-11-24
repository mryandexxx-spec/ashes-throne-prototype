"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const game=read("game.js");
const files=["gear-data.js","progress-core.js","star-core.js","skill-core.js","hero-collection-core.js","daily-core.js","login-core.js","progress-v3-core.js","save-core.js","hero-stats-core.js","hero-stats-profiles.js","hero-stats-combat-bridge.js","initiative-model.js","combat-status-core.js","ability-data.js","battle-rng.js","combat-core.js","auto-decision.js","enemy-decision.js","npc-enemy-data.js","main-campaign-core.js"];
const source=files.map(read).join("\n")+"\n"+game.slice(0,game.indexOf("const $="))+"\nlet progress;\n"+game.slice(game.indexOf("const PILOT_HERO_STATS="),game.indexOf("function hasLeaderSkill"))+"\n({ALLIES:HEROES.filter(h=>h.side==='ally'),SaveCore,MainCampaignCore,NpcEnemyData,CombatCore,AutoDecision,AbilityData,progressedHero,setProgress:p=>{progress=p;}})";
const {ALLIES,SaveCore,MainCampaignCore,NpcEnemyData,CombatCore:C,AutoDecision:A,AbilityData,progressedHero,setProgress}=vm.runInNewContext(source);
const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
const p=SaveCore.load(ALLIES,()=>storage).progress;setProgress(p);
const party=["ren","art"].map(id=>progressedHero(ALLIES.find(h=>h.id===id)));
assert.ok(party.every(h=>h.level===1));
function run(seed,policy,ids=["ren","art"]){
 const b=C.createBattle([...party.filter(h=>ids.includes(h.id)),...MainCampaignCore.enemies(NpcEnemyData)],[],{leaderId:ids[0],rngSeed:seed,hitChecks:true,critChecks:true,penetrationChecks:true,statusChecks:true});
 C.advanceToPlayerTurn(b);
 for(let i=0;b.active&&i<120;i++){
  const actor=b.fighters[b.currentActor];assert.equal(actor.side,"ally");
  const opponents=b.fighters.map((f,i)=>({f,i})).filter(x=>x.f.side==="enemy"&&x.f.hp>0).sort((a,b)=>a.f.hp+a.f.protection-b.f.hp-b.f.protection||a.i-b.i);
  if(policy==="auto"){assert.ok(C.performAutoAction(b,A.chooseAction(b)));continue}
  let ability="basic";
  if(policy==="tactical"){
   if(actor.id==="art"&&C.abilityReady(b,"special")&&b.fighters.some(f=>f.id==="ren"&&f.hp>0))ability="special";
   else if(C.abilityReady(b,"powerful"))ability="powerful";
   else if(actor.id==="ren"&&C.abilityReady(b,"special"))ability="special";
  }
  const side=C.abilityTargetSide(b,ability);
  const allowed=C.abilityTargetIndices(b,side);
  const target=side==="enemy"?opponents.find(x=>allowed.includes(x.i))?.i:side==="ally"?allowed.find(i=>b.fighters[i].id==="ren")??allowed[0]:allowed[0]??b.currentActor;
  assert.ok(C.performActorAbility(b,ability,target),JSON.stringify({actor:actor.id,ability,side,target,allowed}));
 }
 assert.equal(b.active,false,"M1 must terminate");
 return {win:b.winner==="ally",stars:MainCampaignCore.score(b),actions:b.allyActions};
}
test("M1 starter balance baseline, 32 seeded runs for each legal manual/auto strategy",()=>{
 for(const [policy,ids] of [["basic",["ren","art"]],["tactical",["ren","art"]],["auto",["ren","art"]],["basic",["art"]]]){
  const rows=Array.from({length:32},(_,i)=>run(Math.imul(i+1,0x9e3779b1)>>>0,policy,ids));
  const summary={policy,ids,wins:rows.filter(x=>x.win).length,perfect:rows.filter(x=>x.stars===3).length,avgActions:rows.reduce((n,x)=>n+x.actions,0)/rows.length};
  console.log("CAMROSTER_BALANCE",JSON.stringify(summary));
 }
});
