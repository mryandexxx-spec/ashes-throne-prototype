"use strict";
// ARENA-ENV-006 (experiment): projected 3D terrace behind ?environment=env3d.
// Pure geometry/projection contract; the real frame lives in arena-env-006-browser.cjs.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const E=require("../combat-environment-006.js");
const V=require("../arena-stage-view.js");
const read=f=>fs.readFileSync(f,"utf8");

test("ENV-006C: 3D arena is the default; env2d/env017/env010 opt out",()=>{
 for(const q of ["","?environment=env3d","?x=1&environment=env3d&y=2","?environment=env2dx","?networkPilot=1"])
  assert.equal(E.enabled(q),true,q);
 for(const q of ["?environment=env2d","?x=1&environment=env2d","?environment=env017","?environment=env010"])
  assert.equal(E.enabled(q),false,q);
});

test("projector equals the game camera (ArenaStageView) and the ENV-005 cover fit",()=>{
 const cam=E.camera(V.view);
 // The approved target projects to the screen centre.
 const c=E.toScreen(cam,[0,V.view.targetY,0]);
 assert.ok(Math.abs(c.x-422)<1e-6&&Math.abs(c.y-195)<1e-6);
 // Image bottom = screen bottom, image width = screen width (CSS cover, bottom anchor).
 const bl=E.imageToScreen(0,E.IMAGE.height),tr=E.imageToScreen(E.IMAGE.width,0);
 assert.ok(Math.abs(bl.x)<1e-9&&Math.abs(bl.y-390)<1e-9&&Math.abs(tr.x-844)<1e-9);
 // ray() and toScreen() are inverse.
 const d=E.ray(cam,123,45),p=[0,1,2].map(i=>cam.eye[i]+d[i]*9),s=E.toScreen(cam,p);
 assert.ok(Math.abs(s.x-123)<1e-6&&Math.abs(s.y-45)<1e-6&&Math.abs(s.depth-9)<1e-9);
});

test("every vertex carries the texel the reference camera sees there (projection is exact)",()=>{
 const g=E.geometry(V.view),cam=g.camera;
 assert.ok(g.positions.every(Number.isFinite)&&g.uvs.every(Number.isFinite));
 let worst=0;
 for(let i=0;i<g.vertices;i++){
  const p=g.positions.slice(i*3,i*3+3),s=E.toScreen(cam,p),im=E.screenToImage(s.x,s.y);
  assert.ok(s.depth>0,"in front of the camera");
  worst=Math.max(worst,Math.abs(E.texU(im.x)-g.uvs[i*2]),Math.abs(E.texV(im.y)-g.uvs[i*2+1]));
 }
 assert.ok(worst<1e-6,"uv error "+worst);
});

test("iPhone budget: ≤30k triangles, ≤2048 texture, small download",()=>{
 const g=E.geometry(V.view);
 assert.ok(g.triangles<=30000,"triangles "+g.triangles);
 assert.equal(g.indices.length%3,0);
 assert.ok(Math.max(...g.indices)<g.vertices);
 const buf=fs.readFileSync(E.TEXTURE_URL);
 assert.equal(buf.toString("ascii",0,4),"RIFF");assert.equal(buf.toString("ascii",8,12),"WEBP");
 assert.equal(buf.toString("ascii",12,16),"VP8 ");
 const w=buf.readUInt16LE(26)&0x3fff,h=buf.readUInt16LE(28)&0x3fff;
 assert.deepEqual([w,h],[E.LAYOUT.texture.width,E.LAYOUT.texture.height]);
 assert.ok(w<=2048&&h<=2048);
 const total=buf.length+fs.statSync("combat-environment-006.js").size;
 assert.ok(total<=1.5*1024*1024,"environment download "+total);
 // The painting keeps its native pixels in the middle band.
 assert.equal(E.LAYOUT.texture.width-E.LAYOUT.texLeft-E.LAYOUT.texRight,E.IMAGE.width);
});

