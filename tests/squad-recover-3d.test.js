"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("RECOVER3D: squads remain hidden offscreen and preserve original data controls",()=>{
 const css=read("styles.css"),html=read("index.html"),game=read("game.js");
 assert.ok(!css.includes("#squad.squad-screen{\n display:flex"),"inactive squad must not be forcibly visible");
 assert.match(css,/#squad\.squad-screen\.active\{\s*display:flex/);
 for(const id of ["squadRoster","squadSlots","squadHint","squadWarning","squadStart","squadDisband","squadCount","squadTacticalBrief","squad3dStatus"])
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.match(game,/function toggleSquadHero\(id\)/);
 assert.match(game,/id!=="squad"&&typeof SquadStage3D!=="undefined"\)SquadStage3D\.dispose\(\)/);
 assert.match(game,/function disbandSquad\(\)/);
 assert.match(game,/data-model-id/);
 assert.match(game,/squad-slot-content/);
 assert.ok(!game.includes("function squadPower("),"unapproved power formula must not enter production");
});
test("RECOVER3D: uses existing real GLBs, one Babylon renderer and cleans up on exit",()=>{
 const js=read("squad-stage-3d.js"),html=read("index.html");
 for(const x of ["ImportMeshAsync","ensureLoader","engine.stopRenderLoop","scene?.dispose()","engine.dispose()","ResizeObserver","visibilitychange","42","squad-model-live"])assert.ok(js.includes(x),x);
 assert.match(html,/squad-stage-3d\.js\?v=0\.3\.220" type="text\/progress-gated"/);
 assert.ok(html.indexOf('game.js?v=0.3.220" type="text/progress-gated"')<html.indexOf('squad-stage-3d.js?v=0.3.220'));
 for(const asset of ["assets/ren-meshy-mixamo-animated.glb","dev/assets/models/nada-mobile-animated.glb","dev/assets/models/liora-mobile-animated.glb","dev/assets/models/art-mobile-animated.glb","dev/assets/models/sava-mobile-animated.glb"])
  assert.ok(fs.existsSync(path.join(__dirname,"..",asset)),asset);
});
test("RECOVER3D: network board and brief retained with no reward/save changes",()=>{
 const html=read("index.html"),net=read("network-pilot-ui.js"),nav=read("network-navigation.js");
 for(const id of ["network","net004Board","net004Active","netuxStartSelected","net004Choices","netuxBriefIntel","netuxThreatShortcut","net004History","net007Collect"])
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.ok(nav.includes("netuxThreatShortcut"));
 assert.ok(net.includes("renderReward("));
 assert.ok(net.includes("session.collect("));
});
