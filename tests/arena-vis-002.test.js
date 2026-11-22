const __BUILD_VERSION_FOR_TESTS=require("../package.json").version;
"use strict";
// ARENA-VIS-002: hit feedback contract (numbers, hit-stop, flash, shake, push-in).
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Vis=require("../arena-vis-002.js");
const C=Vis.constants;

function animation(){
 const AnimationProfiles={slots:["basic","special","powerful"],resolve:(id,slot)=>{
  const d={idle:1200,basic:400,special:400,powerful:600,hit:200,ward:300,guard:300,death:400};
  // Ren's basic names its contact moment, like the real profiles (HUDSYNC001).
  return {kind:slot==="idle"?"idle":"hit",durationMs:d[slot]||300,amplitude:.1,
   ...(id==="ren"&&slot==="basic"?{contactFraction:.5}:{})};
 }};
 return vm.runInNewContext(read("battle-animation.js")+"\nBattleAnimation",{AnimationProfiles});
}

test("float labels: damage, crit, protection, heal, guard, miss, resist",()=>{
 assert.deepEqual(Vis.floatSpecs({kind:"damage",amount:26}),[{text:"−26",cls:"damage",note:null}]);
 assert.deepEqual(Vis.floatSpecs({kind:"damage",amount:52,crit:true}),[{text:"−52",cls:"crit",note:"крит"}]);
 // Typed damage: protection and HP parts are shown separately.
 assert.deepEqual(Vis.floatSpecs({kind:"damage",amount:30,hp:12,protection:18}),
  [{text:"−18",cls:"protection",note:null},{text:"−12",cls:"damage",note:null}]);
 assert.deepEqual(Vis.floatSpecs({kind:"damage",amount:9,hp:0,protection:9}),[{text:"−9",cls:"protection",note:"защита"}]);
 assert.deepEqual(Vis.floatSpecs({kind:"damage",amount:9,hp:0,protection:9,crit:true}),[{text:"−9",cls:"protection",note:"крит"}]);
 assert.deepEqual(Vis.floatSpecs({kind:"damage",amount:0}),[{text:"−0",cls:"damage",note:null}],"a blocked blow still reads as a hit");
 assert.deepEqual(Vis.floatSpecs({kind:"heal",amount:25}),[{text:"+25",cls:"heal",note:null}]);
 assert.deepEqual(Vis.floatSpecs({kind:"heal",amount:0}),[],"full HP: no '+0'");
 assert.deepEqual(Vis.floatSpecs({kind:"guard",stacks:2}),[{text:"Защита ×2",cls:"guard",note:null}]);
 assert.deepEqual(Vis.floatSpecs({kind:"miss"}),[{text:"Уклонение",cls:"miss",note:null}]);
 assert.deepEqual(Vis.floatSpecs({kind:"resist"}),[{text:"Сопротивление",cls:"resist",note:null}]);
 assert.deepEqual(Vis.floatSpecs({kind:"power"}),[]);
 assert.deepEqual(Vis.floatSpecs(null),[]);
});

test("hit-stop pauses only the animation clock, 60-90 ms, overlapping hits do not add up",()=>{
 assert.ok(C.HIT_STOP_MS>=60&&C.HIT_STOP_STRONG_MS<=90&&C.HIT_STOP_MS<C.HIT_STOP_STRONG_MS);
 assert.ok(C.FLASH_MS>=70&&C.FLASH_MS<=90);
 const c=Vis.createController();
 assert.equal(c.animationDelta(16),16,"no hit, no pause");
 c.hitStop(65);c.hitStop(65);c.hitStop(40); // area attack: several cues in one frame
 let paused=0,frames=0;
 while(c.stopping()&&frames<20){paused+=16-c.animationDelta(16);frames++;}
 assert.equal(paused,65,"max, not the sum");
 c.hitStop(10);
 assert.equal(c.animationDelta(16),6,"remainder of the frame keeps animating");
 assert.equal(c.animationDelta(-1),0);assert.equal(c.animationDelta(NaN),0);
});

