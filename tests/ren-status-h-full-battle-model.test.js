"use strict";
// REN-STATUS-H: paired full-turn CombatCore simulations. No gameplay changes.
// Experimental candidate is injected into an isolated VM, never persisted.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const files=["initiative-model.js","combat-status-core.js","ability-data.js","battle-rng.js",
 "combat-core.js","story-trial-data.js","auto-decision.js","enemy-decision.js"];
const source=files.map(read).join("\n").replace("const AbilityData=(()=>","let AbilityData=(()=>");
function engine(candidate){
 const patch=candidate?[
  "const oldAbilityData=AbilityData;",
  "AbilityData={...oldAbilityData,get:(actor,id)=>{",
  " const a=oldAbilityData.get(actor,id);",
  " if(actor?.id!=='trial-ren'||!a)return a;",
  " if(id==='passive')return {...a,combatRules:{...a.combatRules,statusPotencyWithoutResistanceDown:5}};",
  " if(id==='powerful')return {...a,followUpStatusAll:{...a.followUpStatusAll,amount:25}};",
  " return a;",
  "}};"
 ].join("\n"):"";
 return vm.runInNewContext(source+"\n"+patch+
  "\n({CombatCore,StoryTrialData,AutoDecision,CombatStatusCore,AbilityData})");
}
const variants=[["A-current",engine(false)],["D-candidate",engine(true)]];
const scenarios=[
 {id:"medium",hp:[130,130],atk:[15,15],speed:[115,125]},
 {id:"hard",hp:[190,210],atk:[22,24],speed:[125,138]}
];
const strategies=["setup-first","damage-first","actual-auto"];
const seeds=64;
const expectedBattles=variants.length*scenarios.length*strategies.length*seeds;
function play(api,scenario,strategy,seed){
 const core=api.CombatCore;
 const party=api.StoryTrialData.heroes().map(h=>({...h}));
 const enemies=[0,1].map((i)=>({
  id:"model-enemy-"+i,name:"Тренировочный противник "+(i+1),side:"enemy",
  role:"Противник в эксперименте",hp:scenario.hp[i],atk:scenario.atk[i],
  speed:scenario.speed[i],debuffResistance:i===0?90:50,debuffPotency:0
 }));
 const battle=core.createBattle([...party,...enemies],[],{
  rngSeed:seed,statusChecks:true,legacyStatusChecks:true});
 core.advanceToPlayerTurn(battle);
 let actions=0,renDamage=0,success=0,resisted=0;
 const countedIds=new Set();
 for(let step=0;battle.active&&step<120;step++){
  const actor=battle.fighters[battle.currentActor];
  assert.ok(actor&&actor.side==="ally","battle advances to allied turn");
  let plan=null;
  if(strategy==="actual-auto")plan=api.AutoDecision.chooseAction(battle);
  else {
   const living=battle.fighters.map((f,i)=>({f,i})).filter(x=>x.f.side==="enemy"&&x.f.hp>0)
    .sort((a,b)=>a.f.hp-b.f.hp||a.i-b.i);
   if(!living.length)break;
   let abilityId="basic";
   if(actor.id==="trial-ren"){
    if(strategy==="setup-first"){
     if(core.abilityReady(battle,"powerful")&&living.length>1)abilityId="powerful";
     else if(core.abilityReady(battle,"special"))abilityId="special";
    }else if(strategy==="damage-first"){
     if(core.abilityReady(battle,"powerful"))abilityId="powerful";
    }
   }else if(core.abilityReady(battle,"special")&&
      (actor.id==="trial-nada"||actor.id==="trial-liora"))
     abilityId="special";
   const mode=core.abilityTargetSide(battle,abilityId);
   const index=mode==="ally"?battle.fighters.findIndex(f=>f.side==="ally"&&f.hp>0):
    mode==="self"||mode==="all-allies"?battle.currentActor:living[0].i;
   plan={abilityId,targetIndex:index};
  }
  if(!plan||!core.performAutoAction(battle,plan))throw Error("rejected action in "+strategy);
  actions++;
  // Ally event batches may include automated enemy responses; filter by actor.
  for(const e of battle.events){
   if(e.actorId!=="trial-ren"||e.type!=="damage")continue;
   // Each event is present once within the current command batch.
   const key=actions+"-"+e.targetId+"-"+e.amount;
   if(!countedIds.has(key)){countedIds.add(key);renDamage+=e.amount;}
  }
  for(const e of battle.events){
   if(e.type==="effect"&&["weaken","slowed","debuff-resistance-down"].includes(e.effect))success++;
   if(e.type==="status-resisted")resisted++;
  }
 }
 const livingAllies=battle.fighters.filter(f=>f.side==="ally"&&f.hp>0);
 const totalHP=livingAllies.reduce((a,f)=>a+f.hp,0);
 return {win:battle.winner==="ally",resolved:!battle.active,actions,
  turn:battle.turn,renDamage,success,resisted,totalHP,
  alive:livingAllies.length,draws:battle.rng.draws};
}
const summaries=[];
const paired=[];
for(const scenario of scenarios){
 for(const strategy of strategies){
  const summariesHere=[];
  for(const [name,api]of variants){
   const rows=[];
   for(let i=0;i<seeds;i++){
    const seed=Math.imul(i+1,0x9e3779b1)>>>0;
    const row=play(api,scenario,strategy,seed);
    // A stalled fight should be reported, not silently counted as a loss.
    assert.equal(row.resolved,true,"full fight must resolve within 120 allied actions");
    rows.push(row);
   }
   const mean=field=>+(rows.reduce((sum,r)=>sum+r[field],0)/rows.length).toFixed(2);
   const summary={scenario:scenario.id,strategy,variant:name,
    wins:rows.filter(r=>r.win).length,
    actions:mean("actions"),renDamage:mean("renDamage"),
    statusSuccess:mean("success"),statusResisted:mean("resisted"),
    survivorHP:mean("totalHP"),rngDraws:mean("draws")};
   summaries.push(summary);
   summariesHere.push({rows,summary});
  }
  const [a,d]=summariesHere;
  paired.push({scenario:scenario.id,strategy,
   onlyA:a.rows.filter((r,i)=>r.win&&!d.rows[i].win).length,
   onlyD:d.rows.filter((r,i)=>r.win&&!a.rows[i].win).length,
   bothWin:a.rows.filter((r,i)=>r.win&&d.rows[i].win).length,
   bothLose:a.rows.filter((r,i)=>!r.win&&!d.rows[i].win).length});
 }
}
assert.equal(summaries.length,12);
assert.equal(summaries.every(r=>r.wins>=0&&r.wins<=seeds),true);
assert.equal(paired.every(r=>r.onlyA+r.onlyD+r.bothWin+r.bothLose===seeds),true);
// Sanity: changed powerful/passive numbers only in the candidate VM.
const aRen=variants[0][1].StoryTrialData.heroes()[0];
const dRen=variants[1][1].StoryTrialData.heroes()[0];
assert.equal(variants[0][1].AbilityData.get(aRen,"passive").combatRules.statusPotencyWithoutResistanceDown,10);
assert.equal(variants[1][1].AbilityData.get(dRen,"passive").combatRules.statusPotencyWithoutResistanceDown,5);
assert.equal(variants[0][1].AbilityData.get(aRen,"powerful").followUpStatusAll.amount,15);
assert.equal(variants[1][1].AbilityData.get(dRen,"powerful").followUpStatusAll.amount,25);
assert.equal(read("ability-data.js").includes("statusPotencyWithoutResistanceDown:10"),true);
assert.equal(JSON.parse(read("package.json")).version,"0.3.88");
console.log("REN-STATUS-H: "+expectedBattles+" complete seeded full-team battles; 64 seeds per scenario × strategy × variant");
console.log("scenario strategy variant wins/64 actions ren-dmg effects resisted survivor-hp draws");
for(const r of summaries)console.log([r.scenario,r.strategy,r.variant,
 r.wins,r.actions,r.renDamage,r.statusSuccess,r.statusResisted,r.survivorHP,r.rngDraws].join(" "));
console.log("PAIRED outcomes by seed: scenario strategy A-only D-only both-win both-lose");
for(const r of paired)console.log([r.scenario,r.strategy,r.onlyA,r.onlyD,r.bothWin,r.bothLose].join(" "));
console.log("REN-STATUS-H: research only; outcomes depend on synthetic enemy stats and action policies");
