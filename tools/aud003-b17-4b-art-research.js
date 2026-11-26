/* B17.4B [PROPOSAL] isolated research. node tools/aud003-b17-4b-art-research.js
   Never imported by game; no production changes. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const files=["initiative-model.js","ability-data.js","battle-rng.js","combat-status-core.js","combat-core.js","auto-decision.js","enemy-decision.js","npc-enemy-data.js","gear-data.js","hero-stats-core.js","hero-stats-profiles.js","hero-stats-combat-bridge.js","progress-core.js","skill-core.js","star-core.js","progress-v3-core.js","main-campaign-core.js","combat-2-hud/model.js","combat2-arena-pilot.js"];
const src=files.map(f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8"));
function replaceOnce(s,a,b){assert.equal(s.split(a).length,2,"Research baseline changed: "+a);return s.replace(a,b);}
function load(v){
 const ss=src.slice();
 if(v){
  ss[4]=replaceOnce(ss[4],"actor.physicalAttack*.65","actor.physicalAttack*[.65,.68,.71,.74,.77,.80][(actor.skillLevels?.special??1)-1]");
  if(v===1)ss[4]=replaceOnce(ss[4],"art.physicalAttack*.85","art.physicalAttack*[.85,.88,.91,.94,.97,1][(art.skillLevels?.passive??1)-1]");
  if(v===2)ss[4]=replaceOnce(ss[4],"damage*.40","damage*[.40,.42,.44,.46,.48,.50][(art.skillLevels?.passive??1)-1]");
 }
 return new Function(ss.join("\n")+"\nreturn {P:Combat2ArenaPilot,C:CombatCore,A:AutoDecision};")();
}
const variants=[load(0),load(1),load(2)],setups=[];
for(const tier of ["early","mid","max","uneven"])for(const scenario of ["full","waves","boss","loss"])for(const seed of [7,19,41])setups.push(variants[0].P.setup({tier,scenario,seed}));
function run(v,s,l){
 const {C,A}=variants[v],lineup=s.lineup.map(f=>f.id==="art"?{...f,skillLevels:{...f.skillLevels,special:l,passive:l}}:f);
 const b=C.createBattle(lineup,s.waves,s.options);C.advanceToPlayerTurn(b);
 let n=0,rest=0,block=0,cover=0,react=0;
 while(b.active&&n++<240){
  assert.ok(C.performAutoAction(b,A.chooseAction(b)));
  for(const e of b.events){if(e.type==="combat2-protection"){rest+=e.amount;cover++;}if(e.type==="combat2-cover"){block+=e.amount;react++;}}
 }
 assert.equal(b.active,false);return {win:+(b.winner==="ally"),rest,block,cover,react,actions:b.allyActions};
}
const base=setups.map(s=>run(0,s,1)),result=[];
for(let v=0;v<3;v++){
 const rows=[];
 for(let l=1;l<=6;l++){
  const sum={win:0,rest:0,block:0,cover:0,react:0,actions:0,changedRest:0,changedBlock:0};
  for(let i=0;i<setups.length;i++){
   const a=run(v,setups[i],l),b=base[i];
   if(v===0||l===1)assert.deepEqual(a,b);
   for(const k of Object.keys(a))sum[k]+=a[k];
   sum.changedRest+=+(a.rest!==b.rest);sum.changedBlock+=+(a.block!==b.block);
  }
  rows.push({l,...sum});
 }
 result.push({v,rows});
}
console.log(JSON.stringify({count:setups.length,result},null,2));