test("shake decays to zero; there is no camera push-in (ARENA-ART-004G)",()=>{
 const c=Vis.createController();
 c.shake(C.SHAKE_MS);
 const first=c.step(16);
 assert.ok(Math.abs(first.offsetX)>0||Math.abs(first.offsetY)>0);
 assert.ok(Math.abs(first.offsetX)<=C.SHAKE_PX);
 let s;for(let t=0;t<C.SHAKE_MS;t+=16)s=c.step(16);
 assert.equal(s.offsetX,0);assert.equal(s.offsetY,0);
 assert.equal(c.startPush,undefined,"push-in removed by the owner");
 assert.equal(Object.keys(C).some(k=>/^PUSH_/.test(k)),false);
});

test("prefers-reduced-motion: no shake; numbers and hit-stop remain",()=>{
 const c=Vis.createController({reducedMotion:true});
 c.shake(200);
 const s=c.step(16);
 assert.equal(s.offsetX,0);
 c.hitStop(65);assert.equal(c.animationDelta(16),0);
});

function fakeDom(){
 const make=tag=>{const el={tag,children:[],style:{},className:"",textContent:"",hidden:false,attrs:{},
  appendChild(c){this.children.push(c);return c;},setAttribute(k,v){this.attrs[k]=v;}};return el;};
 const container=make("div");
 return {container,document:{createElement:make}};
}
test("floaters: fixed DOM pool, transform/opacity only, expire and clear",()=>{
 const {container,document}=fakeDom();
 const f=Vis.createFloaters(container,document);
 assert.equal(f.spawn("ves",Vis.floatSpecs({kind:"damage",amount:26}),{x:300,y:120}),1);
 const node=container.children[0];
 assert.match(node.className,/arena-floater on damage/);
 assert.equal(node.attrs["aria-hidden"],"true");
 assert.equal(node.children[1].textContent,"−26");
 assert.match(node.style.transform,/translate3d\(300\.0px,120\.0px,0\)/);
 f.tick(C.FLOAT_MS/2);
 assert.match(node.style.transform,/translate3d\(300\.0px,(9\d|10\d|8\d)\.\dpx,0\)/,"rises");
 for(let i=0;i<40;i++)f.spawn("shade",Vis.floatSpecs({kind:"damage",amount:i}),{x:500,y:150});
 assert.equal(container.children.length,C.MAX_FLOATERS,"pool never grows past the cap");
 assert.equal(f.active(),C.MAX_FLOATERS);
 f.tick(C.FLOAT_MS+1);
 assert.equal(f.active(),0);
 assert.equal(node.className,"arena-floater");
 f.spawn("ves",Vis.floatSpecs({kind:"miss"}),{x:1,y:1});f.clear();assert.equal(f.active(),0);
 assert.equal(f.spawn("ves",Vis.floatSpecs({kind:"miss"}),null),0,"off-screen target: nothing");
 // Two quick hits on one target stack instead of overprinting.
 f.spawn("ren",[{text:"−1",cls:"damage"}],{x:100,y:100});f.spawn("ren",[{text:"−2",cls:"damage"}],{x:100,y:100});
 const ys=container.children.filter(n=>/ on /.test(n.className)).map(n=>Number(/,(\d+\.\d)px,0/.exec(n.style.transform)[1]));
 assert.equal(ys.length,2);assert.equal(Math.abs(ys[0]-ys[1]),C.STACK_PX);
});

test("white flash uses per-mesh overlay for ~80 ms and restores the meshes",()=>{
 class Color3{constructor(r,g,b){Object.assign(this,{r,g,b});}}
 const flash=Vis.createFlash({Color3});
 const meshes=[{renderOverlay:false},{renderOverlay:false}];
 assert.equal(flash.start("ves",meshes),true);
 assert.ok(meshes.every(m=>m.renderOverlay&&m.overlayColor.r===1&&m.overlayAlpha===C.FLASH_ALPHA));
 flash.tick(40);
 assert.ok(meshes[0].overlayAlpha<C.FLASH_ALPHA&&meshes[0].overlayAlpha>0);
 flash.tick(45);
 assert.ok(meshes.every(m=>m.renderOverlay===false&&m.overlayAlpha===0));
 assert.equal(flash.active(),0);
 assert.equal(flash.start("x",[]),false);
 flash.start("ves",meshes);flash.clear();assert.ok(meshes.every(m=>!m.renderOverlay));
});

