/* Combat-015A: planning only, no game integration and no mutations. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const script = ["initiative-model.js","ability-data.js","combat-core.js","auto-decision.js"]
  .map(name => fs.readFileSync(path.join(root,name),"utf8")).join("\n") +
  "\n({InitiativeModel,AbilityData,CombatCore,AutoDecision})";
const {CombatCore, AutoDecision} = vm.runInNewContext(script);
const hero = (id, hp=100, atk=30, speed=200) =>
  ({id,name:id,side:"ally",hp,atk,speed});
const foe = (id, hp=120, speed=100) =>
  ({id,name:id,side:"enemy",hp,atk:1,speed});
function battle(allies, enemies) {
  const b = CombatCore.createBattle([...allies,...enemies]);
  CombatCore.advanceToPlayerTurn(b);
  return b;
}
function decide(b) {
  const before = JSON.stringify(b);
  const result = AutoDecision.chooseAction(b);
  assert.equal(JSON.stringify(b),before,"the planner must never mutate battle");
  return result;
}
let b = battle([hero("kael")],[foe("one",120)]);
assert.equal(decide(b).abilityId,"basic","healthy allies require no guard");
b.fighters[0].hp=50;
assert.deepEqual(JSON.parse(JSON.stringify(decide(b))),{abilityId:"special",targetIndex:0},
  "guard endangered unprotected ally");
b.fighters[0].guardHits=2;
assert.equal(decide(b).abilityId,"basic","do not waste existing protection");

b = battle([hero("medic-demo"),hero("lyra")],[foe("one")]);
b.fighters[1].hp=25;
assert.deepEqual(JSON.parse(JSON.stringify(decide(b))),{abilityId:"special",targetIndex:1},
  "single-target heal weakest wounded ally");
b.fighters[0].hp=50;
assert.equal(decide(b).abilityId,"powerful","group heal when two allies need it");
b.fighters[1].hp=100;
b.fighters[0].hp=100;
assert.equal(decide(b).abilityId,"basic","never heal a healthy squad");
b.fighters[0].hp=50;
b.fighters[0].specialCooldown=2;
assert.equal(decide(b).abilityId,"basic","unneeded group heal cannot replace cooldown");

b = battle([hero("lyra")],[foe("one",120),foe("two",80)]);
assert.equal(decide(b).abilityId,"powerful","available stronger strike should be considered");
assert.equal(decide(b).targetIndex,2,"prefer lowest-HP enemy with stable tie break");
b.fighters[0].powerfulCooldown=2;
assert.equal(decide(b).abilityId,"special","apply useful weakening when stronger on cooldown");
b.fighters[1].weakenAttacks=1;
b.fighters[2].weakenAttacks=1;
assert.equal(decide(b).abilityId,"basic","do not reapply sufficient weakening");
b.fighters[0].specialCooldown=1;
assert.deepEqual(JSON.parse(JSON.stringify(decide(b))),{abilityId:"basic",targetIndex:2},
 "fallback to basic against lowest-HP living enemy");
b.fighters[2].hp=0;
assert.equal(decide(b).targetIndex,1,"never select dead enemy");

b = battle([hero("test-area-damage")],[foe("one"),foe("two")]);
assert.equal(decide(b).abilityId,"special","AOE preferred with multiple live enemies");
b.fighters[2].hp=0;
assert.equal(decide(b).abilityId,"powerful","single powerful strike remains useful");
b.fighters[0].powerfulCooldown=2;
assert.equal(decide(b).abilityId,"basic","single neutral AOE is not useful");

b = battle([hero("kael")],[foe("one")]);
b.fighters[0].hp=55;
b.fighters[0].specialCooldown=2;
assert.equal(decide(b).abilityId,"powerful","available powerful guard is still useful");
b.fighters[0].powerfulCooldown=2;
assert.equal(decide(b).abilityId,"basic","both guard cooldowns force basic");
b.currentActor=-1;
assert.equal(decide(b),null,"no action when actor not ready");
b.active=false;
assert.equal(decide(b),null,"no action when battle completed");
assert.equal(AutoDecision.chooseAction(null),null);
console.log("Combat-015A readonly tactical planning: healing, guard, damage, AOE, cooldown, target and fallback passed");
