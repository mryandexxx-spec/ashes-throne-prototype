"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("styles.css"),html=read("index.html"),game=read("game.js");
const start=css.indexOf("/* UI-STORY-001"),art=css.slice(start);
test("UI-STORY-001 keeps the literary HQ scene scoped to noncanonical story",()=>{
 assert.ok(start>0);
 assert.match(art,/body:has\(#storyDemo\.active\)::before/);
 assert.match(art,/url\("assets\/hq-hall-painting-mobile\.webp"\)/);
 assert.match(art,/#storyDemo\.story-demo-screen\.active/);
 assert.match(art,/#storyDemo #storyDemoText/);
 assert.match(art,/white-space:pre-line/);
 assert.match(art,/#storyDemo \.story-demo-disclaimer/);
 assert.match(html,/\[ПРЕДЛОЖЕНИЕ\] · ПРОБА ПЕРА/);
 assert.match(html,/Неподтверждённая хронология/);
 assert.doesNotMatch(art,/#battle\s|#campaign\s|#squad\s/);
});
test("UI-STORY-001 preserves dialogue choice, battle trial and restart contracts",()=>{
 for(const id of ["storyDemo","storyDemoSpeaker","storyDemoText","storyDemoNext","storyDemoChoices",
                  "storyDemoChoiceA","storyDemoChoiceB","storyDemoFight","storyDemoTrialFight",
                  "storyDemoAgain","storyDemoBack","storyDemoNotice"])
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 assert.match(game,/StoryDemoCore\.view\(storyDemoState\)/);
 assert.match(game,/StoryDemoCore\.next\(storyDemoState\)/);
 assert.match(game,/StoryDemoCore\.chooseTone\(storyDemoState,/);
 assert.match(game,/StoryDemoCore\.chooseEvidence\(storyDemoState,/);
 assert.match(game,/StoryDemoCore\.startBattle\(storyDemoState\)/);
 assert.match(game,/openSquad\("storyDemo"\)/);
 assert.match(game,/showScreen\("campaign"\)/);
 assert.match(game,/addEventListener\("click",beginStoryDemo\)/);
 assert.match(art,/#storyDemo \.story-demo-choices\[hidden\]/);
});
test("UI-STORY-001 keeps native biography top-layer, content and close controls",()=>{
 for(const id of ["heroBiographyDialog","heroBiographyTitle","heroBiographyTags","heroBiographyText","heroBiographyNote","heroBiographyPortrait","heroBiographyClose","storyRenBiography","detailBiography"])
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 assert.match(game,/function showHeroBiography\(hero\)/);
 assert.match(game,/dialog\.showModal\(\)/);
 assert.match(game,/dialog\.close\(\)/);
 assert.match(game,/HeroProfileData\.get\(hero\.id\)/);
 assert.match(art,/#heroBiographyDialog\.hero-biography-dialog/);
 assert.match(art,/#heroBiographyDialog::backdrop/);
 assert.match(art,/overflow-y:auto;overflow-x:hidden/);
 assert.match(art,/safe-area-inset-top/);
 assert.match(art,/#heroBiographyDialog \.hero-biography-close:focus-visible/);
});
test("UI-STORY-001 has short landscape, reduced motion, touch and exact build",()=>{
 assert.match(art,/@media\(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(art,/padding-inline:max\(12px,env\(safe-area-inset-left\)\)/);
 assert.match(art,/min-height:44px/);
 assert.match(art,/#storyDemo button:focus-visible/);
 assert.match(art,/@media\(prefers-reduced-motion:reduce\)/);
 assert.equal(JSON.parse(read("package.json")).version,"0.3.105");
 assert.match(html,/v0\.3\.105 · UIHUD001/);
});
