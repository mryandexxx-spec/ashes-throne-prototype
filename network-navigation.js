/* NET-UX-002: presentation-only navigation for the live network and weekly threat.
 * Switching views never starts an operation, writes a save, or loads a 3D scene.
 */
const NetworkNavigation=(()=>{
 "use strict";
 let mounted=false,threatAvailable=false,currentView="clues";
 const $=id=>document.getElementById(id);
 function apply(){
  const root=$("network"),clues=$("netuxCluesPanel"),threat=$("net008aThreat");
  if(!root||!clues||!threat)return false;
  clues.hidden=currentView!=="clues";
  threat.hidden=currentView!=="threat";
  root.querySelectorAll("[data-net-view]").forEach(button=>{
   const active=button.dataset.netView===currentView;
   button.setAttribute("aria-pressed",String(active));
   if(button.dataset.netView==="threat")button.hidden=!threatAvailable;
  });
  return true;
 }
 function select(view){
  if(view!=="clues"&&view!=="threat")return false;
  if(view==="threat"&&!threatAvailable)return false;
  currentView=view;
  return apply();
 }
 function setThreatAvailable(available){
  threatAvailable=!!available;
  if(!threatAvailable&&currentView==="threat")currentView="clues";
  return apply();
 }
 function mount({threatAvailable:available=false}={}){
  const root=$("network");
  if(!root)return false;
  if(!mounted){
   root.addEventListener("click",event=>{
    const button=event.target.closest?.("button[data-net-view]");
    if(!button||!root.contains(button)||button.hidden||button.disabled)return;
    select(button.dataset.netView);
   });
   mounted=true;
  }
  return setThreatAvailable(available);
 }
 return Object.freeze({mount,select,setThreatAvailable,current:()=>currentView});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkNavigation;
