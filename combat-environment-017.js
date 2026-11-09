/* COMBAT-ENV-017 — camera-first LARGE MASSES, candidate A.
 * Experimental, non-canonical, deliberately no geology/textures/erosion.
 * Coordinates are expressed relative to the game's fixed ArcRotateCamera yaw.
 * Everything here is owned by the existing Scene, non-pickable, static.
 */
const CombatEnvironment017=(()=>{
 "use strict";
 const ALPHA=-3*Math.PI/4;
 const AWAY={x:-Math.cos(ALPHA),z:-Math.sin(ALPHA)};
 const RIGHT={x:-Math.sin(ALPHA),z:Math.cos(ALPHA)};
 const p=(side,away,y)=>[RIGHT.x*side+AWAY.x*away,y,RIGHT.z*side+AWAY.z*away];
 const MASS=Object.freeze([
  // Rock behind and to the left grows outwards from the existing ledge;
  // the close edge stays BELOW the fighter plane. No overhead left wing.
  {id:"landward-root",shade:[.40,.42,.41],lines:[
   [[-9,0,-.6],[-14,1,-1.1],[-22,4,-2.0],[-33,7,-3.1],[-49,10,-4]],
   [[-9,0,-5.4],[-14,3,-6.5],[-22,7,-8],[-33,12,-10],[-49,17,-12]],
   [[-9,0,-14],[-14,6,-16],[-22,10,-19],[-33,17,-22],[-49,24,-25]]
  ]},
  // A separated, asymmetric opposite wall. Its nearer boundary is
  // genuinely distant; no near/right ring encloses the open void.
  {id:"distant-bank",shade:[.50,.54,.55],lines:[
   [[18,49,-8],[30,52,-6],[43,57,-2],[57,61,1],[75,70,-3],[98,79,-1]],
   [[18,49,-28],[30,52,-24],[43,57,-25],[57,61,-19],[75,70,-23],[98,79,-27]],
   [[18,49,-53],[30,52,-49],[43,57,-50],[57,61,-46],[75,70,-49],[98,79,-52]]
  ]},
  // Only a distant shadowed return: never a symmetric facing wall.
  {id:"far-return",shade:[.60,.63,.63],lines:[
   [[-64,91,-13],[-33,96,-9],[-5,108,-17],[19,119,-11],[48,134,-20]],
   [[-64,91,-39],[-33,96,-38],[-5,108,-45],[19,119,-40],[48,134,-47]]
  ]}
 ]);
 function supported(B){return !!(B?.Mesh&&B.VertexData?.ComputeNormals&&B.StandardMaterial&&B.Color3);}
 function build(B,scene,own){
  if(!supported(B)||!scene||typeof own!=="function")throw Error("ENV017 Babylon geometry required");
  let vertices=0,triangles=0;
  const meshes=[];
  const make=(def)=>{
   const columns=def.lines[0].length,rows=def.lines.length;
   if(def.lines.some(line=>line.length!==columns))throw Error("ENV017 uneven contour");
   const positions=[],indices=[],normals=[],colors=[];
   for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    positions.push(...p(...def.lines[row][col]));
    const shade=1-row*.085+(col%3===1?.025:0);
    colors.push(...def.shade.map(c=>c*shade),1);
   }
   for(let row=0;row<rows-1;row++)for(let col=0;col<columns-1;col++){
    const a=row*columns+col,b=a+columns;
    indices.push(a,b,a+1,a+1,b,b+1);
   }
   B.VertexData.ComputeNormals(positions,indices,normals);
   const mesh=own(new B.Mesh("env017_"+def.id,scene));
   const data=new B.VertexData();
   data.positions=positions;data.indices=indices;data.normals=normals;data.colors=colors;
   data.applyToMesh(mesh,false);
   const mat=own(new B.StandardMaterial("env017_mat_"+def.id,scene));
   mat.diffuseColor=new B.Color3(1,1,1);
   mat.emissiveColor=new B.Color3(.12,.13,.13);
   mat.specularColor=new B.Color3(0,0,0);
   mat.useVertexColors=true;mat.backFaceCulling=false;mat.fogEnabled=true;
   mesh.material=mat;mesh.useVertexColors=true;
   mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
   meshes.push(mesh);
   vertices+=positions.length/3;triangles+=indices.length/3;
  };
  MASS.forEach(make);
  // The three ENV009 scenic annuli occlude the new composition. Preserve
  // living_ledge and ravine, and only disable the old distant rings.
  for(const name of ["near_escarpment","far_ridge","horizon_ridge"]){
   const old=scene.meshes?.find(m=>m.name==="env009_"+name);
   if(old?.setEnabled)old.setEnabled(false);
  }
  if(typeof document!=="undefined"&&document.documentElement){
   document.documentElement.dataset.environment="ENV017";
   document.documentElement.dataset.env017Massing="ready";
  }
  return Object.freeze({meshes:meshes.length,vertices,triangles,stage:"massing-only"});
 }
 // Runtime diagnostics must use Babylon's actual Scene transform, not
 // guessed screen coordinates or an orthographic approximation.
 function inspect(B,scene,camera,width,height){
  if(!B?.Vector3?.Project||!scene?.getTransformMatrix||!camera)return null;
  const transform=scene.getTransformMatrix();
  const viewport=camera.viewport?.toGlobal?
   camera.viewport.toGlobal(width,height):{x:0,y:0,width,height};
  const project=([x,y,z])=>{
   const v=B.Vector3.Project(new B.Vector3(x,y,z),
    B.Matrix.Identity(),transform,viewport);
   return [Number(v.x.toFixed(1)),Number(v.y.toFixed(1)),Number(v.z.toFixed(3))];
  };
  return {alpha:camera.alpha,beta:camera.beta,radius:camera.radius,
   fov:camera.fov,target:[camera.target.x,camera.target.y,camera.target.z],
   viewport,ledgeRightEdge:project(p(9,0,0)),
   gapSample:project(p(14,20,-12)),
   bankNear:project(p(...MASS[1].lines[0][0])),
   bankFar:project(p(...MASS[1].lines[0][4])),
   leftRoot:project(p(...MASS[0].lines[0][3]))};
 }
 return Object.freeze({supported,build,inspect,MASS});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatEnvironment017;
