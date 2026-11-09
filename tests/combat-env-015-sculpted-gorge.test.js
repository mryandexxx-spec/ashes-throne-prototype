"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const build=require("../tools/env015-sculpt-export.cjs");
const Root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(Root,p),"utf8");
function doc(bytes){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 assert.equal(dv.getUint32(0,true),0x46546c67);
 assert.equal(dv.getUint32(4,true),2);
 assert.equal(dv.getUint32(8,true),bytes.length);
 const n=dv.getUint32(12,true);
 assert.equal(dv.getUint32(16,true),0x4e4f534a);
 return JSON.parse(new TextDecoder().decode(bytes.slice(20,20+n)));
}
test("ENV015 is a reproducible authentic GLB with real closed far-side volume",()=>{
 const a=build(),b=build();
 assert.deepEqual(Buffer.from(a.bytes),Buffer.from(b.bytes));
 assert.ok(a.bytes.length>120000&&a.bytes.length<750000);
 const gltf=doc(a.bytes);
 assert.equal(gltf.asset.version,"2.0");
 assert.equal(gltf.meshes.length,4);
 assert.deepEqual(a.stats.map(m=>m.name),[
   "attached_living_rock","far_opposite_mass","weathered_talus","distant_layered_ridge"]);
 const triangles=a.stats.reduce((total,m)=>total+m.triangles,0);
 assert.ok(triangles>11500&&triangles<=16000,`mobile budget: ${triangles}`);
 const vertices=a.stats.reduce((total,m)=>total+m.vertices,0);
 assert.ok(vertices<10000&&vertices>6000);
 for(const mesh of gltf.meshes){
  const p=mesh.primitives[0];
  assert.equal(p.mode,4);
  for(const key of ["POSITION","NORMAL","COLOR_0","TEXCOORD_0"])
   assert.ok(Number.isInteger(p.attributes[key]),key);
 }
 assert.ok(a.stats[1].vertices>3500,"opposing rock must be a deep front/back volume");
});
test("ENV015 directly matches ENV009 radial ravine end at every one of 97 vertices",()=>{
 const raw=read("tools/env015-sculpt-export.cjs");
 assert.match(raw,/return geo\("attached_living_rock",96,20/);
 assert.match(raw,/const contactChannel=/);
 assert.doesNotMatch(raw,/Math\.random|setInterval|requestAnimationFrame/);
 // Decode first indexed float3 accessor from the generated binary glTF.
 const {bytes}=build(),meta=doc(bytes),accessor=meta.accessors[
  meta.meshes[0].primitives[0].attributes.POSITION
 ],view=meta.bufferViews[accessor.bufferView];
 const jsonLength=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(12,true);
 const begin=20+jsonLength+8+view.byteOffset+(accessor.byteOffset||0);
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 for(let i=0;i<=96;i++){
  const a=i*Math.PI*2/96,r=2.42;
  const rough=1+.045*Math.sin(5*a+.4)+.023*Math.sin(11*a+1.3)+.012*Math.sin(23*a+2.1);
  const fan=1+.065*Math.sin(3*a-.3);
  const x=Math.cos(a)*9.15*r*rough*fan;
  const z=Math.sin(a)*5.85*r*rough;
  const y=-9.9+.75*Math.sin(a*6+.4)+.42*Math.sin(a*13-1.1);
  for(const [k,v] of [[0,x],[1,y],[2,z]])
   assert.ok(Math.abs(dv.getFloat32(begin+(i*3+k)*4,true)-v)<.0005,
    `actual ravine seam mismatch vertex ${i} component ${k}`);
 }
});
test("ENV015 keeps one engine, fixed 3/4 camera and safe optional WebGL baseline",()=>{
 const cv=read("combat-visual-007.js"),game=read("game.js");
 const html=read("index.html"),env=read("combat-environment-015.js");
 const pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.86");
 assert.match(html,/v0\.3\.86 · OPSHELP \+ RENPLAY \+ REN3D003 \+ ENV016/);
 assert.ok(html.indexOf('src="combat-environment-015.js"')<
   html.indexOf('src="combat-visual-007.js"'));
 assert.match(cv,/CombatEnvironment015\.build\(B,scene,owned\)/);
 assert.match(cv,/CombatEnvironment010\.build\(B,scene,owned\)/);
 assert.match(cv,/CombatEnvironment014\.build\(B,scene,owned\)/);
 assert.match(env,/assets\/env010\//);
 assert.match(env,/\.\.\/env015\/gorge-sculpt-v1\.glb/);
 assert.match(env,/fogDensity=\.0051/);
 assert.match(env,/isPickable=false/);
 assert.doesNotMatch(env,/runRenderLoop\(|setInterval\(|requestAnimationFrame\(/);
 assert.equal((game.match(/new BABYLON.Engine\(/g)||[]).length,1);
 assert.match(game,/arenaCamera\.lowerRadiusLimit=12;arenaCamera\.upperRadiusLimit=21/);
});
