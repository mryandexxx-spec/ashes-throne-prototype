/* COMBAT-ENV-010 — sculpted fixed-angle canyon strata and atmosphere.
 * NOT a worldbuilding fact. 3D ENV009 stays intact and pick-free.
 * Camera-facing multi-plane geometry is acceptable only with fixed yaw/tilt.
 * Sculpted wall geometry is static and scene-owned: no fetch, timers or shaders.
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
  skyTop:[.31,.40,.49],skyUpper:[.43,.52,.565],
  skyHaze:[.62,.68,.69],skyHorizon:[.72,.74,.70],
  far:[.56,.607,.60],mid:[.405,.46,.455],near:[.305,.372,.374]
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
  const stops=[[-360,COLORS.skyHorizon],[-145,COLORS.skyHorizon],
   [-55,COLORS.skyHaze],[45,COLORS.skyUpper],[160,COLORS.skyTop]];
  geom("sky",1,stops.length,(u,row)=>place(118,(u-.5)*310,stops[row][0]),
   (u,row)=>stops[row][1],sky);

  // The silhouette must read as eroded tableland, not a sequence of rounded
  // gaussian hills. Smoothly stepped shoulders alternate with long scarps.
  const smooth=(a,b,t)=>{const q=CLAMP((t-a)/(b-a),0,1);return q*q*(3-2*q);};
  const tableland=(x,c,w,h)=>h*(1-smooth(w*.58,w,Math.abs(x-c)));
  function crest(x,phase){
    const u=x+phase*11.5;
    const plateau=Math.max(
      tableland(u,-68,50,.94),
      tableland(u,-4,37,1.13),
      tableland(u,60,51,.80),
      tableland(u,122,32,.61)
    );
    const branching=.047*Math.sin(u*.135+phase*2)+
     .034*Math.sin(u*.31+phase)+.016*Math.sin(u*.76+phase*3);
    // Incised gullies interrupt the summit; they never form regular spikes.
    const gulley=Math.pow(Math.max(0,Math.sin(u*.107+phase*.8)),14)*.18;
    return CLAMP(plateau+branching-gulley,.03,1.35);
  }
  function fault(x,phase){
    const g=Math.sin(x*.177+phase*3.3)+.24*Math.sin(x*.39-phase);
    return Math.pow(Math.max(0,g*.73),12);
  }
  const layers=[
    // These are scenic, non-canonical rock masses. Each has genuine depth
    // variation across the face, not merely an extruded flat silhouette.
    {name:"horizon",d:99,base:-52,amplitude:34,phase:.55,color:COLORS.far,relief:1.2},
    {name:"midground",d:72,base:-48,amplitude:38,phase:2.10,color:COLORS.mid,relief:1.9},
    {name:"escarpment",d:47,base:-43,amplitude:33,phase:3.65,color:COLORS.near,relief:2.5}
  ];
  for(const layer of layers){
    const material=mat(layer.name);
    const rows=19;
    geom(layer.name,128,rows,(u,row)=>{
      const x=(u-.5)*244;
      const t=row/(rows-1);
      const summit=layer.base+layer.amplitude*crest(x,layer.phase);
      // Erosion and debris add depth and small terraces to the rock face.
      // A sloping rock wall casts real facet lighting from the two game lights.
      const drop=68*Math.pow(1-t,1.35);
      const bench=Math.sin(t*29+layer.phase*.6)*(.38+.37*(1-t));
      const gully=fault(x,layer.phase);
      const lean=(1-t)*12.0+
        layer.relief*Math.sin(x*.11+t*7+layer.phase)*Math.sin(t*3.8)+
        gully*(1.7+2.6*(1-t));
      const y=summit-drop+bench+layer.relief*.23*
        Math.sin(x*.34+layer.phase+t*11)*(1-t);
      const distance=layer.d+lean;
      return place(distance,x,y);
    },(u,row,x,y,z)=>{
      const t=row/(rows-1);
      const side=(u-.5)*244;
      const broken=fault(side,layer.phase);
      // A limited lithological palette: seam-darkened strata, fractured faces,
      // warm sunlit ledges and cool recessed gullies.
      const beds=.035*Math.sin(y*.44+side*.035)+
        .021*Math.sin(y*1.14+side*.13+layer.phase);
      const recess=-.16*broken*(.35+.65*(1-t));
      const cliffShade=-.105*(1-t)+.062*Math.sin(side*.075+layer.phase)*t;
      const facet=.050*Math.sin(side*.39+row*.81+layer.phase);
      const sun=.055*Math.max(0,Math.sin(side*.093-layer.phase))*
        Math.pow(t,1.3);
      const haze=(1-t)*.10+(layer.name==="horizon"?.12:layer.name==="midground"?.045:0);
      return mix(layer.color,COLORS.skyHaze,haze).map((v,k)=>
        CLAMP(v+beds+recess+cliffShade+facet+sun+(k===0?.012*t:0),0,1));
    },material);
  }

  // A single repeatable tangent-space stone normal map adds grazing-light
  // fracture relief to ENV009's walkable shelf without changing its y=0
  // collision/formation plane. Generated once per Scene: 256² RGBA ≈ 256 KiB.
  // No image download, shader, new renderer, or per-frame CPU work.
  function geologicalNormalMap(){
    if(typeof B.DynamicTexture!=="function")return false;
    const ledge=Array.isArray(scene.materials)?
      scene.materials.find(m=>m.name==="env009_mat_weathered_stone"):null;
    if(!ledge)return false;
    let tex=null;
    try{
      const n=256,field=new Float32Array(n*n);
      const hash=(x,y,size)=>{
        x=((x%size)+size)%size;y=((y%size)+size)%size;
        let v=Math.imul(x+17,374761393)+Math.imul(y+53,668265263);
        v=Math.imul(v^(v>>>13),1274126177);
        return ((v^(v>>>16))>>>0)/4294967295;
      };
      const noise=(u,v,steps)=>{
        const x=u*steps,y=v*steps,i=Math.floor(x),j=Math.floor(y);
        const sx=x-i,sy=y-j,fx=sx*sx*(3-2*sx),fy=sy*sy*(3-2*sy);
        const a=hash(i,j,steps)*(1-fx)+hash(i+1,j,steps)*fx;
        const b=hash(i,j+1,steps)*(1-fx)+hash(i+1,j+1,steps)*fx;
        return a*(1-fy)+b*fy;
      };
      for(let y=0;y<n;y++)for(let x=0;x<n;x++){
        const u=x/n,v=y/n;
        const macro=noise(u,v,4),breakup=noise(u,v,12);
        const warp=(macro-.5)*.11+(breakup-.5)*.04;
        const bedding=Math.sin((u*2+v*4.0+warp)*TAU);
        field[y*n+x]=.46*macro+.30*breakup+.15*noise(u,v,32)+
          .09*bedding-.11*(Math.abs(bedding)<.055?1:0);
      }
      tex=new B.DynamicTexture("env010_rock_microrelief",n,scene,false);
      const ctx=tex.getContext();
      if(!ctx||typeof ctx.createImageData!=="function")throw Error("normal canvas unavailable");
      const img=ctx.createImageData(n,n),out=img.data;
      for(let y=0;y<n;y++)for(let x=0;x<n;x++){
        const l=field[y*n+(x+n-1)%n],r=field[y*n+(x+1)%n];
        const up=field[((y+n-1)%n)*n+x],down=field[((y+1)%n)*n+x];
        const dx=(r-l)*4.4,dy=(down-up)*4.4;
        const norm=1/Math.hypot(dx,dy,1),k=(y*n+x)*4;
        out[k]=Math.round(CLAMP(.5-.5*dx*norm,0,1)*255);
        out[k+1]=Math.round(CLAMP(.5-.5*dy*norm,0,1)*255);
        out[k+2]=Math.round((.5+.5*norm)*255);
        out[k+3]=255;
      }
      ctx.putImageData(img,0,0);tex.update(false);
      if(B.Texture){tex.wrapU=B.Texture.WRAP_ADDRESSMODE;tex.wrapV=B.Texture.WRAP_ADDRESSMODE;}
      tex.level=.36;
      own(tex);ledge.bumpTexture=tex;
      return true;
    }catch(error){try{tex?.dispose?.();}catch(_){ }return false;}
  }
  geologicalNormalMap();
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
