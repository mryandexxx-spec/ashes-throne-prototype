const HEROES = [
  {id:"kael",name:"Каэль Ворон",role:"Страж",hp:120,atk:24,speed:110,side:"ally",glyph:"♜"},
  {id:"lyra",name:"Лира Соль",role:"Следопыт",hp:88,atk:31,speed:155,side:"ally",glyph:"♧"},
  {id:"darin",name:"Дарин Пепельный",role:"Мечник",hp:105,atk:27,speed:125,side:"ally",glyph:"⚔"},
  {id:"ves",name:"Вестник Конклава",role:"Противник",hp:90,atk:18,speed:105,side:"enemy",glyph:"☠"},
  {id:"shade",name:"Теневой клинок",role:"Противник",hp:78,atk:22,speed:135,side:"enemy",glyph:"♟"}
];
const $=s=>document.querySelector(s);
let engine, scene, meshes={};
let renderLoopRunning=false;
let state=CombatCore.createBattle(HEROES);
function showScreen(id){
 if(id!=="battle")stopBattleRendering();
 document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));
 $("#"+id).classList.add("active");
 if(id==="battle"){
  resetBattle(); // Every entry is a new demonstration battle, regardless of entry point.
  if(!engine)initBabylon();
  engine.resize();
  startBattleRendering();
 }
}
document.querySelectorAll("[data-screen]").forEach(b=>b.addEventListener("click",()=>showScreen(b.dataset.screen)));
$("#startBattle").addEventListener("click",()=>showScreen("battle"));
$("#campaignBattle").addEventListener("click",()=>showScreen("battle"));
function renderHeroes(){
 $("#heroList").innerHTML=HEROES.filter(h=>h.side==="ally").map(h=>`<article class="hero-card"><div class="hero-avatar">${h.glyph}</div><h3>${h.name}</h3><p>${h.role} · I уровень</p><div class="stats"><span>Здоровье ${h.hp}</span><span>Сила ${h.atk}</span></div></article>`).join("");
}
function livingEnemies(){return CombatCore.livingEnemies(state.fighters);}
function syncBattleUI(){
 const fighters=state.fighters;
 const actor=state.active?fighters[state.currentActor]:null;
 const target=state.active?fighters[state.selectedEnemy]:null;
 $("#battleStatus").textContent=actor?"Ход: "+actor.name:"Бой завершён";
 $("#turnChip").textContent="Ход "+state.turn;
 $("#actionTitle").textContent=actor?"Атака: "+actor.name:"Бой завершён";
 $("#actionHint").textContent=target?"Цель: "+target.name:"Выбери живого противника";
 $("#attackBtn").textContent=state.active?"Атаковать":"Сыграть снова";
 $("#attackBtn").disabled=state.active&&(!actor||!target);
 $("#battleMessage").textContent=state.message;
 renderCombatants();
 updateMeshes();
}
function renderCombatants(){
 $("#combatants").innerHTML=state.fighters.map((h,i)=>
   `<div class="fighter ${h.side==="enemy"?"enemy":""} ${h.hp<=0?"defeated":""} ${state.active&&i===state.selectedEnemy?"selected":""} ${state.active&&i===state.currentActor?"acting":""}" data-index="${i}"><b>${h.name}</b><small>${Math.max(0,h.hp)} / ${h.maxHp} HP · СПД ${h.speed}</small><div class="health"><span style="width:${Math.max(0,h.hp)/h.maxHp*100}%"></span></div></div>`
 ).join("");
 document.querySelectorAll(".fighter.enemy").forEach(el=>el.addEventListener("click",()=>{
  if(CombatCore.chooseEnemy(state,Number(el.dataset.index)))syncBattleUI();
 }));
}
function resetBattle(){
 state=CombatCore.createBattle(HEROES);
 CombatCore.advanceToPlayerTurn(state);
 syncBattleUI();
}
function attack(){
 if(CombatCore.performPlayerAttack(state))syncBattleUI();
}
// Exactly one permanent click handler; no onclick replacement on victory.
$("#attackBtn").addEventListener("click",()=>{if(!state.active)resetBattle();else attack();});
// A single render callback and a single Engine/Scene for the lifetime of this prototype.
function renderBattleFrame(){if(scene)scene.render();}
function shouldRenderBattle(){return !!engine && !document.hidden && $("#battle").classList.contains("active");}
function startBattleRendering(){
 if(!shouldRenderBattle()||renderLoopRunning)return;
 engine.runRenderLoop(renderBattleFrame);
 renderLoopRunning=true;
}
function stopBattleRendering(){
 if(!engine||!renderLoopRunning)return;
 engine.stopRenderLoop(renderBattleFrame);
 renderLoopRunning=false;
}
// Reuse the scene rather than re-creating meshes on every battle entry.
function initBabylon(){
 const canvas=$("#renderCanvas");engine=new BABYLON.Engine(canvas,true,{stencil:true});
 scene=new BABYLON.Scene(engine);scene.clearColor=new BABYLON.Color4(.035,.045,.065,1);
 const camera=new BABYLON.ArcRotateCamera("camera",-Math.PI/2,1.05,15,new BABYLON.Vector3(0,1,0),scene);camera.lowerRadiusLimit=11;camera.upperRadiusLimit=18;camera.attachControl(canvas,true);
 const hemi=new BABYLON.HemisphericLight("hemi",new BABYLON.Vector3(0,1,0),scene);hemi.intensity=.8;
 const key=new BABYLON.DirectionalLight("key",new BABYLON.Vector3(-.5,-1,.5),scene);key.intensity=1.1;
 const ground=BABYLON.MeshBuilder.CreateGround("ground",{width:16,height:9},scene);const gm=new BABYLON.StandardMaterial("groundMat",scene);gm.diffuseColor=new BABYLON.Color3(.12,.15,.19);gm.specularColor=new BABYLON.Color3(.1,.1,.1);ground.material=gm;
 // Built-in material avoids relying on a separately loaded Babylon Materials Library.
 const grid=BABYLON.MeshBuilder.CreateGround("grid",{width:16,height:9,subdivisions:12},scene);grid.position.y=.012;
 const gridmat=new BABYLON.StandardMaterial("gridmat",scene);
 gridmat.diffuseColor=new BABYLON.Color3(.14,.17,.21);gridmat.emissiveColor=new BABYLON.Color3(.035,.045,.06);
 gridmat.alpha=.28;gridmat.wireframe=true;gridmat.backFaceCulling=false;grid.material=gridmat;
 // Low-poly stylized fighters: capsule body, sphere head, colored shield.
 state.fighters.forEach((h,i)=>{
  const x=h.side==="ally"?-3.4:3.4,z=(i%3-1)*1.55;
  const body=BABYLON.MeshBuilder.CreateCapsule("body_"+i,{height:1.5,radius:.42},scene);body.position=new BABYLON.Vector3(x,.8,z);
  const mat=new BABYLON.StandardMaterial("mat_"+i,scene);mat.diffuseColor=h.side==="ally"?new BABYLON.Color3(.28,.55,.76):new BABYLON.Color3(.72,.25,.23);mat.emissiveColor=h.side==="ally"?new BABYLON.Color3(.02,.06,.09):new BABYLON.Color3(.08,.015,.01);body.material=mat;
  const head=BABYLON.MeshBuilder.CreateSphere("head_"+i,{diameter:.62,segments:12},scene);head.position=new BABYLON.Vector3(x,1.8,z);head.material=mat;
  const base=BABYLON.MeshBuilder.CreateCylinder("base_"+i,{diameter:1.15,height:.12,tessellation:24},scene);base.position=new BABYLON.Vector3(x,.08,z);const bm=new BABYLON.StandardMaterial("basemat_"+i,scene);bm.diffuseColor=h.side==="ally"?new BABYLON.Color3(.65,.48,.2):new BABYLON.Color3(.4,.18,.18);base.material=bm;
  meshes[i]={body,head,base};
 });
 // Registered only once because initBabylon() runs once.
 window.addEventListener("resize",()=>{if(shouldRenderBattle())engine.resize();});
}
function updateMeshes(){if(!scene)return;state.forEach((h,i)=>{if(meshes[i]){const visible=h.hp>0;meshes[i].body.setEnabled(visible);meshes[i].head.setEnabled(visible);meshes[i].base.setEnabled(visible);}});}
// Browsers may keep the tab alive when it is hidden; suspend GPU work until visible.
document.addEventListener("visibilitychange",()=>{
 if(document.hidden)stopBattleRendering();
 else if(shouldRenderBattle()){engine.resize();startBattleRendering();}
});
renderHeroes();CombatCore.advanceToPlayerTurn(state);renderCombatants();
