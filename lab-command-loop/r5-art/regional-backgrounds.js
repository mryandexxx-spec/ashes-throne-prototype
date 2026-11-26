"use strict";
// R5 lab only. Hero-specific override > regional background > neutral backdrop.
// Entries describe presentation, not new canon. Do not assign an unknown region by guessing.
const RegionalCardBackgrounds=(()=>{
 const regional=Object.freeze({"gardens-over-abyss":Object.freeze({id:"gardens-terrace-preview",url:"assets/arena-env005-terrace.webp",status:"existing game asset; temporary visual fallback"})});
 const heroes=Object.freeze({art:Object.freeze({regionId:"gardens-over-abyss",approvedOverride:null,labPreview:Object.freeze({id:"gardens-art-r57",url:"lab-command-loop/r5-art/r56/gardens-art.webp",status:"lore-grounded artistic candidate; not canon or approved final art"})})});
 const neutral=Object.freeze({id:"neutral",url:null,status:"no regional background available"});
 const resolve=(heroId,regionId)=>heroes[heroId]?.approvedOverride||heroes[heroId]?.labPreview||regional[regionId||heroes[heroId]?.regionId]||neutral;
 function apply(element,heroId,regionId){
 const entry=resolve(heroId,regionId);
 const set=e=>{const safe=e.url?new URL(e.url,document.baseURI).href:null;element.dataset.regionBackground=e.id;element.style.setProperty("--r5-hall",safe?'url("'+safe+'")':"none");};
 set(entry);
 if(entry.url){const probe=new Image();probe.onerror=()=>{if(element.dataset.regionBackground===entry.id)set(regional[regionId||heroes[heroId]?.regionId]||neutral)};probe.src=new URL(entry.url,document.baseURI).href;}
 return entry;
}
 return Object.freeze({resolve,apply});
})();