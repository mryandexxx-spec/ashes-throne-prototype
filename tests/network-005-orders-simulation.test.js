"use strict";
/* NET-005: test-only directed orders, mastered simulation and material-source honesty. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Data=require("../network-data.js"),Core=require("../network-core.js");
const Pilot=require("../network-pilot-session.js");
const Reward=require("../network-reward-core.js");
const region="gardens-over-abyss",unlocked=[region];
const clone=x=>JSON.parse(JSON.stringify(x));
const config=Object.freeze({id:"net005-test-only",capacity:5,intervalMs:1000,
 guaranteeAfter:3,focusWeight:1,masteryScore:3});
const template=Object.freeze({...Data.PROPOSAL_CATALOG.templates[0],id:"test-mastered",
 levels:[1],modifierIds:[]});
const catalog=Data.buildCatalog({version:1,regions:Data.PROPOSAL_CATALOG.regions,
 templates:[template]});
function initial(){
 const first=Core.fresh(123,0,config,catalog);
 return Core.accrue(first,4000,catalog,unlocked);
}
function manual(s,quality=3){
 const c=s.board[0];
 let next=Core.start(s,c.id);
 next=Core.prepare(next,"survey");
 next=Core.approach(next,"quiet");
 // A synthetic S1 summary tests the strict state machine; real battles are
 // independently exercised via NetworkEncounterAdapter/CombatCore.
 const great=quality===3;
 const summary={version:1,wave:0,deployed:1,knockedOut:great?0:1,
  allyActions:great?1:20,paceBudget:5,objectiveEnemyId:"npc-test",
  objectiveDone:great,score:great?100:60};
 next=Core.battleOutcome(next,c.id,0,true,summary.score,summary);
 return Core.finish(next);
}
function store(){
 const values=new Map();
 const local={getItem:k=>values.has(k)?values.get(k):null,
  setItem:(k,v)=>values.set(k,v)};
 return {values,local};
}
function pilotFactory(storage){
 return Pilot.create({storageProvider:()=>storage.local,ownsLock:()=>true,
  exclusive:async cb=>cb(),now:()=>10000,seed:()=>123});
}
test("NET-005 only manual mastery at the same template AND level unlocks simulation",()=>{
 const s=initial(),c=s.board[1];
 assert.equal(Core.simulate(s,c.id,catalog,unlocked),null,"no manual mastery");
 const low=manual(s,2);
 assert.equal(Core.isMastered(low,c,"quiet"),false);
 assert.equal(Core.simulate(low,c.id,catalog,unlocked),null);
 const mastered=manual(s,3),target=mastered.board[0];
 assert.equal(Core.isMastered(mastered,target,"quiet"),true);
 assert.equal(Core.isMastered(mastered,{...target,level:target.level+1},"quiet"),false);
 const before=clone(mastered);
 const result=Core.simulate(mastered,target.id,catalog,unlocked);
 assert.ok(Core.validState(result));
 assert.equal(result.board.length,mastered.board.length-1);
 assert.equal(result.completed.length,mastered.completed.length+1);
 assert.equal(result.completed.at(-1).serial,mastered.completed.at(-1).serial+1);
 assert.equal(result.completed.at(-1).kind,"simulated");
 assert.equal(result.completed.at(-1).score,0);
 assert.equal(result.completed.at(-1).rewardRef,target.rewardRef);
 assert.equal(result.influence[region],mastered.influence[region]+1);
 assert.deepEqual(result.mastery,mastered.mastery,"simulation cannot raise mastery");
 assert.deepEqual(result.threatIntel,mastered.threatIntel,"no threat bonus");
 assert.deepEqual(mastered,before,"pure transition");
 assert.equal(Core.simulate(result,target.id,catalog,unlocked),null,"double use");
 assert.equal(Core.simulate(mastered,999,catalog,unlocked),null);
 assert.equal(Core.simulate(mastered,target.id,Data.CATALOG,unlocked),null);
 assert.equal(Core.simulate(mastered,target.id,catalog,[]),null);
 const changed=clone(catalog);changed.templates[0].revision++;
 assert.equal(Core.simulate(mastered,target.id,Data.buildCatalog(changed),unlocked),null);
 const badPreparation=clone(mastered);
 badPreparation.board.find(c=>c.id===target.id).preparationIds=["unapproved-prep"];
 assert.equal(Core.validState(badPreparation),true);
 assert.equal(Core.simulate(badPreparation,target.id,catalog,unlocked),null);
 const badModifier=clone(mastered);
 badModifier.board.find(c=>c.id===target.id).modifierId="unknown-modifier";
 assert.equal(Core.validState(badModifier),true);
 assert.equal(Core.simulate(badModifier,target.id,catalog,unlocked),null);
 const blocked=Core.start(mastered,target.id);
 assert.equal(Core.simulate(blocked,blocked.board[0].id,catalog,unlocked),null);
 const tampered=clone(result);tampered.completed.at(-1).score=4;
 assert.equal(Core.validState(tampered),false,"simulated score is never a manual grade");
});
test("NET-005 serial proof accepts only persisted manual or simulated completions",()=>{
 const saved=manual(initial());
 const target=saved.board[0],simulation=Core.simulate(saved,target.id,catalog,unlocked);
 const db=store();
 const proof=id=>Reward.prove({storage:db.local,
  sourceId:template.rewardRef,kind:"serial",occurrenceId:String(id),count:1});
 assert.equal(proof(2),false,"in-memory result cannot authorize payout");
 db.values.set(Core.KEY,JSON.stringify(simulation));
 assert.equal(proof(1),true);
 assert.equal(proof(2),true);
 const noMastery=clone(simulation);noMastery.mastery={};
 db.values.set(Core.KEY,JSON.stringify(noMastery));
 assert.equal(proof(2),false,"simulated proof also requires persisted mastery");
 db.values.set(Core.KEY,JSON.stringify(simulation));
 assert.equal(Reward.prove({storage:db.local,sourceId:"wrong-source",
  kind:"serial",occurrenceId:"2",count:1}),false);
 const corrupt=clone(simulation);corrupt.completed.at(-1).score=1;
 db.values.set(Core.KEY,JSON.stringify(corrupt));
 assert.equal(proof(2),false);
});
test("NET-005 pilot orders persist, invalid material is rejected, full board does not reroll",async()=>{
 const st=store();st.values.set(Core.KEY,"LIVE_NETWORK_SENTINEL");
 st.values.set("ashes-throne.progress.v3","WALLET_SENTINEL");
 const session=pilotFactory(st);
 assert.equal((await session.open()).ok,true);
 const before=clone(session.read());
 const orders=session.availableOrders();
 assert.ok(orders.some(o=>o.kind==="type"&&o.targetId==="trophies"));
 assert.ok(orders.some(o=>o.kind==="region"&&o.targetId===region));
 assert.equal(orders.some(o=>o.kind==="material"||o.kind==="hero"),false);
 assert.equal(session.canSimulate(before.board[0].id),false);
 assert.equal((await session.change("order",{kind:"type",targetId:"trophies"})).ok,true);
 assert.equal(session.read().order.targetId,"trophies");
 const rev=session.read().revision;
 assert.equal((await session.change("refresh")).ok,true);
 assert.equal(session.read().revision,rev,"full board never consumes order guarantee");
 assert.equal(session.read().order.misses,0);
 assert.equal((await session.change("order",{kind:"material",targetId:"Fe"})).ok,false);
 const reopened=pilotFactory(st);assert.equal((await reopened.open()).ok,true);
 assert.equal(reopened.read().order.targetId,"trophies");
 assert.equal((await reopened.change("order",null)).ok,true);
 assert.equal(reopened.read().order,null);
 assert.equal(st.values.get(Core.KEY),"LIVE_NETWORK_SENTINEL");
 assert.equal(st.values.get("ashes-throne.progress.v3"),"WALLET_SENTINEL");
});
test("NET-005 configured matching material links only: no fictitious farm sources",()=>{
 const scope={NetworkData:Data,GearData:{MATERIALS:["Fe","Le"]}};
 const Source=vm.runInNewContext(read("gear-source-data.js")+"\nGearSourceData",scope);
 assert.equal(Source.findNetworkSources("Fe",Data.CATALOG,unlocked).length,0);
 assert.equal(Source.findNetworkSources("Fe",Data.PROPOSAL_CATALOG,unlocked).length,0);
 assert.equal(Source.findNetworkSources("unknown",catalog,unlocked).length,0);
 const described=clone(catalog);described.templates[0].materialId="Fe";
 const withMaterial=Data.buildCatalog(described);
 assert.equal(Source.findNetworkSources("Fe",withMaterial,[]).length,0);
 const unknown=Source.findNetworkSources("Fe",withMaterial);
 assert.equal(unknown.length,1,"candidate is visible without invented unlock");
 assert.equal(unknown[0].access,"unknown");
 const sources=Source.findNetworkSources("Fe",withMaterial,unlocked);
 assert.equal(sources.length,1);
 assert.equal(sources[0].access,"eligible");
 assert.equal(sources[0].materialId,"Fe");
 assert.equal(sources[0].templateId,template.id);
 assert.equal(sources[0].rewardRef,template.rewardRef);
 assert.equal(Object.hasOwn(sources[0],"quantity"),false,
  "no reward quantity is invented");
});
test("NET-005 build is opt-in, versioned and no live reward/source table",()=>{
 const pkg=JSON.parse(read("package.json")),html=read("index.html");
 assert.ok(html.includes('id="buildVersion">Прототип · v'+pkg.version+' · ARENAART004D'));
 assert.ok(html.includes('id="net005OrderChoices"'));
 assert.ok(html.includes('id="net005FinderBack"'));
 assert.ok(read("network-pilot-ui.js").includes("Симуляция закрыта"));
 assert.ok(read("gear-ux-004.js").includes("Разведсеть пока не подтверждена"));
 assert.equal(Data.CATALOG.templates.length,0);
 assert.ok(Data.PROPOSAL_CATALOG.templates.every(t=>t.materialId===null));
 assert.ok(html.includes('src="network-live-economy.js?v='+pkg.version+'"'));
 assert.ok(Data.LIVE_CATALOG.templates.length>=30);
 assert.ok(!read("game.js").includes("NetworkRewardCore.claim("));
});
