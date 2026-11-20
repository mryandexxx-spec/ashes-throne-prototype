/* ARENA-ENV-006 — EXPERIMENT, flag ?environment=env3d only. Not merged by default.
 * Camera-projection 3D arena: the owner's ENV-005 terrace painting is projected
 * from the approved ArenaStageView camera onto a light proxy of its own depth:
 *   floor   — the painted tiles lie on the real fighter plane y=0;
 *   walls   — balustrade, planters, arch and tree stand upright at the line where
 *             they meet the floor (fronto-parallel to the reference camera);
 *   far     — cliffs, chasm and sky sit on a distant layer.
 * At the reference shot (844x390, radius 7.6) the frame equals the 2D ENV-005
 * backdrop; pinch-zoom (radius 6.6–10.5) then gives true perspective: the floor
 * grows with the fighters, the far plane barely moves. One mesh, one unlit
 * material, one WebP texture: one draw call, no shadow map, no post-process.
 * Everything is non-pickable and is disposed by dispose(). Pure geometry math
 * is exported for Node tests; Babylon is touched only in create().
 * ARENA-ENV-006B — background animation inside the same draw call (ShaderMaterial):
 *   leaf   — dappled leaf shade on the tiles sways: the shade map S, estimated from the
 *            art, is resampled with a small wind offset and the painting is relit by
 *            S(uv+d)/S(uv) — tiles and seams stay put, only the light patches move;
 *   mist   — white spray at the waterfall drifts (two-phase flow over the art);
 *   flower — corner flowers sway a few pixels.
 * Masks come from one small baked texture (tools/build-arena-env006b-anim-mask.py).
 * Clock: tick(dt) from renderBattleFrame only; no own loop. Reduced motion keeps the
 * ENV-006 static StandardMaterial path and does not load the mask. */
