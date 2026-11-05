const HEROES = [
  {id:"kael",name:"Каэль Ворон",role:"Страж",hp:120,atk:24,side:"ally",glyph:"♜"},
  {id:"lyra",name:"Лира Соль",role:"Следопыт",hp:88,atk:31,side:"ally",glyph:"♧"},
  {id:"darin",name:"Дарин Пепельный",role:"Мечник",hp:105,atk:27,side:"ally",glyph:"⚔"},
  {id:"ves",name:"Вестник Конклава",role:"Противник",hp:90,atk:18,side:"enemy",glyph:"☠"},
  {id:"shade",name:"Теневой клинок",role:"Противник",hp:78,atk:22,side:"enemy",glyph:"♟"}
];
const $=s=>document.querySelector(s);
let selectedEnemy=3, turn=1, active=true, engine, scene, meshes={};
let renderLoopRunning=false;
let state=HEROES.map(h=>({...h,maxHp:h.hp}));
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
function livingEnemies(){return state.map((h,i)=>({h,i})).filter(({h})=>h.side==="enemy"&&h.hp>0);}
function syncBattleUI(){
 const enemies=livingEnemies();
 if(active && !enemies.some(({i})=>i===selectedEnemy))selectedEnemy=enemies.length?enemies[0].i:-1;
 if(!active)selectedEnemy=-1;
 const target=state[selectedEnemy];
 $("#battleStatus").textContent=active&&target?"Цель: "+target.name:(active?"Нет доступных целей":"Бой завершён");
 $("#turnChip").textContent=`Ход ${turn}`;
 $("#attackBtn").textContent=active?"Атаковать":"Сыграть снова";
 $("#attackBtn").disabled=active&&!target;
 renderCombatants();
 updateMeshes();
}
function renderCombatants(){
 $("#combatants").innerHTML=state.map((h,i)=>`<div class="fighter ${h.side==="enemy"?"enemy":""} ${h.hp<=0?"defeated":""} ${active&&i===selectedEnemy?"selected":""}" data-index="${i}"><b>${h.name}</b><small>${Math.max(0,h.hp)} / ${h.maxHp} HP</small><div class="health"><span style="width:${Math.max(0,h.hp)/h.maxHp*100}%"></span></div></div>`).join("");
 document.querySelectorAll(".fighter.enemy").forEach(el=>el.addEventListener("click",()=>{
  const index=Number(el.dataset.index);
  if(!active||!state[index]||state[index].side!=="enemy"||state[index].hp<=0)return;
  selectedEnemy=index;
  syncBattleUI();
 }));
}
function resetBattle(){
 state=HEROES.map(h=>({...h,maxHp:h.hp}));
 selectedEnemy=state.findIndex(h=>h.side==="enemy"&&h.hp>0);
 turn=1;active=true;
 $("#battleMessage").textContent="Отряд готов к бою";
 syncBattleUI();
}
function attack(){
 if(!active)return;
 const enemies=livingEnemies();
 if(!enemies.some(({i})=>i===selectedEnemy))selectedEnemy=enemies.length?enemies[0].i:-1;
 const target=state[selectedEnemy];
 const attacker=state.find(h=>h.side==="ally"&&h.hp>0);
 if(!target||!attacker)return;
 target.hp=Math.max(0,target.hp-attacker.atk);
 $("#battleMessage").textContent=`${attacker.name} наносит ${attacker.atk} урона: ${target.name}`;
 if(target.hp<=0){
  $("#battleMessage").textContent+=" — повержен!";
  if(livingEnemies().length===0){
   active=false;
   $("#battleMessage").textContent="Победа! Отряд одержал верх.";
   syncBattleUI();
   return;
  }
  selectedEnemy=livingEnemies()[0].i;
 }
 enemyTurn();
 syncBattleUI();
}
function enemyTurn(){
 const enemy=state.find(h=>h.side==="enemy"&&h.hp>0);
 const ally=state.find(h=>h.side==="ally"&&h.hp>0);
 if(enemy&&ally){
  ally.hp=Math.max(0,ally.hp-enemy.atk);
  $("#battleMessage").textContent+=` · Ответный удар: ${ally.name} получает ${enemy.atk}`;
 }
 if(!state.some(h=>h.side==="ally"&&h.hp>0)){
  active=false;
  $("#battleMessage").textContent="Поражение. Попробуй ещё раз.";
 }
 turn++;
}
// Exactly one permanent click handler; no onclick replacement on victory.
$("#attackBtn").addEventListener("click",()=>{if(!active)resetBattle();else attack();});
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
 state.forEach((h,i)=>{
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
renderHeroes();renderCombatants();
