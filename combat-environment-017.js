/* ENV020 — hand-authored world-space cliff silhouette for the fixed combat camera.
 * One deliberately authored geological wedge, not procedural heightfield, annuli,
 * broad apron, billboard, or generated noise. Non-canonical art proposal.
 */
const CombatEnvironment017=(()=>{
 "use strict";
 const ALPHA=-3*Math.PI/4;
 const AWAY={x:-Math.cos(ALPHA),z:-Math.sin(ALPHA)};
 const RIGHT={x:-Math.sin(ALPHA),z:Math.cos(ALPHA)};
 const point=(side,away,y)=>[RIGHT.x*side+AWAY.x*away,y,RIGHT.z*side+AWAY.z*away];
 // Coordinates are authored in camera-side / away / height space.
 // The inner stable crown is a geometric fan, leaving the established
 // fighters on their original y=0 contact plane.
 const CROWN=Object.freeze([
  [-6.5,-7.6,-.20],[-8.8,-5.8,-.25],[-9.1,-2.0,-.12],
  [-9.6,2.5,.03],[-10.1,7.0,.42],[-8.4,10.0,.60],
  [-5.2,10.6,.10],[-1.3,10.1,0],[2.0,9.8,-.12],
  [5.6,8.7,-.13],[7.5,6.4,-.16],[7.8,2.9,-.16],
  [8.1,-.1,-.28],[7.2,-3.5,-.20],[5.6,-6.4,-.15],
  [2.0,-7.8,-.08],[-2.9,-8.5,-.15]
 ]);
 // A stronger but geographically narrow rock root is part of the SAME
 // peninsula mesh. It sits behind the left edge, not under the full HUD.
 const ROOT=Object.freeze([
  [-6.5,-7.6,-.20],[-8.8,-5.8,-.25],[-9.1,-2.0,-.12],
  [-9.6,2.5,.03],[-10.1,7.0,.42],[-8.4,10.0,.60],
  [-5.2,10.6,.10]
 ]);
 const ROOT_BACK=Object.freeze([
  [-12.0,-9.3,-.8],[-13.8,-6.5,-.6],[-14.6,-2.3,.4],
  [-16.0,3.6,1.65],[-17.7,8.6,3.2],[-14.5,13.7,3.1],
  [-7.2,15.0,1.0]
 ]);
 // Deliberate high/low profiles of a *single* far wall. Its near edge
 // starts beyond the open air; no right-hand ground plane connects the two.
 const MASS=Object.freeze([
  {id:"distant-bank",shade:[.49,.57,.59],lines:[
   [[8.0,17,3.6],[10.5,18,6.0],[14.3,19,5.0],[18.6,21,8.1],[25.0,25,5.7],[33.0,30,9.7]],
   [[8.0,17,-3.4],[10.5,18,-2.0],[14.3,19,-5.0],[18.6,21,-2.1],[25.0,25,-5.4],[33.0,30,-3.0]],
   [[8.0,17,-14],[10.5,18,-11.8],[14.3,19,-16],[18.6,21,-14],[25.0,25,-17],[33.0,30,-16]]
  ]},
  {id:"horizon",shade:[.65,.71,.72],lines:[
   [[-7.0,35,7],[-.2,38,10],[8.2,39,6],[16.6,41,10],[24.0,44,8]],
   [[-7.0,35,-7],[-.2,38,-8],[8.2,39,-8],[16.6,41,-8],[24.0,44,-9]]
  ]}
 ]);
 const deep=[-2.6,-6.4,-11.2];
 function supported(B){return !!(B?.Mesh&&B.VertexData?.ComputeNormals&&B.StandardMaterial&&B.Color3);}
 function build(B,scene,own){
  if(!supported(B)||!scene||typeof own!=="function")throw Error("ENV020 Babylon geometry required");
  let vertices=0,triangles=0;const meshes=[];
  function make(name,positions,indices,colors,emissive){
   const normals=[];B.VertexData.ComputeNormals(positions,indices,normals);
   const mesh=own(new B.Mesh("env017_"+name,scene));
   const vd=new B.VertexData();vd.positions=positions;vd.indices=indices;
   vd.normals=normals;vd.colors=colors;vd.applyToMesh(mesh,false);
   const mat=own(new B.StandardMaterial("env017_mat_"+name,scene));
   mat.diffuseColor=new B.Color3(1,1,1);
   mat.emissiveColor=new B.Color3(...emissive);
   mat.specularColor=new B.Color3(.004,.004,.004);
   mat.useVertexColors=true;mat.backFaceCulling=false;
   mat.fogEnabled=false;
   mesh.material=mat;mesh.useVertexColors=true;
   mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
   vertices+=positions.length/3;triangles+=indices.length/3;
   meshes.push(mesh);
  }
  // Explicit fan and contiguous root with authored facets and strata below
  // the broken edge. The same mesh carries all near-side geology.
  const ps=[],cs=[],ids=[];
  const push=(q,c)=>{ps.push(...point(...q));cs.push(...c,1);return ps.length/3-1;};
  const center=push([0,0,0],[.69,.57,.43]);
  const rim=CROWN.map((q,i)=>push(q,
   i<=6?[.59,.50,.39]:i>=10?[.57,.47,.35]:[.66,.54,.40]));
  for(let i=0;i<rim.length;i++)ids.push(center,rim[i],rim[(i+1)%rim.length]);
  // Landward continuation within this same VertexData, not a pasted plane.
  const land=ROOT_BACK.map((q,i)=>push(q,
   i>=3?[.51,.52,.47]:[.55,.49,.39]));
  for(let i=0;i<land.length-1;i++){
   ids.push(rim[i],land[i],rim[i+1]);
   ids.push(rim[i+1],land[i],land[i+1]);
  }
  // Descending cliff only where an actual lip faces the visible right
  // void. The cliff never extends horizontally across that open volume.
  const lipIndices=[8,9,10,11,12,13,14,15];
  let upper=lipIndices.map(i=>rim[i]);
  for(let row=0;row<deep.length;row++){
   const next=lipIndices.map((i,j)=>{
    const q=CROWN[i],shift=(row+1)*.085;
    return push([q[0]+shift,q[1],deep[row]+(j%3)*.18],
     row===0?[.43,.45,.43]:row===1?[.36,.40,.40]:[.30,.35,.37]);
   });
   for(let j=0;j<next.length-1;j++){
    ids.push(upper[j],upper[j+1],next[j]);
    ids.push(next[j],upper[j+1],next[j+1]);
   }
   upper=next;
  }
  make("living_ledge",ps,ids,cs,[.20,.17,.12]);
  for(const def of MASS){
   const pos=[],ind=[],colors=[],n=def.lines[0].length;
   for(let row=0;row<def.lines.length;row++)for(let i=0;i<n;i++){
    pos.push(...point(...def.lines[row][i]));
    const s=1-row*.14+(i%2?.06:0);
    colors.push(...def.shade.map(c=>c*s),1);
   }
   for(let row=0;row<def.lines.length-1;row++)for(let i=0;i<n-1;i++){
    const a=row*n+i,b=a+n;
    ind.push(a,b,a+1,a+1,b,b+1);
   }
   make(def.id,pos,ind,colors,def.id==="horizon"?[.36,.41,.43]:[.31,.36,.39]);
  }
  for(const name of ["living_ledge","ravine","near_escarpment","far_ridge","horizon_ridge"]){
   const m=scene.meshes?.find(x=>x.name==="env009_"+name);
   if(m?.setEnabled)m.setEnabled(false);
  }
  if(B.Color4)scene.clearColor=new B.Color4(.53,.62,.66,1);
  if(B.Scene?.FOGMODE_EXP2!==undefined){
   scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogDensity=.006;
   scene.fogColor=new B.Color3(.59,.66,.69);
  }
  if(typeof document!=="undefined"&&document.documentElement){
   document.documentElement.dataset.environment="ENV017";
   document.documentElement.dataset.env017Massing="ready";
   document.documentElement.dataset.env020Authored="ready";
  }
  return Object.freeze({meshes:meshes.length,vertices,triangles,stage:"authored-silhouette"});
 }
 function inspect(B,scene,camera,width,screenHeight){
  if(!B?.Vector3?.Project||!scene?.getTransformMatrix||!camera)return null;
  const transform=scene.getTransformMatrix();
  const viewport=camera.viewport?.toGlobal?
   camera.viewport.toGlobal(width,screenHeight):{x:0,y:0,width,height:screenHeight};
  const project=(q)=>{
   const v=B.Vector3.Project(new B.Vector3(...point(...q)),B.Matrix.Identity(),transform,viewport);
   return [Number(v.x.toFixed(1)),Number(v.y.toFixed(1)),Number(v.z.toFixed(3))];
  };
  return {alpha:camera.alpha,beta:camera.beta,radius:camera.radius,
   fov:camera.fov,target:[camera.target.x,camera.target.y,camera.target.z],
   viewport,ledgeRightEdge:project(CROWN[12]),gapSample:project([11,12,-8]),
   bankNear:project(MASS[0].lines[0][0]),
   bankFar:project(MASS[0].lines[0][4]),
   leftRoot:project(ROOT_BACK[4])};
 }
 return Object.freeze({supported,build,inspect,MASS,CROWN,ROOT_BACK});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatEnvironment017;
