/* NADAPLAY001: stable playable identity, portrait, battle pilot and trial separation. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const profiles=require("../hero-profile-data.js");
const trial=require("../story-trial-data.js");
const collection=require("../hero-collection-core.js");
const stars=require("../star-core.js");
const skills=require("../skill-core.js");
const vm=require("node:vm");
const abilities=vm.runInNewContext(root("skill-core.js")+"\n"+root("ability-data.js")+"\nAbilityData");

test("permanent Nada is a separate playable hero, not the story fixture",()=>{
 const nada=profiles.get("nada");
 assert.equal(nada?.name,"Нада");
 assert.match(nada.biography,/документ/);
 assert.ok(trial.profiles.some(hero=>hero.id==="trial-nada"));
 assert.ok(collection.IDS.includes("nada")&&collection.START.includes("nada"));
 assert.ok(stars.IDS.includes("nada")&&stars.START.includes("nada"));
 assert.ok(skills.HERO_IDS.includes("nada"));
 assert.equal(trial.profiles.some(hero=>hero.id==="nada"),false);
 const game=root("game.js"),defs=game.slice(0,game.indexOf("const $="));
 assert.match(defs,/id:"nada",name:"Нада",classId:"support"/);
 assert.doesNotMatch(root("story-trial-data.js"),/id:"nada",/);
});
test("approved artwork is now a real owned roster card and 2D hero dossier",()=>{
 const game=root("game.js");
 const roster=game.slice(game.indexOf("function renderHeroes()"),
  game.indexOf('document.querySelectorAll("[data-roster-filter]").forEach(button=>button.addEventListener'));
 assert.doesNotMatch(roster,/showNadaPreview|data-preview-nada/);
 assert.match(roster,/h\.id==="nada"/);
 assert.match(roster,/nada-collection-portrait/);
 assert.match(game,/showNadaPortrait=hero\.id==="nada"/);
 assert.match(game,/renPortrait\.src=showNadaPortrait\?"assets\/nada-portrait-ui\.webp\?v=2"/);
 assert.match(root("ren-card-3d.js"),/portrait\.hidden=heroId!=="nada"/);
 assert.equal(fs.existsSync(path.join(__dirname,"..","assets","nada-portrait-ui.webp")),true);
 assert.equal(profiles.get("ren")?.name,"Рен Терен");
});
test("temporary physical support abilities are distinct and can level",()=>{
 const actor={id:"nada",combatProfile:"stats002c",skillLevels:{basic:3,special:1,powerful:1}};
 assert.equal(abilities.get(actor,"basic").name,"Прицельный выстрел");
 assert.equal(abilities.get(actor,"basic").damageType,"physical");
 assert.equal(abilities.get(actor,"basic").multiplier,1.2);
 assert.equal(abilities.get(actor,"special").name,"Найти слабость");
 assert.equal(abilities.get(actor,"special").weakening,2);
 assert.equal(abilities.get(actor,"powerful").name,"Уязвимое место");
 assert.equal(abilities.get(actor,"passive").name,"Внимание к деталям");
 assert.equal(abilities.get(actor,"leader"),null);
 assert.notEqual(abilities.get(actor,"special").name,
  abilities.get({id:"trial-nada"},"special").name);
});
test("new build still preserves the original UIHUD version prefix",()=>{
 const html=root("index.html"),pkg=JSON.parse(root("package.json"));
 assert.equal(pkg.version,"0.3.139");
 assert.match(html,/v0\.3\.139 · LIORAPLAY001/);
 assert.match(root("docs/BUILD_HISTORY.md"),/NADAART001 \+ NADAPLAY001 \+ NADAPORTRAIT002 \+ NADAROSTER001/);
});
