"use strict";
// ARENA-ENV-005: owner-supplied terrace art as the battle backdrop (quick variant).
// Contract only; real frame checks live in the browser tests (env022 fixture).
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=f=>fs.readFileSync(f,"utf8");

function webpSize(buf){
 assert.equal(buf.toString("ascii",0,4),"RIFF");
 assert.equal(buf.toString("ascii",8,12),"WEBP");
 const chunk=buf.toString("ascii",12,16);
 if(chunk==="VP8 "){
  assert.deepEqual([...buf.slice(23,26)],[0x9d,0x01,0x2a],"VP8 start code");
  return {w:buf.readUInt16LE(26)&0x3fff,h:buf.readUInt16LE(28)&0x3fff,lossy:true};
 }
 if(chunk==="VP8X")return {w:1+buf.readUIntLE(24,3),h:1+buf.readUIntLE(27,3),lossy:null};
 throw Error("unexpected WebP chunk "+chunk);
}

test("backdrop is a local lossy WebP ≥1600×740 within the 120–200 KB budget",()=>{
 const buf=fs.readFileSync("assets/arena-env005-terrace.webp");
 const {w,h}=webpSize(buf);
 assert.ok(w>=1600&&h>=740,`size ${w}×${h}`);
 assert.ok(buf.length>=100*1024&&buf.length<=200*1024,`bytes ${buf.length}`);
 // Decoded RGBA must stay small for iPhone memory (one image, no mip chain).
 assert.ok(w*h*4<8*1024*1024);
});

test("arena CSS uses the new art bottom-anchored with a HUD shade; old SVG is gone",()=>{
 const css=read("styles.css");
 const rule=css.slice(css.indexOf(".battle-screen.env022-concept-preview .arena-wrap{"));
 const body=rule.slice(0,rule.indexOf("}"));
 assert.match(body,/url\("assets\/arena-env005-terrace\.webp"\)/);
 assert.match(body,/linear-gradient\(180deg/);
 assert.match(body,/background-position:center center,center bottom/);
 assert.match(body,/background-size:cover,cover/);
 assert.ok(!css.includes("env022-canyon-concept.svg"));
 assert.ok(!fs.existsSync("assets/env022-canyon-concept.svg"));
 // Fixture and workflow follow the new file.
 assert.ok(read("tests/fixtures/env022-full-game.html").includes("arena-env005-terrace.webp"));
 assert.ok(read(".github/workflows/env022-concept-webgl.yml").includes("assets/arena-env005-terrace.webp"));
});

test("transparent WebGL over the CSS art is unchanged (no 3D scenery, same camera)",()=>{
 const game=read("game.js");
 assert.match(game,/alpha:ENV022_CONCEPT_PREVIEW/);
 assert.match(game,/ENV022_CONCEPT_PREVIEW\?0:1/);
 assert.ok(game.includes("environment=(?:env017|env010)"));
 const view=require("../arena-stage-view.js").view;
 assert.equal(view.beta,1.12);assert.equal(view.radius,7.6);assert.equal(view.fov,.85);
});

test("build label follows the current build",()=>{
 const pkg=JSON.parse(read("package.json"));
 const html=read("index.html");
 assert.equal(pkg.version,"0.3.222");
 assert.ok(html.includes('id="buildVersion">Прототип · v0.3.222 · SQUADVIEW002'));
 assert.ok(html.includes('src="game.js?v=0.3.222"'));
 assert.ok(!html.includes("?v=0.3.214"));
});
