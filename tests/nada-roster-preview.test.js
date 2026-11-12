/* NADAART001: no accidental migration of trial Nada or unapproved combat skills. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const profiles=require("../hero-profile-data.js");
const trial=require("../story-trial-data.js");
const collection=require("../hero-collection-core.js");
const stars=require("../star-core.js");

test("approved Nada profile is present and not trial-Nada",()=>{
 const nada=profiles.get("nada");
 assert.equal(nada?.name,"Нада");
 assert.match(nada.biography,/документ/);
 assert.match(nada.note,/не утверждены/);
 assert.ok(trial.profiles.some(hero=>hero.id==="trial-nada"));
 assert.equal(collection.IDS.includes("nada"),false);
 assert.equal(stars.IDS.includes("nada"),false);
});
test("Nada preview is visible only in roster all/locked, separate from saved playable party",()=>{
 const code=root("game.js");
 const rosterStart=code.indexOf("function renderHeroes()");
 const rosterEnd=code.indexOf('document.querySelectorAll("[data-roster-filter]")',rosterStart);
 assert.ok(rosterStart>0&&rosterEnd>rosterStart);
 const render=code.slice(rosterStart,rosterEnd);
 assert.match(render,/showNadaPreview=rosterFilter!=="owned"/);
 assert.match(render,/data-preview-nada/);
 assert.match(render,/nada-portrait-ui\.webp/);
 assert.match(render,/showHeroBiography\(\{id:"nada",name:"Нада"\}\)/);
 const heroDefs=code.slice(0,code.indexOf("const $="));
 assert.doesNotMatch(heroDefs,/id:"nada"/);
 assert.equal(fs.existsSync(path.join(__dirname,"..","assets","nada-portrait-ui.webp")),true);
});
test("portrait biography remains a reusable modal without breaking Ren",()=>{
 const code=root("game.js");
 assert.match(code,/hero\.id==="nada"\?"assets\/nada-portrait-ui\.webp"/);
 assert.match(code,/hero\.id==="ren"\|\|hero\.id==="trial-ren"/);
 assert.equal(profiles.get("ren")?.name,"Рен Терен");
 const html=root("index.html"),pkg=JSON.parse(root("package.json"));
 assert.equal(pkg.version,"0.3.124");
 assert.match(html,/v0\.3\.124 · UIHUD001/);
 assert.match(html,/RENBYTES002 \+ NADAART001/);
});
