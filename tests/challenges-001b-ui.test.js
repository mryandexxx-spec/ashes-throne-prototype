"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const html=read("index.html"),game=read("game.js"),pkg=JSON.parse(read("package.json"));
test("pilot UI is a distinct navigable mode with separate results and no economic controls",()=>{
 for(const id of ["challenges","challengeList","challengeSaveStatus","challengeResult",
 "challengeResultTitle","challengeResultText","challengeResultStars",
 "challengeResultRetry","challengeResultBack","challengeResultHome",
 "battleChallengeGoal"])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/data-screen="challenges"/);
 assert.ok(html.indexOf('src="challenge-core.js"')>html.indexOf('src="campaign-data.js"'));
 assert.ok(html.indexOf('src="challenge-core.js"')<html.indexOf('src="game.js"'));
 assert.equal(pkg.version,"0.3.101");
 assert.match(html,/v0\.3\.101 · UIMODES001D/);
});
test("pilot uses the real player squad and custom enemy waves, leaving campaign intact",()=>{
 const checks=[
  'battleIsChallenge=squadReturnScreen==="challenges"',
  'ChallengeCore.get(activeChallengeId)',
  'openSquad("challenges")',
  'const first=def.enemyIds.filter(id=>!later.has(id));',
  'return [...selectedParty(),...enemies.map(progressedEnemy)];',
  'ChallengeCore.start(activeChallengeId)',
  'ChallengeCore.capture(challengeTracker,state.events||[])',
  'ChallengeCore.result(challengeProgress,activeChallengeId,state,challengeTracker)',
  'ChallengeCore.save(outcome.candidate,()=>window.localStorage,challengeSaveBlocked)',
  'renderChallengeResult()',
  'showScreen("challengeResult")',
  'activeMissionId=null'
 ];
 for(const part of checks)assert.ok(game.includes(part),part);
 assert.ok(game.includes('battleIsCampaign=squadReturnScreen==="campaign"&&!!activeMissionId'));
 assert.ok(game.includes('if(battleIsCampaign&&!freeStoryEntry){'));
 assert.ok(!read("campaign-data.js").includes("T-01"));
 assert.ok(!read("mission-data.js").includes("N-01"));
 assert.ok(!read("hero-collection-core.js").includes("T-01"));
});
test("core collects actual resolved combat events and assigns first target",()=>{
 const src=["initiative-model.js","ability-data.js","combat-core.js","challenge-core.js"].map(read).join("\n");
 const {CombatCore,ChallengeCore}=vm.runInNewContext(src+"\n({CombatCore,ChallengeCore})");
 const actor={id:"test-hero",side:"ally",name:"Hero",hp:400,atk:30,speed:250};
 const enemy=(id,hp)=>({id,side:"enemy",name:id,hp,atk:1,speed:70});
 const run=(priorityId)=>{
  const battle=CombatCore.createBattle([actor,enemy("ves",priorityId==="ves"?10:100),
   enemy("shade",priorityId==="shade"?10:100)]);
  const tracker=ChallengeCore.start("T-01");
  CombatCore.advanceToPlayerTurn(battle);
  let actions=0;
  while(battle.active&&actions++<30){
   const next=battle.fighters.some(f=>f.id===priorityId&&f.hp>0)?
    priorityId:(priorityId==="ves"?"shade":"ves");
   const i=battle.fighters.findIndex(f=>f.id===next);
   assert.equal(CombatCore.chooseEnemy(battle,i),true);
   assert.equal(CombatCore.performPlayerAbility(battle,"basic"),true);
   assert.equal(ChallengeCore.capture(tracker,battle.events),true);
  }
  assert.ok(actions<30);assert.equal(battle.winner,"ally");
  return ChallengeCore.score("T-01",battle,tracker);
 };
 assert.equal(run("ves"),3);
 assert.equal(run("shade"),1);
});
test("N-01 uses current wave logic without arbitrary 3-star limit",()=>{
 const src=["initiative-model.js","ability-data.js","combat-core.js","challenge-core.js"].map(read).join("\n");
 const {CombatCore,ChallengeCore}=vm.runInNewContext(src+"\n({CombatCore,ChallengeCore})");
 const actor={id:"test-hero",side:"ally",name:"Hero",hp:400,atk:30,speed:250};
 const enemy=id=>({id,side:"enemy",name:id,hp:10,atk:1,speed:70});
 const battle=CombatCore.createBattle([actor,enemy("ves"),enemy("shade")],[[enemy("ves-2")]]);
 const tracker=ChallengeCore.start("N-01");
 CombatCore.advanceToPlayerTurn(battle);
 let n=0;
 while(battle.active&&n++<20){
  assert.equal(CombatCore.performPlayerAbility(battle,"basic"),true);
  assert.equal(ChallengeCore.capture(tracker,battle.events),true);
 }
 assert.ok(n<20);
 assert.equal(battle.winner,"ally");
 assert.equal(battle.wave,2);
 assert.equal(ChallengeCore.score("N-01",battle,tracker),2);
});
