/* COMBAT-ENV-010 — composed fixed-angle sculpted canyon and light microrelief.
 * NOT a worldbuilding fact. 3D ENV009 stays intact and pick-free.
 * Camera-facing multi-plane geometry is acceptable only with fixed yaw/tilt.
 * All geometry is static, scene-owned; no requests, textures, timers or shaders.
 */
const CombatEnvironment010=(()=>{
 "use strict";
 const TAU=Math.PI*2;
 const ALPHA=-3*Math.PI/4; // Matches game.js ARENA_VIEW, not a camera controller.
 // Resolve relative to this script, not the preview fixture's URL.
 const ASSET_ROOT=typeof document!=="undefined"&&document.currentScript?.src?
  new URL("assets/env010/",document.currentScript.src).href:null;
 const AWAY={x:-Math.cos(ALPHA),z:-Math.sin(ALPHA)};
 const RIGHT={x:-Math.sin(ALPHA),z:Math.cos(ALPHA)};
 const CLAMP=(v,min,max)=>Math.max(min,Math.min(max,v));
 const mix=(a,b,t)=>a.map((n,i)=>n*(1-t)+b[i]*t);
 const COLORS=Object.freeze({
  skyTop:[.32,.43,.52],skyUpper:[.43,.53,.60],
  skyHaze:[.62,.68,.69],skyHorizon:[.72,.74,.70],
  far:[.57,.625,.64],mid:[.46,.52,.54],near:[.355,.43,.46]
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
  // Weathered sedimentary scarps: plateau tops, abrupt fractured shoulders
  // and talus. Avoid Gaussian hill silhouettes in the fixed 3/4 composition.
  const smooth=(a,b,x)=>{const t=CLAMP((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  const mesa=(u,c,w,h,phase)=>{
   const offset=.065*Math.sin(u*24+phase)+.026*Math.sin(u*71-phase*.7);
   const q=Math.abs((u-c)/w)*(1+offset);
   const crown=1-.11*smooth(.25,.78,q);
   const scarp=1-smooth(.71,1.07,q);
   const talus=.13*Math.exp(-Math.pow((q-1.04)/.36,2));
   return h*(crown*scarp+talus);
  };
  function sculpt(t,phase){
   const u=t/115;
   const mass=mesa(u,-.76,.36,.78,phase)+mesa(u,-.22,.26,1.18,phase+1.5)+
    mesa(u,.24,.24,.69,phase+2.7)+mesa(u,.73,.35,.95,phase+4.1);
   const weathering=.024*Math.sin(t*.22+phase)+.018*Math.sin(t*.47-phase*.7);
   const watercut=.10*Math.pow(Math.max(0,Math.sin(t*.055+phase*1.5)),6);
   return mass+weathering-watercut;
  }
  const layers=[
   {name:"horizon",d:92,base:-98,amplitude:54,phase:.45,color:COLORS.far,relief:1.1},
   {name:"midground",d:65,base:-70,amplitude:40,phase:1.8,color:COLORS.mid,relief:1.8},
   {name:"escarpment",d:42,base:-53,amplitude:34,phase:3.2,color:COLORS.near,relief:2.4}
  ];
  for(const layer of layers){
   const material=mat(layer.name);
   // Additional strata have mild geometric depth, rather than making a
   // hard, brightly lit cavern above the sky. Lower relief fades with range.
   const steps=[-160,-112,-78,-50,-32,-20,-12,-5,0];
   geom(layer.name,112,steps.length,(u,row)=>{
    const x=(u-.5)*232;
    const summit=layer.base+layer.amplitude*sculpt(x,layer.phase);
    const t=row/(steps.length-1);
    const erosion=.38*Math.sin(x*.18+row*.68+layer.phase)*(1-t);
    const y=summit+steps[row]+erosion;
    const offset=layer.relief*(1-t)*(.32+.48*Math.sin(x*.11+row*.4+layer.phase)+
       .20*Math.sin(x*.24+layer.phase*2));
    return place(layer.d+offset,x,y);
   },(u,row,x,y,z)=>{
    const t=(u-.5)*232;
    const land=layer.color;
    const slope=sculpt(t+1.5,layer.phase)-sculpt(t-1.5,layer.phase);
    const sediment=.027*Math.sin(y*.23+t*.024+layer.phase);
    const fineStrata=.014*Math.sin(y*.62+t*.073+layer.phase*1.6);
    const facet=CLAMP(slope*1.4,-.10,.10);
    const shaded=row<3?-.067:row<5?-.032:row===5?.008:.045;
    const haze=row===0?.25:row<3?.11:0;
    return mix(land,COLORS.skyHaze,haze).map(v=>v+sediment+fineStrata+facet+shaded);
   },material);
  }
  // Two camera-side sculpted banks frame the distant gorge. They sit beyond
  // the battle footprint, and are genuine 3D walls with stepped strata.
  for(const side of [-1,1]){
   const bank=mat(side<0?"west_bank":"east_bank");
   const steps=[-100,-73,-49,-34,-23,-15,-9,-4,0];
   geom(side<0?"west_bank":"east_bank",48,steps.length,(u,row)=>{
    const x=side*(11+22*u);
    const top=-12+5.4*Math.cos(u*2.4)-5.2*u+
     1.8*Math.sin(u*9.7+side*1.5);
    const t=row/(steps.length-1);
    const cut=1.6*Math.sin(u*13+side*2.2+row*.34)*(1-t);
    const distance=25+6*u+(1-t)*(1.3*Math.sin(u*8+side)+
     .65*Math.sin(u*21+row*.27));
    return place(distance,x,top+steps[row]+cut);
   },(u,row,x,y,z)=>{
    const bed=.035*Math.sin(y*.44+u*5.7);
    const joint=Math.abs(Math.sin(u*18+row*.09+side))>.965?-.052:0;
    const ledge=row>5?.043:row>3?.006:-.035;
    const edge=.016*Math.sin(u*31+row*.9);
    const base=side<0?[.40,.405,.395]:[.365,.39,.405];
    return base.map(v=>v+bed+joint+ledge+edge);
   },bank);
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
  // Bundled CC0 photo-based material (ambientCG Rock063, downsampled to 512).
  // The original ENV009 diffuse + procedural microrelief remain visible until
  // BOTH files load; on failure the visual scene remains usable without them.
  // No remote runtime requests or additional scene/engine cycles.
  function loadLocalRock(){
    if(!ASSET_ROOT||typeof B.Texture!=="function")return false;
    const shelf=Array.isArray(scene.meshes)?
      scene.meshes.find(m=>m.name==="env009_living_ledge"):null;
    if(!shelf||typeof shelf.getVerticesData!=="function"||
       typeof shelf.getIndices!=="function")return false;
    let albedoReady=false,normalReady=false,capMade=false,albedo=null,normal=null;
    const makeCap=()=>{
      const disposed=typeof scene.isDisposed==="function"?
        scene.isDisposed():Boolean(scene.isDisposed);
      if(!albedoReady||!normalReady||capMade||disposed)return;
      const positions=shelf.getVerticesData("position");
      const uvs=shelf.getVerticesData("uv");
      const normals=shelf.getVerticesData("normal");
      const rockColors=shelf.getVerticesData("color");
      const indices=shelf.getIndices();
      const count=97,rows=11,verts=rows*count,triangles=(rows-1)*96*6;
      if(!positions||!uvs||!normals||!indices||
         positions.length<verts*3||uvs.length<verts*2||
         normals.length<verts*3||indices.length<triangles)return;
      capMade=true;
      // Follow ENV009's real sculpted top surface; no rectangular platform
      // and no photo stretched down the near-vertical canyon face.
      const data=new B.VertexData();
      data.positions=Array.from(positions.slice(0,verts*3));
      for(let i=1;i<data.positions.length;i+=3)data.positions[i]+=.018;
      data.indices=Array.from(indices.slice(0,triangles));
      data.normals=Array.from(normals.slice(0,verts*3));
      data.uvs=Array.from(uvs.slice(0,verts*2));
      // Gradual material transition: intact shelf → eroded lip → bare cliff.
      // The edge is irregular because the inherited ENV009 rim is sculpted.
      data.colors=[];
      for(let i=0;i<verts;i++){
        const row=Math.floor(i/count);
        const a=row<=5?1:row===6?.94:row===7?.73:row===8?.45:row===9?.18:0;
        const k=i*4;
        if(rockColors?.length>=verts*4) data.colors.push(
          rockColors[k],rockColors[k+1],rockColors[k+2],a);
        else data.colors.push(.56,.46,.355,a);
      }
      const cap=own(new B.Mesh("env010_sedimentary_shelf_skin",scene));
      data.applyToMesh(cap,false);
      const material=own(new B.StandardMaterial("env010_sedimentary_skin",scene));
      material.diffuseColor=new B.Color3(.79,.74,.66);
      material.useVertexColors=true;
      cap.hasVertexAlpha=true;cap.useVertexColors=true;
      material.specularColor=new B.Color3(.010,.012,.012);
      material.emissiveColor=new B.Color3(.025,.027,.022);
      material.diffuseTexture=albedo;material.bumpTexture=normal;
      cap.material=material;
      cap.isPickable=false;cap.checkCollisions=false;
      cap.receiveShadows=false;
    };
    const options=B.Texture.TRILINEAR_SAMPLINGMODE;
    try{
      albedo=own(new B.Texture(ASSET_ROOT+"rock063-color-512.jpg",scene,
        false,false,options,()=>{albedoReady=true;makeCap();},()=>{}));
      normal=own(new B.Texture(ASSET_ROOT+"rock063-normal-512.jpg",scene,
        false,false,options,()=>{normalReady=true;makeCap();},()=>{}));
      albedo.uScale=1.65;albedo.vScale=1.65;
      normal.uScale=1.65;normal.vScale=1.65;normal.level=.23;
      if(B.Texture.WRAP_ADDRESSMODE!==undefined)for(const t of [albedo,normal]){
        t.wrapU=B.Texture.WRAP_ADDRESSMODE;t.wrapV=B.Texture.WRAP_ADDRESSMODE;
      }
      return true;
    }catch(error){return false;}
  }
  loadLocalRock();
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
