const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const env=require("../combat-environment-017.js");
const visual=fs.readFileSync("combat-visual-007.js","utf8");
const html=fs.readFileSync("index.html","utf8");
test("ENV019 preserves fighter floor and bounds near-land geometry",()=>{
 assert.equal(env.MASS.length,2);
 assert.ok(env.SIDES[0]>=-14&&env.SIDES.at(-1)<=7);
 assert.ok(env.DEPTHS[0]>=-11&&env.DEPTHS.at(-1)<=15);
 for(const s of [-6,-4,-2,0,2,4,6])for(const a of [-7,-3,0,3,9])
  assert.equal(env.height(s,a),0,"fighter remains on y=0");
 assert.ok(env.height(-9,9)>0,"left back merges gently into raised land");
 assert.ok(env.edge(-9)>5.7&&env.edge(12)<7,"right rim remains near fighter shelf");
 assert.ok(env.MASS[0].lines[0].every(pt=>pt[1]>=21),"opposite bank is truly distant");
 assert.ok(env.MASS[0].lines[0].every(pt=>pt[0]>=8.5),"gap stays open on right");
});
test("ENV019 suppresses all five old ring meshes and uses a slender cliff",()=>{
 class Color{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
 class Mesh{constructor(name,scene){this.name=name;this.isPickable=true;scene.meshes.push(this);}setEnabled(v){this.enabled=v;}}
 class Mat{constructor(name){this.name=name;}}
 class VertexData{applyToMesh(mesh){mesh.data={positions:this.positions,indices:this.indices,colors:this.colors};}}
 VertexData.ComputeNormals=(p,i,n)=>{for(let j=0;j<p.length;j++)n.push(0);};
 const B={Mesh,VertexData,StandardMaterial:Mat,Color3:Color,
  Color4:class{},Scene:{FOGMODE_EXP2:2}};
 const names=["living_ledge","ravine","near_escarpment","far_ridge","horizon_ridge"];
 const scene={meshes:names.map(name=>({name:"env009_"+name,setEnabled(v){this.enabled=v;}}))};
 const result=env.build(B,scene,x=>x);
 assert.equal(result.stage,"env019-silhouette");
 assert.equal(result.meshes,4);
 const ledge=scene.meshes.find(m=>m.name==="env017_living_ledge");
 const cliff=scene.meshes.find(m=>m.name==="env017_open-cliff-face");
 assert.equal(ledge.data.positions.length,env.SIDES.length*env.DEPTHS.length*3);
 assert.equal(cliff.data.positions.length,4*env.DEPTHS.length*3);
 assert.ok(cliff.data.indices.length<ledge.data.indices.length,"no huge right apron");
 assert.ok(scene.meshes.filter(m=>m.name.startsWith("env009_")).every(m=>m.enabled===false));
 assert.ok(scene.meshes.filter(m=>m.name.startsWith("env017_")).every(m=>m.isPickable===false));
 assert.equal(scene.fogDensity,.008);
});
test("ENV019 retains HUD, real camera diagnostics and ENV010 fallback",()=>{
 const src=fs.readFileSync("combat-environment-017.js","utf8");
 assert.match(visual,/CombatEnvironment017\.build\(B,scene,owned\)/);
 assert.match(visual,/else if\(typeof CombatEnvironment010/);
 assert.match(html,/combat-environment-017\.js/);
 assert.match(html,/v0\.3\.84 · OPSHELP.*ENV017-MASSING/);
 assert.match(src,/dataset\.env019Silhouette="ready"/);
 assert.match(src,/scene\.getTransformMatrix\(\)/);
 assert.match(src,/B\.Vector3\.Project/);
 assert.doesNotMatch(src,/requestAnimationFrame|runRenderLoop|new B\.Engine/);
});
