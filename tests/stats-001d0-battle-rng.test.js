"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const BattleRng=require("../battle-rng.js");

// Public contract: an explicit uint32 seed, deterministic independent stream,
// exact replay and no state corruption on malformed commands.
for(const seed of [0,1,42,0xffffffff]){
 const a={rng:BattleRng.create(seed)},b={rng:BattleRng.create(seed)};
 const av=Array.from({length:24},()=>BattleRng.roll(a,37));
 const bv=Array.from({length:24},()=>BattleRng.roll(b,37));
 assert.deepEqual(av,bv,"same seed + calls must replay byte-for-byte");
 assert.ok(av.every(x=>x.value>=0&&x.value<1));
 assert.equal(a.rng.draws,24);
 assert.equal(a.rng.seed,seed);
 const snapshot=BattleRng.snapshot(a);
 const expected=Array.from({length:8},()=>BattleRng.roll(a,50));
 const resumed={rng:BattleRng.restore(JSON.parse(JSON.stringify(snapshot)))};
 assert.deepEqual(Array.from({length:8},()=>BattleRng.roll(resumed,50)),expected,
   "JSON-roundtripped snapshot continues the same sequence");
 assert.equal(snapshot.draws,24,"snapshot must not alias live state");
}
const zero={rng:BattleRng.create(0)};
assert.equal(BattleRng.roll(zero,0).hit,false);
assert.equal(BattleRng.roll(zero,100).hit,true);
assert.equal(zero.rng.draws,2,"boundary chances deliberately consume draws");
for(const invalid of [-1,0x100000000,1.5,NaN,Infinity,"42",null]){
 assert.throws(()=>BattleRng.create(invalid),RangeError);
}
const test={rng:BattleRng.create(123)};
for(const chance of [-1,101,NaN,Infinity,"50",null]){
 const before=BattleRng.snapshot(test);
 assert.throws(()=>BattleRng.roll(test,chance),RangeError);
 assert.deepEqual(BattleRng.snapshot(test),before,"invalid odds do not consume RNG");
}
for(const invalid of [
 {seed:0,state:-1,draws:0},{seed:0,state:1,draws:-1},
 {seed:0,state:1,draws:Infinity},{seed:0,state:1,draws:1.5},
 {seed:2**32,state:1,draws:0},null
])assert.throws(()=>BattleRng.restore(invalid),RangeError);
const exhausted={rng:{seed:1,state:1,draws:Number.MAX_SAFE_INTEGER}};
assert.throws(()=>BattleRng.roll(exhausted,50),RangeError);
assert.equal(exhausted.rng.state,1);
assert.equal(exhausted.rng.draws,Number.MAX_SAFE_INTEGER);
assert.throws(()=>BattleRng.roll({},50),RangeError);

// The core owns one RNG per seeded battle, but NO existing action draws yet.
// The optional seed cannot change current damage, actor selection or events.
const source=["initiative-model.js","ability-data.js","battle-rng.js",
 "combat-core.js","auto-decision.js","enemy-decision.js"].map(read).join("\n");
const api=vm.runInNewContext(source+"\n({CombatCore,BattleRng})");
const troops=[
 {id:"kael",name:"Kael",side:"ally",hp:120,atk:24,speed:110},
 {id:"ves",name:"Ves",side:"enemy",hp:90,atk:18,speed:105}
];
function run(options){
 const b=api.CombatCore.createBattle(troops,[],options);
 api.CombatCore.advanceToPlayerTurn(b);
 assert.equal(api.CombatCore.performPlayerAbility(b,"basic"),true);
 return b;
}
const normal=run({});
const seeded=run({rngSeed:123});
assert.equal(Object.hasOwn(normal,"rng"),false,"legacy battles have no RNG state");
assert.equal(seeded.rng.draws,0,"no random chance is enabled in current gameplay");
assert.deepEqual(
 JSON.parse(JSON.stringify(seeded.events)),
 JSON.parse(JSON.stringify(normal.events)),
 "seed opt-in must not change current outcomes or event contracts");
assert.deepEqual(
 JSON.parse(JSON.stringify(seeded.fighters)),
 JSON.parse(JSON.stringify(normal.fighters)),
 "seed opt-in must not change current combat state");
assert.deepEqual(api.BattleRng.snapshot(seeded),{seed:123,state:123,draws:0});
assert.throws(()=>api.CombatCore.createBattle(troops,[],{rngSeed:-1}),RangeError);
assert.throws(()=>api.CombatCore.createBattle(troops,[],{rngSeed:null}),RangeError);
assert.equal(run({rngSeed:0}).rng.draws,0);

// The browser loads RNG BEFORE combat core and does not change existing build labels.
const html=read("index.html");
assert.ok(html.indexOf('src="battle-rng.js"')<html.indexOf('src="combat-core.js"'));
assert.ok(html.includes('src="battle-rng.js"'));
console.log("Stats-001D0: deterministic replay, JSON snapshots, invalid input atomicity, optional battle state and unchanged gameplay passed");
