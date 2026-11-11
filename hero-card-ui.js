/* HEROCARD001: viewport dossier dialogs; gameplay and 3D remain their owners. */
const HeroCardUI=(()=>{
 "use strict";
 let returnFocus=null;
 const get=id=>document.getElementById(id);
 const build=get("buildVersion");
 if(build)build.dataset.shortBuild=(build.textContent.match(/v\d+\.\d+\.\d+/)?.[0]||"")+" · HEROCARD001";
 function open(id){
  const dialog=get(id);
  if(!dialog||dialog.open)return;
  returnFocus=document.activeElement;
  dialog.showModal();
 }
 function leave(id){
  document.body?.classList.toggle("hero-card-mode",id==="heroDetail");
  if(id!=="heroDetail")document.querySelectorAll(".hero-card-dialog[open]").forEach(d=>d.close());
 }
 document.querySelectorAll("[data-hero-dialog]").forEach(button=>{
  button.addEventListener("click",()=>open(button.dataset.heroDialog));
 });
 document.querySelectorAll(".hero-card-dialog").forEach(dialog=>{
  dialog.querySelector("[data-hero-dialog-close]")?.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{
   if(event.target!==dialog)return;
   const r=dialog.getBoundingClientRect();
   if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  });
  dialog.addEventListener("close",()=>{
   if(get("heroDetail")?.classList.contains("active")&&returnFocus?.isConnected)returnFocus.focus();
   returnFocus=null;
  });
 });
 const paths={
  basic:'M5 31 29 5 32 4 31 9 9 33 M4 23 13 32 M4 34 8 30',
  special:'M6 8 16 18 6 28 M30 8 20 18 30 28 M18 3 18 10 M18 26 18 33',
  powerful:'M18 3 18 12 M18 24 18 33 M3 18 12 18 M24 18 33 18 M7 7 13 13 M23 23 29 29 M7 29 13 23 M23 13 29 7',
  passive:'M5 30 12 20 20 23 29 6 M23 6 29 6 30 12',
  leader:'M11 16 11 10 C11 1 25 1 25 10 L25 16 M8 16 28 16 28 32 8 32 Z',
  torso:'M12 5 5 10 2 20 8 23 10 17 10 32 26 32 26 17 28 23 34 20 31 10 24 5 M12 5 Q18 14 24 5',
  head:'M11 30 11 22 C1 7 10 3 18 3 C26 3 35 7 25 22 L25 30 Z',
  hands:'M8 29 5 19 8 16 13 20 13 7 17 7 17 18 20 6 24 7 23 19 28 12 31 14 27 28 21 32 12 32 Z',
  feet:'M10 3 23 3 23 21 31 25 31 32 6 32 6 26 10 21 Z',
  utility:'M3 13 33 13 33 25 3 25 Z M14 10 22 10 22 28 14 28 Z'
 };
 function icon(kind){
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox","0 0 36 36");svg.setAttribute("aria-hidden","true");
  const path=document.createElementNS("http://www.w3.org/2000/svg","path");
  path.setAttribute("d",paths[kind]||paths.basic);path.setAttribute("fill","none");
  path.setAttribute("stroke","currentColor");path.setAttribute("stroke-width","2.3");
  path.setAttribute("stroke-linecap","round");path.setAttribute("stroke-linejoin","round");
  svg.append(path);return svg;
 }
 function decorate(){
  get("heroAbilityList")?.querySelectorAll("[data-hero-ability]").forEach(card=>{
   if(card.querySelector(".hero-card-ability-icon"))return;
   const span=document.createElement("span");span.className="hero-card-ability-icon";
   span.append(icon(card.dataset.heroAbility));card.prepend(span);
  });
  get("gearSlots")?.querySelectorAll("[data-gear-slot]").forEach(button=>{
   const slot=GearData.SLOTS[Number(button.dataset.gearSlot)];
   if(!slot)return;
   const label=document.createElement("small");label.textContent=slot.label;
   button.replaceChildren(icon(slot.id==="weapon"?"basic":slot.id),label);
  });
 }
 function ability(event){
  const card=event.target.closest?.("[data-hero-ability]");
  if(!card||event.target.closest?.("[data-skill-open]"))return;
  const id=card.dataset.heroAbility;
  if(typeof SkillCore!=="undefined"&&SkillCore.IDS.includes(id)){
   openSkillUpgrade(id);return;
  }
  const base=ALLIES.find(h=>h.id===selectedHeroId);
  if(!base)return;
  const info=AbilityInfo.forHero(progressedHero(base)).find(a=>a.id===id);
  if(!info)return;
  get("heroAbilityDialogTitle").textContent=info.name;
  get("heroAbilityDescription").textContent=info.description;
  get("heroAbilityMeta").textContent=info.meta.join(" · ");
  open("heroAbilityDialog");
 }
 get("heroAbilityList")?.addEventListener("click",ability);
 get("heroAbilityList")?.addEventListener("keydown",event=>{
  if((event.key==="Enter"||event.key===" ")&&event.target.matches("[data-hero-ability]")){
   event.preventDefault();ability(event);
  }
 });
 leave(get("heroDetail")?.classList.contains("active")?"heroDetail":"home");
 return Object.freeze({open,leave,decorate});
})();
