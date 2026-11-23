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
test("intro narration can be skipped without skipping the mandatory order",()=>{
 const state=First.fresh();
 const result=Story.skipNarration(state.phase,state.choice,Story.fresh());
 assert.equal(result.action,"decision");
 assert.equal(result.cursor.step,4);
 assert.equal(Story.frame(state.phase,state.choice,result.cursor).choice,true);
 assert.equal(First.start(state),null);
});
test("both orders lead to distinct responses and real combat state",()=>{
 for(const choice of ["survey","cover"]){
  const selected=First.choose(First.fresh(),choice);
  const cursor=Story.normalize(Story.fresh(),selected.phase);
  assert.equal(cursor.step,5);
  assert.equal(Story.frame(selected.phase,choice,cursor).speaker,choice==="survey"?"АРТ":"РЕН");
  assert.equal(Story.skipNarration(selected.phase,choice,cursor).action,"battle");
  assert.equal(First.start(selected).phase,"battle");
 }
});
test("scene resumes after reload, retry never invents a victory",()=>{
 const st=storage();
 const cursor={version:1,part:"intro",step:2};
 assert.equal(Story.save(cursor,()=>st),true);
 assert.deepEqual(Story.load(()=>st,"briefing"),cursor);
 assert.equal(Story.load(()=>st,"ready").step,5);
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
 assert.equal(Story.CAST.worker.portrait,"assets/cutscenes/first-report/v2/warning.webp");
 assert.equal(Story.CAST.master.portrait,"assets/cutscenes/first-report/v2/decision.webp");
 assert.equal(Story.CAST.worker.npc,true);
 assert.equal(Story.CAST.master.npc,true);
 assert.deepEqual(Story.INTRO.map(x=>x.speakerId),["worker","master","art","ren","master"]);
 assert.equal(Story.RESPONSE.survey.speakerId,"art");
 assert.equal(Story.RESPONSE.cover.speakerId,"ren");
 assert.deepEqual(Story.OUTRO.map(x=>x.speakerId),["art","master"]);
 assert.deepEqual(Story.INTRO.map(x=>x.shot),["workers","workers","supports","route","wide"]);
 assert.equal(Story.RESPONSE.survey.shot,"supports");
 assert.equal(Story.RESPONSE.cover.shot,"route");
 assert.deepEqual(Story.OUTRO.map(x=>x.shot),["supports","wide"]);
 for(const beat of [...Story.INTRO,...Object.values(Story.RESPONSE),...Story.OUTRO])
  assert.ok(Story.CAST[beat.speakerId]?.label);
});
test("civilian frames are painted actions; the hero frames keep neutral identity",()=>{
 for(const key of ["warning","conflict","decision","aftermath"]){
  assert.equal(Story.ART[key],"assets/cutscenes/first-report/v2/"+key+".webp");
  assert.equal(Story.AVIF[key],"assets/cutscenes/first-report/v2/"+key+".avif");
 }
 assert.match(Story.ART.approach,/v3\/bridge-approach\.webp$/);
 assert.match(Story.AVIF.approach,/v3\/bridge-approach\.avif$/);
 assert.equal(Story.INTRO[2].art,"approach");
 assert.equal(Story.INTRO[3].art,"approach");
 assert.equal(Story.RESPONSE.survey.art,"approach");
 assert.equal(Story.RESPONSE.cover.art,"approach");
});

test("civilian portraits reuse the high-resolution action art without invented faces",()=>{
 const fs=require("node:fs"),path=require("node:path");
 for(const name of ["worker","master"]){
  const cast=Story.CAST[name];
  assert.equal(cast.portraitAvif,cast.portrait.replace(/\.webp$/,".avif"));
  const webp=fs.readFileSync(path.join(__dirname,"..",cast.portrait));
  assert.equal(webp.toString("ascii",0,4),"RIFF");
  assert.ok(webp.length>100_000);
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
