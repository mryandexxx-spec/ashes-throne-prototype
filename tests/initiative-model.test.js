"use strict";
const assert = require("node:assert/strict");
const model = require("../initiative-model.js");
const party = [
  {id:"slow",speed:100,hp:10},
  {id:"fast",speed:200,hp:10}
];
const s = model.createInitiative(party);
assert.equal(s[0].meter,0);
assert.equal(party[0].meter,undefined, "source data untouched");
const counts = {slow:0,fast:0};
const first=[];
let time=0;
for(let i=0;i<30;i++) {
  const turn=model.nextActor(s);
  assert.ok(turn);
  time+=turn.delta;
  counts[turn.id]++;
  if(i<4) first.push([turn.id,time]);
  model.finishTurn(s,turn.id);
}
assert.deepEqual(counts,{slow:10,fast:20});
assert.deepEqual(first,[["fast",5],["slow",10],["fast",10],["fast",15]]);
const tie=model.createInitiative([
  {id:"a",speed:100,hp:1},{id:"b",speed:100,hp:1}
]);
assert.equal(model.nextActor(tie).id,"a");
model.finishTurn(tie,"a");
const second=model.nextActor(tie);
assert.equal(second.id,"b");
assert.equal(second.delta,0);
model.finishTurn(tie,"b");
const dead=model.createInitiative([{id:"dead",speed:999,hp:0},{id:"alive",speed:10,hp:1}]);
assert.equal(model.nextActor(dead).id,"alive");
assert.throws(()=>model.createInitiative([{id:"bad",speed:0,hp:5}]));
assert.throws(()=>model.createInitiative([{id:"same",speed:1,hp:2},{id:"same",speed:2,hp:3}]));
console.log("Combat-001 initiative tests passed");
