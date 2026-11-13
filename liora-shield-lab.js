/* LIORA-SHIELD-002: visual workshop. NOT a playable hero or a battle runtime. */
(function(){
 "use strict";
 const el=id=>document.getElementById(id);
 const status=text=>{el("status").textContent=text;};
 let engine=null,scene=null,character=null,shield=null,attachment=null,groups=[],active=null;
 let playing=true,clock=0,lastFrame=0,disposed=false;
 const labels=["Running","Walking","Alert","Block1","Catching_Breath","Dead",
  "Hit_Reaction","Idle_02","Shield_Push_Left","Squat_Stance",
  "Step_Forward_and_Push","Walk_Fight_Forward"];
 function bounds(result){
  let min=new BABYLON.Vector3(Infinity,Infinity,Infinity);
  let max=new BABYLON.Vector3(-Infinity,-Infinity,-Infinity);
  let count=0;
  for(const mesh of result.meshes){
   if(!mesh.getTotalVertices?.())continue;
   mesh.computeWorldMatrix(true);
   const b=mesh.getBoundingInfo().boundingBox;
   min=BABYLON.Vector3.Minimize(min,b.minimumWorld);
   max=BABYLON.Vector3.Maximize(max,b.maximumWorld);
   count++;
  }
  if(!count)throw Error("Character GLB has no visible meshes");
  return {min,max};
 }
 function frameAt(group,p){
  if(!group)return;
  group.goToFrame(group.from+(group.to-group.from)*p);
  // Model's hips root translation is not battle movement; preview in place.
  const hip=character.transformNodes.find(n=>n.name==="mixamorig:Hips");
  if(hip&&hip.metadata?.lioraBase){
   hip.position.x=hip.metadata.lioraBase.x;
   hip.position.z=hip.metadata.lioraBase.z;
  }
  attachment.hand.computeWorldMatrix(true);
  attachment.socket.computeWorldMatrix(true);
 }
 function setClip(name){
  active?.stop();
  active=groups.find(g=>g.name===name);
  if(!active)throw Error("Missing animation "+name);
  active.start(false,1,active.from,active.to);
  active.pause();
  clock=0;
  el("frame").value="0";
  frameAt(active,0);
 }
 function setPoseFromInputs(){
  if(!attachment)return;
  const v={};
  for(const input of el("sliders").querySelectorAll("input"))
   v[input.dataset.key]=Number(input.value);
  try{
   attachment.pose({offset:{x:v.ox,y:v.oy,z:v.oz},
    rotation:{x:v.rx,y:v.ry,z:v.rz},scale:v.s});
  }catch(error){status("Настройки щита: "+error.message);}
 }
 function setControls(){
  for(const input of el("sliders").querySelectorAll("input"))
   input.addEventListener("change",setPoseFromInputs);
  el("reset").addEventListener("click",()=>{
   const values=["-.09",".03",".17","0","0","0","1"];
   [...el("sliders").querySelectorAll("input")].forEach((input,i)=>input.value=values[i]);
   setPoseFromInputs();
  });
  el("clip").addEventListener("change",()=>{setClip(el("clip").value);status("Клип: "+active.name);});
  el("frame").addEventListener("input",()=>{
   playing=false;el("play").textContent="Воспроизвести";
   const p=Number(el("frame").value)/100;
   frameAt(active,p);
  });
  el("play").addEventListener("click",()=>{
   playing=!playing;el("play").textContent=playing?"Пауза":"Воспроизвести";
  });
  el("scan").addEventListener("click",scan);
 }
 function scan(){
  if(!attachment||!groups.length)return;
  const oldName=active.name,oldProgress=Number(el("frame").value)/100,oldPlaying=playing;
  playing=false;
  const report=[];
  for(const name of labels){
   const group=groups.find(g=>g.name===name);
   if(!group){report.push(name+": НЕТ КЛИПА");continue;}
   try{
    setClip(name);
    let valid=true,maxDistance=0;
    for(const p of [0,.25,.5,.75,1]){
     frameAt(group,p);
     const hand=attachment.hand.getAbsolutePosition();
     const socket=attachment.socket.getAbsolutePosition();
     const delta=BABYLON.Vector3.Distance(hand,socket);
     if(!Number.isFinite(delta)||delta>1.5)valid=false;
     maxDistance=Math.max(maxDistance,delta);
    }
    report.push(name+": "+(valid?"OK":"ОШИБКА")+
     " · расстояние от кисти до крепления до "+maxDistance.toFixed(3)+" м");
   }catch(error){report.push(name+": ОШИБКА "+error.message);}
  }
  setClip(oldName);frameAt(active,oldProgress);el("frame").value=String(Math.round(oldProgress*100));
  playing=oldPlaying;el("play").textContent=playing?"Пауза":"Воспроизвести";
  el("checks").textContent=report.join("\n");
  status("Проверка 12 клипов завершена: контроль соединения и чисел. Визуальное отсутствие пересечений и корректность захвата щита проверяйте вручную.");
 }
 async function init(){
  try{
   if(!window.BABYLON||!BABYLON.SceneLoader||typeof LioraShieldAttachment==="undefined"||
    typeof LioraModelAssets==="undefined"||typeof LioraShieldAssets==="undefined")throw Error("Babylon/реестр ассетов не загружены");
   const canvas=el("stage");
   engine=new BABYLON.Engine(canvas,true,{stencil:true,alpha:true});
   scene=new BABYLON.Scene(engine);
   scene.clearColor=new BABYLON.Color4(.10,.14,.16,1);
   const camera=new BABYLON.ArcRotateCamera("lioraCam",-Math.PI/2,1.3,3.7,
    new BABYLON.Vector3(0,1,0),scene);
   camera.lowerRadiusLimit=1.4;camera.upperRadiusLimit=8;
   camera.attachControl(canvas,true);
   new BABYLON.HemisphericLight("ambient",new BABYLON.Vector3(0,1,0),scene).intensity=.95;
   const key=new BABYLON.DirectionalLight("key",new BABYLON.Vector3(-.5,-1,-.7),scene);
   key.intensity=.9;
   const load=async url=>{
    const slash=url.lastIndexOf("/");
    return BABYLON.SceneLoader.ImportMeshAsync(null,url.slice(0,slash+1),
     url.slice(slash+1),scene,undefined,".glb");
   };
   status("Загружаю Лиору ("+LioraModelAssets.bytes+" байт)...");
   character=await load(LioraModelAssets.url);
   const parent=new BABYLON.TransformNode("lioraViewRoot",scene);
   for(const node of [...character.meshes,...character.transformNodes])
    if(!node.parent)node.parent=parent;
   const box=bounds(character);
   const size=box.max.subtract(box.min);
   const scale=2.1/size.y;
   parent.scaling.setAll(scale);
   parent.position.set(-(box.min.x+box.max.x)*.5*scale,
    -.0-box.min.y*scale,-(box.min.z+box.max.z)*.5*scale);
   const hip=character.transformNodes.find(n=>n.name==="mixamorig:Hips");
   if(hip)hip.metadata={...(hip.metadata||{}),lioraBase:{x:hip.position.x,z:hip.position.z}};
   status("Лиора загружена. Загружаю отдельный щит...");
   shield=await load(LioraShieldAssets.url);
   attachment=LioraShieldAttachment.attach(BABYLON,scene,character,shield);
   groups=character.animationGroups.slice();
   const select=el("clip");
   for(const name of labels){
    const option=document.createElement("option");
    option.value=name;option.textContent=name;
    option.disabled=!groups.some(g=>g.name===name);
    select.appendChild(option);
   }
   const first=groups.find(g=>g.name==="Idle_02")||groups[0];
   if(!first)throw Error("Liora has no animation groups");
   select.value=first.name;
   setClip(first.name);
   setControls();
   engine.runRenderLoop(()=>{
    if(disposed||document.hidden)return;
    if(playing&&active){
     const fps=active.targetedAnimations?.[0]?.animation?.framePerSecond||60;
     const span=Math.max(1,active.to-active.from);
     const duration=span/fps;
     const dt=Math.min(engine.getDeltaTime(),100)/1000;
     clock+=dt;const p=(clock%duration)/duration;
     frameAt(active,p);
     el("frame").value=String(Math.round(p*100));
    }
    scene.render();
   });
   window.addEventListener("resize",()=>engine?.resize(),{passive:true});
   status("Готово: "+groups.length+" анимаций, левая кисть "+attachment.jointName+
    ", щит на отдельном узле. Проверь посадку на всех клипах.");
  }catch(error){
   console.error("LIORA-SHIELD-002",error);
   status("Ошибка лаборатории: "+(error?.message||String(error)));
  }
 }
 window.addEventListener("pagehide",()=>{
  disposed=true;
  try{engine?.stopRenderLoop();scene?.dispose();engine?.dispose();}catch(_error){}
 });
 void init();
})();
