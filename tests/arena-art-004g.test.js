"use strict";
// ARENA-ART-004G: iPhone review of the battle HUD, no camera push-in, sarkh courier in N-02.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const html=read("index.html"),game=read("game.js"),css=read("styles.css"),pkg=JSON.parse(read("package.json"));
const battle=html.slice(html.indexOf('<section id="battle"'),html.indexOf("</section>",html.indexOf('<section id="battle"')));
const block=css.slice(css.indexOf("/* ARENA-ART-004G"));

test("ARENA-ART-004G: version and build code",()=>{
 assert.equal(pkg.version,"0.3.222");
 assert.ok(html.includes('id="buildVersion">Прототип · v0.3.222 · SQUADVIEW002'));
 assert.ok(html.includes('src="game.js?v=0.3.222"'));
});

test("ARENA-ART-004G: top-left row is menu, log, Автобой, 1×; ✕ is gone",()=>{
 const top=battle.slice(battle.indexOf('class="battle-top arena-hud"'),battle.indexOf('id="battleMenu" '));
 const order=["battleMenuBtn","battleLog","autoBattleBtn","autoSpeedBtn"].map(id=>top.indexOf('id="'+id+'"'));
 assert.ok(order.every(i=>i>0)&&order.every((v,i)=>!i||v>order[i-1]),"order in the top row");
 assert.doesNotMatch(top,/✕|aria-label="В меню"/);
 assert.match(top,/id="battleMenuBtn"[^>]*aria-haspopup="menu"[^>]*aria-expanded="false"[^>]*aria-controls="battleMenu"/);
 const hero=battle.slice(battle.indexOf('class="battle-hero arena-hud"'),battle.indexOf('class="battle-bottom'));
 assert.doesNotMatch(hero,/autoBattleBtn|autoSpeedBtn/,"autoplay left the hero row");
});

