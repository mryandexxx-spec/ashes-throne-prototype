// Isolated MAP-3D-02A. No game save, progression or campaign imports.
import {init,importNavMesh,NavMeshQuery} from 'recast-navigation';
import {createInteractions} from './interaction.mjs';
// MAP-3D-04 — movement/input/camera, based on frozen DEVICE-01.
const B=window.BABYLON,canvas=document.querySelector('canvas'),status=document.querySelector('#status');
const V=p=>B.Vector3.FromArray(p),arr=v=>v.asArray(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');
let engine,scene,camera,proxy,holder,mesh,query,groups,level,artMeshes=[],markers=[],pos,path=[],route,activeClip,groundOffset=0,commands=0,arrivals=0,unsafe=0,last=null,ready=false,loading=false,epoch=0,zoom=6,zoomGoal=6,overview=false,view,pace='walk',frames=[],visited=new Set(),metrics={},pointer=new Map(),gesture=false,down=null,pinchStart=0,pinchZoom=0,events=[],routeCosts=[],updateCosts=[];
let shadow=null,sun=null,quality={shadows:true,scale:1},fpsStart=0,fpsCount=0,skipDelta=true,cameraSpan=5.5;
const fpsNode=document.querySelector('#fps');
const say=s=>status.textContent=s;
function resetFPS(){fpsStart=performance.now();fpsCount=0;fpsNode.textContent='FPS —';skipDelta=true;}
function showFPS(){fpsCount++;const t=performance.now(),elapsed=t-fpsStart;if(elapsed>=1000){const fps=1000*fpsCount/elapsed;fpsNode.textContent=fps.toFixed(1)+' FPS · '+(elapsed/fpsCount).toFixed(1)+' мс · '+engine.getRenderWidth()+'×'+engine.getRenderHeight();fpsCount=0;fpsStart=t;}}
function configureShadows(){
 if(!scene||!sun)return;
 if(shadow&&!quality.shadows){shadow.dispose();shadow=null;}
 if(!shadow&&quality.shadows){
  shadow=new B.ShadowGenerator(1024,sun);shadow.usePercentageCloserFiltering=true;shadow.normalBias=.025;shadow.bias=.0008;sun.autoCalcShadowZBounds=true;sun.autoUpdateExtends=true;
  for(const m of scene.meshes)if(m.getTotalVertices()>0&&m!==proxy&&!markers.includes(m)&&m!==route){shadow.addShadowCaster(m,false);m.receiveShadows=true;}
 }
 scene.shadowsEnabled=quality.shadows;
}
function updateButtons(){const a=document.querySelector('#shadows'),b=document.querySelector('#resolution');a.textContent=quality.shadows?'Тени: вкл':'Тени: выкл';a.setAttribute('aria-pressed',String(quality.shadows));b.textContent=quality.scale===1?'Чёткость: 100%':'Чёткость: 67%';b.setAttribute('aria-pressed',String(quality.scale!==1));a.disabled=b.disabled=!ready;}
function clearInput(){const ids=[...pointer.keys()];pointer.clear();down=null;gesture=false;pinchStart=0;for(const id of ids){try{if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}catch{}}}
function visibility(){if(!ready||!engine)return;engine.stopRenderLoop(tick);clearInput();resetFPS();if(!document.hidden){resize();engine.runRenderLoop(tick);} }
document.addEventListener('visibilitychange',visibility);
window.addEventListener('pagehide',e=>{if(e.persisted){engine?.stopRenderLoop(tick);clearInput();resetFPS();}else close();});
window.addEventListener('pageshow',e=>{if(e.persisted)visibility();});
document.querySelector('#shadows').onclick=()=>{if(!ready)return;quality.shadows=!quality.shadows;configureShadows();resetFPS();updateButtons();};
document.querySelector('#resolution').onclick=()=>{if(!ready)return;quality.scale=quality.scale===1?1.5:1;engine.setHardwareScalingLevel(quality.scale);resize();resetFPS();updateButtons();};
const record=(type,data={})=>{events.push({type,...data});if(events.length>200)events.shift();};
async function bytes(url,expected){const resp=await fetch(url);if(!resp.ok)throw Error('Asset unavailable: '+url);const b=await resp.arrayBuffer();if(expected&&await hash(b)!==expected)throw Error('Asset hash mismatch: '+url);return b;}
function floor(x,z){const hit=scene.pickWithRay(new B.Ray(new B.Vector3(x,100,z),new B.Vector3(0,-1,0),200),m=>m===proxy);return hit.hit?hit.pickedPoint.y:null;}
function grounded(p){const y=floor(p[0],p[2]);return y===null?null:[p[0],y,p[2]];}
function valid(p){return [[0,0],[.2,0],[-.2,0],[0,.2],[0,-.2]].every(([x,z])=>floor(p[0]+x,p[2]+z)!==null);}
function clip(name){if(activeClip===name)return;groups[activeClip]?.stop();groups[name].start(true);activeClip=name;record('clip',{name});}
function updateCamera(dt){const k=1-Math.exp(-dt/120),desired=V(overview?[0,0,-2.5]:pos);view=B.Vector3.Lerp(view,desired,k);camera.setTarget(view.clone());zoom+=(zoomGoal-zoom)*k;const aspect=engine.getRenderWidth()/Math.max(1,engine.getRenderHeight());cameraSpan+=((overview?12/aspect:zoom)-cameraSpan)*k;const x=cameraSpan*aspect;camera.orthoLeft=-x;camera.orthoRight=x;camera.orthoTop=cameraSpan;camera.orthoBottom=-cameraSpan;}
function stop(reason){path=[];route?.dispose();route=null;if(groups)clip('Idle_4');document.querySelector('#stop').disabled=true;if(reason)say(reason);}
function select(target){const start=performance.now();try{selectImpl(target);}finally{if(routeCosts.length<6000)routeCosts.push(performance.now()-start);}}
function selectImpl(target){if(!ready||!interactions.canMove())return;commands++;last={accepted:false,target};if(!target||!valid(target)){say('Недоступная точка');return;}
 const vec=p=>({x:p[0],y:p[1],z:p[2]}),x=query.computePath(vec(pos),vec(target));
 const raw=x.success?x.path.map(v=>[v.x,v.y,v.z]):[];
 if(raw.length<2||B.Vector3.Distance(V(raw[0]),V(pos))>.65||B.Vector3.Distance(V(raw.at(-1)),V(target))>.65){say('Маршрут недоступен');return;}
 const points=[pos,...raw].map(grounded);if(points.some(p=>!p)){say('Маршрут недоступен');return;}
 for(let i=1;i<points.length;i++){const a=V(points[i-1]),b=V(points[i]),n=Math.max(1,Math.ceil(B.Vector3.Distance(a,b)/.1));for(let j=0;j<=n;j++)if(!valid(arr(B.Vector3.Lerp(a,b,j/n)))){say('Маршрут недоступен');return;}}
 route?.dispose();path=points.slice(1);last={accepted:true,target,points};document.querySelector('#stop').disabled=false;route=B.MeshBuilder.CreateLines('route',{points:points.map(p=>V(p).add(new B.Vector3(0,.06,0)))},scene);route.color=new B.Color3(.97,.72,.24);route.isPickable=false;
 clip(pace==='run'?'Running':'Walking');say('В пути');
}
function tick(){if(!ready)return;const t0=performance.now(),rawDt=engine.getDeltaTime(),dt=skipDelta?0:Math.min(rawDt,100);if(!skipDelta&&rawDt>0&&frames.length<6000)frames.push(rawDt);skipDelta=false;
 const walking=path.length>0;let failed=false,heading=null;let budget=dt/1000*(pace==='run'?5:3);
 while(path.length&&budget>0){const next=V(path[0]),a=V(pos),d=B.Vector3.Distance(a,next);if(d<.0001){path.shift();continue;}const step=Math.min(budget,d),p=grounded(arr(B.Vector3.Lerp(a,next,step/d)));if(!p||!valid(p)){unsafe++;failed=true;stop('Небезопасный маршрут');break;}const dx=p[0]-pos[0],dz=p[2]-pos[2];if(Math.hypot(dx,dz)>.0001){heading=Math.atan2(dx,dz);}pos=p;holder.position.set(pos[0],pos[1]+groundOffset,pos[2]);budget-=step;if(step===d)path.shift();}
 if(heading!==null){const delta=Math.atan2(Math.sin(heading-holder.rotation.y),Math.cos(heading-holder.rotation.y));holder.rotation.y+=clamp(delta,-dt*.012,dt*.012);}
 if(walking&&!path.length&&!failed){arrivals++;stop('Прибытие');for(const m of level.markers){if(B.Vector3.Distance(V(pos),V(m.position))<.8){visited.add(m.id);say('Точка: '+m.id);}}record('arrival',{pos:[...pos]});}
 updateCamera(dt);if(updateCosts.length<6000)updateCosts.push(performance.now()-t0);scene.render();interactions.update();showFPS();
}
function resize(){if(engine){engine.resize();if(ready)updateCamera(0);}}
function beginPinch(){const [a,b]=pointer.values();pinchStart=Math.hypot(a.x-b.x,a.y-b.y);pinchZoom=zoomGoal;}
function downEvent(e){if(!ready||e.button!==0||pointer.has(e.pointerId))return;pointer.set(e.pointerId,{x:e.clientX,y:e.clientY});try{canvas.setPointerCapture(e.pointerId);}catch{}if(pointer.size===1){down={x:e.clientX,y:e.clientY};gesture=false;}else{gesture=true;if(pointer.size===2)beginPinch();}}
function moveEvent(e){if(!pointer.has(e.pointerId))return;pointer.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointer.size===2){const [a,b]=pointer.values(),d=Math.hypot(a.x-b.x,a.y-b.y);if(d>0&&pinchStart>0&&!overview)zoomGoal=clamp(pinchZoom*pinchStart/d,3.8,9);}else if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>12)gesture=true;}
function pickDestination(x,y){const rect=canvas.getBoundingClientRect(),hit=scene.pick(x-rect.left,y-rect.top,m=>m===proxy),visible=scene.pick(x-rect.left,y-rect.top,m=>artMeshes.includes(m)&&!m.name.startsWith('walkable_support'));return hit.hit&&!(visible.hit&&visible.distance<hit.distance-.04)?arr(hit.pickedPoint):null;}
function upEvent(e){if(!pointer.has(e.pointerId))return;const tap=!gesture&&pointer.size===1&&down&&e.type==='pointerup'&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<=12;pointer.delete(e.pointerId);if(tap)select(pickDestination(e.clientX,e.clientY));if(pointer.size===2)beginPinch();if(!pointer.size){down=null;gesture=false;pinchStart=0;}}
function cancelEvent(e){if(!pointer.has(e.pointerId))return;gesture=true;upEvent(e);}
const bindings=[['pointerdown',downEvent],['pointermove',moveEvent],['pointerup',upEvent],['pointercancel',cancelEvent],['lostpointercapture',cancelEvent]];
window.addEventListener('blur',clearInput);
function close(){interactions.reset();epoch++;ready=false;loading=false;for(const [n,f] of bindings)canvas.removeEventListener(n,f);window.removeEventListener('resize',resize);clearInput();document.querySelector('#stop').disabled=true;if(engine){engine.stopRenderLoop();shadow?.dispose();scene?.dispose();engine.dispose();}shadow=sun=null;resetFPS();updateButtons();query?.destroy();mesh?.destroy();engine=scene=camera=proxy=holder=query=mesh=groups=route=null;path=[];markers=[];artMeshes=[];level=null;pos=null;view=null;last=null;activeClip=null;return B.EngineStore.Instances.length;}
async function open(){close();const token=epoch;loading=true;document.querySelector('#restart').disabled=true;say('Загрузка…');const start=performance.now(),check=()=>{if(token!==epoch)throw Error('cancelled');};
 try{
 const manifest=await (await fetch('../map-3d/level/manifest.json')).json();if(manifest.schema!==1||manifest.recast!=='0.43.1')throw Error('Incompatible level package');
 const [meta,nav,bin,art]=await Promise.all(['level.json','nav.json','navmesh.bin','level.glb'].map(n=>bytes('../map-3d/level/'+n,manifest.files[n])));check();
 level=JSON.parse(new TextDecoder().decode(meta));const geometry=JSON.parse(new TextDecoder().decode(nav));await init();check();mesh=importNavMesh(new Uint8Array(bin)).navMesh;query=new NavMeshQuery(mesh);metrics={navReadyMs:performance.now()-start};
 engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:false});engine.setHardwareScalingLevel(quality.scale);scene=new B.Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new B.Color4(.29,.38,.46,1);
 camera=new B.ArcRotateCamera('explorer',1.20,.94,35,new B.Vector3(0,0,0),scene);camera.mode=B.Camera.ORTHOGRAPHIC_CAMERA;scene.activeCamera=camera;
 const hemi=new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene);hemi.intensity=.65;hemi.groundColor=new B.Color3(.38,.34,.31);
 sun=new B.DirectionalLight('sun',new B.Vector3(-.9,-.7,-.5),scene);sun.intensity=2.8;sun.diffuse=new B.Color3(1,.92,.79);sun.position=new B.Vector3(30,24,16);
 scene.fogMode=B.Scene.FOGMODE_LINEAR;scene.fogColor=new B.Color3(.29,.38,.46);scene.fogStart=33;scene.fogEnd=62;
 scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;scene.imageProcessingConfiguration.exposure=1.1;scene.imageProcessingConfiguration.contrast=1.05;
 const url=URL.createObjectURL(new Blob([art],{type:'model/gltf-binary'}));try{artMeshes=(await B.SceneLoader.ImportMeshAsync(null,'',url,scene,undefined,'.glb')).meshes;}finally{URL.revokeObjectURL(url);}check();metrics.artReadyMs=performance.now()-start;
 proxy=new B.Mesh('author nav picking proxy',scene);const vd=new B.VertexData();vd.positions=geometry.positions;vd.indices=geometry.indices;vd.normals=[];B.VertexData.ComputeNormals(vd.positions,vd.indices,vd.normals,{useRightHandedSystem:true});vd.applyToMesh(proxy);proxy.visibility=0;proxy.isPickable=true;proxy.computeWorldMatrix(true);
 markers=level.markers.filter(m=>m.role!=='spawn').map(m=>{const o=B.MeshBuilder.CreateSphere(m.id,{diameter:.5,segments:12},scene);o.position.copyFrom(V(m.position).add(new B.Vector3(0,.25,0)));o.isPickable=false;const mat=new B.StandardMaterial(m.id,scene);mat.emissiveColor=m.role==='exit'?new B.Color3(.3,1,.4):new B.Color3(.9,.65,.2);o.material=mat;o.visibility=0;return o;});
 const hero=await B.SceneLoader.ImportMeshAsync(null,'../../assets/','ren-meshy-mixamo-animated.glb',scene,undefined,'.glb');check();metrics.heroReadyMs=performance.now()-start;
 groups=Object.fromEntries(hero.animationGroups.map(g=>[g.name,g]));for(const g of hero.animationGroups)g.stop();for(const n of ['Idle_4','Walking','Running'])if(!groups[n])throw Error('Missing '+n);
 configureShadows();
 const root=hero.meshes[0];root.computeWorldMatrix(true);const bounds=root.getHierarchyBoundingVectors(true),height=bounds.max.y-bounds.min.y;if(!(height>0))throw Error('Invalid character height');
 holder=new B.TransformNode('navigation owner',scene);root.parent=holder;holder.scaling.setAll(1.7/height);groundOffset=-bounds.min.y*1.7/height;
 pos=level.markers.find(m=>m.role==='spawn').position;holder.position.set(pos[0],pos[1]+groundOffset,pos[2]);view=V(pos);overview=false;document.querySelector('#overview').textContent='Обзор';document.querySelector('#overview').setAttribute('aria-pressed','false');zoom=zoomGoal=cameraSpan=5.5;pace='walk';document.querySelector('#pace').textContent='Бег';frames=[];events=[];routeCosts=[];updateCosts=[];visited=new Set();commands=arrivals=unsafe=0;last=null;activeClip=null;clip('Idle_4');for(const [n,f] of bindings)canvas.addEventListener(n,f);window.addEventListener('resize',resize);ready=true;loading=false;document.querySelector('#restart').disabled=false;updateButtons();updateCamera(100);scene.render();resetFPS();if(!document.hidden)engine.runRenderLoop(tick);metrics.readyMs=performance.now()-start;say('Коснись места назначения');
 }catch(e){if(token===epoch){close();document.querySelector('#restart').disabled=false;say('Ошибка загрузки: '+e.message);throw e;}}
}
function project(p){const v=B.Vector3.Project(V(p),B.Matrix.Identity(),scene.getTransformMatrix(),camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight())),rect=canvas.getBoundingClientRect();return {x:rect.left+v.x*rect.width/engine.getRenderWidth(),y:rect.top+v.y*rect.height/engine.getRenderHeight()};}
document.querySelector('#overview').onclick=()=>{if(!ready)return;overview=!overview;document.querySelector('#overview').textContent=overview?'За героем':'Обзор';document.querySelector('#overview').setAttribute('aria-pressed',String(overview));};
document.querySelector('#pace').onclick=()=>{pace=pace==='walk'?'run':'walk';document.querySelector('#pace').textContent=pace==='walk'?'Бег':'Шаг';if(path.length)clip(pace==='run'?'Running':'Walking');};
document.querySelector('#stop').onclick=()=>{if(ready&&path.length){stop('Остановлен');record('cancel',{pos:[...pos]});}};
document.querySelector('#restart').onclick=()=>{if(!loading)open().catch(console.error);};
function resourceInventory(){if(!scene)return null;return {meshes:scene.meshes.length,vertices:scene.meshes.reduce((n,m)=>n+m.getTotalVertices(),0),indices:scene.meshes.reduce((n,m)=>n+m.getTotalIndices(),0),materials:scene.materials.length,skeletons:scene.skeletons.length,animationGroups:scene.animationGroups.length,textures:scene.textures.map(t=>({name:t.name?.slice(0,100),width:t.getSize().width,height:t.getSize().height})),internalTextures:engine.getLoadedTexturesCache().length,renderSize:[engine.getRenderWidth(),engine.getRenderHeight()]};}
const interactions=createInteractions({view:()=>({ready,pos,walking:path.length>0}),move:select,project});
window.lab={open,close,project,pickDestination,resourceInventory,snapshot:()=>({exploration:interactions.snapshot(),ready,loading,quality:{...quality},pos,last,commands,arrivals,unsafe,walking:path.length>0,clip:activeClip,clipPlaying:groups?.[activeClip]?.isPlaying,events:[...events],visited:[...visited],frames:[...frames],routeCosts:[...routeCosts],updateCosts:[...updateCosts],metrics,engines:B.EngineStore.Instances.length,meshes:scene?.meshes.length,textures:scene?.textures.length,zoom,zoomGoal,overview,cameraSpan,cameraSettled:ready&&B.Vector3.Distance(view,V(overview?[0,0,-2.5]:pos))<.04&&Math.abs(cameraSpan-(overview?12*engine.getRenderHeight()/engine.getRenderWidth():zoomGoal))<.04,pointers:pointer.size,heading:holder?.rotation.y,heroScreen:ready?project(arr(holder.position)):null})};
open().catch(console.error);
