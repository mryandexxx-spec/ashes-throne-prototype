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
  return {sky,tex};
}
