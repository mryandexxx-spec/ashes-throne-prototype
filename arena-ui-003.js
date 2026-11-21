/* ARENA-UI-003: SWGOH-style battle HUD helpers. Presentation only.
   - forecast(): predicted turn order from the current initiative meters. It
     works on a copy and never changes the battle (CombatCore stays the rule).
   - ability icons: approved 63-image atlas first, manifest-listed art second,
     and the original SVG pictogram underneath as safe visual fallback. The manifest is read once, so
     absent files are never requested (no 404 per button on iPhone).
   No Babylon, no timers, no layout reads. */
const ArenaUI003=(()=>{
 "use strict";
 const QUEUE_SIZE=6;
 const PORTRAITS=Object.freeze({
  ren:"assets/ren-portrait-ui.webp",
  nada:"assets/nada-portrait-ui.webp?v=2",
  liora:"assets/liora-portrait-ui.webp?v=1",
  art:"assets/art-portrait-ui.webp?v=2",
  sava:"assets/sava-portrait-ui.webp?v=2"
 });
 // [ПРЕДЛОЖЕНИЕ] temporary pictograms, approved by the owner 20.11.2026 until
 // the generated icons (ABILITY_ICON_PROMPTS_001) are added to assets/abilities/.
 const GLYPHS=Object.freeze({
  strike:'<path d="M5 19 17 7"/><path d="M14 4h6v6"/><path d="M4 15l5 5"/>',
  break:'<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/><path d="M12 7l-2 4h3l-2 5"/>',
  sweep:'<path d="M3 15c4-7 14-7 18 0"/><path d="M6 19c3-4 9-4 12 0"/><path d="M12 3v5"/>',
  shield:'<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/><path d="M12 7v10"/>',
  heal:'<path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9"/>',
  link:'<rect x="3" y="9" width="9" height="6" rx="3"/><rect x="12" y="9" width="9" height="6" rx="3"/>',
  signal:'<path d="M6 21V4"/><path d="M6 4h11l-3 4 3 4H6"/>',
  coordinate:'<path d="M4 5l7 7"/><path d="M4 9V5h4"/><path d="M20 5l-7 7"/><path d="M20 9V5h-4"/><circle cx="12" cy="17" r="3"/>',
  power:'<path d="M12 2.5l2.2 5.8 6-1.6-3.9 4.8 4.6 3.4-6 .6.5 6-3.4-4.6-3.4 4.6.5-6-6-.6 4.6-3.4-3.9-4.8 6 1.6z"/>'
 });
 const ACCENT=Object.freeze({strike:"ember",break:"ember",power:"ember",sweep:"crimson",shield:"steel",
  link:"steel",heal:"verdant",signal:"gold",coordinate:"gold"});
 const MANIFEST="assets/abilities/manifest.json";
 const missing=new Set(),available=new Set();
 let manifestRequest=null;
 // One request per session. A broken or absent manifest means pictograms only.
 function loadManifest(fetchFn=typeof fetch==="function"?fetch:null){
  if(manifestRequest)return manifestRequest;
  if(typeof fetchFn!=="function")return Promise.resolve(false);
  manifestRequest=Promise.resolve().then(()=>fetchFn(MANIFEST,{cache:"no-cache"}))
   .then(r=>r&&r.ok?r.json():null)
   .then(data=>{
    const names=Array.isArray(data?.icons)?data.icons:[];
    for(const name of names)if(typeof name==="string"&&/^[a-z0-9-]+-(basic|special|powerful)\.webp$/.test(name))
     available.add("assets/abilities/"+name);
    return available.size>0;
   }).catch(()=>false);
  return manifestRequest;
 }

 function glyphFor(definition,slot){
  if(!definition)return "strike";
  const base=baseGlyph(definition);
  // A single-target powerful strike must not look like the basic attack.
  return slot==="powerful"&&(base==="strike"||base==="break")?"power":base;
 }
 function baseGlyph(definition){
  const kind=definition.kind,target=definition.target;
  if(kind==="heal")return "heal";
  if(kind==="guard")return "shield";
  if(kind==="insurance")return "link";
  if(kind==="signal")return "signal";
  if(kind==="coordinate")return "coordinate";
  if(target==="all-enemies")return "sweep";
  if(definition.weakening>0||definition.onHitStatus||definition.disruptTurns)return "break";
  return "strike";
 }
 function iconUrl(heroId,slot){
  if(typeof heroId!=="string"||!/^[a-z0-9-]+$/.test(heroId)||!["basic","special","powerful"].includes(slot))return null;
  return "assets/abilities/"+heroId+"-"+slot+".webp";
 }
 function iconMissing(img){
  const src=img?.getAttribute?.("src");
  if(src)missing.add(src);
  if(img)img.remove?.();
 }
 // One button face: pictogram underneath, owner art on top when it loads.
 function abilityFace(heroId,slot,definition,cooldown){
  const glyph=glyphFor(definition,slot);
  const url=iconUrl(heroId,slot);
  const approved=typeof AbilityIconCore!=="undefined"?AbilityIconCore.markup(heroId,slot,"ability-art"):"";
  const art=approved||(url&&available.has(url)&&!missing.has(url)?
   `<img class="ability-art" src="${url}" alt="" draggable="false" onerror="ArenaUI003.iconMissing(this)">`:"");
  const cd=Number.isInteger(cooldown)&&cooldown>0?`<span class="ability-cooldown" aria-hidden="true">${cooldown}</span>`:"";
  const name=definition?.name||"";
  return {glyph,accent:ACCENT[glyph],
   html:`<svg class="ability-glyph" viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[glyph]}</svg>${art}${cd}<span class="ability-name">${escapeHtml(name)}${cd?" · "+cooldown:""}</span>`};
 }
 function escapeHtml(text){
  return String(text).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 }
 function initials(name){
  // Words with a letter only: "Сарх — сухопутный курьер" -> "СС", not "С—".
  const words=String(name||"?").split(/\s+/).filter(w=>/\p{L}/u.test(w));
  return (words.length>1?words[0][0]+words[1][0]:words[0]?.slice(0,2)||"?").toUpperCase();
 }
 function portrait(fighter){
  return fighter&&PORTRAITS[fighter.id]||null;
 }
 // Predicted order: current actor first, then the next ready fighters by the
 // same InitiativeModel rule (threshold 1000, tie by index) on cloned meters.
 // Effects that change meters during enemy actions are not anticipated.
 function forecast(battle,count=QUEUE_SIZE,deps={}){
  const out=[];
  if(!battle?.active||!Array.isArray(battle.fighters))return out;
  const nextActor=deps.nextActor||(typeof InitiativeModel!=="undefined"?InitiativeModel.nextActor:null);
  const speedOf=deps.speedOf||(f=>f.speed);
  if(typeof nextActor!=="function")return out;
  const sim=battle.fighters.map((f,i)=>({id:f.id,hp:f.hp,meter:Number(f.meter)||0,
   index:Number.isInteger(f.index)?f.index:i,speed:Math.max(1,Number(speedOf(f))||1)}));
  const current=battle.currentActor>=0?sim[battle.currentActor]:null;
  if(current&&current.hp>0){
   out.push(current.id);
   current.meter=Math.max(0,current.meter-1000);
  }
  for(let guard=0;out.length<count&&guard<count*4;guard++){
   let ready;
   try{ready=nextActor(sim,f=>f.speed);}catch(e){break;}
   if(!ready)break;
   out.push(ready.id);
   const f=sim.find(x=>x.id===ready.id);
   f.meter=Math.max(0,f.meter-1000);
  }
  return out;
 }
 function queueHtml(battle,ids){
  return ids.map((id,i)=>{
   const f=battle.fighters.find(x=>x.id===id);
   if(!f)return "";
   const img=portrait(f);
   const face=img?`<img src="${img}" alt="" draggable="false">`:`<span>${escapeHtml(initials(f.name))}</span>`;
   return `<li class="turn-queue-item ${f.side}${i===0?" now":""}" data-fighter-id="${escapeHtml(f.id)}" title="${escapeHtml(f.name)}">${face}</li>`;
  }).join("");
 }
 function queueLabel(battle,ids){
  const names=ids.map(id=>battle.fighters.find(x=>x.id===id)?.name).filter(Boolean);
  return names.length?"Очередь ходов: "+names.map((n,i)=>i===0?n+" (сейчас)":n).join(", "):"Очередь ходов";
 }
 return Object.freeze({QUEUE_SIZE,PORTRAITS,GLYPHS,MANIFEST,loadManifest,glyphFor,iconUrl,iconMissing,abilityFace,
  initials,portrait,forecast,queueHtml,queueLabel,escapeHtml,missingIcons:()=>[...missing]});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ArenaUI003;
