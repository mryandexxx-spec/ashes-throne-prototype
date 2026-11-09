/* COMBAT-ENV-011: sculpt the rear exit of the original walkable shelf.
 * Non-canonical visual-only geometry. The combat footprint at y=0 is
 * untouched, as are fighter positions, mechanics, picking and camera.
 * This small pre-pass runs before ENV010 builds its photo skin and loads GLB.
 */
const CombatEnvironment011=(()=>{
 "use strict";
 const SQ=Math.SQRT1_2;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
 function openRearExit(B,scene){
  if(!B?.VertexData?.ComputeNormals||!scene?.meshes)return false;
  const profiles=[
   ["env009_living_ledge",[0,0,0,0,0,0,.7,1.8,3.3,4.8,6.2,7.5,8.8,10.1]],
   ["env009_ravine",[10.1,10.7,11.2,11.8,12.4,12.9]]
  ];
  const ready=profiles.map(([name,drop])=>({
   mesh:scene.meshes.find(m=>m.name===name),drop
  }));
  if(ready.some(({mesh})=>!mesh?.getVerticesData||!mesh?.getIndices))return false;
  const prepared=[];
  for(const {mesh,drop} of ready){
   const source=mesh.getVerticesData("position"),indices=mesh.getIndices();
   if(!source||!indices||source.length/3!==(97*drop.length))return false;
   const positions=Array.from(source),uvs=mesh.getVerticesData("uv"),
    colors=mesh.getVerticesData("color");
   if(!uvs||!colors)return false;
   let changed=0;
   for(let row=0;row<drop.length;row++)for(let sector=0;sector<=96;sector++){
    const k=3*(row*97+sector),x=positions[k],z=positions[k+2];
    const along=(x+z)*SQ,across=(x-z)*SQ;
    const opening=smooth(3.6,6.5,along)*
      (1-smooth(5.3,9.5,Math.abs(across)));
    const lowered=drop[row]*opening;
    if(lowered>.0001){positions[k+1]-=lowered;changed++;}
   }
   const normals=[];B.VertexData.ComputeNormals(positions,Array.from(indices),normals);
   prepared.push({mesh,positions,indices:Array.from(indices),normals,
    uvs:Array.from(uvs),colors:Array.from(colors),changed});
  }
  for(const part of prepared){
   const v=new B.VertexData();
   v.positions=part.positions;v.indices=part.indices;v.normals=part.normals;
   v.uvs=part.uvs;v.colors=part.colors;v.applyToMesh(part.mesh,false);
  }
  if(typeof document!=="undefined"&&document.documentElement)
   document.documentElement.dataset.env011RearExit="ready";
  return true;
 }
 return Object.freeze({openRearExit});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatEnvironment011;
