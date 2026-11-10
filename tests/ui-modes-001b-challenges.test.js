"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("styles.css"),html=read("index.html"),js=read("game.js");
const start=css.indexOf("/* UI-MODES-001B");
const art=css.slice(start);

test("UIMODES001C keeps both trial modes in the accepted HQ visual language",()=>{
 assert.ok(start>0);
 assert.match(art,/body:has\(#challenges\.active\)::before/);
 assert.match(art,/url\("assets\/hq-hall-painting-mobile\.webp"\)/);
 assert.match(art,/#app:has\(#challenges\.active\)>.topbar/);
 assert.match(art,/#challenges\.screen\.active/);
 assert.match(art,/#challenges \.challenge-mode-card/);
 assert.match(art,/#challenges #challengeList \.campaign-mission/);
 assert.doesNotMatch(art,/#campaign\s|#home\s|#playerProfile\s|#battle\s/);
});

test("UIMODES001C preserves mode switching, unlocks, squad entry and results",()=>{
 for(const id of ["challenges","challengeModes","challengeModeBack","challengeModeTitle","challengeList","challengeSaveStatus","challengeResult"])
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 for(const kind of ["tactical","onslaught"])
  assert.ok(html.includes('data-challenge-kind="'+kind+'"'),kind+" mode retained");
 assert.match(js,/function renderChallenges\(\)/);
 assert.match(js,/ChallengeCore\.byKind\(kind\)/);
 assert.match(js,/ChallengeCore\.available\(def\.id,challengeProgress\)/);
 assert.match(js,/data-start-challenge/);
 assert.match(js,/function openChallenge\(id\)/);
 assert.match(js,/openSquad\("challenges"\)/);
 assert.match(js,/function renderChallengeResult\(\)/);
 assert.match(js,/selectedChallengeKind=null;renderChallenges\(\)/);
 assert.match(art,/#challenges #challengeList \[data-start-challenge\]:disabled/);
 assert.match(art,/#challenges #challengeList\[hidden\]/);
});

test("UIMODES001C keeps non-rewarding pilot and accessibility safeguards",()=>{
 assert.match(html,/Свободные повторы, без затрат энергии и наград за сам бой/);
 assert.match(html,/УЧЕБНЫЙ PvE-ПИЛОТ · БЕЗ СЮЖЕТА/);
 assert.match(js,/Прогресс испытаний недоступен/);
 assert.match(art,/@media\(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(art,/padding-inline:max\(12px,env\(safe-area-inset-left\)\)/);
 assert.match(art,/min-height:44px/);
 assert.match(art,/#challenges button:focus-visible/);
 assert.match(art,/@media\(prefers-reduced-motion:reduce\)/);
});

test("UIMODES001C candidate build matches package and footer",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.103");
 assert.match(html,/v0\.3\.103 · UIHUD001/);
});
