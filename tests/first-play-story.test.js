"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Story=require("../first-play-story-core.js");
const First=require("../first-play-core.js");
function storage(){
 const map=new Map();
 return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),
  removeItem:k=>map.delete(k),keys:()=>Array.from(map.keys())};
}
test("skip goes directly to neutral real battle, not a mandatory order",()=>{
 const state=First.fresh();assert.equal(Story.skipNarration(state.phase,state.choice,Story.fresh()).action,"battle");
 assert.equal(First.start(state),null);assert.equal(First.start(First.prepare(state)).phase,"battle");
 assert.equal(Story.skipNarration("ready","neutral",Story.fresh()).action,"battle");
});
test("both orders lead to distinct responses and real combat state",()=>{
 for(const choice of ["survey","cover"]){
  const selected=First.choose(First.fresh(),choice);
  const cursor=Story.normalize(Story.fresh(),selected.phase);
  assert.equal(cursor.step,Story.INTRO.length);
  assert.equal(Story.frame(selected.phase,choice,cursor).speaker,choice==="survey"?"АРТ":"РЕН");
  assert.equal(Story.skipNarration(selected.phase,choice,cursor).action,"battle");
  assert.equal(First.start(selected).phase,"battle");
 }
});
test("scene resumes after reload, retry never invents a victory",()=>{
 const st=storage();
 const cursor={version:2,part:"intro",step:2};
 assert.equal(Story.save(cursor,()=>st),true);
 assert.deepEqual(Story.load(()=>st,"briefing"),cursor);
 assert.equal(Story.load(()=>st,"ready").step,Story.INTRO.length);
 assert.equal(Story.load(()=>st,"won").part,"outro");
 const persisted=Story.save({version:1,part:"outro",step:1},()=>st);
 assert.equal(persisted,true);
 assert.equal(Story.load(()=>st,"won").step,1);
 assert.equal(Story.frame("won","cover",Story.load(()=>st,"won")).speaker,"МАСТЕР");
});
test("two distinct win frames; skip goes to HQ completion, not to battle",()=>{
 const initial=Story.normalize(null,"won");
 assert.equal(Story.frame("won","survey",initial).speaker,"АРТ");
 const next=Story.advance("won",initial);
 assert.equal(next.step,1);
 assert.equal(Story.advance("won",next),null);
 assert.equal(Story.skipNarration("won","survey",next).action,"finish");
});
test("bad cursor/denied storage falls back without changing FirstPlayCore progress",()=>{
 const st=storage();
 st.setItem(Story.KEY,'{"version":1,"part":"intro","step":200}');
 assert.equal(Story.load(()=>st,"briefing").step,0);
 assert.equal(Story.save({version:1,part:"intro",step:999},()=>st),false);
 assert.deepEqual(Story.load(()=>{throw Error("unavailable")},"briefing"),Story.fresh());
 assert.equal(First.fresh().phase,"briefing");
});
test("speaker portraits are the exact Ren/Art game assets",()=>{
 assert.equal(Story.CAST.ren.portrait,"assets/ren-portrait-ui.webp");
 assert.equal(Story.CAST.art.portrait,"assets/art-portrait-ui.webp?v=2");
 assert.equal(Story.CAST.worker.portrait,"assets/cutscenes/first-report/v5/worker-portrait.webp");
 assert.equal(Story.CAST.master.portrait,"assets/cutscenes/first-report/v5/master-portrait.webp");
 assert.equal(Story.CAST.worker.npc,true);
 assert.equal(Story.CAST.master.npc,true);
 assert.deepEqual(Story.INTRO.map(x=>x.speakerId),["worker","master","art","ren"]);
 assert.equal(Story.RESPONSE.survey.speakerId,"art");
 assert.equal(Story.RESPONSE.cover.speakerId,"ren");
 assert.deepEqual(Story.OUTRO.map(x=>x.speakerId),["art","master"]);
 assert.deepEqual(Story.INTRO.map(x=>x.shot),["wide","workers","supports","route"]);
 assert.equal(Story.RESPONSE.survey.shot,"supports");
 assert.equal(Story.RESPONSE.cover.shot,"route");
 assert.deepEqual(Story.OUTRO.map(x=>x.shot),["supports","wide"]);
 for(const beat of [...Story.INTRO,...Object.values(Story.RESPONSE),...Story.OUTRO])
  assert.ok(Story.CAST[beat.speakerId]?.label);
});

