// MAP-3D-01F: isolated Babylon browser scene; neutral geometry, no game state.
import {positions,indices,cases,inspect,clear,y,adapters} from './map-3d-01-nav-core.mjs';
const B=window.BABYLON,canvas=document.querySelector('canvas'),status=document.querySelector('#status');
let engine,scene,camera,actor,terrain,adapter,path=[],pos,frameTimes=[],unsafe=0,commands=0,arrivals=0,last=null,ready=false,routeLine,observer,buildMs,engineBase=B.EngineStore.Instances.length;
let follow=false,zoom=8,zoomTarget=8,viewTarget=null,activeTouches=new Map(),gesture=false,pinchStart=0,pinchZoom=8,down=null;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function ortho(){const w=engine.getRenderWidth(),h=engine.getRenderHeight();const x=follow?zoom*w/h:21;camera.orthoLeft=-x;camera.orthoRight=x;camera.orthoTop=x*h/w;camera.orthoBottom=-camera.orthoTop;}
function setFollow(value){follow=value;zoom=zoomTarget=8;viewTarget=vec(value?pos:[7,0,0]);camera.setTarget(viewTarget.clone());ortho();scene.render();}
function onDown(e){if(!follow)return;activeTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(activeTouches.size===1){down={x:e.clientX,y:e.clientY};gesture=false;}if(activeTouches.size===2){gesture=true;const [a,b]=activeTouches.values();pinchStart=Math.hypot(a.x-b.x,a.y-b.y);pinchZoom=zoomTarget;} }
function onMove(e){if(!follow||!activeTouches.has(e.pointerId))return;activeTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(activeTouches.size===2){const [a,b]=activeTouches.values();const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinchStart>0&&d>0)zoomTarget=clamp(pinchZoom*pinchStart/d,5,11);}else if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>12)gesture=true;}
function onUp(e){if(!follow||!activeTouches.has(e.pointerId))return;const tap=!gesture&&activeTouches.size===1&&down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<=12;activeTouches.delete(e.pointerId);if(tap&&e.type==='pointerup'){const rect=canvas.getBoundingClientRect();const p=scene.pick(e.clientX-rect.left,e.clientY-rect.top,m=>m===terrain);select(p.hit?asArray(p.pickedPoint):null);}if(!activeTouches.size){down=null;gesture=false;}}
function onCancel(e){gesture=true;onUp(e);}

