"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),
 fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const exportGlb=require("../tools/env011-gorge-export.cjs");
const Env011=require("../combat-environment-011.js");
const asset=fs.readFileSync(path.join(root,"assets/env011/open-gorge-v1.glb"));
const SQ=Math.SQRT1_2;
function parse(){
 const len=asset.readUInt32LE(12),j=JSON.parse(asset.subarray(20,20+len).toString());
 return {j,offset:28+len};
}
function position(j,offset,mesh,i){
 const a=j.accessors[j.meshes[mesh].primitives[0].attributes.POSITION],view=j.bufferViews[a.bufferView],
  at=offset+view.byteOffset+(a.byteOffset||0)+i*12;
 return [asset.readFloatLE(at),asset.readFloatLE(at+4),asset.readFloatLE(at+8)];
}
test("ENV011 exporter reproduces the committed GLB and respects the mobile size budget",()=>{
 const made=exportGlb();
 assert.deepEqual(Buffer.from(made.bytes),asset);
 assert.ok(asset.length<450000);
 const {j}=parse();
 assert.equal(j.asset.version,"2.0");
 assert.deepEqual(j.meshes.map(m=>m.name),
 ["front_buttress","middle_terraces","gorge_floor","pale_horizon"]);
 assert.equal(made.stats.reduce((n,m)=>n+m.triangles,0),13404);
 assert.equal(asset.readUInt32LE(8),asset.length);
});
test("ENV011 floor starts just beyond battle shelf and descends through the gorge",()=>{
 const {j,offset}=parse(),WIDTH=13,STEPS=86;
 const centers=[];
 for(let k=0;k<=STEPS;k+=7){
  const p=position(j,offset,2,k*(WIDTH+1)+6);
  centers.push({d:(p[0]+p[2])*SQ,y:p[1],x:(p[0]-p[2])*SQ});
 }
 assert.ok(centers[0].d<16&&centers[0].y>-25,"reachable near floor");
 assert.ok(centers[centers.length-1].d>130&&centers[centers.length-1].y< -80,"far bed descends, not a painted plane");
 assert.ok(Math.max(...centers.map(c=>c.x))-Math.min(...centers.map(c=>c.x))>6,"winding channel");
 for(let row=0;row<=STEPS;row+=6){
  const p0=position(j,offset,0,row*24),p1=position(j,offset,1,row*24);
  const l=position(j,offset,2,row*14),r=position(j,offset,2,row*14+13);
  assert.ok(p0.every((v,k)=>Math.abs(v-l[k])<.002),"left bank intersects floor");
  assert.ok(p1.every((v,k)=>Math.abs(v-r[k])<.002),"right bank intersects floor");
 }
 for(let mesh=0;mesh<4;mesh++){
  const a=j.accessors[j.meshes[mesh].primitives[0].attributes.POSITION];
  assert.ok((a.max[0]+a.max[2])*SQ<270,"bounded far range");
 }
 const far=j.accessors[j.meshes[3].primitives[0].attributes.POSITION];
 assert.ok(far.max[1]< -70,"distant shoulder stays below old artificial roof");
});
test("ENV011 rear exit preserves central fighting ground and descends without cliff seam",()=>{
 class VertexData{
  applyToMesh(mesh){mesh.positions=this.positions;mesh.normals=this.normals;}
 }
 VertexData.ComputeNormals=(pos,indices,normals)=>{for(let i=0;i<pos.length;i++)normals.push(0);};
 const B={VertexData},meshes=[];
 const radii=[0,.13,.29,.44,.58,.69,.77,.84,.90,.945,.99,1.05,1.13,1.25];
 function create(name,rs,ys){
  const position=[],uv=[],color=[],indices=[];
  for(let row=0;row<rs.length;row++)for(let i=0;i<=96;i++){
   const a=i*Math.PI*2/96,r=rs[row];
   position.push(Math.cos(a)*9.15*r,ys[row],Math.sin(a)*5.85*r);
   uv.push(0,0);color.push(1,1,1,1);
  }
  for(let j=0;j<rs.length-1;j++)for(let i=0;i<96;i++){
   const v=j*97+i;indices.push(v,v+97,v+1,v+1,v+97,v+98);
  }
  const mesh={name,positions:position,getVerticesData(type){
   return type==="position"?this.positions:type==="uv"?uv:type==="color"?color:null;
  },getIndices:()=>indices};
  meshes.push(mesh);return mesh;
 }
 const shelf=create("env009_living_ledge",radii,
 [0,0,0,0,0,0,.028,.085,.13,.04,-.42,-1.3,-2.85,-5.1]);
 const ravine=create("env009_ravine",[1.25,1.43,1.66,1.91,2.17,2.42],
 [-5.1,-7.05,-8.3,-9.15,-9.7,-9.9]);
 const center=12,idx=(row,i)=>3*(row*97+i);
 const beforeCenter=shelf.positions[idx(3,center)+1];
 const beforeLip=shelf.positions[idx(13,center)+1];
 assert.equal(Env011.openRearExit(B,{meshes}),true);
 assert.equal(shelf.positions[idx(3,center)+1],beforeCenter,"combat footprint unchanged");
 assert.ok(shelf.positions[idx(13,center)+1]<beforeLip-2.5,"rear lip must open");
 assert.ok(Math.abs(shelf.positions[idx(13,center)+1]-ravine.positions[idx(0,center)+1])<.000001,"continuous seam");
 assert.equal(shelf.positions[idx(13,60)+1],-5.1,"camera-side lip stays intact");
});
test("ENV011 integrates without mechanics, new renderer or camera changes",()=>{
 const source=fs.readFileSync(path.join(root,"combat-visual-007.js"),"utf8");
 const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const engine=fs.readFileSync(path.join(root,"game.js"),"utf8");
 assert.ok(source.indexOf("CombatEnvironment011.openRearExit")>source.indexOf("CombatEnvironment009.build"));
 assert.ok(source.indexOf("CombatEnvironment011.openRearExit")<source.indexOf("CombatEnvironment010.build"));
 assert.match(index,/combat-environment-011.js/);
 assert.match(index,/v0\.3\.84.*ENV011/);
 assert.match(engine,/alpha:-3\*Math\.PI\/4,beta:\.96,radius:12,targetY:\.9/);
 assert.match(engine,/arenaCamera\.lowerRadiusLimit=12;arenaCamera\.upperRadiusLimit=21/);
});