test("every first-play beat has a separate character-led illustration",()=>{
 const paths=["warning","conflict","artSupport","renRoute","decision"];
 assert.equal(new Set(paths.map(k=>Story.ART[k])).size,5);
 for(const key of paths){
  assert.match(Story.ART[key],/^assets\/cutscenes\/first-report\/v5\/[^/]+\.webp$/);
  assert.equal(Story.AVIF[key],null);
  assert.ok(Story.STORYBOARD[key]?.purpose);
 }
 assert.deepEqual(Story.INTRO.map(x=>x.art),
  ["warning","conflict","artSupport","renRoute"]);
 assert.equal(Story.INTRO.at(-1).choice,undefined);
 assert.equal(Story.RESPONSE.survey.art,"artSupport");
 assert.equal(Story.RESPONSE.cover.art,"renRoute");
 assert.equal(Story.OUTRO[1].art,"aftermath");
 for(const key of ["worker","master"]){
  assert.match(Story.CAST[key].portrait,/^assets\/cutscenes\/first-report\/v5\/.*-portrait\.webp$/);
  assert.equal(Story.CAST[key].portraitAvif,null);
 }
 const fs=require("node:fs"),path=require("node:path");
 for(const file of [...paths.map(k=>Story.ART[k]),Story.CAST.worker.portrait,Story.CAST.master.portrait]){
  assert.ok(fs.existsSync(path.join(__dirname,"..",file)),"required scene asset missing: "+file);
 }
});
test("order preview matches the exact two battle bonuses",()=>{
 assert.equal(First.EFFECTS.survey.stat,"speed");
 assert.equal(First.EFFECTS.survey.bonus,30);
 assert.equal(First.EFFECTS.cover.stat,"protection");
 assert.equal(First.EFFECTS.cover.bonus,35);
 assert.match(Story.ORDER_LABELS.survey,/Арт.*скорость.*30/);
 assert.match(Story.ORDER_LABELS.cover,/Рен.*защиты.*35/);
 assert.equal(Story.RESPONSE.survey.effect,"survey");
 assert.equal(Story.RESPONSE.cover.effect,"cover");
 assert.match(Story.RESPONSE.cover.detail,/Protection/);
 const html=require("node:fs").readFileSync(require("node:path").join(__dirname,"..","index.html"),"utf8");
 for(const id of ["firstPlayStoryOrderSignal","firstPlayStorySurvey","firstPlayStoryCover","firstPlayStoryPortraitSource"])
  assert.ok(html.includes(id));
 assert.ok(!html.includes("fp-stage-crew"),"inconsistent cartoon cutouts removed");
});
test("both orders cause distinct local debriefs, while the final clue converges",()=>{
 const start=Story.normalize(null,"won"),survey=Story.frame("won","survey",start),cover=Story.frame("won","cover",start);
 assert.equal(survey.speakerId,"art");
 assert.equal(cover.speakerId,"ren");
 assert.notEqual(survey.text,cover.text);
 const last=Story.advance("won",start);
 assert.deepEqual(Story.frame("won","survey",last),Story.frame("won","cover",last));
 assert.equal(Story.skipNarration("won","survey",last).action,"finish");
});

test("P0-B four readable beats show incident, obstruction and actionable objective",()=>{
 const lines=Story.INTRO.map(x=>x.text);
 assert.equal(lines.length,4);
 assert.match(lines[0],/доски/i);assert.match(lines[1],/осмотр/i);
 assert.match(Story.INTRO[1].cue,/охранник/i);assert.match(lines[2],/штифт/i);
 assert.match(lines[3],/ступени/i);assert.match(Story.INTRO.at(-1).detail,/командуете.*Прикройте/);
 assert.equal(Story.INTRO.slice(0,-1).reduce((n,x)=>n+x.duration,0),15500);
 assert.equal(Story.INTRO.at(-1).duration,undefined);
 assert.ok(Story.OUTRO[1].cue);
 assert.deepEqual(Story.OUTRO[1].document,["Переход безопасен","Крепления снять"]);
 assert.doesNotMatch(Story.OUTRO[1].text,/безопасен|снять крепления/);
});
test("old narration cursors migrate to four shots, ready and victory remain intact",()=>{
 for(let i=0;i<=8;i++){const old={version:1,part:"intro",step:i};
  const now=Story.normalize(old,"briefing");assert.equal(now.version,2);assert.ok(now.step>=0&&now.step<4);
 }
 assert.equal(Story.normalize({version:1,part:"intro",step:7},"ready").step,4);
 assert.equal(Story.normalize({version:1,part:"outro",step:1},"won").step,1);
 assert.equal(Story.frame("ready","neutral",Story.fresh()).speakerId,"ren");
});
