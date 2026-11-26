"use strict";
// R2/A integration: exact accepted R5.7 floor + catalog art; no game state writes.
const R2ACard=(()=>{
 const assets=Object.freeze({
 "g1-blade":"g1-blade.webp","g1-vest":"g1-vest.webp","g1-helm":"g1-helm.webp",
 "g1-gaunt":"g1-gaunt.webp","g1-bootheavy":"g1-bootheavy.webp","g1-belt":"g1-belt.webp"
 });
 const get=id=>document.getElementById(id);
 let watched=null,rail=null;
 function layout(){
  const root=get("heroDetail"),slots=get("gearSlots"),footer=root?.querySelector(".hero-card-gear-footer");
  if(!root||!slots||!footer||!rail)return;
  const active=root.dataset.r2aCard==="art"&&!root.classList.contains("gear-ux-active");
  rail.hidden=!active;
  if(active&&slots.parentNode!==rail)rail.append(slots);
  else if(!active&&slots.parentNode===rail)footer.before(slots);
 }
 function sync(heroId,progress){
  const root=get("heroDetail"),slots=get("gearSlots");
  if(!root||!slots)return;
  if(heroId==="art"){
   root.dataset.r2aCard="art";
   if(!rail){
    rail=document.createElement("section");rail.id="r2aGearRail";
    rail.setAttribute("aria-label","Экипировка");
    const title=document.createElement("small");title.className="r2a-gear-title";title.textContent="ЭКИПИРОВКА";rail.append(title);
    get("gearUxLeft").before(rail);
   }
   if(!watched&&typeof MutationObserver!=="undefined"){
    watched=new MutationObserver(layout);watched.observe(root,{attributes:true,attributeFilter:["class"]});
   }
   const gear=ProgressCore.gearState(progress,heroId);
   if(gear?.mode==="itemized")for(const button of slots.querySelectorAll("[data-gear-slot]")){
    const i=Number(button.dataset.gearSlot),slot=GearData.SLOTS[i];
    if(!slot)continue;
    const id=gear.slots[i]||ProgressCore.itemOffer(progress,heroId,slot.id)[0]?.id;
    const file=assets[id],svg=button.querySelector(":scope > svg");
    if(!file||!svg)continue;
    const img=document.createElement("img");img.className="r2a-item-art";img.alt="";
    img.dataset.itemId=id;img.src="assets/hero-card-r57/"+file;
    img.addEventListener("error",()=>{img.replaceWith(svg)},{once:true});
    svg.replaceWith(img);
    if(slot.id==="utility")button.querySelector("small").textContent="Пояс";
   }
  }else delete root.dataset.r2aCard;
  layout();
  if(typeof R2APath!=="undefined")R2APath.syncProduction(heroId,progress);
 }
 function mountFloor(B,scene){
  // Shadow catcher with no opaque floor, rim or platform. The regional artwork
  // supplies the surface; the plane only contributes a soft contact approximation.
  const sh=new B.DynamicTexture("r5FloorContact",{width:128,height:128},scene,false);sh.hasAlpha=true;
  const c=sh.getContext();
  c.clearRect(0,0,128,128);
  const g=c.createRadialGradient(64,64,3,64,64,61);
  g.addColorStop(0,"rgba(9,8,7,.58)");g.addColorStop(.38,"rgba(9,8,7,.40)");g.addColorStop(.72,"rgba(9,8,7,.17)");g.addColorStop(1,"rgba(9,8,7,0)");
  c.fillStyle=g;c.fillRect(0,0,128,128);sh.update();
  const mat=new B.StandardMaterial("r5FloorContactMat",scene);
  mat.diffuseTexture=sh;mat.useAlphaFromDiffuseTexture=true;mat.disableLighting=true;mat.emissiveColor=new B.Color3(0,0,0);mat.specularColor=new B.Color3(0,0,0);
  const contact=B.MeshBuilder.CreateGround("r5-floor-contact",{width:1.55,height:1.05},scene);
  contact.position.y=.019;contact.material=mat;contact.isPickable=false;
  // Small localized shadows follow the animated feet, rather than a fixed disc.
  // Keep the broad contact layer, and use the same texture for both feet.
  const norm=n=>(n.name||"").toLowerCase().replace(/[^a-z]/g,"");
  const anchors=["left","right"].map(side=>scene.transformNodes.find(n=>norm(n).endsWith(side+"foot"))||scene.transformNodes.find(n=>norm(n).endsWith(side+"toebase"))||null);
  const local=new B.StandardMaterial("r5FootContactMat",scene);
  local.diffuseTexture=sh;local.useAlphaFromDiffuseTexture=true;local.disableLighting=true;local.emissiveColor=new B.Color3(0,0,0);local.specularColor=new B.Color3(0,0,0);local.zOffset=-1;local.alpha=.8;
  const spots=anchors.map((anchor,i)=>{
   const spot=B.MeshBuilder.CreateGround("r5-foot-contact-"+i,{width:.42,height:.32},scene);
   spot.position.y=.022;spot.material=local;spot.isPickable=false;spot.setEnabled(!!anchor);return spot;
  });
  const update=()=>{
   const positions=anchors.map(n=>n?n.getAbsolutePosition():null);
   const valid=positions.filter(p=>p&&Number.isFinite(p.y));
   if(!valid.length)return;
   const low=Math.min(...valid.map(p=>p.y));
   for(let i=0;i<spots.length;i++){
    const p=positions[i];if(!p)continue;
    spots[i].position.x=p.x;spots[i].position.z=p.z;
    // Fade the lifted foot; a planted foot retains a smaller darker contact.
    spots[i].visibility=Math.max(0,1-Math.max(0,p.y-low)/.20);
   }
  };
  update();
  const observer=scene.onBeforeRenderObservable.add(update);
  return {variant:"b-floor",meshes:[contact,...spots],materials:[mat,local],textures:[sh],shadow:null,observer,anchors:anchors.filter(Boolean).length};
 }

 const scenes=new WeakSet();
 function frame(scene,camera){
  if(!scene||!camera)return;
  camera.radius=3.08;camera.setTarget(new BABYLON.Vector3(0,1.04,0));
  const key=scene.getLightByName("renKey"),fill=scene.getLightByName("renFill");
  if(key){key.direction.set(-.65,-1,-.5);key.diffuse=new BABYLON.Color3(1,.88,.72);key.intensity=1.25;}
  if(fill)fill.intensity=.95;
 }
 function mount(scene,camera){
  if(!scene||scenes.has(scene))return;
  mountFloor(BABYLON,scene);scenes.add(scene);frame(scene,camera);
 }
 return Object.freeze({sync,mount,frame});
})();
