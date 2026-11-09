/* COMBAT-ENV-018 — integrated landward shelf and open right-hand abyss.
 * [PROPOSAL] Non-canonical massing only. No new combat systems or camera changes.
 * Replaces the ENV009 elliptical walking island and adjacent ravine only in ENV017 mode.
 * The flat central contact patch remains y=0 for the established combat formation.
 */
const CombatEnvironment017=(()=>{
 "use strict";
 const ALPHA=-3*Math.PI/4;
 const AWAY={x:-Math.cos(ALPHA),z:-Math.sin(ALPHA)};
 const RIGHT={x:-Math.sin(ALPHA),z:Math.cos(ALPHA)};
 const p=(side,away,y)=>[RIGHT.x*side+AWAY.x*away,y,RIGHT.z*side+AWAY.z*away];
 // Camera-relative cross sections: walkable core -> naturally rising land on
 // the left -> sharply descending right cliff. One continuous surface.
 const SIDES=Object.freeze([-42,-34,-27,-21,-16,-12,-9,-7,-5,-3,0,3,5,6.2,7.1,7.7,8.2,9,11,14]);
 const DEPTHS=Object.freeze([-33,-25,-18,-12,-8,-5,-2,1,4,8,13,19,27,36]);
 function ledgeHeight(side,away){
  // Protect every existing fighter position (all fighters lie near the origin).
  if(side>=-5&&side<=5&&away>=-5&&away<=5)return 0;
  // Slope from the playable patch toward the main land mass, broad not noisy.
  const land=Math.max(0,(-side-5)/25);
  const behind=Math.max(0,Math.min(1,(away+3)/22));
  const landRise=land*behind*(1.4+Math.min(1,land)*3.2);
  const foreSlope=land*Math.max(0,(-away-8)/25)*(-3.4);
  const shoulder=Math.max(0,(side-5)/2.1);
  // Abrupt rock face beyond right edge. No enclosing platform ring.
  const fall=shoulder<=1?-1.4*shoulder*shoulder:
   -1.4-5.5*(shoulder-1)-.35*(shoulder-1)*(shoulder-1);
  const broad=.32*Math.sin(away*.105+side*.07)*Math.min(1,Math.max(0,land));
  return landRise+foreSlope+fall+broad;
 }
 const MASS=Object.freeze([
  {id:"distant-bank",shade:[.59,.63,.64],lines:[
   [[12,32,8],[20,34,12],[31,40,9],[46,46,15],[62,52,10],[78,64,17]],
   [[12,32,-17],[20,34,-19],[31,40,-25],[46,46,-20],[62,52,-23],[78,64,-18]],
   [[12,32,-50],[20,34,-57],[31,40,-53],[46,46,-58],[62,52,-54],[78,64,-56]]
  ]},
  {id:"far-return",shade:[.66,.69,.70],lines:[
   [[-55,88,-2],[-26,94,5],[6,104,-4],[32,121,7],[59,137,-3]],
   [[-55,88,-41],[-26,94,-44],[6,104,-49],[32,121,-42],[59,137,-50]]
  ]}
 ]);
 function supported(B){return !!(B?.Mesh&&B.VertexData?.ComputeNormals&&B.StandardMaterial&&B.Color3);}
 function build(B,scene,own){
  if(!supported(B)||!scene||typeof own!=="function")throw Error("ENV018 Babylon geometry required");
  const meshes=[];
  let vertices=0,triangles=0;
  function make(id,positions,indices,colors,uvs,shade){
   const normals=[];
   B.VertexData.ComputeNormals(positions,indices,normals);
   const mesh=own(new B.Mesh("env017_"+id,scene));
   const vd=new B.VertexData();
   vd.positions=positions;vd.indices=indices;vd.normals=normals;vd.colors=colors;
   if(uvs)vd.uvs=uvs;
   vd.applyToMesh(mesh,false);
   const mat=own(new B.StandardMaterial("env017_mat_"+id,scene));
   mat.diffuseColor=new B.Color3(1,1,1);
   mat.emissiveColor=new B.Color3(.095,.105,.105);
   mat.specularColor=new B.Color3(0,0,0);
   mat.useVertexColors=true;mat.backFaceCulling=false;mat.fogEnabled=true;
   mesh.material=mat;mesh.useVertexColors=true;
   mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
   meshes.push(mesh);vertices+=positions.length/3;triangles+=indices.length/3;
  }
  // A single connected top + descending cliff mesh; there is no ellipsoidal
  // island underneath and no second root wall pasted onto its left edge.
  const pos=[],idx=[],col=[],uv=[],stride=DEPTHS.length;
  for(let i=0;i<SIDES.length;i++)for(let j=0;j<DEPTHS.length;j++){
   const side=SIDES[i],away=DEPTHS[j];
   const y=ledgeHeight(side,away);
   pos.push(...p(side,away,y));uv.push(side*.045,away*.045);
   const drop=Math.max(0,-y),rise=Math.max(0,y);
   const color=drop>2?[.32,.36,.37]:rise>2?[.44,.45,.42]:[.53,.46,.37];
   const value=drop>2?Math.max(.65,1-drop*.009):1;
   col.push(color[0]*value,color[1]*value,color[2]*value,1);
  }
  for(let i=0;i<SIDES.length-1;i++)for(let j=0;j<stride-1;j++){
   const a=i*stride+j,b=(i+1)*stride+j;
   idx.push(a,a+1,b,a+1,b+1,b);
  }
  make("living_ledge",pos,idx,col,uv);
  for(const def of MASS){
   const positions=[],indices=[],colors=[];
   const columns=def.lines[0].length;
   for(let row=0;row<def.lines.length;row++)for(let k=0;k<columns;k++){
    positions.push(...p(...def.lines[row][k]));
    const factor=1-row*.08;
    colors.push(...def.shade.map(n=>n*factor),1);
   }
   for(let row=0;row<def.lines.length-1;row++)for(let k=0;k<columns-1;k++){
    const a=row*columns+k,b=a+columns;
    indices.push(a,b,a+1,a+1,b,b+1);
   }
   make(def.id,positions,indices,colors);
  }
  // No old oval floor/ravine, no annular scenic wings. All remain owned
  // by CombatVisual007 and are disposed by its existing cleanup.
  for(const name of ["living_ledge","ravine","near_escarpment","far_ridge","horizon_ridge"]){
   const previous=scene.meshes?.find(m=>m.name==="env009_"+name);
   if(previous?.setEnabled)previous.setEnabled(false);
  }
  if(typeof document!=="undefined"&&document.documentElement){
   document.documentElement.dataset.environment="ENV017";
   document.documentElement.dataset.env017Massing="ready";
   document.documentElement.dataset.env017IntegratedLedge="ready";
  }
  return Object.freeze({meshes:meshes.length,vertices,triangles,stage:"integrated-ledge-massing"});
 }
 function inspect(B,scene,camera,width,height){
  if(!B?.Vector3?.Project||!scene?.getTransformMatrix||!camera)return null;
  const transform=scene.getTransformMatrix();
  const viewport=camera.viewport?.toGlobal?
   camera.viewport.toGlobal(width,height):{x:0,y:0,width,height};
  const project=(xyz)=>{
   const v=B.Vector3.Project(new B.Vector3(...xyz),B.Matrix.Identity(),transform,viewport);
   return [Number(v.x.toFixed(1)),Number(v.y.toFixed(1)),Number(v.z.toFixed(3))];
  };
  return {alpha:camera.alpha,beta:camera.beta,radius:camera.radius,
   fov:camera.fov,target:[camera.target.x,camera.target.y,camera.target.z],
   viewport,ledgeRightEdge:project(p(7.1,0,ledgeHeight(7.1,0))),
   gapSample:project(p(11,20,-17)),
   bankNear:project(p(...MASS[0].lines[0][0])),
   bankFar:project(p(...MASS[0].lines[0][4])),
   leftRoot:project(p(-21,8,ledgeHeight(-21,8)))};
 }
 return Object.freeze({supported,build,inspect,MASS,SIDES,DEPTHS,ledgeHeight});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatEnvironment017;
