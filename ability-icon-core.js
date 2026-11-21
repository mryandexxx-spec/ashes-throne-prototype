/* ABILITYICONS001 — 63 owner-approved WebP illustrations (23 playable, 40 NPC).
 * Single 9×7 atlas: 80 px per cell, no canvas/timers/network fetch per icon.
 * Replace any individual icon through OVERRIDES; see assets/abilities/README.md. */
const AbilityIconCore=(()=>{
 "use strict";
 const ATLAS="assets/abilities/atlas.webp?v=1",COLUMNS=9,ROWS=7;
 const HERO_IDS=Object.freeze(["ren","nada","liora","art","sava"]);
 const NPC_IDS=Object.freeze(["npc-pass-guard","npc-trail-interceptor","npc-ridge-slinger",
  "npc-field-medic","npc-route-signaller","npc-watch-captain",
  "npc-sarkh-convoy-guard","npc-sarkh-land-courier","npc-laun-ford-guard","npc-laun-physician"]);
 const SLOTS=Object.freeze(["basic","special","powerful","passive","leader"]);
 const KEYS=Object.freeze([...HERO_IDS,...NPC_IDS].flatMap(id=>
  ["basic","special","powerful","passive",...(["liora","art","sava"].includes(id)?["leader"]:[])]
   .map(slot=>id+"-"+slot)).sort());
 const INDEX=Object.freeze(Object.fromEntries(KEYS.map((key,i)=>[key,i])));
 // Add only approved replacement files here, e.g. "ren-basic":"assets/abilities/custom/ren-basic.webp?v=2".
 const OVERRIDES=Object.freeze({});
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 function key(actor,slot){
  const actorId=typeof actor==="string"?actor:
   actor?.side==="enemy"&&typeof actor.archetypeId==="string"?actor.archetypeId:
   actor?.archetypeId||actor?.id;
  if(typeof actorId!=="string"||!SLOTS.includes(slot))return null;
  const k=actorId+"-"+slot;return own(INDEX,k)?k:null;
 }
 function style(actor,slot){
  const k=key(actor,slot);
  if(!k)return null;
  const override=OVERRIDES[k];
  if(typeof override==="string"&&override.startsWith("assets/abilities/custom/")&&
     /^assets\/abilities\/custom\/[a-z0-9-]+\.webp(?:\?v=[0-9]+)?$/.test(override))
   return "background-image:url('"+override+"');background-size:cover;background-position:center;";
  const n=INDEX[k],x=n%COLUMNS,y=Math.floor(n/COLUMNS);
  return "background-image:url('"+ATLAS+"');background-size:"+(COLUMNS*100)+"% "+(ROWS*100)+
   "%;background-position:"+(x*100/(COLUMNS-1))+"% "+(y*100/(ROWS-1))+"%;";
 }
 function markup(actor,slot,className="ability-icon-art"){
  const k=key(actor,slot);
  if(!k)return "";
  const cls=/^[a-z0-9-]+$/.test(className)?className:"ability-icon-art";
  return '<span class="'+cls+'" data-ability-icon="'+k+
   '" aria-hidden="true" style="'+style(actor,slot)+'"></span>';
 }
 function element(actor,slot,className="ability-icon-art"){
  const k=key(actor,slot);
  if(!k||typeof document==="undefined")return null;
  const el=document.createElement("span");
  el.className=/^[a-z0-9-]+$/.test(className)?className:"ability-icon-art";
  el.dataset.abilityIcon=k;el.setAttribute("aria-hidden","true");
  el.setAttribute("style",style(actor,slot));return el;
 }
 return Object.freeze({ATLAS,KEYS,HERO_IDS,NPC_IDS,COLUMNS,ROWS,OVERRIDES,key,style,markup,element});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=AbilityIconCore;
