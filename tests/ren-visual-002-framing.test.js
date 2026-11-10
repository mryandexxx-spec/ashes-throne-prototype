"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const css=read("styles.css");
const renCSS=css.split("/* REN-VISUAL-002:")[1];
test("REN-VISUAL-002: collection portrait retains its 4:5 shape in a taller frame",()=>{
 assert.ok(renCSS,"framing rules exist");
 assert.match(renCSS,/\.hero-avatar\.hero-avatar-ren\s*\{[^}]*height:clamp\(136px,16vw,180px\)/);
 assert.match(renCSS,/\.hero-avatar\.hero-avatar-ren::after\s*\{[^}]*content:"САДЫ НАД ПРОПАСТЬЮ"/);
 assert.match(renCSS,/@media\(max-width:700px\)\{\.hero-avatar\.hero-avatar-ren\{justify-content:center;padding-left:0\}/);
 assert.match(renCSS,/\.hero-avatar-ren \.ren-collection-portrait\s*\{[^}]*width:auto;max-width:100%;height:100%;[^}]*object-fit:contain/);
 assert.match(renCSS,/@media\(orientation:landscape\) and \(max-height:540px\) and \(max-width:1100px\)\s*\{\s*\.hero-avatar\.hero-avatar-ren\{height:104px\}/);
 assert.match(renCSS,/@media\(orientation:landscape\) and \(max-height:390px\) and \(max-width:1100px\)\s*\{\s*\.hero-avatar\.hero-avatar-ren\{height:90px\}/);
});
test("REN-VISUAL-002: detailed hero portrait is centered and never cropped by cover",()=>{
 assert.match(renCSS,/\.hero-detail-stage \.ren-detail-portrait\s*\{[^}]*left:50%;[^}]*transform:translateX\(-50%\);[^}]*width:auto;max-width:100%;height:100%;[^}]*object-fit:contain/);
 assert.doesNotMatch(renCSS,/\.ren-(?:collection|detail)-portrait\s*\{[^}]*object-fit:cover/);
 assert.match(renCSS,/\.ren-detail-portrait\[hidden\]\{display:none!important\}/);
 assert.match(renCSS,/\.hero-detail-stage\.has-ren-portrait \.hero-detail-silhouette/);
 assert.match(css,/\.ren-biography-sketch\{[^}]*object-fit:contain/,"existing biography framing unchanged");
});
test("REN-VISUAL-002: only Ren has collection portrait, build bumped and source preserved",()=>{
 const game=read("game.js"),html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.match(game,/owned&&h\.id==="ren"\?'<img class="ren-collection-portrait"/);
 assert.match(game,/const showRenPortrait=hero\.id==="ren"/);
 assert.match(html,/id="detailRenPortrait"[^>]*hidden>/);
 assert.equal(pkg.version,"0.3.85");
 assert.match(html,/v0\.3\.85 · ROSTER001 \+ OPSHELP \+ RENPLAY \+ REN3D003/);
 assert.ok(fs.existsSync(path.join(__dirname,"..","assets","ren-portrait-ui.webp")));
});
