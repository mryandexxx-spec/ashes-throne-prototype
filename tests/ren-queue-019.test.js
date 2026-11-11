"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const game=read("game.js");
const source=read("animation-profiles.js")+"\n"+read("battle-animation.js")+"\n({AnimationProfiles,BattleAnimation})";
const {AnimationProfiles:profiles,BattleAnimation:battle}=vm.runInNewContext(source);

test("RENQUEUE019: controls and auto scheduler cannot start another turn while visual queue is active",()=>{
 assert.match(game,/function visualActionPending\(\)\{return !!scene&&BattleAnimation\.pending\(\)>0;\}/);
 assert.match(game,/autoTimer!==null\|\|isVisualTransition\(\)\|\|visualActionPending\(\)/);
 assert.match(game,/if\(isVisualTransition\(\)\|\|visualActionPending\(\)\|\|!autoBattle/);
 assert.match(game,/if\(autoBattle\|\|isVisualTransition\(\)\|\|visualActionPending\(\)\|\|!CombatCore\.abilityReady/);
 assert.match(game,/if\(!state\.active\|\|autoBattle\|\|isVisualTransition\(\)\|\|visualActionPending\(\)\|\|!CombatCore\.abilityReady/);
 assert.match(game,/if\(hadPending&&!visualActionPending\(\)&&state\.active&&!isVisualTransition\(\)\)syncBattleUI\(\)/);
 assert.match(game,/visualBusy\?"Действие выполняется…"/);
 for(const button of ["basicAbilityBtn","specialAbilityBtn"]){
  assert.ok(game.includes('$("#'+button+'").disabled=')&&game.includes('||visualBusy;'),button);
 }
});

test("RENQUEUE019: presentation queue drains sequentially on x1 and x4, then restarts correctly",()=>{
 const durations={basic:1350,hit:650,death:1850};
 for(const [slot,duration] of Object.entries(durations))assert.equal(profiles.resolve("ren",slot).durationMs,duration);
 for(const speed of [1,4]){
  battle.clear();
  battle.enqueue([{type:"ability",actorId:"ren",targetId:"shade",abilityId:"basic"},{type:"damage",actorId:"shade",targetId:"ren",amount:7}]);
  assert.equal(battle.pending(),2);
  // Same action does not finish early at the chosen speed.
  for(let t=0;t<durationFor("basic")/speed-100;t+=100)battle.tick(Math.min(100,durationFor("basic")/speed-100-t),speed);
  assert.equal(battle.activity("ren").slot,"basic");
  // Finish all available visual steps (clamped frame delta applies).
  for(let i=0;i<80 && battle.pending();i++)battle.tick(100,speed);
  assert.equal(battle.pending(),0);
  battle.clear();
  assert.equal(battle.activity("ren").slot,"idle");
 }
 function durationFor(slot){return durations[slot];}
});