test("ARENA-ART-004G: battle menu — goal, replay, retreat (old ✕ path)",()=>{
 const menu=battle.slice(battle.indexOf('id="battleMenu" '),battle.indexOf("</div>",battle.indexOf('id="battleMenu" ')));
 assert.match(menu,/role="menu"[^>]*hidden/);
 const items=[...menu.matchAll(/<button[^>]*id="(\w+)"[^>]*>([^<]+)</g)].map(m=>[m[1],m[2]]);
 assert.deepEqual(items,[["battleMenuGoal","Описание цели"],["battleMenuRetry","Переиграть"],["battleMenuRetreat","Отступить"]]);
 assert.match(menu,/id="battleMenuRetreat"[^>]*data-screen="home"/,"retreat reuses the shared [data-screen] handler");
 assert.match(game,/if\(goal\)goal\.disabled=!battleHasGoal\(\);\n if\(retry\)retry\.disabled=!state\.active;/);
 assert.match(game,/function replayBattle\(\)\{\n closeBattleMenu\(\);\n if\(!state\.active\)return false;\n const mode=squadReturnScreen\|\|"home";\n openSquad\(mode\);/);
 assert.match(game,/\$\("#squadStart"\)\?\.click\?\.\(\);/,"replay goes through the normal start checks");
 assert.match(game,/if\(id!=="battle"\)\{closeFighterInspection\(\);hideAbilityTooltip\(\);closeBattleMenu\(\);\}/);
 assert.match(game,/"#battleMenuBtn, #battleMenu, #battle \.arena-utility,/,"menu is a HUD obstacle for labels");
 assert.match(block,/\.battle-menu-item\{\n min-height:44px/);
});

test("ARENA-ART-004G: vertical turn queue at the left; objective folded in the top-right corner",()=>{
 assert.match(block,/#battle\.battle-screen \.battle-queue\{\n top:calc\(max\(6px,env\(safe-area-inset-top,0px\)\) \+ 52px\);left:max\(10px,env\(safe-area-inset-left,0px\)\);\n transform:none/);
 assert.match(block,/\.turn-queue-bar\{flex-direction:column/);
 assert.match(block,/\.turn-queue\{flex-direction:column\}/);
 assert.ok(battle.indexOf('class="battle-goal-corner arena-hud"')>battle.indexOf('class="battle-queue arena-hud"'));
 const corner=battle.slice(battle.indexOf('class="battle-goal-corner'),battle.indexOf('id="battleMessage"'));
 assert.match(corner,/id="battleChallengeGoal"/);assert.match(corner,/id="tacticalGoalCard" class="tactical-goal-card collapsed"/);
 assert.match(corner,/id="tacticalGoalToggle"[^>]*aria-expanded="false"/);
 assert.match(block,/\.battle-goal-corner\{\n position:absolute;z-index:4;top:max\(6px,env\(safe-area-inset-top,0px\)\);right:max\(10px,env\(safe-area-inset-right,0px\)\)/);
 assert.match(block,/#battleChallengeGoal:not\(\[hidden\]\)\{\n position:relative;display:block;width:44px;height:44px/);
 assert.match(block,/\.tactical-goal-card\.collapsed p\{display:none\}/);
 assert.match(game,/objective\.classList\?\.remove\?\.\("expanded"\);/,"each battle starts folded");
 assert.match(game,/tacticalGoalCard\.classList\?\.add\?\.\("collapsed"\);/);
});

test("ARENA-ART-004G: fighter card shows the portrait",()=>{
 assert.match(battle,/<span id="inspectPortrait" class="fighter-inspect-portrait" aria-hidden="true"><\/span>/);
 assert.match(game,/const src=typeof ArenaUI003!=="undefined"\?ArenaUI003\.portrait\(fighter\):null;/);
 assert.match(css,/\.fighter-inspect-portrait\{width:64px;height:64px/);
});

test("ARENA-ART-004G: no camera push-in anywhere",()=>{
 const vis=read("arena-vis-002.js");
 assert.doesNotMatch(vis,/startPush|radiusFactor|PUSH_/);
 assert.match(vis,/if\(cue\.kind==="power"\)continue;/);
 assert.doesNotMatch(game,/cameraMotion/);
});

test("ARENA-ART-004G: N-02 wave 1 has the sarkh courier, same id, HP and protection (variant A)",()=>{
 const ctx={console};vm.createContext(ctx);
 for(const f of ["npc-enemy-data.js","npc-challenge-pilot.js"])
  vm.runInContext(read(f)+"\nthis.NpcEnemyData=typeof NpcEnemyData!=='undefined'?NpcEnemyData:this.NpcEnemyData;this.NpcChallengePilot=typeof NpcChallengePilot!=='undefined'?NpcChallengePilot:undefined;",ctx);
 const P=ctx.NpcChallengePilot;
 const first=P.spawn("N-02");
 assert.deepEqual(Array.from(first,x=>[x.id,x.archetypeId,x.name,x.hp,x.protection]),[
  ["npc-n02-slinger","npc-sarkh-land-courier","Сарх — сухопутный курьер",60,5],
  ["npc-n02-signaller","npc-route-signaller","Сигнальщик обхода",52,4]]);
 assert.deepEqual(Array.from(P.spawnWaves("N-02")[0],x=>x.archetypeId),["npc-watch-captain","npc-field-medic"]);
 assert.deepEqual(Array.from(P.trackerTargets("N-02").enemyIds),
  ["npc-n02-slinger","npc-n02-signaller","npc-n02-captain","npc-n02-medic"],"saved trackers keep matching");
 // Only N-02 changed: every other challenge stays human.
 for(const id of ["T-01","T-02","T-03","T-04","N-01","N-03","N-04"])
  assert.ok([...P.spawn(id),...P.spawnWaves(id).flat()].every(x=>x.speciesId==="human"),id);
 assert.equal(P.spawn("N-01").some(x=>x.archetypeId.startsWith("npc-sarkh")),false);
});
