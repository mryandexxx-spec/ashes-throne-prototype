"use strict";
// Minimal DOM for the real promotion renderer in historical VM integration tests.
// Do not fake transaction results or replace the production renderer.
function install(document,elements){
 function node(){
  let text="";
  return {children:[],dataset:{},attributes:{},hidden:false,
   classList:{add(){},remove(){}},
   get textContent(){return text+this.children.map(c=>c.textContent).join("");},
   set textContent(value){text=String(value);this.children=[];},
   append(...children){this.children.push(...children);},
   replaceChildren(...children){text="";this.children=children;},
   setAttribute(k,v){this.attributes[k]=String(v);},
   getAttribute(k){return this.attributes[k]??null;},
   removeAttribute(k){delete this.attributes[k];},
   focus(){this.focused=true;}
  };
 }
 for(const id of ["gearPromotionDialog","gearPromotionTitle","gearPromotionHeroName",
  "gearPromotionTier","gearPromotionLevel","gearPromotionHistory","gearPromotionCost",
  "gearPromotionPortrait","gearPromotionStats","gearPromotionClose",
  "gearPromotionBonusesTitle","gearPromotionResourceIcon","gearPromotionScrollHint"]){
  if(elements[id])Object.defineProperties(elements[id],Object.getOwnPropertyDescriptors(node()));
  else elements[id]=node();
 }
 elements.gearPromotionDialog.showModal=function(){this.open=true;};
 elements.gearPromotionDialog.close=function(){this.open=false;};
 document.getElementById=id=>elements[id]??null;
 document.createElement=()=>node();
}
module.exports={install};
