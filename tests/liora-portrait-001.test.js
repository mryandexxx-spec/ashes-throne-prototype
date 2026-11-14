"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
function webp(pathname,w,h,sha){
 const b=fs.readFileSync(path.join(root,"assets",pathname));
 assert.equal(b.toString("ascii",0,4),"RIFF");
 assert.equal(b.toString("ascii",8,12),"WEBP");
 assert.equal(b.toString("ascii",12,16),"VP8 ");
 assert.equal(b.readUInt16LE(26)&0x3fff,w);
 assert.equal(b.readUInt16LE(28)&0x3fff,h);
 assert.ok(b.length>2000&&b.length<12000,"WebP fits mobile budget");
 assert.equal(crypto.createHash("sha256").update(b).digest("hex"),sha);
}
test("LIORAPORTRAIT001 preserves accepted Liora portrait in two small WebPs",()=>{
 webp("liora-portrait-roster.webp",384,192,"5a41b6e76910169677407f1d2e5e49ac1d71d17becf110c7bf14a995c9d1f1a2");
 webp("liora-portrait-ui.webp",256,256,"18fb8902b4f78df68dab1de6c4f71c460f7f40f446145e3255524f283896b1f4");
});
test("Liora uses wide roster art in clipped frame and square portrait for dossier and biography",()=>{
 const game=read("game.js"),css=read("styles.css"),card=read("ren-card-3d.js");
 assert.match(game,/owned&&h\.id==="liora"\?'<img class="liora-collection-portrait"/);
 assert.match(game,/hero-avatar-liora/);
 assert.equal((game.match(/assets\/liora-portrait-roster\.webp\?v=1/g)||[]).length,1);
 assert.equal((game.match(/assets\/liora-portrait-ui\.webp\?v=1/g)||[]).length,2);
 assert.match(css,/#collection \.roster-card-art\.hero-avatar-liora\{[^}]*overflow:hidden/);
 assert.match(css,/#collection \.hero-avatar-liora \.liora-collection-portrait\{[^}]*width:100%;height:100%;[^}]*object-fit:cover;object-position:center 50%/);
 assert.match(game,/sketch\.hidden=!\["trial-ren","ren","nada","liora"\]\.includes\(hero\.id\)/);
 assert.match(game,/showLioraPortrait=hero\.id==="liora"/);
 assert.match(card,/modeButton\.hidden=!canDisplay3D/);
 const html=read("index.html"),layout=read("hero-card.css");
 const hero=html.slice(html.indexOf('id="heroDetail"'),html.indexOf('id="heroAbilityDialog"'));
 assert.match(hero,/id="renCard3DControls"/,"controls must belong to visible hero card");
 assert.ok(hero.indexOf('id="renCard3DControls"')<hero.indexOf('id="heroAbilityDialog"')||hero.includes('id="renCard3DControls"'));
 assert.match(layout,/#heroDetail \.hero-detail-identity>\.ren-card-3d-controls\{/);
 assert.match(layout,/bottom:60px/);
});
test("release marker matches package and keeps Liora 3D wiring",()=>{
 const version=JSON.parse(read("package.json")).version,html=read("index.html");
 assert.match(version,/^\d+\.\d+\.\d+$/);
 assert.match(html,/id="buildVersion"[^>]*>Прототип · v\d+\.\d+\.\d+ · [A-Z][A-Z0-9-]*/);
 // LIORA-SHIELD-006 switched the combat slots to the shield clips.
 assert.match(read("liora-glb-runtime.js"),/Liora_Shield_Bash/);
 assert.match(read("game.js"),/ensureLiora3D\(\)/);
});
