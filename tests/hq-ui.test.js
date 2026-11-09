const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const html=fs.readFileSync("index.html","utf8"),css=fs.readFileSync("styles.css","utf8"),game=fs.readFileSync("game.js","utf8"),svg=fs.readFileSync("assets/hq-hall.svg","utf8");
test("HQ menu keeps real entry points and native horizontal scroll",()=>{
 for(const s of ["collection","campaign","operations","challenges","playerProfile","dailyTasks","loginCalendar"])
  assert.ok(html.includes('data-screen="'+s+'"'),s);
 for(const s of ["hqPan","dailyTasksNav","dailyClaimBadge","startBattle","devResourcesGrant","hqMoreToggle","hqMoreMenu"])
  assert.ok(html.includes('id="'+s+'"'),s);
 assert.match(css,/\.hq-pan\{[^}]*scroll-snap-type:x proximity/);
 assert.match(css,/touch-action:pan-x/);
 assert.match(css,/scroll-snap-align:center/);
 assert.match(css,/safe-area-inset-left/);
});
test("HQ uses game state and does not duplicate IDs",()=>{
 assert.match(game,/function renderHeadquarters\(\)/);
 assert.doesNotMatch(game,/ops\?"50%"/,"operation must not invent 50% progress");
 for(const s of ["selectedPartyIds","campaignProgress","challengeProgress","operationProgress","signalProgress","progress.energy.value","playerNickname"])
  assert.ok(game.includes(s),s);
 const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);
 assert.equal(ids.length,new Set(ids).size);
});
test("HQ image is small, self-contained, and not a new 3D scene",()=>{
 assert.ok(svg.includes('viewBox="0 0 3400 700"'));
 assert.ok(svg.length<100000);
 assert.doesNotMatch(svg,/<script|foreignObject|iframe/i);
 const home=html.split('id="home"')[1].split('id="dailyTasks"')[0];
 assert.doesNotMatch(home,/hero-banner|home-cards|САГА О РАСКОЛОТОЙ ИМПЕРИИ|canvas|babylon/i);
});

test("HQ-UI-004 painted landmarks are full clickable buttons with readable captions",()=>{
 const home=html.slice(html.indexOf('<section id="home"'),html.indexOf('<section id="dailyTasks"'));
 for(const [zone,target] of [["heroes","collection"],["campaign","campaign"],["operations","operations"],["challenges","challenges"]]){
  const match=home.match(new RegExp('<button[^>]*class="hq-station hq-station-'+zone+'"[^>]*data-screen="'+target+'"'));
  assert.ok(match,zone+" direct navigation");
 }
 assert.equal((home.match(/class="hq-station-caption"/g)||[]).length,4);
 assert.match(css,/HQ-UI-004: hotspots belong to painted objects/);
 assert.match(css,/#home \.hq-scene \.hq-station\{[^}]*touch-action:pan-x/);
 for(const id of ["hqSquadStatus","hqCampaignStatus","hqCampaignFill","hqCampaignStars","hqOperationStatus","hqOperationFlag","hqOperationText","hqChallengeStatus","hqChallengeFill"]){
  assert.ok(home.includes('id="'+id+'"'),id+" state hook");
 }
});

test("HQ-UI-005 SVG contours trace four painted objects and defer hotspot navigation",()=>{
 const home=html.slice(html.indexOf('<section id="home"'),html.indexOf('<section id="dailyTasks"'));
 assert.match(home,/class="hq-contour-overlay"/);
 for(const name of ["heroes","campaign","operations","challenges"]){
  assert.match(home,new RegExp('class="hq-contour hq-contour-'+name+'"'));
 }
 assert.match(css,/@keyframes hq-contour-trace/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(game,/function animateHQContour\(button\)/);
 assert.match(game,/scene\.dataset\.hqIlluminated=zone/);
 assert.match(game,/hqContourTimer=setTimeout/);
 assert.match(game,/resetHQContour\(\)/);
 assert.ok(game.includes('b.matches?.("#home .hq-station")'));
});
