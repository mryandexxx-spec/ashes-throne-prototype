"use strict";
// ARENA-UI-003A: HUD frame. Presentation only; CombatCore rules are not changed.
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const html=read("index.html"),css=read("styles.css"),game=read("game.js"),pkg=JSON.parse(read("package.json"));
const core=vm.runInNewContext(["initiative-model.js","ability-data.js","combat-status-core.js","battle-rng.js",
 "combat-core.js","auto-decision.js","enemy-decision.js","arena-ui-003.js"].map(read).join("\n")+
 "\n({InitiativeModel,CombatCore,AbilityData,ArenaUI003})",{console});
const {InitiativeModel,CombatCore,AbilityData,ArenaUI003:UI}=core;
const battleHtml=html.split('<section id="battle"')[1].split("</section>")[0];

test("ARENAUI003A: forecast follows InitiativeModel exactly and never mutates the battle",()=>{
 const fighters=[{id:"a",speed:150,hp:10,meter:0,index:0},{id:"b",speed:100,hp:10,meter:400,index:1},
  {id:"c",speed:120,hp:10,meter:0,index:2},{id:"dead",speed:999,hp:0,meter:900,index:3}];
 const battle={active:true,currentActor:-1,fighters:fighters.map(f=>({...f}))};
 const before=JSON.stringify(battle);
 const predicted=[...UI.forecast(battle,6)];
 assert.equal(JSON.stringify(battle),before,"battle untouched");
 // Reference: the same rule CombatCore uses (nextActor + finishTurn) on a copy.
 const ref=fighters.map(f=>({...f})),order=[];
 for(let i=0;i<6;i++){const r=InitiativeModel.nextActor(ref);order.push(r.id);InitiativeModel.finishTurn(ref,r.id);}
 assert.deepEqual(predicted,order);
 assert.ok(!predicted.includes("dead"),"fallen fighters never appear");
 // With an acting hero, that hero is first and is not counted twice in a row.
 const acting={active:true,currentActor:0,fighters:[{id:"a",speed:150,hp:10,meter:1000,index:0},
  {id:"b",speed:100,hp:10,meter:0,index:1}]};
 const withActor=[...UI.forecast(acting,4)];
 assert.equal(withActor[0],"a");
 assert.equal(withActor.length,4);
 assert.deepEqual([...UI.forecast({...acting,active:false},4)],[],"no queue after the battle");
});

test("ARENAUI003A: forecast matches the real CombatCore turn order in a live battle",()=>{
 const roster=[
  {id:"kael",name:"Каэль",hp:400,atk:5,speed:110,side:"ally"},
  {id:"lyra",name:"Лира",hp:400,atk:5,speed:155,side:"ally"},
  {id:"shade",name:"Тень",hp:400,atk:5,speed:135,side:"enemy"},
  {id:"ves",name:"Вестник",hp:400,atk:5,speed:105,side:"enemy"}];
 const battle=CombatCore.createBattle(roster);
 CombatCore.advanceToPlayerTurn(battle);
 let checked=0;
 for(let turn=0;turn<8&&battle.active;turn++){
  const predicted=[...UI.forecast(battle,6,{speedOf:f=>CombatCore.effectiveStat(battle,f,"speed")})];
  const snapshot=JSON.stringify(battle.fighters);
  assert.equal(predicted[0],battle.fighters[battle.currentActor].id);
  assert.equal(JSON.stringify(battle.fighters),snapshot,"forecast is read-only");
  assert.ok(CombatCore.performPlayerAbility(battle,"basic"));
  // CombatCore keeps the events of the last player action only: our hero,
  // the enemy actions that followed, then the next ally turn.
  const actual=[...battle.events.filter(e=>e.type==="ability").map(e=>e.actorId)];
  if(battle.active)actual.push(battle.fighters[battle.currentActor].id);
  assert.deepEqual(actual,predicted.slice(0,actual.length),"turn "+turn);
  checked++;
 }
 assert.ok(checked>=6);
});

