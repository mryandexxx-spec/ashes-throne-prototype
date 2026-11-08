/* STORY-002 / STORY-003 — noncanonical combat prototypes, ONLY in the story sandbox.
 * STORY-003 classId uses the FIVE APPROVED class identifiers from GearData:
 * melee, ranged, mage, support, tank; individual assignment is a proposal,
 * not an established literary skill or a permanent roster class.
 * No automatic equipment, class skill or progression is granted.
 * Never add these IDs to permanent HEROES, save v3 or HeroCollectionCore. */
const StoryTrialData=(()=>{
 "use strict";
 const profiles=Object.freeze([
  Object.freeze({id:"trial-ren",name:"Рен Терен",classId:"melee",role:"Боец ближнего боя · проба",side:"ally",
   glyph:"⌁",hp:91,atk:27,speed:150}),
  Object.freeze({id:"trial-nada",name:"Нада",classId:"support",role:"Поддержка · проба",side:"ally",
   glyph:"✎",hp:85,atk:18,speed:120}),
  Object.freeze({id:"trial-liora",name:"Лиора Вель",classId:"tank",role:"Танк · проба",side:"ally",
   glyph:"◇",hp:116,atk:20,speed:105})
 ]);
 function heroes(){return profiles.map(hero=>({...hero}));}
 return Object.freeze({profiles,heroes});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=StoryTrialData;
