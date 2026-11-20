"use strict";
// ARENA-ENV-006B (experiment): background animation of the projected 3D terrace.
// Masks/zones/amplitudes, reduced motion, the per-frame tick (no allocations), wiring.
// The rendered frames (zones move, fighters do not) live in arena-env-006-browser.cjs.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const v8=require("node:v8"),vm=require("node:vm");
const E=require("../combat-environment-006.js");
const V=require("../arena-stage-view.js");
const read=f=>fs.readFileSync(f,"utf8");
const scale=Math.max(E.REF.width/E.IMAGE.width,E.REF.height/E.IMAGE.height); // painting px -> screen px

// Painting-space box of every fighter (1–5 per side): feet to head, ±0.45 world units wide.
function fighterBoxes(){
 const cam=E.camera(V.view),out=[];
 for(const side of ["ally","enemy"])for(let n=1;n<=5;n++)for(let i=0;i<n;i++){
  const f=V.formation(side,i,n);
  const pts=[[f.x-.45,0,f.z],[f.x+.45,0,f.z],[f.x-.45,2.1,f.z],[f.x+.45,2.1,f.z]]
   .map(p=>{const s=E.toScreen(cam,p);return E.screenToImage(s.x,s.y);});
  out.push({side,i,n,x0:Math.min(...pts.map(p=>p.x)),x1:Math.max(...pts.map(p=>p.x)),
   y0:Math.min(...pts.map(p=>p.y)),y1:Math.max(...pts.map(p=>p.y))});
 }
 return out;
}
const ellipseBox=([cx,cy,rx,ry])=>({x0:cx-rx,x1:cx+rx,y0:cy-ry,y1:cy+ry});
const GAP=8; // painting px (≈4 screen px)
const overlap=(a,b)=>a.x0-GAP<b.x1&&b.x0-GAP<a.x1&&a.y0-GAP<b.y1&&b.y0-GAP<a.y1;

test("mist and flower motion never reaches a fighter (1–5 per side, head to feet)",()=>{
 const zones=[ellipseBox(E.ZONES.mist.ellipse),...E.ZONES.flowers.map(ellipseBox)];
 for(const f of fighterBoxes())for(const z of zones)
  assert.ok(!overlap(f,z),`${f.side} ${f.i}/${f.n} overlaps a motion zone`);
 // The split keeps the two uses of the B channel apart.
 const mist=ellipseBox(E.ZONES.mist.ellipse);
 assert.ok(mist.y1<=E.MOTION_SPLIT_Y);
 for(const z of E.ZONES.flowers.map(ellipseBox))assert.ok(z.y0>=E.MOTION_SPLIT_Y-40);
});

test("leaf shade lies on the floor only: zone starts below the terrace back edge",()=>{
 const [cx,,rx]=E.ZONES.leaf.ellipse;
 for(let x=Math.max(0,cx-rx);x<=Math.min(E.IMAGE.width,cx+rx);x+=8)
  assert.ok(E.ZONES.leaf.minY>=E.edgeAt(x)[1],`x=${x}: leaf zone above the back edge`);
});

test("amplitudes are soft on the 844x390 reference screen",()=>{
 const A=E.ANIM;
 assert.ok(A.leafAmplitude*scale<=7,"leaf shade offset ≤7 screen px (ENV-006C)");
 assert.ok(A.flowerAmplitude*scale<=3,"flower sway ≤3 screen px");
 assert.ok(A.mistSweep*scale<=18&&A.mistSpeed<=.15,"mist drifts ≤18 px per ≥6.7 s");
 assert.ok(A.mistWisps<=.12,"wisps ≤ ±12% brightness");
 assert.ok(A.leafRatio[0]>=.4&&A.leafRatio[1]<=2.5,"relight ratio clamped");
 assert.ok(A.maxStepMs<=100);
});

test("mask file: lossless WebP 1024x512, small, layout shared with the projection texture",()=>{
 const buf=fs.readFileSync(E.ANIM_MASK_URL);
 assert.ok(buf.length<=80*1024,"mask "+buf.length+" B");
 assert.equal(buf.toString("ascii",0,4),"RIFF");assert.equal(buf.toString("ascii",8,12),"WEBP");
 assert.equal(buf.toString("ascii",12,16),"VP8L","lossless (no chroma subsampling across mask channels)");
 const bits=buf.readUInt32LE(21);
 assert.equal((bits&0x3fff)+1,E.ANIM_MASK.width);assert.equal(((bits>>14)&0x3fff)+1,E.ANIM_MASK.height);
 assert.equal(E.ANIM_MASK.width*2,E.LAYOUT.texture.width);assert.equal(E.ANIM_MASK.height*2,E.LAYOUT.texture.height);
 const tool=read("tools/build-arena-env006b-anim-mask.py");
 assert.match(tool,/E\.ZONES/);assert.match(tool,/lossless=True/);
});

test("download budget with animation ≤ 1.5 MB, textures ≤ 2048",()=>{
 const bytes=fs.statSync(E.TEXTURE_URL).size+fs.statSync(E.ANIM_MASK_URL).size+fs.statSync("combat-environment-006.js").size;
 assert.ok(bytes<=1.5*1024*1024,bytes);
 assert.ok(E.ANIM_MASK.width<=2048&&E.ANIM_MASK.height<=2048);
});

