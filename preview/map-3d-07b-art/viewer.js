// Isolated 07B spatial model viewer. No game/profile/save or encounter imports.
(async()=>{
const B=window.BABYLON,canvas=document.querySelector('canvas'),status=document.querySelector('#status'),buttons=[...document.querySelectorAll('[data-view]')];
const engine=new B.Engine(canvas,true,{stencil:false,preserveDrawingBuffer:false}),scene=new B.Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new B.Color4(.20,.27,.29,1);
const V=(a)=>B.Vector3.FromArray(a);
const views={overview:{p:[120,163,-182],t:[78,0,-55]},upper:{p:[34,28,-45],t:[23,13,-24]},work:{p:[66,25,-83],t:[51,7,-63]},garden:{p:[74,19,-115],t:[66,3,-95]},east:{p:[138,29,-83],t:[119,9,-65]}};
const camera=new B.ArcRotateCamera('review',0,1,100,V(views.overview.t),scene);scene.activeCamera=camera;camera.minZ=.15;camera.maxZ=500;camera.lowerRadiusLimit=8;camera.upperRadiusLimit=290;camera.lowerBetaLimit=.13;camera.upperBetaLimit=1.48;camera.wheelDeltaPercentage=.025;camera.pinchDeltaPercentage=.02;camera.panningSensibility=180;camera.attachControl(canvas,true);
const ambient=new B.HemisphericLight('sky',new B.Vector3(0,1,0),scene);ambient.intensity=.82;ambient.groundColor=new B.Color3(.38,.4,.42);
const sun=new B.DirectionalLight('sun',new B.Vector3(-.4,-1,.45),scene);sun.intensity=2.2;sun.diffuse=new B.Color3(1,.93,.8);
scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;
let active='overview',ready=false,disposed=false,error=null,meshes=0,triangles=0,frames=0;
function view(key){const v=views[key];if(!v||disposed)return;camera.setTarget(V(v.t));camera.setPosition(V(v.p));active=key;for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.view===key));}
view(active);
for(const button of buttons)button.addEventListener('click',()=>view(button.dataset.view));
const resize=()=>{if(!disposed)engine.resize();};
const tick=()=>{if(ready&&!disposed){scene.render();frames++;}};
function visibility(){if(disposed)return;engine.stopRenderLoop(tick);if(ready&&!document.hidden)engine.runRenderLoop(tick);}
function close(){if(disposed)return;disposed=true;ready=false;engine.stopRenderLoop(tick);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);scene.dispose();engine.dispose();}
window.addEventListener('resize',resize);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',e=>{if(e.persisted)engine.stopRenderLoop(tick);else close();});window.addEventListener('pageshow',e=>{if(e.persisted){resize();visibility();}});
window.spatialReview={snapshot:()=>({ready,error,meshes,triangles,frames,active,alpha:camera.alpha,beta:camera.beta,radius:camera.radius,engines:B.EngineStore.Instances.length}),close};
try{
 const mr=await fetch('./art-manifest.json');if(!mr.ok)throw Error('Art manifest unavailable');const manifest=await mr.json();const response=await fetch('./gardens_art_01.glb');if(!response.ok)throw Error('GLB unavailable');const bytes=await response.arrayBuffer();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==manifest.artGLBSHA256||bytes.byteLength!==manifest.bytes)throw Error('GLB hash mismatch');
 const url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));let result;try{result=await B.SceneLoader.ImportMeshAsync(null,'',url,scene,undefined,'.glb');}finally{URL.revokeObjectURL(url);}
 if(disposed)return;
 const geometry=result.meshes.filter(m=>m.getTotalVertices()>0);meshes=geometry.length;triangles=geometry.reduce((s,m)=>s+m.getTotalIndices()/3,0);
 if(manifest.artRevision!==2||manifest.detailLots!==14||!meshes||triangles<10000||triangles>150000)throw Error('Unexpected mesh data: '+triangles);
 // Apply a single bounded directional shadow map to anchor buildings and vegetation.
 sun.position=new B.Vector3(65,100,-15);
 sun.autoCalcShadowZBounds=true;sun.shadowMinZ=1;sun.shadowMaxZ=230;
 const shadow=new B.ShadowGenerator(1024,sun);shadow.usePercentageCloserFiltering=true;shadow.filteringQuality=B.ShadowGenerator.QUALITY_LOW;shadow.bias=.0008;shadow.normalBias=.035;
 for(const m of geometry){m.receiveShadows=true;if(!/continuous_bedrock|terrace_|street_|walking_surface|_support/.test(m.name))shadow.addShadowCaster(m,false);}
 shadow.getShadowMap().refreshRate=B.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
 ready=true;status.textContent='Арт 02 · 5 районов';for(const button of buttons)button.disabled=false;resize();scene.render();visibility();
}catch(e){error=String(e);status.textContent='Ошибка загрузки модели';console.error(e);close();}
})();