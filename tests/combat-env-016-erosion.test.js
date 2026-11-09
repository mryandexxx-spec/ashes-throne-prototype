"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const make=require("../tools/env016-erosion-export.cjs");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
function gltf(bytes){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 assert.equal(v.getUint32(0,true),0x46546c67);
 assert.equal(v.getUint32(4,true),2);
 assert.equal(v.getUint32(8,true),bytes.byteLength);
 const len=v.getUint32(12,true);
 return JSON.parse(new TextDecoder().decode(bytes.slice(20,20+len)));
}
test("ENV016 exports a bounded reproducible glTF geological volume and real fracture mesh",()=>{
 const a=make(),b=make(),doc=gltf(a.bytes);
 assert.deepEqual(Buffer.from(a.bytes),Buffer.from(b.bytes));
 assert.deepEqual(a.stats.map(x=>x.name),[
  "attached_living_rock","far_opposite_mass","fractured_talus","distant_layered_ridge"]);
 assert.equal(doc.meshes.length,4);
 assert.ok(a.bytes.length>120000&&a.bytes.length<750000);
 const tri=a.stats.reduce((n,m)=>n+m.triangles,0);
 assert.ok(tri>11000&&tri<=16000,"mobile triangle budget: "+tri);
 assert.ok(a.stats[2].vertices>250,"many independently fractured rock pieces");
 assert.ok(a.stats[1].vertices>3000,"far side must have true front and back faces");
 for(const m of doc.meshes){
  const p=m.primitives[0];
  assert.equal(p.mode,4);
  for(const key of ["POSITION","NORMAL","COLOR_0","TEXCOORD_0"])
   assert.ok(Number.isInteger(p.attributes[key]));
 }
});
test("fracture erosion is spatially coherent and does not perturb the ENV009 rim",()=>{
 const src=read("tools/env016-erosion-export.cjs");
 assert.match(src,/return geo\("attached_living_rock",96,22/);
 assert.match(src,/const contactChannel=/);
 assert.match(src,/const incision=/);
 assert.match(src,/const benches=/);
 assert.match(src,/mesh\.indices\.push\(base\+e,base\+q,base\+n\+e/);
 assert.doesNotMatch(src,/Math\.random|fetch\(|axios|requestAnimationFrame/);
 const {bytes}=make(),doc=gltf(bytes);
 const p=doc.meshes[0].primitives[0].attributes.POSITION;
 const acc=doc.accessors[p],view=doc.bufferViews[acc.bufferView];
 const raw=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const offset=20+raw.getUint32(12,true)+8+view.byteOffset+(acc.byteOffset||0);
 for(let i=0;i<=96;i++){
  const a=i*Math.PI*2/96,r=2.42;
  const rough=1+.045*Math.sin(5*a+.4)+.023*Math.sin(11*a+1.3)+.012*Math.sin(23*a+2.1);
  const fan=1+.065*Math.sin(3*a-.3);
  const expected=[Math.cos(a)*9.15*r*rough*fan,
   -9.9+.75*Math.sin(a*6+.4)+.42*Math.sin(a*13-1.1),
   Math.sin(a)*5.85*r*rough];
  for(let k=0;k<3;k++)
   assert.ok(Math.abs(raw.getFloat32(offset+(i*3+k)*4,true)-expected[k])<.0005,
    "original rim vertex "+i+" axis "+k+" must be untouched");
 }
});
test("ENV016 preserves combat lifecycle and original baseline choice",()=>{
 const html=read("index.html"),pkg=JSON.parse(read("package.json"));
 const cv=read("combat-visual-007.js"),env=read("combat-environment-016.js");
 const game=read("game.js");
 assert.equal(pkg.version,"0.3.86");
 assert.match(html,/v0\.3\.86 · OPSHELP \+ RENPLAY \+ REN3D003 \+ ENV016/);
 assert.ok(html.indexOf('src="combat-environment-016.js"')<
  html.indexOf('src="combat-visual-007.js"'));
 assert.match(cv,/CombatEnvironment016\.build\(B,scene,owned\)/);
 assert.match(cv,/CombatEnvironment010\.build\(B,scene,owned\)/);
 assert.match(env,/\.\.\/env016\/fractured-gorge-v1\.glb/);
 assert.match(env,/env016Rock/);
 assert.match(env,/fogDensity=\.0043/);
 assert.doesNotMatch(env,/runRenderLoop\(|setInterval\(/);
 assert.equal((game.match(/new BABYLON.Engine\(/g)||[]).length,1);
 assert.match(game,/arenaCamera\.lowerRadiusLimit=12;arenaCamera\.upperRadiusLimit=21/);
});
