/* NETWORK-UI-000: minimal offline viewer for the Design-canvas mockups.
 * Supports only what these mockups use: <x-dc>, <helmet>, {{path}} holes,
 * <sc-for list as>, <sc-if value>, onClick, and a DCLogic class with state.
 * Documentation-only helper; it is not loaded by the game. */
(function(){
 "use strict";
 class DCLogic{
  constructor(props){this.props=props||{};this.state={};}
  setState(patch){Object.assign(this.state,patch);this._render();}
  forceUpdate(){this._render();}
 }
 window.DCLogic=DCLogic;
 let helmetDone=false;
 const HOLE=/\{\{\s*([^}]+?)\s*\}\}/g;
 function lookup(scope,path){
  if(/^(true|false)$/.test(path))return path==="true";
  if(/^-?\d+(\.\d+)?$/.test(path))return Number(path);
  return path.split(".").reduce((v,k)=>v==null?undefined:v[k],scope);
 }
 function text(scope,s){return s.replace(HOLE,(_,p)=>{const v=lookup(scope,p);return v==null?"":String(v);});}
 function whole(s){const m=/^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(s);return m?m[1]:null;}
 function expand(node,scope){
  const out=[];
  for(const child of Array.from(node.childNodes))out.push(...build(child,scope));
  return out;
 }
 function build(node,scope){
  if(node.nodeType===3)return [document.createTextNode(text(scope,node.nodeValue))];
  if(node.nodeType!==1)return [];
  const tag=node.tagName.toLowerCase();
  if(tag==="sc-for"){
   const list=lookup(scope,whole(node.getAttribute("list"))||"")||[];
   const as=node.getAttribute("as")||"item";
   return list.flatMap((item,i)=>expand(node,Object.assign({},scope,{[as]:item,$index:i})));
  }
  if(tag==="sc-if")return lookup(scope,whole(node.getAttribute("value"))||"")?expand(node,scope):[];
  if(tag==="helmet"){if(helmetDone)return [];helmetDone=true;document.head.append(...Array.from(node.childNodes).map(n=>n.cloneNode(true)));return [];}
  const el=document.createElementNS(node.namespaceURI,node.namespaceURI==="http://www.w3.org/2000/svg"?node.tagName:tag);
  for(const {name,value} of Array.from(node.attributes)){
   if(/^on[a-z]/i.test(name)){
    const fn=lookup(scope,whole(value)||"");
    if(typeof fn==="function")el.addEventListener(name.slice(2).toLowerCase(),fn);
    continue;
   }
   el.setAttribute(name,text(scope,value));
  }
  if(node.childNodes.length)el.append(...expand(node,scope));
  return [el];
 }
 function boot(){
  const host=document.querySelector("x-dc");
  const src=document.querySelector("script[data-dc-script]");
  if(!host||!src)return;
  const tpl=document.createElement("template");
  tpl.innerHTML=host.innerHTML;
  host.replaceChildren();
  host.style.display="block";
  const Component=new Function("DCLogic",src.textContent+"\nreturn Component;")(DCLogic);
  const inst=new Component({});
  inst._render=()=>{
   const nodes=expand(tpl.content,inst.renderVals());
   host.replaceChildren(...nodes);
  };
  inst._render();
 }
 document.write("<style>x-dc{display:none}</style>");
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();
