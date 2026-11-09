const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const env=require("../combat-environment-017.js");
const visual=fs.readFileSync("combat-visual-007.js","utf8");
const html=fs.readFileSync("index.html","utf8");
test("ENV018 preserves combat formation ground and replaces elliptical island",()=>{
 assert.equal(env.SIDES.length,20);
 assert.ok(env.DEPTHS.length>=12);
 for(const side of [-4,-2,0,2,4])for(const away of [-4,-2,0,2,4])
  assert.equal(env.ledgeHeight(side,away),0,"fighter ground must not tilt");
 assert.ok(env.ledgeHeight(-27,19)>2,"rock must grow into left landmass");
 assert.ok(env.ledgeHeight(11,0)<-5,"right edge must become a cliff");
 assert.ok(env.ledgeHeight(14,0)<env.ledgeHeight(11,0));
 assert.ok(env.MASS[0].lines[0].every(v=>v[0]>=12&&v[1]>=32));
});
test("ENV018 builds one connected top/cliff plus two distant masses",()=>{
 class Color{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
 class Mesh{constructor(name,scene){this.name=name;this.isPickable=true;scene.meshes.push(this);}setEnabled(v){this.enabled=v;}}
 class Mat{constructor(name){this.name=name;}}
 class VertexData{applyToMesh(mesh){mesh.data={positions:this.positions,indices:this.indices,colors:this.colors};}}
 VertexData.ComputeNormals=(p,i,n)=>{for(let j=0;j<p.length;j++)n.push(0);};
 const B={Mesh,VertexData,StandardMaterial:Mat,Color3:Color};
 const oldNames=["living_ledge","ravine","near_escarpment","far_ridge","horizon_ridge"];
 const scene={meshes:oldNames.map(name=>({name:"env009_"+name,setEnabled(v){this.enabled=v;}}))};
 const result=env.build(B,scene,v=>v);
 assert.equal(result.meshes,3);
 assert.equal(result.stage,"integrated-ledge-massing");
 const connected=scene.meshes.find(m=>m.name==="env017_living_ledge");
 assert.ok(connected?.data);
 assert.equal(connected.data.positions.length,env.SIDES.length*env.DEPTHS.length*3);
 assert.ok(connected.data.indices.length>1000);
 assert.ok(scene.meshes.filter(m=>m.name.startsWith("env017_")).every(m=>m.isPickable===false));
 assert.ok(scene.meshes.filter(m=>m.name.startsWith("env009_")).every(m=>m.enabled===false));
});
test("ENV018 retains real camera projection, HUD and ENV010 fallback",()=>{
 const src=fs.readFileSync("combat-environment-017.js","utf8");
 assert.match(visual,/CombatEnvironment017\.build\(B,scene,owned\)/);
 assert.match(visual,/else if\(typeof CombatEnvironment010/);
 assert.match(html,/combat-environment-017\.js/);
 assert.match(html,/v0\\.3\\.84 · OPSHELP.*ENV017-MASSING/);
 assert.match(src,/dataset\.env017IntegratedLedge="ready"/);
 assert.match(src,/scene\.getTransformMatrix\(\)/);
 assert.match(src,/B\.Vector3\.Project/);
 assert.doesNotMatch(src,/requestAnimationFrame|runRenderLoop|new B\.Engine/);
});
