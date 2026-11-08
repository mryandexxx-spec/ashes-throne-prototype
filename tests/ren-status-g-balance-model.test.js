"use strict";
// REN-STATUS-G: empirical *engine* outcomes vs an independent, analytic
// probability model. READ-ONLY STUDY, no gameplay formula changes.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const src=["initiative-model.js","combat-status-core.js","ability-data.js",
 "battle-rng.js","combat-core.js","story-trial-data.js"].map(read).join("\n");
const {CombatCore:core,CombatStatusCore:status,StoryTrialData:trial}=vm.runInNewContext(
 src+"\n({CombatCore,CombatStatusCore,StoryTrialData})");
const resistances=[0,25,50,70,90,100];
const abilities=[["basic","slowed"],["special","weaken"],["powerful","debuff-resistance-down"]];
const trials=512;
function formula(resistance,{base=100,minimum=5,maximum=100,down=false,passive=10}={}){
 const effective=Math.max(0,resistance-(down?15:0));
 // Existing passive adds +10 only if resistance-down is ABSENT.
 const bonus=down?0:passive;
 return Math.max(minimum,Math.min(maximum,base+bonus-effective));
}
const probability=(resistance,opts)=>formula(resistance,opts)/100;
function seededAttempt(resistance,abilityId,effectName,down,seed){
 const hero={...trial.heroes()[0]};
 const target={id:"model-enemy",name:"Модельная цель",side:"enemy",
  hp:600,atk:0,speed:1,debuffResistance:resistance,debuffPotency:0};
 const battle=core.createBattle([hero,target],[],{
  rngSeed:seed,statusChecks:true,legacyStatusChecks:true});
 if(down)assert.equal(status.apply(battle.fighters[1],"debuff-resistance-down",15,2),true);
 core.advanceToPlayerTurn(battle);
 assert.equal(battle.fighters[battle.currentActor].id,"trial-ren");
 assert.equal(core.performPlayerAbility(battle,abilityId),true);
 assert.equal(battle.rng.draws,1,"one living target should trigger exactly one status roll");
 assert.equal(battle.fighters[1].hp<600,true,"status resistance does not block damage");
 const success=battle.events.some(e=>e.type==="effect"&&e.effect===effectName);
 const resisted=battle.events.some(e=>e.type==="status-resisted"&&e.effect===effectName);
 assert.notEqual(success,resisted,"exactly one status result per attack");
 if(resisted)assert.equal(battle.events.find(e=>e.type==="status-resisted").chance,
  formula(resistance,{down}),"live engine agrees with independent formula");
 return success;
}
const rows=[];
for(const resistance of resistances){
 const row={resistance,
  current:formula(resistance),afterDown:formula(resistance,{down:true}),
  alternative90:formula(resistance,{base:90,minimum:10,maximum:95}),
  alternative85:formula(resistance,{base:85,minimum:10,maximum:95})};
 for(const [abilityId,effect]of abilities){
  for(const down of [false,true]){
   let successes=0;
   for(let i=0;i<trials;i++){
    // Golden-ratio multiplication spreads uint32 seeds over the full range.
    // Consecutive seeds are *not* sufficiently independent for this LCG.
    const seed=Math.imul(i+1,0x9e3779b1)>>>0;
    if(seededAttempt(resistance,abilityId,effect,down,seed))successes++;
   }
   const expected=probability(resistance,{down});
   const observed=successes/trials;
   assert.ok(Math.abs(observed-expected)<=0.035,
    abilityId+" res="+resistance+" down="+down+
      " empirical "+observed+" differs from analytic "+expected);
   row[abilityId+(down?"After":"Before")]=successes;
  }
 }
 // P(setup succeeds) * improvement in a later independent status attempt;
 // assumes same target survives and the status has not expired.
 row.setupUpliftPP=+(probability(resistance)*
   (formula(resistance,{down:true})-formula(resistance))).toFixed(2);
 rows.push(row);
}
assert.equal(rows[0].current,100);
assert.equal(rows[0].afterDown,100);
assert.equal(rows[4].current,20);
assert.equal(rows[4].afterDown,25);
assert.equal(rows[4].setupUpliftPP,1);
assert.equal(rows[2].setupUpliftPP,3);
assert.equal(trial.statusPilot.enemyResistance[0],90);
assert.equal(trial.statusPilot.enemyResistance[1],50);
assert.ok(!read("progress-v3-core.js").includes("trial-ren"));
console.log("REN-STATUS-G: engine-vs-analytic model; "+trials+
 " stratified seeds per ability/condition. Counts: successes out of "+trials);
console.log("res current% down% alt90% alt85% basic0 basicD special0 specialD power0 powerD setup-uplift-pp");
for(const row of rows){
 console.log([row.resistance,row.current,row.afterDown,
 row.alternative90,row.alternative85,row.basicBefore,row.basicAfter,
 row.specialBefore,row.specialAfter,row.powerfulBefore,row.powerfulAfter,
 row.setupUpliftPP].join(" "));
}
console.log("REN-STATUS-G: 3 abilities x 2 status contexts x 6 resistances x "+
 trials+" seeds verified without changing combat mechanics");
