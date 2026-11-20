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
 * is exported for Node tests; Babylon is touched only in create(). */
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
 const FLAG=/(?:^|[?&])environment=env3d(?:&|$)/;

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

 const enabled=search=>FLAG.test(String(search||""));
 function supported(B){return !!(B?.Mesh&&B.VertexData&&B.StandardMaterial&&B.Texture&&B.Color3);}

 function create(B,scene,options={}){
  if(!supported(B)||!scene)throw Error("ENV006 requires Babylon geometry and a Scene");
  const view=options.view||(typeof ArenaStageView!=="undefined"?ArenaStageView.view:null);
  if(!view)throw Error("ENV006 needs the ArenaStageView camera");
  const g=geometry(view);
  const resources=[];
  const own=v=>{resources.push(v);return v;};
  let state="loading",disposed=false;
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
   const mat=own(new B.StandardMaterial("env006_mat",scene));
   // The painting already carries its light: unlit, untinted, no fog, no tone mapping
   // (the fighters keep ArenaVis001 ACES; the backdrop must match ENV-005 colours).
   mat.disableLighting=true;mat.emissiveColor=new B.Color3(1,1,1);
   mat.specularColor=new B.Color3(0,0,0);mat.fogEnabled=false;mat.backFaceCulling=false;
   if(B.ImageProcessingConfiguration){
    const ip=new B.ImageProcessingConfiguration();
    ip.toneMappingEnabled=false;ip.contrast=1;ip.exposure=1;ip.vignetteEnabled=false;
    mat.imageProcessingConfiguration=ip;
   }
   const url=options.url||TEXTURE_URL;
   const texture=own(new B.Texture(url,scene,false,true,B.Texture.TRILINEAR_SAMPLINGMODE??3,
    ()=>{if(disposed)return;mesh.setEnabled(true);report("ready");},
    message=>{if(disposed)return;report("error");console.warn("ENV006 texture failed",message);}));
   texture.wrapU=texture.wrapV=B.Texture.CLAMP_ADDRESSMODE??0;
   if("anisotropicFilteringLevel" in texture)texture.anisotropicFilteringLevel=4;
   mat.diffuseTexture=texture;
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
  return Object.freeze({dispose,state:()=>state,
   stats:Object.freeze({meshes:1,materials:1,textures:1,vertices:g.vertices,triangles:g.triangles})});
 }
 return Object.freeze({create,supported,enabled,geometry,camera,toScreen,ray,
  imageToScreen,screenToImage,edgeAt,texU,texV,columns,TEXTURE_URL,IMAGE,REF,LAYOUT,EDGE,GRID,FAR_DEPTH});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatEnvironment006;