const CombatEnvironment006=(()=>{
 "use strict";
 const TEXTURE_URL="assets/arena-env006-terrace-projection.webp";
 // Painting (ENV-005 file) and the reference screen it was fitted to (CSS cover, bottom).
 const IMAGE=Object.freeze({width:1672,height:941});
 const REF=Object.freeze({width:844,height:390});
 // Projection texture layout (2048x1024, one atlas): the painting keeps its native
 // pixels in the middle (rows above TEX_TOP are never on screen and are dropped);
 // the margins seen only at zoom-out or on screens wider than 2.17:1 are mirrored,
 // blurred and darkened by tools/build-arena-env006-texture.py and stored at low density.
 const LAYOUT=Object.freeze({texture:Object.freeze({width:2048,height:1024}),
  padLeft:680,padRight:680,padBottom:340,texTop:120,geomTop:100,
  texLeft:188,texRight:188});     // texture px given to each side margin
 const FAR_DEPTH=60;      // camera-space depth of the cliff/sky layer, world units
 // Back edge of the walkable terrace in image px: [x, contact y, top of the upright part].
 // contact = where the upright object meets the floor; top = where the far layer begins
 // (top far above the frame means "upright to the top": arch building and tree).
 const EDGE=Object.freeze([
  [0,455,-9999],[44,455,-9999],[60,378,-9999],[165,372,-9999],[180,336,-9999],
  [310,333,-9999],[330,318,-9999],[430,304,-9999],[445,300,190],[700,296,192],
  [720,292,252],[1000,300,256],[1050,312,272],[1180,324,282],[1200,334,306],
  [1300,350,328],[1400,366,348],[1500,386,364],[1560,398,366],[1600,426,352],[1672,430,352]
 ]);
 const GRID=Object.freeze({columns:64,side:6,far:6,wall:8,floor:40,margin:6});
 // ARENA-ENV-006C: the 3D terrace is the default arena (owner, 20.11.2026). ?environment=env2d
 // returns the flat ENV-005 picture; env017/env010 keep their own legacy arenas.
 const OPT_OUT=/(?:^|[?&])environment=(?:env2d|env017|env010)(?:&|$)/;
 // ENV-006B. Mask atlas: same UV layout as the projection texture at half resolution.
 // R = shade map S (lit tile = 1), G = leaf-shade weight, B = motion weight
 // (mist above image y=MOTION_SPLIT_Y, flower sway below it; the zones never overlap).
 const ANIM_MASK_URL="assets/arena-env006b-anim-mask.webp";
 const ANIM_MASK=Object.freeze({width:1024,height:512});
 const MOTION_SPLIT_Y=430;
 // Zones in painting px: ellipses [cx, cy, rx, ry]; the bake script uses them as limits.
 const ZONES=Object.freeze({
  leaf:Object.freeze({ellipse:Object.freeze([420,725,450,300]),minY:455}),
  // Mist stays above the back enemies' heads (image y ≥317 at 1–5 enemies).
  mist:Object.freeze({ellipse:Object.freeze([1340,262,125,48])}),
  flowers:Object.freeze([Object.freeze([60,680,170,150]),Object.freeze([1660,600,120,140])])
 });
 // Amplitudes in painting px (x0.505 on the 844x390 reference screen).
 const ANIM=Object.freeze({
  leafAmplitude:12,     // max shade offset ≈ 6 screen px (ENV-006C: ×1.7, owner asked for visible motion)
  leafRatio:Object.freeze([.45,2.2]),
  mistSweep:34,mistSpeed:.1,   // spray travels 34 px per 10 s cycle
  mistWisps:.1,                // ± brightness of the drifting wisps
  flowerAmplitude:5,
  maxStepMs:100          // clamp: no jump after a stalled frame
 });

 const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const norm=a=>{const l=Math.hypot(...a);return [a[0]/l,a[1]/l,a[2]/l];};

 // Babylon ArcRotateCamera + LookAtLH + PerspectiveFovLH (vertical FOV), same as the game.
 function camera(view,radius=view.radius,width=REF.width,height=REF.height){
  const target=[0,view.targetY,0];
  const eye=[target[0]+radius*Math.cos(view.alpha)*Math.sin(view.beta),
   target[1]+radius*Math.cos(view.beta),target[2]+radius*Math.sin(view.alpha)*Math.sin(view.beta)];
  const z=norm(sub(target,eye)),x=norm(cross([0,1,0],z)),y=cross(z,x);
  return {eye,x,y,z,tan:Math.tan(view.fov/2),aspect:width/height,width,height};
 }
 function toScreen(cam,p){
  const d=sub(p,cam.eye),cz=dot(d,cam.z);
  const nx=dot(d,cam.x)/(cz*cam.tan*cam.aspect),ny=dot(d,cam.y)/(cz*cam.tan);
  return {x:(nx+1)/2*cam.width,y:(1-ny)/2*cam.height,depth:cz};
 }
 // Ray direction scaled so that camera-space depth grows by 1 per unit.
 function ray(cam,sx,sy){
  const nx=sx/cam.width*2-1,ny=1-sy/cam.height*2;
  return [0,1,2].map(i=>cam.z[i]+cam.x[i]*nx*cam.tan*cam.aspect+cam.y[i]*ny*cam.tan);
 }
 // CSS "cover", anchored bottom-centre (ENV-005 rule) at the reference screen.
 const cover=(()=>{
  const s=Math.max(REF.width/IMAGE.width,REF.height/IMAGE.height);
  return {s,left:(REF.width-IMAGE.width*s)/2,top:REF.height-IMAGE.height*s};
 })();
 const imageToScreen=(px,py)=>({x:cover.left+px*cover.s,y:cover.top+py*cover.s});
 const screenToImage=(sx,sy)=>({x:(sx-cover.left)/cover.s,y:(sy-cover.top)/cover.s});

 function edgeAt(px){
  if(px<=EDGE[0][0])return EDGE[0];
  for(let i=1;i<EDGE.length;i++){
   const a=EDGE[i-1],b=EDGE[i];
   if(px<=b[0]){
    const t=(px-a[0])/(b[0]-a[0]);
    // Upright-to-top columns do not blend with finite tops (keeps the arch edge crisp).
    const top=a[2]<-1000||b[2]<-1000?(t<.5?a[2]:b[2]):a[2]+(b[2]-a[2])*t;
    return [px,a[1]+(b[1]-a[1])*t,top];
   }
  }
  return EDGE[EDGE.length-1];
 }
 const pointAt=(cam,dir,depth)=>[0,1,2].map(i=>cam.eye[i]+dir[i]*depth);
 function floorDepth(cam,dir){return dir[1]<-1e-6?-cam.eye[1]/dir[1]:Infinity;}

 // Image px -> projection texture coordinate (piecewise linear, see LAYOUT).
 function texU(px){
  const L=LAYOUT,T=L.texture.width,mid=T-L.texLeft-L.texRight;
  const t=px<0?L.texLeft*(1+Math.max(-1,px/L.padLeft)):
   px>IMAGE.width?L.texLeft+mid+L.texRight*Math.min(1,(px-IMAGE.width)/L.padRight):
   L.texLeft+mid*px/IMAGE.width;
  return t/T;
 }
 function texV(py){
  const L=LAYOUT,T=L.texture.height,mid=IMAGE.height-L.texTop;
  const t=py<=L.texTop?0:py<=IMAGE.height?py-L.texTop:
   mid+(T-mid)*Math.min(1,(py-IMAGE.height)/L.padBottom);
  return 1-t/T; // Babylon textures load with invertY: v=1 is the top row
 }
 // Column positions: breakpoints at the image borders so texU stays linear per cell.
 function columns(grid){
  const out=[],side=grid.side,mid=grid.columns;
  for(let i=0;i<side;i++)out.push(-LAYOUT.padLeft*(1-i/side));
  for(let i=0;i<=mid;i++)out.push(IMAGE.width*i/mid);
  for(let i=1;i<=side;i++)out.push(IMAGE.width+LAYOUT.padRight*i/side);
  return out;
 }

 /* Pure: positions (world), uvs (projection texture) and indices of the proxy mesh.
  * Each column is one projector "slice": far rows down to the wall top, a zero-area
  * skirt from far depth to wall depth, wall rows down to the contact line, floor rows
  * to the image bottom and on through the bottom margin. Texture coordinates are
  * exact at every vertex; rows/columns break exactly at the texture-layout seams. */
 function geometry(view,grid=GRID){
  const cam=camera(view);
  const positions=[],uvs=[],indices=[];
  const cols=columns(grid);
  const rowsPerColumn=(grid.far+1)+(grid.wall+1)+(grid.floor+1)+grid.margin;
  const yTop=LAYOUT.geomTop,yBottom=IMAGE.height+LAYOUT.padBottom;
  for(const px of cols){
   const [,contact,topRaw]=edgeAt(Math.max(0,Math.min(IMAGE.width,px)));
   const top=Math.max(yTop,Math.min(contact,topRaw));
   const s=imageToScreen(px,contact);
   const wallDepth=floorDepth(cam,ray(cam,s.x,s.y));
   const push=(py,depth)=>{
    const sc=imageToScreen(px,py),dir=ray(cam,sc.x,sc.y);
    const d=depth==null?Math.min(floorDepth(cam,dir),FAR_DEPTH):depth;
    positions.push(...pointAt(cam,dir,d));
    uvs.push(texU(px),texV(py));
   };
   for(let r=0;r<=grid.far;r++)push(yTop+(top-yTop)*r/grid.far,FAR_DEPTH);
   for(let r=0;r<=grid.wall;r++)push(top+(contact-top)*r/grid.wall,wallDepth);
   // Denser rows near the contact line, where depth changes fastest.
   for(let r=0;r<=grid.floor;r++)push(contact+(IMAGE.height-contact)*Math.pow(r/grid.floor,1.7),null);
   for(let r=1;r<=grid.margin;r++)push(IMAGE.height+(yBottom-IMAGE.height)*r/grid.margin,null);
  }
  for(let c=0;c<cols.length-1;c++)for(let r=0;r<rowsPerColumn-1;r++){
   const a=c*rowsPerColumn+r,b=a+rowsPerColumn;
   indices.push(a,a+1,b,b,a+1,b+1);
  }
  return {positions,uvs,indices,vertices:positions.length/3,triangles:indices.length/3,camera:cam};
 }

 const enabled=search=>!OPT_OUT.test(String(search||""));
 function supported(B){return !!(B?.Mesh&&B.VertexData&&B.StandardMaterial&&B.Texture&&B.Color3);}
 function animationSupported(B){return !!B?.ShaderMaterial;}

 // ENV-006B shaders. Atlas px == painting px in the middle band (LAYOUT), so offsets in
 // painting px are (dx/2048, -dy/1024) in UV; painting y = texTop + (1-v)*1024.
 const VERTEX=`precision highp float;
attribute vec3 position;attribute vec2 uv;
uniform mat4 worldViewProjection;varying vec2 vUV;
void main(){vUV=uv;gl_Position=worldViewProjection*vec4(position,1.0);}`;
 const f=n=>Number(n).toFixed(4);
 const FRAGMENT=`precision highp float;
varying vec2 vUV;uniform sampler2D art;uniform sampler2D anim;uniform float uTime;uniform float uOn;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
vec2 px(vec2 d){return vec2(d.x/${f(LAYOUT.texture.width)},-d.y/${f(LAYOUT.texture.height)});}
void main(){
 vec4 c=texture2D(art,vUV);
 if(uOn>0.5){
  float t=uTime;
  vec2 img=vec2(vUV.x*${f(LAYOUT.texture.width)}-${f(LAYOUT.texLeft)},${f(LAYOUT.texTop)}+(1.0-vUV.y)*${f(LAYOUT.texture.height)});
  vec3 m=texture2D(anim,vUV).rgb;
  float below=step(${f(MOTION_SPLIT_Y)},img.y);
  float sway=m.b*below,mist=m.b*(1.0-below);
  if(sway>0.004){
   vec2 o=vec2(${f(ANIM.flowerAmplitude)}*sin(t*1.5+img.y*0.035+img.x*0.01),0.35*${f(ANIM.flowerAmplitude)}*sin(t*1.1+img.x*0.03));
   c=texture2D(art,vUV+px(o*sway));
  }
  if(mist>0.004){
   float p1=fract(t*${f(ANIM.mistSpeed)}),p2=fract(p1+0.5),w=abs(2.0*p1-1.0);
   vec2 dir=vec2(0.95,-0.3)*${f(ANIM.mistSweep)};
   vec3 a1=texture2D(art,vUV-px(dir*(p1-0.5))).rgb,a2=texture2D(art,vUV-px(dir*(p2-0.5))).rgb;
   c.rgb=mix(c.rgb,mix(a1,a2,w),mist);
   // Drifting wisps: soft value noise moving with the spray, brightness ±${f(ANIM.mistWisps)}.
   float n=noise(img*vec2(0.035,0.06)-vec2(0.95,-0.3)*t*${f(ANIM.mistSpeed*ANIM.mistSweep*.35)});
   c.rgb+=mist*${f(ANIM.mistWisps*2)}*(n-0.5);
  }
  if(m.g>0.004){
   float gust=0.7+0.3*sin(t*0.37);
   vec2 d=${f(ANIM.leafAmplitude)}*gust*vec2(0.65*sin(t*1.25+img.x*0.011+img.y*0.004)+0.35*sin(t*2.1+img.y*0.017+1.3),
    0.5*(0.6*sin(t*1.05+img.x*0.007+2.0)+0.4*sin(t*1.9+img.x*0.015)));
   float s0=max(m.r,0.3),s1=max(texture2D(anim,vUV+px(d)).r,0.3);
   c.rgb*=mix(1.0,clamp(s1/s0,${f(ANIM.leafRatio[0])},${f(ANIM.leafRatio[1])}),m.g);
  }
 }
 gl_FragColor=vec4(c.rgb,1.0);
}`;

 function create(B,scene,options={}){
  if(!supported(B)||!scene)throw Error("ENV006 requires Babylon geometry and a Scene");
  const view=options.view||(typeof ArenaStageView!=="undefined"?ArenaStageView.view:null);
  if(!view)throw Error("ENV006 needs the ArenaStageView camera");
  const g=geometry(view);
  const resources=[];
  const own=v=>{resources.push(v);return v;};
  let state="loading",disposed=false;
  // ENV-006B clock (seconds) and the animated material; plain fields, tick allocates nothing.
  let clock=0,shader=null,animState="off";
  const report=next=>{
   state=next;
   if(typeof document!=="undefined"&&document.documentElement){
    document.documentElement.dataset.env006=next;
    if(next==="ready")document.documentElement.dataset.environment="ENV006-3D";
   }
   try{options.onState?.(next);}catch(_){}
  };
  try{
   const mesh=own(new B.Mesh("env006_terrace",scene));
   const data=new B.VertexData();
   data.positions=g.positions;data.uvs=g.uvs;data.indices=g.indices;
   const normals=[];B.VertexData.ComputeNormals(g.positions,g.indices,normals);data.normals=normals;
   data.applyToMesh(mesh,false);
   mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
   mesh.alwaysSelectAsActiveMesh=true; // one big static mesh: skip per-frame culling work
   mesh.setEnabled(false);              // hidden until the texture is decoded (CSS art shows)
   const url=options.url||TEXTURE_URL;
   const texture=own(new B.Texture(url,scene,false,true,B.Texture.TRILINEAR_SAMPLINGMODE??3,
    ()=>{if(disposed)return;mesh.setEnabled(true);report("ready");},
    message=>{if(disposed)return;report("error");console.warn("ENV006 texture failed",message);}));
   texture.wrapU=texture.wrapV=B.Texture.CLAMP_ADDRESSMODE??0;
   if("anisotropicFilteringLevel" in texture)texture.anisotropicFilteringLevel=4;
   const animate=!options.reducedMotion&&animationSupported(B);
   let mat;
   if(animate){
    // ENV-006B: same unlit output (raw texel, no tone mapping, no fog) plus the effects.
    mat=own(new B.ShaderMaterial("env006_mat",scene,{vertexSource:VERTEX,fragmentSource:FRAGMENT},
     {attributes:["position","uv"],uniforms:["worldViewProjection","uTime","uOn"],samplers:["art","anim"]}));
    mat.backFaceCulling=false;
    mat.setTexture("art",texture);mat.setTexture("anim",texture); // placeholder until the mask loads
    mat.setFloat("uTime",0);mat.setFloat("uOn",0);
    // onLoad may fire synchronously for a cached texture: apply after both exist.
    let mask=null,maskLoaded=false;
    const applyMask=()=>{if(disposed||!mask||!maskLoaded)return;mat.setTexture("anim",mask);mat.setFloat("uOn",1);animState="running";};
    shader=mat;animState="loading";
    mask=own(new B.Texture(options.maskUrl||ANIM_MASK_URL,scene,false,true,B.Texture.BILINEAR_SAMPLINGMODE??2,
     ()=>{maskLoaded=true;applyMask();},
     message=>{if(disposed)return;animState="static";console.warn("ENV006B mask failed, static backdrop",message);}));
    mask.wrapU=mask.wrapV=B.Texture.CLAMP_ADDRESSMODE??0;
    applyMask();
   }else{
    mat=own(new B.StandardMaterial("env006_mat",scene));
    // The painting already carries its light: unlit, untinted, no fog, no tone mapping
    // (the fighters keep ArenaVis001 ACES; the backdrop must match ENV-005 colours).
    mat.disableLighting=true;mat.emissiveColor=new B.Color3(1,1,1);
    mat.specularColor=new B.Color3(0,0,0);mat.fogEnabled=false;mat.backFaceCulling=false;
    if(B.ImageProcessingConfiguration){
     const ip=new B.ImageProcessingConfiguration();
     ip.toneMappingEnabled=false;ip.contrast=1;ip.exposure=1;ip.vignetteEnabled=false;
     mat.imageProcessingConfiguration=ip;
    }
    mat.diffuseTexture=texture;
    animState=options.reducedMotion?"reduced":"static";
   }
   mesh.material=mat;
   mesh.freezeWorldMatrix?.();
   report("loading");
  }catch(error){
   for(let i=resources.length-1;i>=0;i--)try{resources[i].dispose?.();}catch(_){}
   throw error;
  }
  function dispose(){
   if(disposed)return;disposed=true;
   for(let i=resources.length-1;i>=0;i--)try{resources[i].dispose?.();}catch(_){}
   resources.length=0;
   if(typeof document!=="undefined"&&document.documentElement){
    delete document.documentElement.dataset.env006;
    if(document.documentElement.dataset.environment==="ENV006-3D")
     document.documentElement.dataset.environment="ENV022-CONCEPT-PREVIEW";
   }
  }
  // Called once per rendered battle frame with the engine delta (ms). Real time:
  // ignores hit-stop and battle speed (wind is not game time); stops with the render loop.
  function tick(dt){
   if(shader===null||disposed)return;
   clock+=(dt>0?(dt<ANIM.maxStepMs?dt:ANIM.maxStepMs):0)*.001;
   if(clock>=3600)clock-=3600;
   shader.setFloat("uTime",clock);
  }
  // Test/evidence hook: set the clock directly (seconds).
  function setClock(seconds){if(shader===null||disposed)return;clock=+seconds||0;shader.setFloat("uTime",clock);}
  return Object.freeze({dispose,tick,setClock,state:()=>state,animation:()=>animState,clock:()=>clock,
   stats:Object.freeze({meshes:1,materials:1,textures:shader?2:1,vertices:g.vertices,triangles:g.triangles})});
 }
 return Object.freeze({create,supported,enabled,geometry,camera,toScreen,ray,
  imageToScreen,screenToImage,edgeAt,texU,texV,columns,TEXTURE_URL,IMAGE,REF,LAYOUT,EDGE,GRID,FAR_DEPTH,
  animationSupported,ANIM_MASK_URL,ANIM_MASK,MOTION_SPLIT_Y,ZONES,ANIM,VERTEX,FRAGMENT});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatEnvironment006;
