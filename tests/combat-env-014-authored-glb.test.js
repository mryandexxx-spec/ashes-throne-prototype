"use strict";
/* ENV014 authored asset validation. No Babylon mock is a screenshot. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const exportGlb=require("../tools/env014-gorge-export.cjs");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
function gltf(bytes){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 assert.equal(dv.getUint32(0,true),0x46546c67);
 assert.equal(dv.getUint32(4,true),2);
 assert.equal(dv.getUint32(8,true),bytes.length);
 const jsonLen=dv.getUint32(12,true);
 assert.equal(dv.getUint32(16,true),0x4e4f534a);
 const data=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+jsonLen)));
 return data;
}
test("ENV014 exports genuine, hand-contoured, 3D solid-depth glTF 2.0 GLB",()=>{
 const {bytes,stats,json}=exportGlb(),doc=gltf(bytes);
 assert.deepEqual(doc, json);
 assert.equal(doc.asset.version,"2.0");
 assert.equal(doc.meshes.length,4);
 assert.deepEqual(stats.map(x=>x.name),[
  "front_buttress","middle_terraces","gorge_floor","pale_horizon"]);
 assert.ok(bytes.length>65000&&bytes.length<750000);
 const triangles=stats.reduce((n,x)=>n+x.triangles,0);
 assert.ok(triangles>9500&&triangles<16000);
 const vertices=stats.reduce((n,x)=>n+x.vertices,0);
 assert.ok(vertices>5000&&vertices<10000);
 for(const m of doc.meshes){
  const p=m.primitives[0];
  assert.equal(p.mode,4);
  assert.ok(Number.isInteger(p.attributes.POSITION));
  assert.ok(Number.isInteger(p.attributes.NORMAL));
  assert.ok(Number.isInteger(p.attributes.COLOR_0));
  assert.ok(Number.isInteger(p.attributes.TEXCOORD_0));
 }
 const first=doc.accessors[doc.meshes[0].primitives[0].attributes.POSITION];
 assert.ok(first.max[0]-first.min[0]>10);
 assert.ok(first.max[1]-first.min[1]>65);
 assert.ok(first.max[2]-first.min[2]>10);
});
test("export is byte-identical between runs; original sculpture is a local offline asset",()=>{
 const a=exportGlb(),b=exportGlb();
 assert.deepEqual(Buffer.from(a.bytes),Buffer.from(b.bytes));
 const source=read("tools/env014-gorge-export.cjs");
 assert.match(source,/const RIGHT_BANK=/);
 assert.match(source,/const OPPOSITE_WALL=/);
 assert.match(source,/const LEFT_BANK=/);
 assert.match(source,/const FAR_HORIZON=/);
 assert.doesNotMatch(source,/Math\.random|fetch\(|axios|http:\/\//);
});
test("ENV014 preserves CV007 and real game lifecycle with direct ENV010 baseline",()=>{
 const game=read("game.js"),cv=read("combat-visual-007.js");
 const html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.84");
 assert.match(html,/v0\.3\.84 · OPSHELP \+ RENPLAY \+ REN3D003 \+ ENV014/);
 assert.ok(html.indexOf('src="combat-environment-014.js"')<
  html.indexOf('src="combat-visual-007.js"'));
 assert.match(cv,/new URLSearchParams\(location\.search\)\.get\("arena"\)==="env010"/);
 assert.match(cv,/CombatEnvironment014\.build\(B,scene,owned\)/);
 assert.match(cv,/CombatEnvironment010\.build\(B,scene,owned\)/);
 assert.equal((game.match(/new BABYLON.Engine\(/g)||[]).length,1);
 assert.match(game,/arenaCamera\.lowerRadiusLimit=12;arenaCamera\.upperRadiusLimit=21/);
 const env=read("combat-environment-014.js");
 assert.match(env,/\.\.\/env014\/gorge-sculpt-v1\.glb/);
 assert.match(env,/env014Rock/);
 assert.match(env,/env009_living_ledge/);
 assert.doesNotMatch(env,/runRenderLoop\(|setInterval\(/);
});

test("ENV014B hand-set contours recede rather than putting high rock behind fighters",()=>{
 const src=read("tools/env014-gorge-export.cjs");
 assert.match(src,/\[-26,139,-98,0\]/);
 assert.match(src,/\[44,153,-76,2\.1\]/);
 assert.match(src,/\[-146,119,-111,0\]/);
 assert.match(src,/\[-110,235,-164,0\]/);
 const render=read("combat-environment-014.js");
 assert.match(render,/m\.fogEnabled=true/);
 assert.match(render,/scene\.fogDensity=\.006/);
 assert.match(render,/\["front_buttress"\]/);
 const {stats}=exportGlb();
 assert.ok(stats.reduce((n,m)=>n+m.triangles,0)<16000);
});
