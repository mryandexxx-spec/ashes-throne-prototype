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

test("HQ-UI-007 local material lighting is anchored to the painted scene",()=>{
 const home=html.slice(html.indexOf('<section id="home"'),html.indexOf('<section id="dailyTasks"'));
 assert.match(home,/class="hq-selection-fx"/);
 assert.match(home,/viewBox="0 0 2048 688" preserveAspectRatio="xMidYMid slice"/);
 assert.doesNotMatch(home,/hq-light-reveal|hq-contour-overlay/);
 assert.doesNotMatch(css,/@keyframes hq-light-reveal|@keyframes hq-contour-trace|stroke-dasharray:100/);
 for(const zone of ["heroes","campaign","operations","challenges"]){
  assert.match(home,new RegExp('class="hq-fx-zone hq-fx-'+zone+'"'));
  assert.ok(css.includes('data-hq-illuminated="'+zone+'"'),"active zone: "+zone);
 }
 assert.match(home,/id="hq-fx-paper-clip"/);
 assert.match(home,/id="hq-fx-board-clip"/);
 assert.match(css,/background-position:center center,center center,center center/);
 assert.match(css,/@keyframes hq-material-light/);
 assert.match(css,/@keyframes hq-specular-flicker/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(game,/function animateHQSelectionFx\(button\)/);
 assert.match(game,/scene\.dataset\.hqIlluminated=zone/);
 assert.match(game,/hqFxTimer=setTimeout/);
 assert.match(game,/\},500\);/);
});

test("HQ-UI-008 shoulders and swords use short art-matched accents, not fake silhouette bars",()=>{
 const home=html.slice(html.indexOf('<section id="home"'),html.indexOf('<section id="dailyTasks"'));
 const heroes=home.slice(home.indexOf('class="hq-fx-zone hq-fx-heroes"'),home.indexOf('class="hq-fx-zone hq-fx-campaign"'));
 const weapons=home.slice(home.indexOf('class="hq-fx-zone hq-fx-challenges"'),home.indexOf('</g>',home.indexOf('class="hq-fx-zone hq-fx-challenges"')));
 assert.equal((heroes.match(/class="hq-fx-pinpoint"/g)||[]).length,2);
 assert.equal((weapons.match(/class="hq-fx-pinpoint"/g)||[]).length,3);
 assert.doesNotMatch(heroes,/M291 263 Q328 241 375 288|M138 243 Q168 227 190 248/);
 assert.doesNotMatch(weapons,/M1835 159 L1836 284|M1878 146 L1879 277/);
 assert.match(weapons,/M1837 163 L1834 188/);
 assert.match(weapons,/M1873 189 L1869 218/);
 assert.match(weapons,/M1905 163 L1901 187/);
 assert.match(css,/@keyframes hq-pinpoint-bloom/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
