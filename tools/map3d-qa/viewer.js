(async()=>{
const canvas=document.querySelector('canvas'),status=document.querySelector('#status'),B=window.BABYLON;
let engine,scene,camera,geometry=[],active,frames=0,ready=false,closed=false,error=null,ms=[],loadMs=0,manifest,stage='ENGINE';
const start=performance.now(),V=a=>B.Vector3.FromArray(a);
const snap=()=>({ready,closed,error,stage,active,frames,loadMs,frameMs:[...ms],engines:B?.EngineStore.Instances.length??0,version:B?.Engine.Version,meshes:geometry.length,triangles:geometry.reduce((s,m)=>s+m.getTotalIndices()/3,0),materials:scene?.materials.length??0,textures:scene?.textures.length??0,renderSize:engine?[engine.getRenderWidth(),engine.getRenderHeight()]:null});
function resize(){if(!engine||closed)return;engine.resize();if(camera&&manifest){const span=manifest.views.find(v=>v.id===active)?.span??6,a=engine.getRenderWidth()/Math.max(1,engine.getRenderHeight());camera.orthoLeft=-span*a;camera.orthoRight=span*a;camera.orthoTop=span;camera.orthoBottom=-span;}}
function close(){if(closed)return;closed=true;ready=false;window.removeEventListener('resize',resize);engine?.stopRenderLoop();scene?.dispose();engine?.dispose();}
window.qa={snapshot:snap,close};window.addEventListener('pagehide',close);
try{
if(!B)throw Error('Local Babylon unavailable');engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:false});scene=new B.Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new B.Color4(.20,.27,.29,1);
camera=new B.ArcRotateCamera('review',0,1,16,B.Vector3.Zero(),scene);camera.mode=B.Camera.ORTHOGRAPHIC_CAMERA;camera.minZ=.1;camera.maxZ=500;camera.attachControl(canvas,true);
const ambient=new B.HemisphericLight('sky',new B.Vector3(0,1,0),scene);ambient.intensity=.85;
const sun=new B.DirectionalLight('sun',new B.Vector3(-.4,-1,.45),scene);sun.intensity=2.2;
stage='INPUT';manifest=await (await fetch('/manifest.json')).json();const response=await fetch('/map.glb');if(!response.ok)throw Error('GLB unavailable');const bytes=await response.arrayBuffer();
const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(sha!==manifest.sha256||bytes.byteLength!==manifest.bytes)throw Error('Candidate identity mismatch');
stage='IMPORT';const url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));try{const result=await B.SceneLoader.ImportMeshAsync(null,'',url,scene,undefined,'.glb');geometry=result.meshes.filter(m=>m.getTotalVertices()>0);}finally{URL.revokeObjectURL(url);}
if(!geometry.length||!snap().triangles)throw Error('No visible geometry');if(manifest.triangles!=null&&snap().triangles!==manifest.triangles)throw Error('Triangle count mismatch');
function view(v){active=v.id;camera.setTarget(V(v.target));camera.setPosition(V(v.target.map((x,i)=>x+v.offset[i])));resize();status.textContent=manifest.id+' / '+v.id;}
for(const v of manifest.views){const b=document.createElement('button');b.dataset.view=v.id;b.textContent=v.id;b.onclick=()=>view(v);document.querySelector('nav').append(b);}
window.addEventListener('resize',resize);view(manifest.views[0]);stage='RENDER';await scene.whenReadyAsync();scene.render();ready=true;loadMs=performance.now()-start;engine.runRenderLoop(()=>{if(!ready||closed)return;scene.render();frames++;if(ms.length<240&&frames>5)ms.push(engine.getDeltaTime());});
}catch(e){error=String(e);status.textContent=stage+' '+error;console.error(e);close();}
})();