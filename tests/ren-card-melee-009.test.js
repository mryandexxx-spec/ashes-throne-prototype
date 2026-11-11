"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const source=read("animation-profiles.js")+"\n"+read("battle-animation.js")+"\nBattleAnimation";
const anim=vm.runInNewContext(source);
test("MELEE009: targeted attacks move close, pause at contact, and return exactly home",()=>{
 const origin={x:-2.45,z:-1},target={x:2.45,z:1};
 const base={slot:"basic"};
 for(const [p,expectMoving] of [[0,false],[.19,true],[.5,true],[.82,true],[1,false]]){
  const move=anim.approach({...base,progress:p},origin,target);
  const distance=Math.hypot(move.x,move.z);
  assert.ok(expectMoving?distance>0:distance===0,"progress "+p);
 }
 const contact=anim.approach({...base,progress:.5},origin,target);
 assert.ok(Math.abs(Math.hypot(target.x-origin.x-contact.x,target.z-origin.z-contact.z)-1.25)<1e-8);
 const atHome=anim.approach({...base,progress:1},origin,target);
 assert.equal(atHome.x,0);assert.equal(atHome.z,0);
 const noTarget=anim.approach({...base,progress:.5},origin,null);
 assert.equal(noTarget.x,0);assert.equal(noTarget.z,0);
 const noAttack=anim.approach({slot:"hit",progress:.5},origin,target);
 assert.equal(noAttack.x,0);assert.equal(noAttack.z,0);
});
test("MELEE009: event target remains bound to attack animation",()=>{
 anim.clear();
 anim.enqueue([{type:"ability",actorId:"ren",targetId:"shade-1",abilityId:"basic"}]);
 anim.tick(30,1);
 assert.equal(anim.activity("ren").targetId,"shade-1");
 assert.equal(anim.activity("kael").targetId,null);
 anim.clear();
 assert.equal(anim.activity("ren").targetId,null);
});
test("RENCARD009: front-facing fixed vertical angle and SWGOH-style side controls",()=>{
 const card=read("ren-card-3d.js"),html=read("index.html"),css=read("styles.css"),game=read("game.js"),rig=read("ren-glb-runtime.js");
 assert.match(card,/ArcRotateCamera\("renCardCamera",Math\.PI\/2,Math\.PI\/2\.15/);
 assert.match(card,/camera\.lowerBetaLimit=Math\.PI\/2\.15/);
 assert.match(card,/camera\.upperBetaLimit=Math\.PI\/2\.15/);
 assert.match(card,/camera\.alpha=Math\.PI\/2/);
 assert.match(css,/#heroDetail \.hero-detail-reference\{[\s\S]*?grid-template-columns:minmax\(180px,1fr\) minmax\(250px,1\.55fr\)/);
 const gear=html.indexOf('class="gear-panel"'),progress=html.indexOf('class="hero-detail-panel hero-detail-progression"');
 assert.ok(gear>progress,"gear controls moved to right development column");
 assert.ok(html.includes('id="renCard3DCanvas"'));
 assert.match(game,/BattleAnimation\.approach\(activity,origin,targetPosition\)/);
 assert.match(rig,/turn\("hipR",stride\)/);
 const pkg=JSON.parse(read("package.json"));
 assert.ok(/^\d+\.\d+\.\d+$/.test(pkg.version));
 assert.ok(html.includes("v"+pkg.version+" · UIHUD001"));
 assert.match(html,/RENCARD009 \+ MELEE009/);
});
