"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const html=read("index.html"),css=read("styles.css"),game=read("game.js");
const pkg=JSON.parse(read("package.json"));
assert.equal(pkg.version,"0.3.68");
assert.match(html,/v0\.3\.68 · CHAL002/);
const dossier=html.split('<section id="heroDetail"')[1]?.split('<section id="campaign"')[0];
assert.ok(dossier,"dossier section");
const left=dossier.indexOf('class="hero-abilities-panel"');
const center=dossier.indexOf('class="hero-detail-panel hero-detail-identity"');
const right=dossier.indexOf('class="hero-detail-panel hero-detail-progression"');
assert.ok(left>=0&&center>left&&right>center,"abilities -> schematic hero and gear -> progression");
const elementIds=[
 "heroAbilityList","detailGlyph","detailStats","detailName","detailRole",
 "detailHeroLevelCap","detailLevel","detailWallet","detailCost","detailPreview",
 "detailUpgrade","detailNotice","gearTier","gearSlots","gearMaterial",
 "gearWallet","gearPrice","gearStatBonus","gearEquipNext","gearNotice",
 "progressSaveNote","detailBack","detailHome"
];
for(const id of elementIds){
 const matches=dossier.match(new RegExp('id="'+id+'"',"g"))||[];
 assert.equal(matches.length,1,id+" must be preserved exactly once");
}
assert.ok(dossier.indexOf('id="gearSlots"')>center);
assert.ok(dossier.indexOf('id="gearSlots"')<right);
assert.ok(dossier.indexOf('id="detailStats"')>right);
for(const cls of ["hero-detail-stage","hero-detail-silhouette","hero-detail-stage-emblem",
 "hero-detail-stage-platform","hero-detail-reference"]){
 assert.ok(dossier.includes(cls),cls);
 assert.ok(css.includes("."+cls),cls+" styles");
}
assert.match(css,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1\.12fr\) minmax\(0,1fr\)/);
assert.match(css,/@media\(orientation:landscape\)/);
assert.match(css,/@media\(max-width:650px\) and \(orientation:portrait\)/);
assert.ok(game.includes('document.createElement("details")'),"tap-to-expand ability description");
assert.ok(game.includes('document.createElement("summary")'));
for(const handler of [
 'id="gearEquipNext"','id="detailUpgrade"','id="gearSlots"'
])assert.ok(dossier.includes(handler));
assert.ok(game.includes('$("#gearEquipNext")?.addEventListener("click"'));
assert.ok(game.includes('$("#detailUpgrade").addEventListener("click"'));
assert.ok(game.includes('$("#gearSlots")?.addEventListener("click"'));
console.log("HERO001: three-column dossier structure, unchanged IDs and live controls validated");
