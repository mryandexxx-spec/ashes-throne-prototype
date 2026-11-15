"use strict";
/* LOREARTSAVA001: narrative portraits and per-episode hero requirements.
   All trial encounters remain noncanonical gameplay adaptations. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const Data=require("../lore-campaign-data.js");
const Scenes=require("../lore-campaign-scenes.js");
const Trials=require("../lore-campaign-trials.js");
const Act2=require("../lore-campaign-act2.js");

test("LOREARTSAVA001: Sava participates in FS-04 and Art in FS-06 only",()=>{
 const graph=Trials.data.catalog();
 assert.equal(Data.catalogIsValid(graph),true);
 assert.equal(Scenes.valid(Trials.pack,graph),true);
 const expected={
  "fs-01":[], "fs-02":[], "fs-03":[],
  "fs-04":["sava"],"fs-05":[],"fs-06":["art"]
 };
 for(const [node,extra] of Object.entries(expected)){
  const entry=Trials.encounter("five-shadows:"+node);
  assert.ok(entry,node);
  assert.deepEqual(entry.requiredHeroIds||[],extra,node);
  assert.ok(2+extra.length<=5,"No over-constrained story squad");
 }
 assert.equal(Trials.pack,Act2.pack,"No source dialogue or reward rewrite");
});

test("LOREARTSAVA001: normal squad is the template; mandatory heroes fit five slots",()=>{
 const game=read("game.js");
 const begin=game.indexOf("const LORE_REQUIRED_HERO_IDS=");
 const end=game.indexOf("function setSquadSlots(",begin);
 assert.ok(begin>=0&&end>begin,"Real lore squad helper exists");
 // Evaluate the exact shipped squad insertion logic, without DOM or gameplay side effects.
 const factory=vm.runInNewContext(
  '(function(trials,context){const LoreCampaignTrials=trials;'+
  'const loreRequiredContext=context;const MAX_SQUAD=5;'+
  'let squadReturnScreen="loreRequired";'+game.slice(begin,end)+
  'return {requiredLoreHeroIds,prepareLoreRequiredSlots};})'
 );
 const ordinary=["kael","lyra","darin","medic-demo","test-area-damage"];
 const original=ordinary.slice();
 const expectedExtras={"fs-01":[], "fs-02":[], "fs-03":[],
  "fs-04":["sava"],"fs-05":[],"fs-06":["art"]};
 for(const [name,extra] of Object.entries(expectedExtras)){
  const logic=factory(Trials,{nodeId:"five-shadows:"+name});
  const mandatory=Array.from(logic.requiredLoreHeroIds());
  assert.deepEqual(mandatory,["ren","nada",...extra],name);
  const slots=Array.from(logic.prepareLoreRequiredSlots(ordinary));
  assert.equal(slots.length,5,name);
  assert.equal(new Set(slots).size,5,name);
  assert.equal(slots[0],"kael","Preserve player leader whenever possible");
  for(const id of mandatory)assert.ok(slots.includes(id),name+" "+id);
  assert.deepEqual(ordinary,original,"Original saved formation is untouched");
 }
 assert.match(game,/requiredLoreHeroIds\(\)\.every\(id=>ids\.includes\(id\)&&heroOwned\(id\)\)/);
 assert.match(game,/if\(isLoreRequiredSquad\(\)&&requiredLoreHeroIds\(\)\.includes\(id\)\)return false/);
 assert.match(game,/slots\.map\(id=>requiredLoreHeroIds\(\)\.includes\(id\)\?id:null\)/);
 assert.match(game,/mandatoryIds\.length===2\?/,"Existing two-hero intro remains compatible");
});

test("LOREARTSAVA001: approved image paths are present in both story and battle dialogue",()=>{
 const ui=read("lore-campaign-ui.js");
 for(const [name,file] of [["Сава","sava"],["Арт","art"]]){
  assert.ok(ui.includes('"'+name+'":"assets/'+file+'-portrait-ui.webp?v=2"'));
 }
 assert.match(ui,/const portrait=portraitFor\(current\.speakerId\)/,"Scene portrait");
 assert.match(ui,/const portrait=portraitFor\(line\.speakerId\)/,"Pre-battle voice portrait");
 const act=Act2.pack.scenes.find(s=>s.nodeId==="five-shadows:fs-06");
 assert.ok(act);
 const sava=act.beats.find(b=>b.id==="fs06-sava");
 const art=act.beats.find(b=>b.id==="fs06-art");
 assert.ok(sava&&art);
 assert.equal(sava.speakerId,"Сава");
 assert.equal(sava.nextBeatId,"fs06-art");
 assert.equal(art.speakerId,"Арт");
 assert.equal(art.text,"— А как узнаем, что её увидели?");
 assert.equal(art.nextBeatId,"fs06-compare");
 const fs04=Act2.pack.scenes.find(s=>s.nodeId==="five-shadows:fs-04");
 assert.ok(fs04.beats.some(b=>b.speakerId==="Сава"));
 const g=Trials.data.catalog();
 assert.ok(g.nodes.every(n=>n.rewardPoolId===null&&n.energyCostId===null));
});

test("LOREARTSAVA001: new web build version and safe caching contract",()=>{
 const html=read("index.html"),pack=JSON.parse(read("package.json"));
 assert.match(pack.version,/^\d+\.\d+\.\d+$/);
 assert.ok(html.includes("v"+pack.version+" · "));
 for(const f of ["game.js","lore-campaign-ui.js","lore-campaign-act2.js","lore-campaign-trials.js"]){
  assert.ok(html.includes(f+"?v="+pack.version),f);
 }
});
