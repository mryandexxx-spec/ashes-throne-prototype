/* REN-GLB-003: self-contained, touch-rotatable Ren in the hero dossier.
 * The card has its own engine only while visible; combat owns its separate scene.
 * Portrait is kept as fallback when GLB or WebGL cannot be loaded.
 */
const RenCard3D=(()=>{
 "use strict";
 let active=false,engine=null,scene=null,camera=null,holder=null,animation=null;
 let rigPose=null,kinemiqIdle=null,retargetIdle=null,idleMs=0;
 let render=null,loadingToken=0,view="model",sizeObserver=null;
 const byId=id=>document.getElementById(id);
 function report(text){const el=byId("renCard3DStatus");if(el)el.textContent=text;}
 function loading(text){
  const overlay=byId("renCardLoadIndicator");
  const label=byId("renCardLoadingText");
  if(overlay)overlay.hidden=false;
  if(label)label.textContent=text;
  report(text);
 }
 function endLoading(){
  const overlay=byId("renCardLoadIndicator");
  if(overlay)overlay.hidden=true;
 }
 function setMode(mode){
  view=mode;
  const model=view==="model";
  const stage=byId("detailHeroStage");
  if(stage)stage.classList.toggle("has-ren-3d",model&&!!holder);
  const portrait=byId("detailRenPortrait");
  if(portrait)portrait.hidden=model&&!!holder;
  const button=byId("renCardMode");
  if(button){button.textContent=model?"Портрет":"3D-модель";button.setAttribute("aria-pressed",String(!model));}
  if(model&&engine){engine.resize();scene?.render();}
 }
 function dispose(){
  loadingToken++;
  active=false;
  endLoading();
  if(engine){
   engine.stopRenderLoop(render);
   scene?.dispose();
   engine.dispose();
  }
  sizeObserver?.disconnect();sizeObserver=null;
  engine=null;scene=null;camera=null;holder=null;animation=null;render=null;rigPose=null;kinemiqIdle=null;retargetIdle=null;idleMs=0;
  const stage=byId("detailHeroStage");
  stage?.classList.remove("has-ren-3d");
  const canvas=byId("renCard3DCanvas");
  if(canvas){delete canvas.dataset.animationSource;delete canvas.dataset.poseSource;}
  const portrait=byId("detailRenPortrait");
  if(portrait)portrait.hidden=false;
 }
 async function activate(heroId){
  const isRen=heroId==="ren";
  const controls=byId("renCard3DControls");
  const canvas=byId("renCard3DCanvas");
  if(controls)controls.hidden=!isRen;
  if(canvas)canvas.hidden=!isRen;
  if(!isRen){
   if(active)dispose();
   const portrait=byId("detailRenPortrait");
   if(portrait)portrait.hidden=true;
   return;
  }
  if(active)return;
  if(!canvas||typeof BABYLON==="undefined"||!BABYLON.Engine||!RenGlbRuntime?.ensureLoader){
   report("3D недоступно; показан портрет.");endLoading();return;
  }
  active=true;
  const token=++loadingToken;
  view="model";
  loading("Загружаем Рена…");
  try{
   engine=new BABYLON.Engine(canvas,true,{alpha:true,stencil:true,preserveDrawingBuffer:false});
   scene=new BABYLON.Scene(engine);
   scene.clearColor=new BABYLON.Color4(0,0,0,0);
   camera=new BABYLON.ArcRotateCamera("renCardCamera",Math.PI/2,Math.PI/2.15,3.15,new BABYLON.Vector3(0,1,0),scene);
   camera.lowerRadiusLimit=1.65;
   camera.upperRadiusLimit=6.6;
   camera.lowerBetaLimit=Math.PI/2.15;
   camera.upperBetaLimit=Math.PI/2.15; // Single-finger drag rotates only horizontally.
   camera.panningSensibility=0;
   camera.attachControl(canvas,true);
   const fill=new BABYLON.HemisphericLight("renFill",new BABYLON.Vector3(0,1,0),scene);
   fill.intensity=1.1;
   const key=new BABYLON.DirectionalLight("renKey",new BABYLON.Vector3(-.7,-1,-.5),scene);
   key.intensity=1;
   render=()=>{if(active&&!document.hidden&&view==="model"){
    idleMs+=Math.min(engine.getDeltaTime(),100);
    if(retargetIdle)retargetIdle(idleMs);
    else if(kinemiqIdle)kinemiqIdle(idleMs);
    else rigPose?.({slot:"idle",progress:(idleMs%3000)/3000});
    scene.render();
   }};
   engine.runRenderLoop(render);
   if(typeof ResizeObserver!=="undefined"){
    sizeObserver=new ResizeObserver(()=>{if(engine)engine.resize();});
    sizeObserver.observe(canvas);
   }
   await RenGlbRuntime.ensureLoader();
   if(!active||token!==loadingToken)return;
   const result=await BABYLON.SceneLoader.ImportMeshAsync(null,"assets/",RenGlbRuntime.ASSET_URL.slice(7),scene,undefined,".glb");
   if(!active||token!==loadingToken){
    for(const group of result.animationGroups)group.dispose();
    for(const mesh of result.meshes)mesh.dispose();
    return;
   }
   const parts=result.meshes.filter(mesh=>mesh.getTotalVertices?.()>0);
   if(!parts.length)throw Error("В GLB нет геометрии");
   holder=new BABYLON.TransformNode("renCardGlbRoot",scene);
   for(const node of [...result.meshes,...result.transformNodes]){
    if(!node.parent)node.parent=holder;
   }
   // Frame the actual mesh rather than assuming its coordinate origin or height.
   let min=new BABYLON.Vector3(Infinity,Infinity,Infinity);
   let max=new BABYLON.Vector3(-Infinity,-Infinity,-Infinity);
   for(const mesh of parts){
    mesh.computeWorldMatrix(true);
    const bbox=mesh.getBoundingInfo().boundingBox;
    min=BABYLON.Vector3.Minimize(min,bbox.minimumWorld);
    max=BABYLON.Vector3.Maximize(max,bbox.maximumWorld);
   }
   const center=min.add(max).scale(.5);
   const extent=max.subtract(min);
   const largest=Math.max(extent.x,extent.y,extent.z);
   if(!Number.isFinite(largest)||largest<=0)throw Error("Неверные габариты GLB");
   const scale=2.1/largest;
   holder.scaling.set(scale,scale,scale);
   holder.position.set(-center.x*scale,1.08-center.y*scale,-center.z*scale);
   camera.setTarget(new BABYLON.Vector3(0,1.08,0));
   camera.radius=3.15;
   const groups=result.animationGroups;
   animation=groups.find(g=>g.name==="Idle_4")||groups.find(g=>g.name==="Ren_Idle_Breathing_3s")||null;
   groups.forEach(g=>g.stop());
   // RENMESH017: use the animation baked into the same Mixamo GLB.
   // Never combine native AnimationGroups with old hand-authored retarget poses.
   if(animation){
    animation.start(true,0.75);
    canvas.dataset.animationSource="meshy-native-idle";
   }else{
    // The legacy rig can still use its previous safe fallback.
    try{
     retargetIdle=typeof RenMotionRetarget!=="undefined"
      ?RenMotionRetarget.create(BABYLON,result.transformNodes):null;
    }catch(error){console.warn("Ren fallback retarget unavailable",error);}
    if(retargetIdle)retargetIdle(0);
    else{
     kinemiqIdle=typeof RenKinemIQIdle!=="undefined"
      ?RenKinemIQIdle.create(BABYLON,result.transformNodes):null;
     if(kinemiqIdle)kinemiqIdle(0);
     else rigPose=RenGlbRuntime.createRigAnimator(BABYLON,result.transformNodes);
    }
    canvas.dataset.animationSource="legacy-fallback";
   }
   setMode("model");
   engine.resize();
   endLoading();
   report("3D Рен загружен. Проводите влево или вправо для поворота; двумя пальцами меняйте масштаб.");
  }catch(error){
   console.warn("REN-GLB-003 card model unavailable",error);
   report("Не удалось загрузить 3D: "+(error.message||String(error))+". Показан портрет.");
   // Retain portrait and release the card's WebGL context on load failure.
   dispose();
  }
 }
 function initControls(){
  const button=byId("renCardMode"),reset=byId("renCardReset");
  button?.addEventListener("click",()=>setMode(view==="model"?"portrait":"model"));
  reset?.addEventListener("click",()=>{
   if(camera){
    camera.alpha=Math.PI/2;camera.beta=Math.PI/2.15;camera.radius=3.15;
    camera.setTarget(new BABYLON.Vector3(0,1.08,0));
   }
  });
 }
 if(typeof document!=="undefined")initControls();
 return Object.freeze({activate,dispose,setMode});
})();
if(typeof module!=="undefined")module.exports=RenCard3D;
