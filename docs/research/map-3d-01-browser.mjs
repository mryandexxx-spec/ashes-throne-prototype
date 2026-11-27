// MAP-3D-01F: isolated Babylon browser scene; neutral geometry, no game state.
import {positions,indices,cases,inspect,clear,y,adapters} from './map-3d-01-nav-core.mjs';
const B=window.BABYLON,canvas=document.querySelector('canvas'),status=document.querySelector('#status');
let engine,scene,camera,actor,terrain,adapter,path=[],pos,frameTimes=[],unsafe=0,commands=0,arrivals=0,last=null,ready=false,routeLine,observer,buildMs,engineBase=B.EngineStore.Instances.length;
const vec=p=>B.Vector3.FromArray(p),asArray=v=>[v.x,v.y,v.z];
const ground=p=>[p[0],y(p[0]),p[2]];
function reset(from){
 path=[];pos=ground(from);actor.position.copyFrom(vec(pos).add(new B.Vector3(0,.55,0)));
 if(routeLine){routeLine.dispose();routeLine=null;}
 unsafe=0;last=null;
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
 scene.render();
}
async function close(){
 ready=false;if(engine){engine.stopRenderLoop();window.removeEventListener('resize',resize);if(observer)scene.onPointerObservable.remove(observer);scene.dispose();engine.dispose();}
 adapter?.dispose?.();engine=scene=camera=actor=terrain=adapter=routeLine=observer=null;path=[];return B.EngineStore.Instances.length;
}
function resize(){engine?.resize();}
async function open(name){
 await close();const start=performance.now();adapter=await adapters[name]();buildMs=performance.now()-start;
 engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false,stencil:false});scene=new B.Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new B.Color4(.11,.15,.18,1);
 camera=new B.ArcRotateCamera('fixed test camera',-Math.PI/2,Math.PI/3,42,new B.Vector3(7,0,0),scene);
 camera.mode=B.Camera.ORTHOGRAPHIC_CAMERA;camera.orthoLeft=-21;camera.orthoRight=21;camera.orthoTop=21*engine.getRenderHeight()/engine.getRenderWidth();camera.orthoBottom=-camera.orthoTop;
 scene.activeCamera=camera;
 new B.HemisphericLight('light',new B.Vector3(0,1,0),scene);
 terrain=new B.Mesh('exact same walkable mesh',scene);
 const data=new B.VertexData();data.positions=positions;data.indices=indices;data.normals=[];B.VertexData.ComputeNormals(positions,indices,data.normals);data.applyToMesh(terrain);
 const mat=new B.StandardMaterial('floor',scene);mat.diffuseColor=new B.Color3(.39,.55,.49);mat.backFaceCulling=false;terrain.material=mat;
 actor=B.MeshBuilder.CreateCapsule('actor proxy',{height:1.1,radius:.28},scene);actor.isPickable=false;
 const am=new B.StandardMaterial('actor',scene);am.diffuseColor=new B.Color3(.9,.55,.2);actor.material=am;
 frameTimes=[];commands=arrivals=0;reset(cases[0].from);
 observer=scene.onPointerObservable.add(info=>{if(info.type!==B.PointerEventTypes.POINTERDOWN)return;const p=scene.pick(scene.pointerX,scene.pointerY,m=>m===terrain);select(p.hit?asArray(p.pickedPoint):null);});
 window.addEventListener('resize',resize);engine.runRenderLoop(tick);scene.render();ready=true;setStatus(name);
 return {buildMs,engines:B.EngineStore.Instances.length,base:engineBase,meshes:scene.meshes.length};
}
function project(p){
 const v=B.Vector3.Project(vec(p),B.Matrix.Identity(),scene.getTransformMatrix(),camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight()));
 const rect=canvas.getBoundingClientRect();return {x:rect.left+v.x*rect.width/engine.getRenderWidth(),y:rect.top+v.y*rect.height/engine.getRenderHeight()};
}
window.lab={open,close,reset,project,cases:cases.map(x=>({...x})),snapshot:()=>({ready,pos,last,commands,arrivals,walking:path.length>0,unsafe,frames:frameTimes.slice(),engines:B.EngineStore.Instances.length,meshes:scene?.meshes.length,buildMs})};