test("controller wiring: damage => hit-stop + flash + number; powerful blow shakes, radius untouched",()=>{
 class Color3{constructor(r,g,b){Object.assign(this,{r,g,b});}}
 const {container,document}=fakeDom();
 const fx=Vis.create({Color3},{container,document});
 const camera={radius:7.6,lowerRadiusLimit:6.6,targetScreenOffset:{x:0,y:0}};
 const body={renderOverlay:false};
 const ctx={multiplier:1,project:()=>({x:200,y:100}),meshesFor:id=>id==="ves"?[body]:[]};
 fx.handle([{id:"ves",kind:"damage",amount:26}],ctx);
 assert.equal(body.renderOverlay,true);
 assert.equal(fx.animationDelta(16),0,"hit-stop started");
 assert.equal(container.children.length,1);
 fx.frame(16,camera,false);
 assert.equal(camera.targetScreenOffset.x,0,"ordinary hit: no shake");
 // Powerful blow: shake only. ARENA-ART-004G: the camera never pushes in.
 fx.handle([{id:"ren",kind:"power"},{id:"ves",kind:"damage",amount:42,power:true}],ctx);
 let shook=false;for(let i=0;i<30;i++){fx.frame(16,camera);shook=shook||camera.targetScreenOffset.x!==0;
  assert.equal(camera.radius,7.6);assert.equal(camera.lowerRadiusLimit,6.6);}
 assert.ok(shook,"powerful blow shakes");
 for(let i=0;i<40;i++)fx.frame(16,camera);
 assert.equal(camera.targetScreenOffset.x,0);assert.equal(camera.targetScreenOffset.y,0);
 // 4x autobattle: hit-stop is shorter.
 const fastStop=Vis.create({Color3},{});fastStop.handle([{id:"ves",kind:"damage",amount:1}],{multiplier:4});
 let paused=0;for(let i=0;i<10;i++)paused+=16-fastStop.animationDelta(16);
 assert.ok(paused<C.HIT_STOP_MS&&paused>=C.HIT_STOP_MS/2-1,"4x keeps the beat but shorter");
 // clear() mid-shake returns the offset to zero.
 fx.handle([{id:"ves",kind:"damage",amount:42,power:true}],ctx);fx.frame(16,camera);
 fx.clear(camera);assert.equal(camera.radius,7.6);assert.equal(camera.targetScreenOffset.x,0);
});

