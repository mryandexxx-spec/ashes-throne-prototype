"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("browser journeys have one automated owner and are not nested",()=>{
 const squad=read("tests/squad-recover-browser.cjs"),fp=read("tests/first-play-browser.cjs"),selective=read(".github/workflows/ci-selective.yml"),unified=read(".github/workflows/aud003-b17-3a.yml");
 assert.doesNotMatch(squad,/first-play-browser\.cjs/);
 assert.doesNotMatch(fp,/first-play-closeout-browser\.cjs/);
 assert.equal((selective.match(/node tests\/first-play-browser\.cjs/g)||[]).length,1);
 assert.equal((selective.match(/node tests\/squad-recover-browser\.cjs/g)||[]).length,1);
 assert.doesNotMatch(selective,/node tests\/first-play-closeout-browser\.cjs/);
 assert.equal((unified.match(/node tests\/first-play-closeout-browser\.cjs/g)||[]).length,1);
 assert.match(unified,/mode: \[pilot, live\]/);
});
test("scope separation preserves first boot coverage when squad or shared runtime changes",()=>{
 const selector=read("scripts/ci-selective.cjs");
 const source=selector.slice(selector.indexOf("const any="),selector.indexOf("const tests=new Set"));
 for(const changed of [["game.js"],["index.html"],["styles.css"],["squad-stage-3d.js"],["assets/ren.glb"],["tests/first-play-browser.cjs"],["art-adventure-core.js"]]){
  const result=vm.runInNewContext(source+"\nscopes",{changed});
  assert.equal(result.firstplay,true,changed[0]);
 }
 assert.equal(vm.runInNewContext(source+"\nscopes",{changed:["docs/PROJECT_STATUS.md"]}).firstplay,false);
});
