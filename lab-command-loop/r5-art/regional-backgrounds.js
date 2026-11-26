"use strict";
// R5 lab only. Hero-specific override > regional background > neutral backdrop.
// Entries describe presentation, not new canon. Do not assign an unknown region by guessing.
const RegionalCardBackgrounds=(()=>{
 const regional=Object.freeze({"gardens-over-abyss":Object.freeze({id:"gardens-terrace-preview",url:"assets/arena-env005-terrace.webp",status:"existing game asset; temporary visual fallback"})});
 const heroes=Object.freeze({art:Object.freeze({regionId:"gardens-over-abyss",approvedOverride:null})});
 const neutral=Object.freeze({id:"neutral",url:null,status:"no regional background available"});
 const resolve=(heroId,regionId)=>heroes[heroId]?.approvedOverride||regional[regionId||heroes[heroId]?.regionId]||neutral;
 function apply(element,heroId,regionId){const entry=resolve(heroId,regionId);const safe=entry.url?new URL(entry.url,document.baseURI).href:null;element.dataset.regionBackground=entry.id;element.style.setProperty("--r5-hall",safe?'url("'+safe+'")':"none");return entry}
 return Object.freeze({resolve,apply});
})();