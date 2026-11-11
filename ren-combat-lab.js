/* Isolated review surface. Same choreography, root extraction and sampler as combat. */
(async()=>{
 "use strict";
 const $=id=>document.getElementById(id),B=BABYLON;
 const engine=new B.Engine($('canvas'),true,{preserveDrawingBuffer:true});
 const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.07,.075,.085,1);
 const camera=new B.ArcRotateCamera('lab-camera',-Math.PI/2,1.27,8,new B.Vector3(0,1,0),scene);
 camera.attachControl($('canvas'),true);camera.lowerRadiusLimit=2;camera.upperRadiusLimit=15;
 new B.HemisphericLight('fill',new B.Vector3(0,1,0),scene);
 const key=new B.DirectionalLight('key',new B.Vector3(-.7,-1,-.5),scene);key.intensity=1.1;
 const material=(name,color)=>{const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(color);return m;};
 const floor=B.MeshBuilder.CreateGround('floor',{width:16,height:10},scene);floor.material=material('floor-mat','#292b2d');
 for(let i=-8;i<=8;i++)B.MeshBuilder.CreateLines('grid',{points:[new B.Vector3(i,.01,-5),new B.Vector3(i,.01,5)]},scene).color=new B.Color3(.22,.22,.23);
 for(let i=-5;i<=5;i++)B.MeshBuilder.CreateLines('grid',{points:[new B.Vector3(-8,.01,i),new B.Vector3(8,.01,i)]},scene).color=new B.Color3(.22,.22,.23);
 const body=new B.Mesh('ren-anchor',scene),head=new B.Mesh('ren-head-anchor',scene);body.position.y=.8;head.position.y=1.8;
 const target=B.MeshBuilder.CreateCapsule('target',{height:2.1,radius:.42},scene);target.position.y=1.05;target.material=material('target-mat','#854e45');
 const marker=B.MeshBuilder.CreateSphere('hand-marker',{diameter:.09,segments:8},scene);marker.material=material('marker-mat','#f0c879');marker.material.emissiveColor=new B.Color3(.7,.4,.1);
 const line=B.MeshBuilder.CreateLines('contact-plane',{points:[new B.Vector3(0,0,-.7),new B.Vector3(0,2.5,-.7),new B.Vector3(0,2.5,.7),new B.Vector3(0,0,.7)]},scene);line.color=new B.Color3(1,.3,.2);
 const actor=RenGlbRuntime.create(B,scene,{body,head},(kind,text)=>{$('status').textContent=text;});
 if(!await actor.ready)return;
 const hand=scene.transformNodes.find(n=>n.name==='mixamorig:RightHand');
 let plan,time=0,playing=false,idleMs=0,repeatWait=0,lastText='';
 const origin={x:0,z:0},enemy={x:0,z:0};
 function reset(){
  const distance=Number($('distance').value);plan=RenChoreography.plan(distance);time=0;playing=false;repeatWait=0;
  origin.x=-distance/2;enemy.x=distance/2;target.position.x=enemy.x;line.position.x=enemy.x-.42;
  $('distanceValue').textContent=distance.toFixed(1);$('scrub').value='0';
 }
 reset();
 const controls=['play','pause','reset'];controls.forEach(id=>{$(id).disabled=false;});
 $('play').onclick=()=>{if(time>=plan.durationMs)time=0;playing=true;};
 $('pause').onclick=()=>{playing=false;};$('reset').onclick=reset;
 $('distance').oninput=reset;$('mode').onchange=reset;
 $('scrub').oninput=()=>{playing=false;time=Number($('scrub').value)/1000*plan.durationMs;};
 $('phase').onchange=()=>{
  playing=false;const times={brake:plan.approachMs,windup:plan.attackStart,contact:plan.contactMs,recover:plan.attackEnd,retreat:plan.retreatStart,end:plan.durationMs};
  time=times[$('phase').value]||0;$('scrub').value=String(time/plan.durationMs*1000);
 };
 for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{
  camera.alpha=button.dataset.view==='front'?Math.PI/4:-Math.PI/2;camera.beta=button.dataset.view==='top'?.2:1.27;
 };
 function draw(dt,render=true){
  if(document.hidden)return;
  if(playing){time=Math.min(plan.durationMs,time+Math.min(dt,100)*Number($('speed').value));
   if(time>=plan.durationMs){if($('repeat').checked){repeatWait+=dt;if(repeatWait>400){time=0;repeatWait=0;}}else playing=false;}}
  idleMs+=Math.min(dt,100);
  const raw=$('mode').value!=='choreography',phase=RenChoreography.sample(plan,time);
  const offset=raw?{x:0,z:0}:RenChoreography.offset(plan,time,origin,enemy);
  body.position.set(origin.x+offset.x,.8,offset.z);
  if(raw)actor.sampleRaw($('mode').value,time/plan.durationMs);
  else if(time===0&&!playing)actor.update({slot:'idle',progress:(idleMs%13966.667)/13966.667});
  else actor.update({slot:'basic',plan,elapsedMs:time,progress:time/plan.durationMs});
  const reaction=Math.max(0,time-plan.contactMs)/120;
  target.rotation.z=!raw&&time>=plan.contactMs&&reaction<1?-.14*Math.sin(Math.PI*reaction):0;
  target.material.emissiveColor.set(...(!raw&&Math.abs(time-plan.contactMs)<45?[.3,.12,.02]:[0,0,0]));
  if(hand){hand.computeWorldMatrix(true);marker.position.copyFrom(hand.getAbsolutePosition());}
  if(render)scene.render();
  $('scrub').value=String(time/plan.durationMs*1000);
  const text=`${raw?'SOURCE':phase.phase} · ${Math.round(time)} / ${Math.round(plan.durationMs)} ms\nAnchor x ${body.position.x.toFixed(3)} z ${body.position.z.toFixed(3)}\nTarget x ${enemy.x.toFixed(3)} · gap ${(enemy.x-body.position.x).toFixed(3)}\nContact ${Math.round(plan.contactMs)} ms · frame 39\nMeshes ${scene.meshes.length} · Groups ${scene.animationGroups.length}`;
  if(text!==lastText){$('telemetry').textContent=text;lastText=text;}
  $('contact').textContent=!raw&&phase.contact?'● КОНТАКТ · кадр 39':'';
 }
 engine.runRenderLoop(()=>draw(engine.getDeltaTime()));
 window.addEventListener('resize',()=>engine.resize());
 window.addEventListener('pagehide',()=>{engine.stopRenderLoop();actor.dispose();scene.dispose();engine.dispose();},{once:true});
 // Explicit deterministic test API, confined to this lab page.
 window.RenLab={scene,engine,actor,body,target,hand,get plan(){return plan;},get time(){return time;},seek(ms,render=true){playing=false;time=Math.max(0,Math.min(plan.durationMs,ms));draw(0,render);},reset,draw};
})().catch(error=>{document.getElementById('status').textContent='Ошибка: '+error.message;console.error(error);});
