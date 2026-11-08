/* COMBAT-ENV-010 — original near-zero-cost fixed-angle distant composition.
 * NOT a worldbuilding fact. 3D ENV009 stays intact and pick-free.
 * Camera-facing multi-plane geometry is acceptable only with fixed yaw/tilt.
 * All geometry is static, scene-owned; no requests, textures, timers or shaders.
 */
const CombatEnvironment010=(()=>{
 "use strict";
 const TAU=Math.PI*2;
 const ALPHA=-3*Math.PI/4; // Matches game.js ARENA_VIEW, not a camera controller.
 const AWAY={x:-Math.cos(ALPHA),z:-Math.sin(ALPHA)};
 const RIGHT={x:-Math.sin(ALPHA),z:Math.cos(ALPHA)};
 const CLAMP=(v,min,max)=>Math.max(min,Math.min(max,v));
 const mix=(a,b,t)=>a.map((n,i)=>n*(1-t)+b[i]*t);
 const COLORS=Object.freeze({
  skyTop:[.235,.345,.430],skyUpper:[.37,.48,.54],
  skyHaze:[.58,.66,.67],skyHorizon:[.72,.74,.69],
  far:[.495,.56,.57],mid:[.39,.47,.49],near:[.30,.38,.40]
 });
 function supported(B){
  return !!(B&&typeof B.Mesh==="function"&&typeof B.VertexData==="function"&&
   typeof B.VertexData.ComputeNormals==="function"&&typeof B.StandardMaterial==="function"&&
   typeof B.Color3==="function");
 }
 function build(B,scene,own){
  if(!supported(B)||!scene||typeof own!=="function")throw Error("ENV010 requires Babylon VertexData");
  const meshes=[];
  let vertices=0,triangles=0;
  function mat(name){
   const m=own(new B.StandardMaterial("env010_mat_"+name,scene));
   m.diffuseColor=new B.Color3(1,1,1);
   m.emissiveColor=new B.Color3(.15,.17,.18);
   m.specularColor=new B.Color3(0,0,0);
   m.disableLighting=false;m.fogEnabled=false;
   m.backFaceCulling=false;m.useVertexColors=true;
   return m;
  }
  function place(distance,x,y){
   return [AWAY.x*distance+RIGHT.x*x,y,AWAY.z*distance+RIGHT.z*x];
  }
  function geom(name,columns,rows,sample,shade,material){
   const positions=[],normals=[],colors=[],indices=[];
   for(let j=0;j<rows;j++)for(let i=0;i<=columns;i++){
    const [x,y,z]=sample(i/columns,j);
    const c=shade(i/columns,j,x,y,z);
    positions.push(x,y,z);
    colors.push(CLAMP(c[0],0,1),CLAMP(c[1],0,1),CLAMP(c[2],0,1),1);
   }
   for(let j=0;j<rows-1;j++)for(let i=0;i<columns;i++){
    const a=j*(columns+1)+i,b=a+columns+1;
    indices.push(a,b,a+1,a+1,b,b+1);
   }
   B.VertexData.ComputeNormals(positions,indices,normals);
   const mesh=own(new B.Mesh("env010_"+name,scene));
   const data=new B.VertexData();
   data.positions=positions;data.normals=normals;data.indices=indices;data.colors=colors;
   data.applyToMesh(mesh,false);
   mesh.useVertexColors=true;
   mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
   mesh.material=material;
   meshes.push(mesh);
   vertices+=positions.length/3;triangles+=indices.length/3;
  }
  // One unlit quadrilateral with a continuous vertical haze gradient.
  // A sky colour plane is not the scene geometry and is too far to accept touches.
  const sky=mat("atmosphere");
  const stops=[[-360,COLORS.skyHorizon],[-90,COLORS.skyHorizon],
   [8,COLORS.skyHaze],[100,COLORS.skyUpper],[250,COLORS.skyTop]];
  geom("sky",1,stops.length,(u,row)=>place(118,(u-.5)*310,stops[row][0]),
   (u,row)=>stops[row][1],sky);
  function peak(s,c,w,h){const q=(s-c)/w;return h*Math.exp(-q*q*1.15);}
  function sculpt(t,phase){
   // Different scales: long sloping beds with sparse narrow fracture valleys.
   const u=t/115;
   const mass=peak(u,-.76,.36,.78)+peak(u,-.22,.26,1.18)+
    peak(u,.24,.24,.69)+peak(u,.73,.35,.95);
   const foothills=.12*Math.sin(t*.105+phase)+.065*Math.sin(t*.29+phase*.7);
   const cleft=Math.max(0,1-Math.abs(Math.sin(t*.06+phase*1.5))/.085);
   return mass+foothills-.22*cleft;
  }
  const layers=[
   {name:"horizon",d:92,base:19,amplitude:35,phase:.45,color:COLORS.far},
   {name:"midground",d:65,base:10.5,amplitude:28,phase:1.8,color:COLORS.mid},
   {name:"escarpment",d:42,base:4.0,amplitude:19,phase:3.2,color:COLORS.near}
  ];
  for(const layer of layers){
   const m=mat(layer.name);
   // Vertical layers form an actual multi-level rock profile; no painted cutout
   // placed on top of a flat panel. Different distances provide zoom parallax.
   geom(layer.name,112,5,(u,row)=>{
    const x=(u-.5)*232;
    const summit=layer.base+layer.amplitude*sculpt(x,layer.phase);
    const steps=[-160,-72,-27,-8,0];
    const y=summit+steps[row]+(row<4?.5*Math.sin(x*.18+row*.68+layer.phase):0);
    return place(layer.d,x,y);
   },(u,row,x,y,z)=>{
    const t=(u-.5)*232;
    const land=layer.color;
    const deposit=.035*Math.sin(t*.12+layer.phase)+.017*Math.sin(t*.33+row*.8);
    const shaded=row<3?-.075:row===3?-.035:.025;
    const haze=row===0?.28:row===1?.13:0;
    return mix(land,COLORS.skyHaze,haze).map(v=>v+deposit+shaded);
   },m);
  }
  // Only for a fixed camera: retire ENV009's 360-degree wall rings so the
  // new distant composition is actually visible. The nearby ledge and ravine
  // remain fully three-dimensional; the old meshes stay owned by the Scene.
  for(const name of ["env009_near_escarpment","env009_far_ridge","env009_horizon_ridge"]){
   const old=Array.isArray(scene.meshes)?scene.meshes.find(mesh=>mesh.name===name):null;
   if(old&&typeof old.setEnabled==="function")old.setEnabled(false);
   else if(old)old.isVisible=false;
  }
  return Object.freeze({meshes:meshes.length,vertices,triangles});
 }
 return Object.freeze({supported,build,COLORS});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatEnvironment010;
