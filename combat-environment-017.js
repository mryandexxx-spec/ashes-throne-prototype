/* COMBAT-ENV-019 — one deliberately small silhouette pass.
 * Non-canonical concept, constrained to the original combat camera.
 * No new dependencies, render loops, fighter moves, world lore, or art detail.
 * A genuinely open gap is EMPTY: no mega-mesh beyond the cliff.
 */
const CombatEnvironment017=(()=>{
 "use strict";
 const ALPHA=-3*Math.PI/4;
 const AWAY={x:-Math.cos(ALPHA),z:-Math.sin(ALPHA)};
 const RIGHT={x:-Math.sin(ALPHA),z:Math.cos(ALPHA)};
 const p=(side,away,y)=>[RIGHT.x*side+AWAY.x*away,y,RIGHT.z*side+AWAY.z*away];
 // Unlike ENV018, there is NO 40-unit near ground or slanted right apron.
 // Sixteen units of stable central rock, a narrow vertical edge, open sky.
 const SIDES=Object.freeze([-14,-12,-10,-8,-6,-4,-2,0,2,4,5.4,6.3,7.0]);
 const DEPTHS=Object.freeze([-11,-9,-7,-5,-3,0,3,6,9,12,15]);
 function edge(away){
  return 7+.32*Math.sin(away*.34+.6)+.23*Math.sin(away*.77-1.3);
 }
 function height(side,away){
  // Combat formation must always touch the original y=0 ground.
  if(side>=-6&&side<=6.3&&away>=-7&&away<=9)return 0;
  // The left-hand root is within the SAME terrain mesh and grows gently
  // towards the landmass, rather than a giant isolated triangle.
  const left=Math.max(0,Math.min(1,(-side-6)/8));
  const back=Math.max(0,Math.min(1,(away-1)/14));
  const front=Math.max(0,Math.min(1,(-away-7)/4));
  return left*back*(1.3+.45*Math.sin(away*.22)) - front*.25;
 }
 // Each polyline is a contour on a distant opposite wall. Its first crest
 // is separated from the foreground edge by a real empty 3D interval.
 const MASS=Object.freeze([
  {id:"distant-bank",shade:[.60,.65,.66],lines:[
   [[8.5,21,4.0],[13,23,5.6],[19,24,3.9],[26,27,7.1],[35,31,5.8],[46,37,8.2]],
   [[8.5,21,-5],[13,23,-5.6],[19,24,-7],[26,27,-5.7],[35,31,-7.9],[46,37,-5.9]],
   [[8.5,21,-15],[13,23,-17],[19,24,-19],[26,27,-16],[35,31,-19],[46,37,-17]]
  ]},
  {id:"far-ridge",shade:[.69,.72,.73],lines:[
   [[-9,43,5],[-1,46,8],[12,48,5],[24,52,9],[39,57,6]],
   [[-9,43,-9],[-1,46,-11],[12,48,-9],[24,52,-12],[39,57,-10]]
  ]}
 ]);
 function supported(B){return !!(B?.Mesh&&B.VertexData?.ComputeNormals&&B.StandardMaterial&&B.Color3);}
 function build(B,scene,own){
  if(!supported(B)||!scene||typeof own!=="function")throw Error("ENV019 requires Babylon VertexData");
  let vertices=0,triangles=0;
  const meshes=[];
  function create(name,positions,indices,colors,materialColor,fog=false){
   const normals=[];
   B.VertexData.ComputeNormals(positions,indices,normals);
   const mesh=own(new B.Mesh("env017_"+name,scene));
   const data=new B.VertexData();
   data.positions=positions;data.indices=indices;data.normals=normals;data.colors=colors;
   data.applyToMesh(mesh,false);
   const mat=own(new B.StandardMaterial("env017_mat_"+name,scene));
   mat.diffuseColor=new B.Color3(...materialColor);
   mat.emissiveColor=new B.Color3(.09,.09,.09);
   mat.specularColor=new B.Color3(0,0,0);
   mat.disableLighting=true;mat.useVertexColors=true;mat.backFaceCulling=false;
   mat.fogEnabled=fog;
   mesh.material=mat;mesh.useVertexColors=true;
   mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
   meshes.push(mesh);vertices+=positions.length/3;triangles+=indices.length/3;
  }
  const pos=[],idx=[],col=[],width=DEPTHS.length;
  for(let i=0;i<SIDES.length;i++)for(let j=0;j<DEPTHS.length;j++){
   const side=SIDES[i],away=DEPTHS[j],x=side>=7?edge(away):side,y=height(side,away);
   pos.push(...p(x,away,y));
   const left=Math.max(0,Math.min(1,(-side-6)/8));
   const shade=1-.13*left+.025*Math.sin(away*.33+side*.2);
   col.push(.57*shade,.48*shade,.38*shade,1);
  }
  for(let i=0;i<SIDES.length-1;i++)for(let j=0;j<width-1;j++){
   const a=i*width+j,b=a+width;
   idx.push(a,a+1,b,a+1,b+1,b);
  }
  create("living_ledge",pos,idx,col,[1,1,1]);
  // Almost vertical, thin cliff face: NO long horizontal apron to the right.
  const face=[],faces=[],faceColors=[],rowWidth=DEPTHS.length;
  const drop=[0,-2.6,-6.7,-12.5];
  for(let row=0;row<drop.length;row++)for(const away of DEPTHS){
   face.push(...p(edge(away)+row*.12,away,drop[row]));
   const tone=1-row*.12+.035*Math.sin(away*.42);
   faceColors.push(.42*tone,.43*tone,.40*tone,1);
  }
  for(let row=0;row<drop.length-1;row++)for(let j=0;j<rowWidth-1;j++){
   const a=row*rowWidth+j,b=a+rowWidth;
   faces.push(a,a+1,b,a+1,b+1,b);
  }
  create("open-cliff-face",face,faces,faceColors,[1,1,1]);
  for(const def of MASS){
   const v=[],ind=[],c=[],n=def.lines[0].length;
   for(let row=0;row<def.lines.length;row++)for(let i=0;i<n;i++){
    v.push(...p(...def.lines[row][i]));
    const shade=1-row*.13+(i%3===1?.04:0);
    c.push(...def.shade.map(x=>x*shade),1);
   }
   for(let row=0;row<def.lines.length-1;row++)for(let i=0;i<n-1;i++){
    const a=row*n+i,b=a+n;
    ind.push(a,a+1,b,a+1,b,b+1);
   }
   create(def.id,v,ind,c,[1,1,1],true);
  }
  // Remove ALL annular surfaces from the actual rendering in ENV019 mode.
  for(const name of ["living_ledge","ravine","near_escarpment","far_ridge","horizon_ridge"]){
   const old=scene.meshes?.find(m=>m.name==="env009_"+name);
   if(old?.setEnabled)old.setEnabled(false);
  }
  // Silhouette-first daylight: the void stays visibly lighter than the face.
  if(B.Color4)scene.clearColor=new B.Color4(.51,.58,.61,1);
  if(B.Scene?.FOGMODE_EXP2!==undefined){
   scene.fogMode=B.Scene.FOGMODE_EXP2;
   scene.fogDensity=.008;
   scene.fogColor=new B.Color3(.57,.63,.65);
  }
  if(typeof document!=="undefined"&&document.documentElement){
   document.documentElement.dataset.environment="ENV017";
   document.documentElement.dataset.env017Massing="ready";
   document.documentElement.dataset.env019Silhouette="ready";
  }
  return Object.freeze({meshes:meshes.length,vertices,triangles,stage:"env019-silhouette"});
 }
 function inspect(B,scene,camera,width,height){
  if(!B?.Vector3?.Project||!scene?.getTransformMatrix||!camera)return null;
  const transform=scene.getTransformMatrix();
  const viewport=camera.viewport?.toGlobal?
   camera.viewport.toGlobal(width,height):{x:0,y:0,width,height};
  const project=([x,y,z])=>{
   const v=B.Vector3.Project(new B.Vector3(x,y,z),B.Matrix.Identity(),transform,viewport);
   return [Number(v.x.toFixed(1)),Number(v.y.toFixed(1)),Number(v.z.toFixed(3))];
  };
  return {alpha:camera.alpha,beta:camera.beta,radius:camera.radius,
   fov:camera.fov,target:[camera.target.x,camera.target.y,camera.target.z],
   viewport,ledgeRightEdge:project(p(edge(0),0,0)),
   gapSample:project(p(12,15,-12)),
   bankNear:project(p(...MASS[0].lines[0][0])),
   bankFar:project(p(...MASS[0].lines[0][4])),
   leftRoot:project(p(-12,12,height(-12,12)))};
 }
 return Object.freeze({supported,build,inspect,MASS,SIDES,DEPTHS,height,edge});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatEnvironment017;
