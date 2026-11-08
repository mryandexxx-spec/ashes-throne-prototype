/* STORY-002 — noncanonical combat prototypes, ONLY in the story sandbox.
 * Never add these IDs to the permanent HEROES, save v3 or HeroCollectionCore. */
const StoryTrialData=(()=>{
 "use strict";
 const profiles=Object.freeze([
  Object.freeze({id:"trial-ren",name:"Рен Терен",role:"Проводник · проба",side:"ally",
   glyph:"⌁",hp:91,atk:27,speed:150}),
  Object.freeze({id:"trial-nada",name:"Нада",role:"Исследовательница · проба",side:"ally",
   glyph:"✎",hp:85,atk:18,speed:120}),
  Object.freeze({id:"trial-liora",name:"Лиора Вель",role:"Спасательница · проба",side:"ally",
   glyph:"◇",hp:116,atk:20,speed:105})
 ]);
 function heroes(){return profiles.map(hero=>({...hero}));}
 return Object.freeze({profiles,heroes});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=StoryTrialData;