test("ARENAUI003A: icon faces use owner art when present and data-driven pictograms otherwise",async()=>{
 const ren=AbilityData.get({id:"ren"},"special");
 assert.equal(UI.glyphFor(AbilityData.get({id:"ren"},"basic"),"basic"),"strike");
 assert.equal(UI.glyphFor(ren,"special"),"break");
 assert.equal(UI.glyphFor(AbilityData.get({id:"liora"},"special"),"special"),"shield");
 assert.equal(UI.glyphFor(AbilityData.get({id:"art"},"special"),"special"),"link");
 assert.equal(UI.glyphFor(AbilityData.get({id:"sava"},"special"),"special"),"signal");
 assert.equal(UI.glyphFor(AbilityData.get({id:"medic-demo"},"special"),"special"),"heal");
 assert.equal(UI.glyphFor(AbilityData.get({id:"test-area-damage"},"special"),"special"),"sweep");
 assert.equal(UI.glyphFor(AbilityData.get({id:"ren"},"powerful"),"powerful"),"power","powerful never looks like the basic attack");
 for(const g of Object.keys(UI.GLYPHS))assert.match(UI.GLYPHS[g],/^<(path|rect|circle)/);
 assert.equal(UI.iconUrl("ren","special"),"assets/abilities/ren-special.webp");
 assert.equal(UI.iconUrl("../x","special"),null);
 assert.equal(UI.iconUrl("ren","leader"),null);
 // Nothing listed yet: pictogram only, no image request at all.
 assert.doesNotMatch(UI.abilityFace("ren","special",ren,0).html,/<img/);
 const manifest=JSON.parse(read("assets/abilities/manifest.json"));
 assert.ok(Array.isArray(manifest.icons));
 for(const name of manifest.icons)assert.ok(fs.existsSync(path.join(__dirname,"..","assets/abilities",name)),name+" listed but missing");
 // The manifest is read once; invalid names are ignored.
 let calls=0;
 const fetchFn=async url=>{calls++;assert.equal(url,"assets/abilities/manifest.json");
  return {ok:true,json:async()=>({icons:["ren-special.webp","../evil-basic.webp","ren-leader.webp"]})};};
 assert.equal(await UI.loadManifest(fetchFn),true);
 assert.equal(await UI.loadManifest(fetchFn),true);
 assert.equal(calls,1,"one request per session");
 assert.doesNotMatch(UI.abilityFace("ren","basic",AbilityData.get({id:"ren"},"basic"),0).html,/<img/,"unlisted icon is not requested");
 const face=UI.abilityFace("ren","special",ren,2);
 assert.match(face.html,/<img class="ability-art" src="assets\/abilities\/ren-special\.webp"/);
 assert.match(face.html,/class="ability-cooldown" aria-hidden="true">2</);
 assert.match(face.html,/class="ability-name">Найти брешь · 2</);
 assert.equal(face.accent,"ember");
 // A missing file is requested once; later faces show only the pictogram.
 let removed=false;
 UI.iconMissing({getAttribute:()=>"assets/abilities/ren-special.webp",remove(){removed=true;}});
 assert.equal(removed,true);
 assert.doesNotMatch(UI.abilityFace("ren","special",ren,0).html,/<img/);
 assert.doesNotMatch(UI.abilityFace("ren","special",ren,0).html,/ability-cooldown/);
 assert.equal(UI.escapeHtml('<b a="1">'),"&lt;b a=&quot;1&quot;&gt;");
 assert.equal(UI.initials("Вестник Конклава"),"ВК");
 assert.equal(UI.initials("Арт"),"АР");
 assert.equal(UI.initials("Сарх — сухопутный курьер"),"СС","ARENA-ART-004G: dash is not an initial");
 for(const src of Object.values(UI.PORTRAITS))assert.ok(fs.existsSync(path.join(__dirname,"..",src.split("?")[0])),src);
});