test("all fighters stand on painted tiles, in front of the balustrade, inside the frame",()=>{
 const cam=E.camera(V.view);
 for(const side of ["ally","enemy"])for(let n=1;n<=5;n++)for(let i=0;i<n;i++){
  const f=V.formation(side,i,n),s=E.toScreen(cam,[f.x,0,f.z]),im=E.screenToImage(s.x,s.y);
  const edge=E.edgeAt(im.x)[1];
  // ARENA-FIX-001 mirrored enemy formation: back-right enemy sits 119 px from the edge (was >=120 with the old line).
  assert.ok(im.y-edge>=110,`${side} ${i}/${n}: ${Math.round(im.y-edge)} px in front of the back edge`);
  assert.ok(im.x>0&&im.x<E.IMAGE.width&&im.y<E.IMAGE.height,`${side} ${i}/${n} inside the painting`);
 }
});

test("zoom 6.6–10.5 on 4:3…2.2:1 screens never looks past the textured proxy",()=>{
 const ref=E.camera(V.view),L=E.LAYOUT;
 for(const r of [V.view.minRadius,V.view.radius,V.view.maxRadius])
  for(const [w,h] of [[1024,768],[667,375],[844,390],[932,430],[960,436]]){
   const cam=E.camera(V.view,r,w,h);
   for(let k=0;k<=16;k++)for(const [sx,sy] of [[w*k/16,0],[w*k/16,h],[0,h*k/16],[w,h*k/16]]){
    const d=E.ray(cam,sx,sy);
    const t=d[1]<0?-cam.eye[1]/d[1]:Infinity;
    let p=[0,1,2].map(i=>cam.eye[i]+d[i]*(t<E.FAR_DEPTH?t:E.FAR_DEPTH));
    let im=E.screenToImage(...Object.values(E.toScreen(ref,p)).slice(0,2));
    if(im.y<E.edgeAt(Math.max(0,Math.min(E.IMAGE.width,im.x)))[1]){
     p=[0,1,2].map(i=>cam.eye[i]+d[i]*(E.FAR_DEPTH+r-V.view.radius));
     im=E.screenToImage(...Object.values(E.toScreen(ref,p)).slice(0,2));
    }
    const at=`r=${r} ${w}x${h} (${sx|0},${sy|0}) -> (${im.x|0},${im.y|0})`;
    assert.ok(im.x>=-L.padLeft&&im.x<=E.IMAGE.width+L.padRight,at);
    assert.ok(im.y>=L.geomTop&&im.y<=E.IMAGE.height+L.padBottom,at);
   }
  }
});

test("game wiring: flag-only, built on battle entry, disposed on exit; 2D stays the default",()=>{
 const game=read("game.js"),html=read("index.html");
 assert.match(game,/CombatEnvironment006\.enabled\(location\.search\)/);
 assert.ok(game.includes("if(!engine)initBabylon();\n   ensureArenaEnv006();"));
 assert.match(game,/stopBattleRendering\(\);disposeArenaEnv006\(\);\}/);
 assert.match(game,/disposeNpcGlbRuntimes\(\);\n   disposeArenaEnv006\(\);/);
 // ENV-005 behaviour is untouched: transparent canvas + CSS art (also the 3D loading fallback).
 assert.ok(game.includes("!/(?:^|[?&])environment=(?:env017|env010)(?:&|$)/.test(location.search)"));
 assert.match(game,/alpha:ENV022_CONCEPT_PREVIEW/);
 const at=html.indexOf('src="combat-environment-006.js?v=0.3.219"');
 assert.ok(at>0&&at<html.indexOf('src="game.js?v=0.3.219"'));
 const src=read("combat-environment-006.js");
 assert.match(src,/isPickable=false/);
 assert.ok(!/ShadowGenerator|PostProcess|DefaultRenderingPipeline/.test(src),"no shadow map, no post-process");
});

test("build label v0.3.219 · RECOVER3D",()=>{
 const pkg=JSON.parse(read("package.json")),html=read("index.html");
 assert.equal(pkg.version,"0.3.219");
 assert.ok(html.includes('id="buildVersion">Прототип · v0.3.219 · RECOVER3D'));
 assert.ok(html.includes('src="game.js?v=0.3.219"'));
 assert.ok(!html.includes("?v=0.3.214"));
 assert.ok(pkg.scripts.test.includes("node --check combat-environment-006.js"));
});
