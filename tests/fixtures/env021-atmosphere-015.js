/* ENV021 015 experimental real-time sky for Babylon fixture only.
   Procedural DynamicTexture on a back-facing sphere, not a screenshot overlay.
   Does not mutate game runtime or require an external sky image/network call. */
function createENV021Atmosphere(B,scene){
  const size=512, height=256;
  const sky=B.MeshBuilder.CreateSphere("env021_015_sky",{diameter:700,segments:32,sideOrientation:B.Mesh.BACKSIDE},scene);
  sky.isPickable=false;sky.checkCollisions=false;sky.infiniteDistance=true;
  sky.renderingGroupId=0;
  const tex=new B.DynamicTexture("env021_015_cloud_atlas",{width:size,height},scene,false);
  const ctx=tex.getContext();const image=ctx.createImageData(size,height);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // Bounded, deterministic pseudo-fBm in spherical UV coordinates.
  function noise(x,y){
    let acc=0,weight=0;
    const freqs=[2,5,11,23,47],amps=[.44,.28,.16,.08,.04];
    for(let k=0;k<5;k++){
      const f=freqs[k],u=x*f,v=y*f;
      const wave=(Math.sin(6.283*(u+.21*Math.sin(v*1.7))+k*4.2)*
                  Math.sin(6.283*(v+.19*Math.sin(u*2.3))-k*1.7))*.5+.5;
      acc+=wave*amps[k];weight+=amps[k];
    }
    return acc/weight;
  }
  for(let yy=0;yy<height;yy++){
    const t=yy/(height-1);
    for(let xx=0;xx<size;xx++){
      const x=xx/(size-1),idx=4*(yy*size+xx);
      const high=clamp(1.0-t,0,1);
      const horizon=Math.exp(-Math.pow((t-.47)/.31,2));
      const field=noise(x,t),cloud=clamp((field-.39)*4.5,0,1);
      const glaze=Math.exp(-Math.pow((x-.70)/.23,2))*horizon;
      let r=26+65*horizon+30*t,g=36+73*horizon+30*t,b=53+83*horizon+31*t;
      const ash=cloud*(.77+.18*high);
      r=r*(1-ash)+80*ash;g=g*(1-ash)+82*ash;b=b*(1-ash)+91*ash;
      const glow=glaze*(.55+.45*cloud);
      r+=102*glow;g+=65*glow;b+=22*glow;
      image.data[idx]=clamp(r,0,255);image.data[idx+1]=clamp(g,0,255);
      image.data[idx+2]=clamp(b,0,255);image.data[idx+3]=255;
    }
  }
  ctx.putImageData(image,0,0);tex.update(false);
  tex.wrapU=B.Texture.WRAP_ADDRESSMODE;
  tex.wrapV=B.Texture.CLAMP_ADDRESSMODE;
  const mat=new B.StandardMaterial("env021_015_sky_material",scene);
  mat.disableLighting=true;mat.emissiveTexture=tex;mat.diffuseColor=new B.Color3(0,0,0);
  mat.specularColor=new B.Color3(0,0,0);mat.backFaceCulling=false;
  sky.material=mat;
  // Volumetric-looking cloud banks are real camera-distant meshes with
  // deterministic alpha textures. They sit beyond all canyon geometry.
  const camera=scene.activeCamera;
  const forward=camera.getForwardRay().direction;
  const flat=Math.hypot(forward.x,forward.z)||1;
  const fx=forward.x/flat,fz=forward.z/flat;
  const layers=[];
  for(let layer=0;layer<2;layer++){
    const w=512,h=256;
    const cloudTex=new B.DynamicTexture("env021_015_cloud_bank_"+layer,{width:w,height:h},scene,false);
    const context=cloudTex.getContext();
    const pixels=context.createImageData(w,h);
    for(let py=0;py<h;py++){
      const v=py/h;
      for(let px=0;px<w;px++){
        const u=px/w;
        const grain=noise(u*.8+layer*.2,v*.8+layer*.13);
        // Cluster clouds in broad banks, never flat rectangular strips.
        const bank=(.55+.45*Math.sin(u*12+layer*2.1))*Math.sin(Math.PI*v);
        const silhouette=Math.max(0,(grain-.35)*3.9)*Math.max(0,bank);
        const alpha=Math.min(.73,silhouette*(layer===0?.73:.43));
        const warm=Math.exp(-Math.pow((u-.66)/.25,2));
        const k=4*(py*w+px);
        pixels.data[k]=Math.min(255,112+67*warm);
        pixels.data[k+1]=Math.min(255,118+39*warm);
        pixels.data[k+2]=Math.min(255,128+13*warm);
        pixels.data[k+3]=Math.round(alpha*255);
      }
    }
    context.putImageData(pixels,0,0);cloudTex.hasAlpha=true;cloudTex.update(false);
    const cloud=B.MeshBuilder.CreatePlane("env021_015_cloud_plane_"+layer,
      {width:layer?330:260,height:layer?140:112,sideOrientation:B.Mesh.DOUBLESIDE},scene);
    // The combat camera looks DOWN ~35 degrees; horizon clouds belong
    // at negative world Y at this distance, not above the camera frustum.
    cloud.position.set(fx*(layer?230:170),layer?-52:-37,fz*(layer?230:170));
    cloud.billboardMode=B.Mesh.BILLBOARDMODE_ALL;
    cloud.isPickable=false;cloud.checkCollisions=false;
    cloud.renderingGroupId=0;
    const cloudMat=new B.StandardMaterial("env021_015_cloud_material_"+layer,scene);
    cloudMat.diffuseTexture=cloudTex;
    cloudMat.useAlphaFromDiffuseTexture=true;
    cloudMat.disableLighting=true;
    cloudMat.emissiveColor=new B.Color3(.50,.49,.49);
    cloudMat.specularColor=new B.Color3(0,0,0);
    cloudMat.backFaceCulling=false;
    cloudMat.disableDepthWrite=true;
    cloud.material=cloudMat;
    layers.push(cloud);
  }
  return {sky,tex,layers};
}
