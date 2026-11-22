"use strict";
// Legacy headless VM tests need the same minimal DOM contract as the new
// presentation layer. The production game uses real browser DOM APIs.
module.exports=function installGearVictoryDom(document,elements,makeElement){
 function decorate(node){
  if(!node)return node;
  node.children=node.children||[];
  node.attributes=node.attributes||{};
  node.append=function(...children){this.children.push(...children);};
  node.replaceChildren=function(...children){this.children=[...children];};
  node.setAttribute=function(name,value){this.attributes[name]=String(value);};
  node.getAttribute=function(name){return this.attributes[name]??null;};
  node.removeAttribute=function(name){delete this.attributes[name];};
  node.focus=function(){this.focused=true;};
  return node;
 }
 for(const node of Object.values(elements))decorate(node);
 for(const id of ["gearPromotionHeroName","gearPromotionTier","gearPromotionHistory",
                  "gearPromotionPortrait","detailRenPortrait"])
  if(!elements[id])elements[id]=decorate(makeElement(id));
 document.getElementById=id=>elements[id]||null;
 document.createElement=name=>decorate(makeElement(name));
};