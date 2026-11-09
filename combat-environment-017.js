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
 // [ПРЕДЛОЖЕНИЕ] Three deliberately broad shapes, evaluated in the real fixed camera.
 // Top contour is a CREST, lower contours descend into the abyss.
 // Keep the near-right view unobstructed; no foreground right-hand wall.
 const MASS=Object.freeze([
  {id:"landward-root",shade:[.48,.50,.48],lines:[
   // The inner shoulder meets the outer ENV009 ledge BELOW its walkable top;
   // the larger rock mass descends left/back, not above the combatants.
   [[-8,-3,-1],[-11,-2,-1.5],[-16,1,-2],[-24,5,-2.6],[-36,10,-3.4],[-52,17,-4.2]],
   [[-8,-3,-4],[-11,-2,-5],[-16,1,-6],[-24,5,-6.5],[-36,10,-6.2],[-52,17,-8]],
   [[-8,-3,-13],[-11,-2,-15],[-16,1,-18],[-24,5,-20],[-36,10,-23],[-52,17,-27]]
  ]},
  {id:"distant-bank",shade:[.65,.69,.70],lines:[
   // A visible broken crest, well behind the gap. It rises unevenly
   // instead of forming the horizontal lip of a manufactured platform.
   [[18,49,1.8],[30,52,4.7],[43,57,3.0],[57,61,9.0],[75,70,5.1],[98,79,11.0]],
   [[18,49,-22],[30,52,-25],[43,57,-21],[57,61,-19],[75,70,-26],[98,79,-23]],
   [[18,49,-57],[30,52,-54],[43,57,-58],[57,61,-51],[75,70,-55],[98,79,-62]]
  ]},
  {id:"far-return",shade:[.60,.63,.64],lines:[
   // A much farther, discontinuous-looking skyline. No symmetric framing.
   [[-64,91,3],[-33,96,7],[-5,108,1],[19,119,9],[48,134,2]],
   [[-64,91,-34],[-33,96,-40],[-5,108,-43],[19,119,-38],[48,134,-48]]
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