test("one shader pass: no discard, bounded texture reads, uniforms declared",()=>{
 assert.ok(!/discard/.test(E.FRAGMENT));
 assert.ok((E.FRAGMENT.match(/texture2D\(/g)||[]).length<=7);
 for(const u of ["uTime","uOn","art","anim"])assert.match(E.FRAGMENT,new RegExp("uniform \\w+ "+u+";"));
});

// Minimal Babylon stand-in: enough for create()/tick()/dispose().
function fakeBabylon(log){
 class Res{constructor(name){this.name=name;log.created.push(this);}dispose(){log.disposed.push(this);}}
 class Texture extends Res{constructor(url,scene,a,b,mode,onLoad){super(url);this.url=url;log.textures.push(url);if(onLoad)onLoad();}}
 Texture.TRILINEAR_SAMPLINGMODE=3;Texture.BILINEAR_SAMPLINGMODE=2;Texture.CLAMP_ADDRESSMODE=0;
 class Mesh extends Res{setEnabled(v){this.enabled=v;}freezeWorldMatrix(){}}
 class VertexData{applyToMesh(){}static ComputeNormals(){}}
 class StandardMaterial extends Res{}
 class ShaderMaterial extends Res{constructor(name,scene,src,opt){super(name);this.src=src;this.opt=opt;this.floats={};this.tex={};}
  setFloat(k,v){this.floats[k]=v;return this;}setTexture(k,t){this.tex[k]=t;return this;}}
 class Color3{constructor(r,g,b){this.r=r;this.g=g;this.b=b;}}
 class ImageProcessingConfiguration{}
 return {Mesh,VertexData,StandardMaterial,ShaderMaterial,Texture,Color3,ImageProcessingConfiguration};
}
const newLog=()=>({created:[],disposed:[],textures:[]});

test("animated path: shader material, mask texture, clock only from tick(dt), full dispose",()=>{
 const log=newLog(),B=fakeBabylon(log);
 const env=E.create(B,{},{view:V.view});
 const mat=log.created.find(r=>r instanceof B.ShaderMaterial);
 assert.ok(mat,"ShaderMaterial");assert.equal(mat.name,"env006_mat");
 assert.deepEqual(log.textures,[E.TEXTURE_URL,E.ANIM_MASK_URL]);
 assert.equal(env.animation(),"running");assert.equal(mat.floats.uOn,1);assert.equal(env.stats.textures,2);
 env.tick(16);env.tick(16);assert.ok(Math.abs(env.clock()-.032)<1e-9);
 env.tick(5000);assert.ok(Math.abs(env.clock()-.132)<1e-9,"a stalled frame advances ≤100 ms");
 env.tick(-5);env.tick(NaN);assert.ok(Math.abs(env.clock()-.132)<1e-9);
 assert.equal(mat.floats.uTime,env.clock());
 env.setClock(2);assert.equal(mat.floats.uTime,2);
 env.dispose();
 assert.equal(log.disposed.length,log.created.length,"every resource disposed");
 env.tick(16);assert.equal(env.clock(),2,"no ticking after dispose");
});

test("prefers-reduced-motion: static ENV-006 material, no mask, tick is a no-op",()=>{
 const log=newLog(),B=fakeBabylon(log);
 const env=E.create(B,{},{view:V.view,reducedMotion:true});
 assert.ok(!log.created.some(r=>r instanceof B.ShaderMaterial));
 assert.ok(log.created.some(r=>r instanceof B.StandardMaterial&&r.name==="env006_mat"));
 assert.deepEqual(log.textures,[E.TEXTURE_URL],"mask not even downloaded");
 assert.equal(env.animation(),"reduced");assert.equal(env.stats.textures,1);
 env.tick(16);env.setClock(5);assert.equal(env.clock(),0);
 env.dispose();assert.equal(log.disposed.length,log.created.length);
});

test("tick allocates nothing per frame",()=>{
 const log=newLog(),B=fakeBabylon(log),env=E.create(B,{},{view:V.view});
 const src=E.create.toString(),body=src.slice(src.indexOf("function tick("),src.indexOf("function setClock("));
 assert.ok(!/new |\[|\{[^}]*:|=>|\.\.\./.test(body.slice(body.indexOf("{")+1)),"tick body: no new/arrays/objects/closures");
 v8.setFlagsFromString("--expose-gc");const gc=vm.runInNewContext("gc");
 for(let i=0;i<2e4;i++)env.tick(16);
 gc();const before=process.memoryUsage().heapUsed;
 for(let i=0;i<5e5;i++)env.tick(16);
 gc();const grown=process.memoryUsage().heapUsed-before;
 assert.ok(grown<256*1024,"heap grew "+grown+" B over 500k ticks");
 env.dispose();
});

test("game wiring: clock from renderBattleFrame after the fighters' tick, reduced motion passed",()=>{
 const game=read("game.js");
 assert.match(game,/BattleAnimation\.tick\(animationDt,BattleSpeed\.multiplier\(\)\);\n[^\n]*\n arenaEnv006\?\.tick\(dt\);/);
 assert.match(game,/CombatEnvironment006\.create\(BABYLON,scene,\{reducedMotion:/);
 const src=read("combat-environment-006.js");
 assert.ok(!/setInterval|setTimeout|requestAnimationFrame|runRenderLoop|performance\.now|Date\.now/.test(src),"no own loop or timers");
 assert.ok(!/ShadowGenerator|PostProcess|DefaultRenderingPipeline|ParticleSystem/.test(src));
});
