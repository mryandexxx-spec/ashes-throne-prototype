"use strict";
const assert=require("node:assert/strict");
const GearData=require("../gear-data.js");
const expected=[
 "hp","protection","physicalAttack","magicAttack","physicalDefense",
 "magicDefense","speed","critChance","critDamage","accuracy",
 "evasion","defensePenetration","debuffPotency","debuffResistance"
];
assert.deepEqual(GearData.FUTURE_STAT_KEYS,expected,"approved 14-stat ordering is stable");
assert.deepEqual(Object.keys(GearData.STAT_LABELS),expected,"all approved stats have a readable label");
const profile=GearData.statOverview({hp:143,atk:36,speed:110});
assert.equal(profile.length,14);
assert.deepEqual(profile.filter(s=>s.active).map(s=>s.id),["hp","speed"]);
assert.equal(profile[0].value,143);
assert.equal(profile[6].value,110);
assert.equal(profile.find(s=>s.id==="protection").value,null,"separate Protection pool is not fabricated");
assert.equal(profile.find(s=>s.id==="physicalAttack").value,null,"general test ATK is not assumed physical");
assert.equal(profile.find(s=>s.id==="magicAttack").value,null,"general test ATK is not assumed magical");
for(const stat of profile.filter(s=>!s.active))assert.equal(stat.value,null);
assert.equal(GearData.STAT_LABELS.protection,"Защита (Protection)");
assert.equal(GearData.STAT_LABELS.debuffResistance,"Сопротивление ослаблениям");
assert.equal(GearData.statOverview({hp:180,speed:135})[0].value,180,"UI reads current stats each rerender");
assert.ok(Object.isFrozen(profile[0]));
console.log("Stats-001A: approved 14 keys, 2 actual values and 12 undefined mechanics verified");
