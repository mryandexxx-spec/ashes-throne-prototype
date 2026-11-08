"use strict";
// Stats-004A5: test-only account→hero cap, preserving previously bought levels.
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const P=vm.runInNewContext(read("progress-core.js")+"\nProgressCore");
const hero={id:"kael",side:"ally",hp:120,atk:24,speed:110};
const progress=P.createProgress([hero]);
progress.currency=100000;
const thresholds=[0,47,102,238,1579];
const caps=[3,8,12,15,15];
for(let i=0;i<thresholds.length;i++){
 progress.accountXp=thresholds[i];
 assert.equal(P.heroLevelCap(progress),caps[i]);
}
progress.accountXp=0;
assert.equal(P.heroLevelCap(progress),3);
assert.equal(P.upgrade(progress,"kael"),true);
assert.equal(P.upgrade(progress,"kael"),true);
assert.equal(P.levelOf(progress,"kael"),3);
const gold=progress.currency;
assert.equal(P.upgradeCost(progress,"kael"),null);
assert.equal(P.upgrade(progress,"kael"),false);
assert.equal(progress.currency,gold,"failed upgrade cannot charge currency");
assert.match(P.upgradeBlockReason(progress,"kael"),/Уровень аккаунта 1/);
progress.accountXp=47;
while(P.canUpgrade(progress,"kael"))assert.equal(P.upgrade(progress,"kael"),true);
assert.equal(P.levelOf(progress,"kael"),8);
assert.equal(P.upgrade(progress,"kael"),false);
progress.accountXp=102;
while(P.canUpgrade(progress,"kael"))assert.equal(P.upgrade(progress,"kael"),true);
assert.equal(P.levelOf(progress,"kael"),12);
progress.accountXp=165;
assert.equal(P.heroLevelCap(progress),12);
progress.accountXp=238;
while(P.canUpgrade(progress,"kael"))assert.equal(P.upgrade(progress,"kael"),true);
assert.equal(P.levelOf(progress,"kael"),15);
assert.equal(P.upgrade(progress,"kael"),false);
assert.match(P.upgradeBlockReason(progress,"kael"),/тестового максимума/);
// Existing saves must not lose hero levels, HP, gear or currency when a new cap starts.
progress.accountXp=0;
const snap=JSON.stringify(progress);
assert.equal(P.levelOf(progress,"kael"),15);
assert.ok(P.heroStats(progress,hero).hp>hero.hp);
assert.equal(P.canUpgrade(progress,"kael"),false);
assert.equal(JSON.stringify(progress),snap,"checking the cap must not mutate or downgrade save");
// A fresh v3 profile is subject to the same gate; no schema modification.
const v3=P.createProgress([hero]);
v3.saveVersion=3;v3.currency=100000;v3.accountXp=85;
assert.equal(P.heroLevelCap(v3),8);
assert.equal(P.upgrade(v3,"kael"),true);
assert.equal(v3.levels.kael,2);
assert.equal(P.upgradeCost(v3,"missing"),null);
assert.match(P.upgradeBlockReason(v3,"missing"),/не найден/);
const game=read("game.js");
assert.match(game,/ProgressCore\.heroLevelCap\(progress\)/);
assert.match(game,/ProgressCore\.upgradeBlockReason\(progress,base\.id\)/);
assert.match(game,/const before=progress\.saveVersion===3\?JSON\.stringify\(progress\):null/);
console.log("Stats-004A5: account levels, hard cap, currency safety, existing hero levels and UI messaging passed");
