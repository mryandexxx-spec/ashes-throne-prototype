const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const env=require("../combat-environment-017.js");
const visual=fs.readFileSync("combat-visual-007.js","utf8");
const html=fs.readFileSync("index.html","utf8");
test("ENV020 uses explicitly authored crown/root, not a procedural grid",()=>{
 assert.equal(env.CROWN.length,17);
 assert.equal(env.ROOT_BACK.length,7);
 assert.equal(env.MASS.length,2);
 assert.ok(env.CROWN.every(x=>x[0]>=-11&&x[0]<=9),"near ledge bounded");
 assert.ok(env.CROWN.every(x=>x[1]>=-9&&x[1]<=11),"no infinite apron");
 assert.ok(env.CROWN.filter(x=>x[2]===0).length>=1);
 assert.ok(env.ROOT_BACK.some(x=>x[2]>=3),"connected left bedrock lifts");
 assert.ok(env.MASS[0].lines[0].every(x=>x[1]>=17));
 assert.ok(env.MASS[0].lines[0].every(x=>x[0]>=8));
});
test("ENV020 builds a single authored near-side mesh and disables oval rings",()=>{
 class Color{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
 class Mesh{constructor(name,s){this.name=name;this.isPickable=true;s.meshes.push(this);}setEnabled(x){this.enabled=x;}}
 class Mat{constructor(name){this.name=name;}}
 class Data{applyToMesh(mesh){mesh.data={positions:this.positions,indices:this.indices,colors:this.colors,normals:this.normals};}}
 Data.ComputeNormals=(p,i,n)=>{for(let k=0;k<p.length;k++)n.push(0);};
 const B={Mesh,VertexData:Data,StandardMaterial:Mat,Color3:Color,Color4:Color,Scene:{FOGMODE_EXP2:2}};
 const old=["living_ledge","ravine","near_escarpment","far_ridge","horizon_ridge"];
 const scene={meshes:old.map(x=>({name:"env009_"+x,setEnabled(x){this.enabled=x;}}))};
 const result=env.build(B,scene,v=>v);
 assert.equal(result.stage,"authored-silhouette");
 assert.equal(result.meshes,3);
 const near=scene.meshes.find(x=>x.name==="env017_living_ledge");
 assert.ok(near.data.positions.length>env.CROWN.length*3);
 assert.ok(near.data.indices.length>100);
 assert.ok(scene.meshes.filter(x=>x.name.startsWith("env009_")).every(x=>x.enabled===false));
 assert.ok(scene.meshes.filter(x=>x.name.startsWith("env017_")).every(x=>x.isPickable===false));
 assert.equal(scene.fogDensity,.006);
});
test("ENV020 respects HUD, fixed-camera inspect, ENV010 fallback",()=>{
 const src=fs.readFileSync("combat-environment-017.js","utf8");
 assert.match(visual,/CombatEnvironment017\.build\(B,scene,owned\)/);
 assert.match(visual,/else if\(typeof CombatEnvironment010/);
 assert.match(html,/combat-environment-017\.js/);
 assert.match(html,/v0\.3\.84 · OPSHELP.*ENV017-MASSING/);
 assert.match(src,/dataset\.env020Authored="ready"/);
 assert.match(src,/scene\.getTransformMatrix\(\)/);
 assert.match(src,/B\.Vector3\.Project/);
 assert.doesNotMatch(src,/requestAnimationFrame|runRenderLoop|new B\.Engine/);
});