const vec=p=>B.Vector3.FromArray(p),asArray=v=>[v.x,v.y,v.z];
const ground=p=>[p[0],y(p[0]),p[2]];
function reset(from){
 path=[];pos=ground(from);actor.position.copyFrom(vec(pos).add(new B.Vector3(0,.55,0)));
 if(routeLine){routeLine.dispose();routeLine=null;}
 unsafe=0;last=null;if(follow){viewTarget=vec(pos);camera.setTarget(viewTarget.clone());scene.render();}
}
function setStatus(s){status.textContent=s;}
function select(target){
 commands++;
 if(routeLine){routeLine.dispose();routeLine=null;}
 path=[];
 if(!target){last={accepted:false,reason:'no ground hit'};setStatus('No ground');return;}
 const raw=adapter.query(pos,target),result=inspect({from:pos,to:target},raw);
 last={...result,target};
 if(!result.accepted){setStatus('Unreachable');return;}
 path=raw.map(ground);routeLine=B.MeshBuilder.CreateLines('path',{points:[vec(pos).add(new B.Vector3(0,.08,0)),...path.map(p=>vec(p).add(new B.Vector3(0,.08,0)))]},scene);
 routeLine.color=new B.Color3(1,.75,.22);routeLine.isPickable=false;
 setStatus('Walking');
}
function tick(){
 const dt=engine.getDeltaTime();if(dt>0&&frameTimes.length<3000)frameTimes.push(dt);
 let budget=Math.min(dt,100)*.022; // accelerated lab only, same for all candidates
 const wasWalking=path.length>0;
 while(path.length&&budget>0){
   const next=path[0],dist=B.Vector3.Distance(vec(pos),vec(next));
   if(dist<1e-5){pos=next;path.shift();continue;}
   const step=Math.min(budget,dist),previous=pos;
   pos=ground(asArray(B.Vector3.Lerp(vec(pos),vec(next),step/dist)));
   const n=Math.max(1,Math.ceil(step/.05));
   for(let i=0;i<=n;i++){const t=i/n;if(!clear(previous[0]+(pos[0]-previous[0])*t,previous[2]+(pos[2]-previous[2])*t))unsafe++;}
   budget-=step;if(step===dist){pos=next;path.shift();}
   actor.position.copyFrom(vec(pos).add(new B.Vector3(0,.55,0)));
 }
 if(wasWalking&&!path.length){arrivals++;setStatus('Arrived');}
 if(follow){const k=1-Math.exp(-Math.min(dt,100)/120);viewTarget=B.Vector3.Lerp(viewTarget,vec(pos),k);camera.setTarget(viewTarget.clone());zoom+=(zoomTarget-zoom)*k;ortho();}
 scene.render();
}
async function close(){
 ready=false;follow=false;activeTouches.clear();down=null;gesture=false;canvas.removeEventListener('pointerdown',onDown);canvas.removeEventListener('pointermove',onMove);canvas.removeEventListener('pointerup',onUp);canvas.removeEventListener('pointercancel',onCancel);if(engine){engine.stopRenderLoop();window.removeEventListener('resize',resize);if(observer)scene.onPointerObservable.remove(observer);scene.dispose();engine.dispose();}
 adapter?.dispose?.();engine=scene=camera=actor=terrain=adapter=routeLine=observer=null;path=[];return B.EngineStore.Instances.length;
}
function resize(){if(engine){engine.resize();ortho();}}
async function open(name){
 await close();const start=performance.now();adapter=await adapters[name]();buildMs=performance.now()-start;
 engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:false});scene=new B.Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new B.Color4(.11,.15,.18,1);
 camera=new B.ArcRotateCamera('fixed test camera',-Math.PI/2,Math.PI/3,42,new B.Vector3(7,0,0),scene);
 camera.mode=B.Camera.ORTHOGRAPHIC_CAMERA;camera.orthoLeft=-21;camera.orthoRight=21;camera.orthoTop=21*engine.getRenderHeight()/engine.getRenderWidth();camera.orthoBottom=-camera.orthoTop;
 scene.activeCamera=camera;
 new B.HemisphericLight('light',new B.Vector3(0,1,0),scene);
 terrain=new B.Mesh('exact same walkable mesh',scene);
 const data=new B.VertexData();data.positions=positions;data.indices=indices;data.normals=[];B.VertexData.ComputeNormals(positions,indices,data.normals,{useRightHandedSystem:true});data.applyToMesh(terrain);
 const mat=new B.StandardMaterial('floor',scene);mat.diffuseColor=new B.Color3(.39,.55,.49);mat.backFaceCulling=false;mat.emissiveColor=new B.Color3(.12,.22,.18);terrain.material=mat;
 actor=B.MeshBuilder.CreateCapsule('actor proxy',{height:1.1,radius:.28},scene);actor.isPickable=false;
 const am=new B.StandardMaterial('actor',scene);am.diffuseColor=new B.Color3(.9,.55,.2);actor.material=am;
 frameTimes=[];commands=arrivals=0;reset(cases[0].from);
 observer=scene.onPointerObservable.add(info=>{if(follow||info.type!==B.PointerEventTypes.POINTERDOWN)return;const p=scene.pick(scene.pointerX,scene.pointerY,m=>m===terrain);select(p.hit?asArray(p.pickedPoint):null);});
 canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onCancel);window.addEventListener('resize',resize);engine.runRenderLoop(tick);scene.render();ready=true;setStatus(name);
 return {buildMs,engines:B.EngineStore.Instances.length,base:engineBase,meshes:scene.meshes.length};
}
function project(p){
 const v=B.Vector3.Project(vec(p),B.Matrix.Identity(),scene.getTransformMatrix(),camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight()));
 const rect=canvas.getBoundingClientRect();return {x:rect.left+v.x*rect.width/engine.getRenderWidth(),y:rect.top+v.y*rect.height/engine.getRenderHeight()};
}
window.lab={open,close,reset,project,setFollow,cases:cases.map(x=>({...x})),snapshot:()=>({ready,pos,last,commands,arrivals,follow,zoom,zoomTarget,cameraTarget:viewTarget?asArray(viewTarget):null,actorScreen:actor?project(asArray(actor.position)):null,walking:path.length>0,unsafe,frames:frameTimes.slice(),engines:B.EngineStore.Instances.length,meshes:scene?.meshes.length,buildMs})};
