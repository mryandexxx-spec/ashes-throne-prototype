/* NET-UX-003: presentation-only navigation for clues, weekly threat and daily tasks.
 * Switching views never starts an operation, writes a save, or loads a 3D scene.
 */
const NetworkNavigation=(()=>{
 "use strict";
 let mounted=false,threatAvailable=false,currentView="clues";
 const $=id=>document.getElementById(id);
 function apply(){
  const root=$("network"),clues=$("netuxCluesPanel"),threat=$("net008aThreat"),daily=$("netuxDailyPanel");
  if(!root||!clues||!threat)return false;
  clues.hidden=currentView!=="clues";
  threat.hidden=currentView!=="threat";
  if(daily)daily.hidden=currentView!=="daily";
  const quick=$("netuxThreatShortcut");
  if(quick){
   quick.hidden=!threatAvailable;
   quick.setAttribute("aria-pressed",String(currentView==="threat"));
  }
  root.querySelectorAll("[data-net-view]").forEach(button=>{
   const active=button.dataset.netView===currentView;
   button.setAttribute("aria-pressed",String(active));
   if(button.dataset.netView==="threat")button.hidden=!threatAvailable;
  });
  return true;
 }
 function select(view){
  if(!["clues","threat","daily"].includes(view))return false;
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
    const shortcut=event.target.closest?.("button[data-net-quick]");
    if(shortcut&&root.contains(shortcut)&&!shortcut.hidden&&!shortcut.disabled){
     select(shortcut.dataset.netQuick);return;
    }
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
