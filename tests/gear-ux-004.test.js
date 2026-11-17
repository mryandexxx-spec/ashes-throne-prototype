"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const ui=read("gear-ux-004.js");
const fakeMission={get:id=>({title:"Миссия "+id})};
const GearUX004=vm.runInNewContext(ui+"\nGearUX004",{MissionData:fakeMission});

test("GEAR-UX-004 source labels distinguish unknown, locked, free, manual and 3-star repeat",()=>{
 assert.equal(GearUX004.sourceStatus({access:"unknown"}),"Доступность не определена");
 assert.match(GearUX004.sourceStatus({access:"locked",missingPrerequisites:["m1"]}),/Миссия m1/);
 assert.match(GearUX004.sourceStatus({access:"first-clear"}),/бесплатно/);
 assert.match(GearUX004.sourceStatus({access:"repeat",bestStars:1,energyCost:10}),/1★ · 10 ⚡/);
 assert.match(GearUX004.sourceStatus({access:"repeat",bestStars:3,energyCost:10}),/3★ · 10 ⚡/);
 assert.equal(GearUX004.hasReturnContext(),false);
 assert.equal(GearUX004.rememberMission("m1"),false,"Cannot farm without selected hero/slot");
});

test("GEAR-UX-004 keeps active gear panels outside the existing 3D stage",()=>{
 const html=read("index.html"),css=read("gear-ux-004.css");
 for(const id of ["gearUxLeft","gearUxRight","gearFocusToggle","gearSlots","renCard3DCanvas"]){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.ok(html.indexOf('id="gearUxLeft"')<html.indexOf('id="detailHeroStage"'));
 assert.ok(html.indexOf('id="gearUxRight"')>html.indexOf('id="detailHeroStage"'));
 assert.match(css,/overflow-y:auto/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/max-height:430px/);
 const version=JSON.parse(read("package.json")).version;
 const escaped=version.replace(/\./g,"\\.");
 for(const file of ["gear-source-data","gear-planning-core","gear-ux-004"])
  assert.match(html,new RegExp(file+"\\.js\\?v="+escaped));
 assert.match(html,new RegExp('id="buildVersion"[^>]*>Прототип · v'+escaped+' · [A-Z0-9]+'));
});

test("GEAR-UX-004 preserves existing transactions and original campaign reward code",()=>{
 const game=read("game.js");
 assert.match(game,/GearUX004\.openSlot\(\)/);
 assert.match(game,/GearUX004\.returnToHero\(\)/);
 assert.match(game,/GearUX004\.render\(\{/);
 assert.match(game,/ProgressCore\.equipItem\(progress,selectedHeroId,item\.id\)/);
 assert.match(game,/ProgressCore\.simulate\(progress,simulationMissionId/);
 assert.match(ui,/get\("gearEquipNext"\)\?\.click\(\)/);
 assert.match(ui,/GearPlanningCore\.plan\(/);
 assert.match(ui,/GearPlanningCore\.findSources\(/);
 assert.doesNotMatch(ui,/localStorage|grantRepeatFarm|ProgressCore\.simulate\(/);
});