test("BattleAnimation emits feedback at the moment each blow is drawn",()=>{
 const A=animation();
 // Crit marker precedes its damage event in CombatCore.
 A.enqueue([{type:"ability",actorId:"ren",abilityId:"basic",targetId:"ves"},
  {type:"critical",actorId:"ren",targetId:"ves"},
  {type:"damage",actorId:"ren",targetId:"ves",amount:52,remainingHp:38,hpDamage:40,protectionDamage:12}]);
 A.tick(100,1);
 assert.deepEqual(Array.from(A.drainFeedback()),[],"nothing before contact");
 A.tick(150,1); // contact at 200 ms
 const fx=Array.from(A.drainFeedback());
 assert.equal(fx.length,1);
 assert.equal(fx[0].id,"ves");assert.equal(fx[0].kind,"damage");assert.equal(fx[0].crit,true);
 assert.equal(fx[0].hp,40);assert.equal(fx[0].protection,12);assert.equal(fx[0].power,false);
 const hit=Array.from(A.drainStarted());
 assert.equal(hit[0].strong,true,"crit makes the spark burst strong");
 assert.equal(A.drainFeedback().length,0,"drained once");
 A.clear();
 // Powerful: camera cue at action start, damage flagged as power.
 A.enqueue([{type:"ability",actorId:"art",abilityId:"powerful",targetId:"ves"},
  {type:"damage",actorId:"art",targetId:"ves",amount:42,remainingHp:20}]);
 A.tick(16,1);
 assert.deepEqual(Array.from(A.drainFeedback()).map(f=>f.kind),["power"]);
 A.tick(100,1);A.tick(100,1);A.tick(100,1);A.tick(100,1);A.tick(100,1);A.tick(100,1);
 const after=Array.from(A.drainFeedback());
 assert.equal(after[0].kind,"damage");assert.equal(after[0].power,true);assert.equal(after[0].crit,false);
 A.clear();
 // Miss and resist: shown when the action lands, not at its start.
 A.enqueue([{type:"ability",actorId:"art",abilityId:"basic",targetId:"ves"},
  {type:"miss",actorId:"art",targetId:"ves"},
  {type:"ability",actorId:"art",abilityId:"special",targetId:"shade"},
  {type:"status-resisted",actorId:"art",targetId:"shade",effect:"weaken"}]);
 A.tick(16,1);assert.equal(A.drainFeedback().length,0);
 A.tick(100,1);A.tick(100,1);A.tick(100,1);A.tick(100,1);
 assert.deepEqual(Array.from(A.drainFeedback()).map(f=>f.id+":"+f.kind),["ves:miss"]);
 for(let i=0;i<5;i++)A.tick(100,1);
 assert.deepEqual(Array.from(A.drainFeedback()).map(f=>f.id+":"+f.kind),["shade:resist"]);
 A.clear();
 // Heal and guard ride on the existing ward cues.
 A.enqueue([{type:"ability",actorId:"liora",abilityId:"special",targetId:"ren"},
  {type:"effect",actorId:"liora",targetId:"ren",effect:"guard",stacks:2},
  {type:"heal",actorId:"liora",targetId:"ren",amount:25,remainingHp:80}]);
 for(let i=0;i<20;i++)A.tick(100,1);
 assert.deepEqual(Array.from(A.drainFeedback()).map(f=>f.kind+":"+(f.stacks??f.amount)),["guard:2","heal:25"]);
 A.enqueue([{type:"damage",targetId:"ren",amount:5}]);A.clear();A.tick(500,1);
 assert.equal(A.drainFeedback().length,0,"no stale feedback after replay");
});

test("ARENA-VIS-002 is presentation only and wired into the existing frame",()=>{
 const src=read("arena-vis-002.js"),game=read("game.js"),html=read("index.html"),css=read("styles.css"),pkg=JSON.parse(read("package.json"));
 assert.doesNotMatch(src,/CombatCore|state\.fighters|runRenderLoop|setInterval|setTimeout|requestAnimationFrame|\bfetch\(|XMLHttpRequest|Math\.random|innerHTML/);
 assert.match(game,/const animationDt=arenaFeedback\?arenaFeedback\.animationDelta\(dt\):dt;\n BattleAnimation\.tick\(animationDt,BattleSpeed\.multiplier\(\)\);/);
 assert.match(game,/BattleAnimation\.drainFeedback\(\)/);
 assert.doesNotMatch(game,/cameraMotion/,"ARENA-ART-004G: no push-in at any speed");
 assert.match(game,/arenaFeedback\.frame\(dt,arenaCamera\)/);
 assert.match(game,/arenaFeedback\?\.clear\(arenaCamera\)/);
 assert.match(game,/prefers-reduced-motion: reduce\)"\)\.matches;\n   arenaFeedback=ArenaVis002\.create/);
 assert.match(game,/combatVisual007\.tick\(dt,BattleSpeed\.multiplier\(\)\)/,"sparks keep real time during hit-stop");
 assert.ok(html.indexOf('id="arenaFloaters"')>html.indexOf('id="arenaIndicators"'));
 assert.match(html,/<div id="arenaFloaters" class="arena-floaters" aria-hidden="true"><\/div>/);
 assert.ok(html.indexOf(`src="arena-vis-002.js?v=${pkg.version}"`)>0);
 assert.ok(html.indexOf(`src="arena-vis-002.js?v=${pkg.version}"`)<html.indexOf(`src="game.js?v=${pkg.version}"`));
 assert.match(css,/\.battle-screen \.arena-floaters\{[^}]*pointer-events:none/);
 assert.match(css,/\.battle-screen \.arena-floater\.crit\{[^}]*font-size:31px/);
 assert.ok(pkg.scripts.test.includes("node --check arena-vis-002.js"));
 assert.match(pkg.version,/^\d+\.\d+\.\d+$/);
 assert.ok(html.includes('id="buildVersion">Прототип · v'+__BUILD_VERSION_FOR_TESTS+' · '));
});
