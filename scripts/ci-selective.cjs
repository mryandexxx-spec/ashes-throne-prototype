"use strict";
// Diff-aware, dependency-free PR smoke: no npm test on every small UI change.
// Use: node scripts/ci-selective.cjs
const cp=require("node:child_process");
const fs=require("node:fs");
const path=require("node:path");
function git(args){
 return cp.execFileSync("git",args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
}
const baseBranch=process.env.BASE_BRANCH||process.env.GITHUB_BASE_REF||"main";
let changed=[];
try{
 changed=git(["diff","--name-only","--diff-filter=ACMRT","origin/"+baseBranch+"...HEAD"])
  .split("\n").map(x=>x.trim()).filter(Boolean);
}catch(error){
 console.error("CI: cannot calculate the changed files; refusing to silently skip tests",error.message);
 process.exit(1);
}
if(process.env.GITHUB_EVENT_NAME==="workflow_dispatch"&&!changed.length)
 changed=["game.js"]; // explicit manual smoke runs the essential game path
const any=fn=>changed.some(fn);
const squad=any(f=>["game.js","index.html","styles.css","squad-stage-3d.js","tests/squad-recover-browser.cjs",
 "resource-icon-ui.js","resource-icon-ui.css","tests/resource-icon-ui-browser.cjs"].includes(f)
 || /^assets\/.*\.glb$/.test(f)||/^assets\/resources\//.test(f));
const battle=any(f=>/^(combat-|arena-|battle-|npc-|enemy-|tests\/arena-fix-001)/.test(f)
 || f==="combat-core.js" || f==="arena-world-hud.js");
const lore=any(f=>/^(lore-|story-|tests\/lore-campaign)/.test(f));
const network=any(f=>/^(network-|net-|weekly-threat-|tests\/network-)/.test(f));
const hero=any(f=>/^(hero-card|hero-stats|gear-|tests\/hero-card)/.test(f));
// Roster/save schema changes require the full regression, not only squad/hero smoke.
const audit=any(f=>f.startsWith(".github/workflows/")||f==="scripts/ci-selective.cjs"||
 ["hero-collection-core.js","progress-v3-core.js","star-core.js","resource-icon-ui.js"].includes(f));
const firstplay=any(f=>/^(first-play(?:[-.]|$)|tests\/first-play(?:[-.]|$))/.test(f));
const scopes={squad,battle,lore,network,hero,audit,firstplay};
const tests=new Set();
if(squad)for(const f of ["tests/squad-001.test.js","tests/combat-014b-leader-squad.test.js","tests/ui-hero-002-squad.test.js","tests/squad-recover-3d.test.js"])tests.add(f);
if(battle)for(const f of ["tests/combat-014a-leader-contract.test.js","tests/ren-status-h-full-battle-model.test.js"])tests.add(f);
if(lore)for(const f of ["tests/lore-campaign-required-combat.test.js","tests/lore-campaign-battle-briefs.test.js"])tests.add(f);
if(network)for(const f of ["tests/network-004-pilot.test.js","tests/network-ux-004-board.test.js"])tests.add(f);
if(hero)tests.add("tests/hq-ui.test.js");
if(firstplay)for(const f of ["tests/first-play.test.js","tests/first-play-story.test.js","tests/first-play-art.test.js"])tests.add(f);
for(const f of changed)if(/^tests\/[^/]+\.test\.js$/.test(f))tests.add(f);
const existing=[...tests].filter(f=>fs.existsSync(f)).sort();
console.log("CI changed files:",JSON.stringify(changed));
console.log("CI selected scopes:",JSON.stringify(scopes));
console.log("CI selected Node tests:",JSON.stringify(existing));
for(const f of changed){
 if(!/\.(?:js|cjs|mjs)$/.test(f)||!fs.existsSync(f))continue;
 cp.execFileSync(process.execPath,["--check",f],{stdio:"inherit",timeout:20000});
}
if(any(f=>f==="index.html"||f==="package.json"||f==="game.js"||f==="styles.css"||f==="squad-stage-3d.js")){
 const version=require(path.resolve("package.json")).version;
 const html=fs.readFileSync("index.html","utf8");
 if(!html.includes("id=\"buildVersion\">Прототип · v"+version+" · "))
  throw Error("CI: index.html buildVersion must match package.json "+version);
}
if(existing.length)
 cp.execFileSync(process.execPath,["--test",...existing],{stdio:"inherit",timeout:180000});
const output=process.env.GITHUB_OUTPUT;
if(output)fs.appendFileSync(output,Object.entries(scopes).map(([k,v])=>k+"="+v).join("\n")+"\n");
console.log("CI selective Node smoke PASS");
