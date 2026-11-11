/* HEROCARD001: viewport dossier dialogs; gameplay and 3D remain their owners. */
const HeroCardUI=(()=>{
 "use strict";
 let returnFocus=null;
 const get=id=>document.getElementById(id);
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
 return Object.freeze({open,leave});
})();
