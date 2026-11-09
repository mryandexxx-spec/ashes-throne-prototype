/* COMBAT-ENV-012B — one-shot low-relief open channel, original non-canonical 3D.
 * The walkable ENV009 ledge and character positions are unchanged. Static,
 * pick-free terrain only; no gameplay state or additional render loop.
 */
const CombatEnvironment012=(()=>{
 'use strict';
 const SQ=Math.SQRT1_2;
 const ROWS=72,ACROSS=18;
 const CLAMP=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=t=>{t=CLAMP(t,0,1);return t*t*(3-2*t);};
 const world=(x,d,y)=>[(d+x)*SQ,y,(d-x)*SQ];
 const center=d=>1.6*Math.sin((d-13)*.044)+.75*Math.sin(d*.103+.3);
 const halfWidth=d=>6.8+.082*d;
 const bedHeight=d=>-9.85+4.7*(1-Math.exp(-(d-20)/46))+.12*Math.sin(d*.11);
 const domain=i=>20+(140-20)*i/ROWS;
 function geometry(){
  const result=[];
  function surface(name,cols,sample,paint){
   const positions=[],indices=[],colors=[],uvs=[];
   for(let i=0;i<=ROWS;i++){
    const d=domain(i);
    for(let j=0;j<=cols;j++){
     const t=j/cols;
     const [x,y]=sample(d,t);
     positions.push(...world(x,d,y));
     const c=paint(d,t,x,y);
     colors.push(...c,1);
     uvs.push(d*.055+t*.15,y*.16+t*1.6);
    }
   }
   for(let i=0;i<ROWS;i++)for(let j=0;j<cols;j++){
    const a=i*(cols+1)+j,b=a+cols+1;
    indices.push(a,b,a+1,a+1,b,b+1);
   }
   result.push({name,positions,indices,colors,uvs});
  }
  surface('gorge_floor',ACROSS,(d,t)=>{
   const v=2*t-1,w=halfWidth(d);
   return [center(d)+v*w,bedHeight(d)+.32*v*v+.10*Math.sin(d*.17+v*3)*(1-v*v)];
  },(d,t)=>{
   const v=Math.abs(2*t-1),s=.025*Math.sin(d*.11+t*9)+.012*Math.cos(d*.27-t*14);
   return [.43+s+.025*(1-v),.43+s+.020*(1-v),.40+s+.010*(1-v)];
  });
  for(const side of [-1,1]){
   surface(side<0?'west_terraces':'east_terraces',ACROSS,(d,t)=>{
    const w=halfWidth(d),out=10.0+.050*d;
    const k=smooth(t);
    const x=center(d)+side*(w+t*out);
    const step=.16*Math.sin(d*.14+side*1.4+t*8)*t;
    const height=7.2*k+(.75*Math.sin(d*.055+side*1.8)+.34*Math.cos(d*.125+side))*k;
    const talus=.5*Math.exp(-Math.pow((t-.20)/.18,2))*smooth(t/.16);
    return [x,bedHeight(d)+.32+height+talus+step];
   },(d,t,x,y)=>{
    const streak=.027*Math.sin(y*.8+d*.13)+.020*Math.cos(d*.23-t*4);
    const talus=t<.35?.03:0;
    const haze=.10*smooth((d-65)/70);
    const base=side<0?[.36,.36,.35]:[.40,.39,.37];
    return base.map((v,i)=>CLAMP(v+streak+talus+haze+(i===2?.006:0),.18,.68));
   });
  }
  return result;
 }
 function supported(B){return !!(B?.Mesh&&B?.VertexData&&B?.VertexData?.ComputeNormals&&B?.StandardMaterial&&B?.Color3);}
 function build(B,scene,own){
  if(!supported(B)||!scene||typeof own!=='function')throw Error('ENV012 requires Babylon VertexData');
  const made=[],terrain=geometry();let triangles=0;
  try{
   for(const shape of terrain){
    const mesh=new B.Mesh('env012_'+shape.name,scene);made.push(mesh);
    const material=new B.StandardMaterial('env012_mat_'+shape.name,scene);made.push(material);
    material.diffuseColor=new B.Color3(1,1,1);
    material.specularColor=new B.Color3(.012,.012,.012);
    material.emissiveColor=new B.Color3(.10,.115,.12);
    material.backFaceCulling=false;material.useVertexColors=true;
    const vertex=new B.VertexData();
    vertex.positions=shape.positions;vertex.indices=shape.indices;
    vertex.colors=shape.colors;vertex.uvs=shape.uvs;vertex.normals=[];
    B.VertexData.ComputeNormals(vertex.positions,vertex.indices,vertex.normals);
    vertex.applyToMesh(mesh,false);
    mesh.material=material;mesh.useVertexColors=true;
    mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
    triangles+=shape.indices.length/3;
   }
   for(const resource of made)own(resource);
  }catch(err){for(const resource of made)try{resource.dispose?.();}catch(_){}throw err;}
  return Object.freeze({meshes:terrain.length,triangles,vertices:terrain.reduce((n,m)=>n+m.positions.length/3,0)});
 }
 return Object.freeze({supported,build,geometry});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=CombatEnvironment012;