test("ARENAUI003A: arena markup — queue, hero, round abilities; no target card or service text",()=>{
 for(const id of ["turnQueueBar","turnQueue","turnQueueWave","turnQueueToggle","battleChallengeGoal","tacticalGoalCard",
  "activeHero","activeHeroPortrait","activeHeroName","autoBattleBtn","autoSpeedBtn","actionHint",
  "basicAbilityBtn","specialAbilityBtn","powerfulAbilityBtn","battleLog","battleLogSummary","battleMessage","battleStatus"])
  assert.equal((battleHtml.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id);
 for(const id of ["targetFighterHud","turnChip","actionTitle"])assert.doesNotMatch(html,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(battleHtml,/ДЕЙСТВИЕ|Способности<|Анимация действия|Действие выполняется/);
 assert.match(battleHtml,/id="turnQueueToggle"[^>]*aria-controls="turnQueue"[^>]*aria-expanded="true"/);
 assert.match(battleHtml,/id="battleMessage" class="battle-message sr-only" role="status"/,"status stays for screen readers");
 assert.match(battleHtml,/class="battle-heading sr-only"/);
 assert.match(battleHtml,/<summary aria-label="Журнал боя"><svg/);
 assert.match(battleHtml,/id="battleLogSummary" class="sr-only"/);
 // No "Тестовая арена"/"Ход N" on screen: the label is read only by screen readers.
 assert.match(game,/battleIsCampaign\?MissionData\.get\(activeMissionId\)\.title:"ТЕСТОВАЯ АРЕНА"/);
 assert.doesNotMatch(game,/\$\("#turnChip"\)|\$\("#actionTitle"\)|\$\("#targetFighter/);
});

test("ARENAUI003A: HUD logic is read-only presentation with a remembered queue toggle",()=>{
 assert.match(game,/ArenaUI003\.forecast\(state,ArenaUI003\.QUEUE_SIZE,\{\s*speedOf:f=>CombatCore\.effectiveStat\(state,f,"speed"\)\}\)/);
 assert.match(game,/localStorage\?\.getItem\?\.\("ashes-throne\.arena-queue-collapsed"\)==="1"/);
 assert.match(game,/try\{window\.localStorage\?\.setItem\?\.\("ashes-throne\.arena-queue-collapsed"/);
 assert.match(game,/if\(signature!==turnQueueSignature\)/,"queue DOM rebuilt only on change");
 assert.match(game,/if\(data\.face!==signature\)\{data\.face=signature;button\.innerHTML=face\.html;\}/,"icons rebuilt only on change");
 assert.match(game,/const slotState=\(ready,cooldown\)=>!actor\?"locked":autoBattle\?"auto":visualBusy&&ready\?"wait":\s*\n?\s*ready\?"ready":cooldown>0\?"cooldown":"locked";/);
 // Disabled rules are unchanged from Combat-009/012B.
 assert.match(game,/basicButton\.disabled=!actor\|\|autoBattle\|\|visualBusy;/);
 assert.match(game,/specialButton\.disabled=!specialReady\|\|autoBattle\|\|visualBusy;/);
 assert.match(game,/powerfulButton\.disabled=!powerfulReady\|\|autoBattle\|\|visualBusy;/);
 assert.doesNotMatch(read("arena-ui-003.js"),/setTimeout|setInterval|requestAnimationFrame|getBoundingClientRect|BABYLON/);
});

test("ARENAUI003A: CSS — 44pt targets, ≥56px round abilities, safe-area, scoped selectors",()=>{
 const block=css.slice(css.indexOf("/* ARENA-UI-003A"));
 assert.ok(block.length>100);
 assert.doesNotMatch(block,/#battle\s/,"scoped as #battle.battle-screen");
 assert.match(block,/\.battle-menu-btn,[\s\S]*?width:44px;height:44px;min-width:44px;min-height:44px/);
 assert.match(block,/\.ability-slot \.ability-btn\{[^}]*width:60px;height:60px;[^}]*border-radius:50%/);
 assert.match(block,/#powerfulAbilityBtn\{width:66px;height:66px/);
 assert.match(block,/\.battle-hero \.ghost\{min-height:44px;min-width:44px/);
 assert.match(block,/\.turn-queue-toggle::before\{content:"";position:absolute;inset:-2px -6px -2px -10px\}/);
 for(const side of ["top","left","right","bottom"])assert.match(block,new RegExp("env\\(safe-area-inset-"+side));
 assert.match(block,/\[data-state="cooldown"\],[\s\S]*?\[data-state="locked"\]\{filter:grayscale/);
 assert.match(block,/\.ability-tooltip p\{display:block\}/,"long-press text is visible on short landscape");
 assert.match(block,/\.action-hint\{display:block;/);
 assert.match(block,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(block,/backdrop-filter|blur\(|animation:/,"no costly filters or loops on iPhone");
});

test("ARENAUI003A: build version and script order",()=>{
 assert.equal(pkg.version,"0.3.218");
 assert.ok(html.includes('id="buildVersion">Прототип · v0.3.218 · NETUXCLR008'));
 assert.ok(pkg.scripts.test.includes("node --check arena-ui-003.js"));
 const at=html.indexOf('src="arena-ui-003.js?v=0.3.218"');
 assert.ok(at>0&&at<html.indexOf('src="game.js?v=0.3.218"'));
});

// ---------------- ARENA-UI-003B: labels and numbers ----------------
const Vis=require("../arena-vis-002.js");
function fakeDom(){
 const make=()=>{const el={children:[],style:{},className:"",textContent:"",hidden:false,
  appendChild(c){this.children.push(c);return c;},setAttribute(){} };return el;};
 return {container:make(),doc:{createElement:make}};
}
const centreY=el=>Number(/translate3d\([^,]+,(-?[\d.]+)px/.exec(el.style.transform)[1]);
test("ARENAUI003B: a number never rises into its target's label, even when the label moves",()=>{
 const {container,doc}=fakeDom();
 let floor=80;
 const f=Vis.createFloaters(container,doc,{floor:id=>id==="ves"?floor:null});
 // Shoulder point just under the label: the old layer drew the number over the bars.
 assert.equal(f.spawn("ves",[{cls:"damage",text:"−31"}],{x:500,y:84}),1);
 const node=container.children[0];
 const pad=Vis.constants.FLOOR_PAD_PX;
 for(let t=0;t<Vis.constants.FLOAT_MS;t+=16){
  f.tick(16);
  if(!node.className.includes("on"))break;
  assert.ok(centreY(node)>=floor+pad-1e-6,`t=${t}: ${centreY(node)} under ${floor}+${pad}`);
  if(t===160){floor=92;f.relayout();assert.ok(centreY(node)>=floor+pad,"follows a label that moved down");}
 }
 // A target without a label (or before layout) keeps the VIS-002 behaviour.
 const g=Vis.createFloaters(fakeDom().container,fakeDom().doc,{});
 assert.equal(g.spawn("x",[{cls:"damage",text:"−1"}],{x:10,y:84}),1);
 assert.equal(typeof f.relayout,"function");
});
test("ARENAUI003B: labels show names only for the acting hero and the target; marks stay as icons",()=>{
 assert.match(game,/const targeted=!!actor&&h\.hp>0&&!support&&h\.side==="enemy"&&state\.fighters\[state\.selectedEnemy\]\?\.id===h\.id;/);
 assert.match(game,/const named=active\|\|targeted;/);
 assert.match(game,/\$\{named\?`<div class="arena-indicator-name"\$\{h\.side==="enemy"\?` style="max-width:\$\{nameW\}px"`:""\}>\$\{h\.name\}<\/div>`:""\}/);
 assert.match(game,/data-name-w="\$\{nameW\}"/,"the reserved band and the name cap are the same number");
 assert.match(game,/const markIcon=!named&&markClass\?`<span class="arena-effect mark \$\{markClass\}"/);
 // Labels are pinned (bounded shift), the free packer is gone.
 const hud=read("arena-world-hud.js");
 assert.doesNotMatch(hud,/function pack\(|shelf/);
 assert.match(hud,/anchor\(rows,this\.width,this\.height,this\.insets,marked\(this\.obstacles\)\)/);
 // A striker's label hides while it is away and takes no room.
 assert.match(game,/visual\.av003Away=Math\.hypot\(approach\.x\|\|0,approach\.z\|\|0\)>\.45;/);
 assert.match(game,/arenaHudLayout\.track\(id,node,ax,ay,away\)/);
 // Numbers read the label bottom, and are re-placed after the labels in the same frame.
 assert.match(game,/floor:id=>arenaHudLayout\?\.bottomOf\?\.\(id\)\?\?null/);
 assert.match(game,/positionArenaIndicators\(\);\n \/\/ ARENA-UI-003B[^\n]*\n arenaFeedback\?\.floaters\?\.relayout\?\.\(\);\n scene\.render\(\);/);
 const block=css.slice(css.indexOf("/* ARENA-UI-003B"));
 assert.match(block,/\.arena-indicator\.away\{opacity:0\}/);
 assert.match(block,/\.arena-indicator\.enemy\.named \.arena-indicator-name\{position:absolute;top:100%;[^}]*height:12px;line-height:12px\}/,"name fits the reserved band");
 assert.doesNotMatch(block,/#battle\s|backdrop-filter|blur\(/);
});
