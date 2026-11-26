"use strict";
(()=>{const root=document.documentElement,stageEl=document.getElementById("detailHeroStage"),gear=document.getElementById("r4Gear"),rail=document.getElementById("r5GearRail"),variant=document.getElementById("r5Variant"),picker=document.getElementById("r5Background");
let scene=null,localUrl=null,initial=false;
for(const b of gear.querySelectorAll("button")){const id=b.dataset.slot,svg=b.querySelector("svg"),img=document.createElement("img");img.src="lab-command-loop/r5-art/gear-"+id+".svg";img.alt="";svg.replaceWith(img);if(id==="utility")b.querySelector("small").textContent="Пояс";}
function current(){return typeof BABYLON!=="undefined"?BABYLON.EngineStore.Instances.find(e=>e.getRenderingCanvas()?.id==="renCard3DCanvas"):null}
function decorate(){if(!stageEl.classList.contains("has-ren-3d"))return;const engine=current(),s=engine?.scenes[0],camera=s?.activeCamera;if(!s||!camera)return;
 if(scene!==s){scene=s;initial=true;}
 R5Stage.mount(s,root.dataset.r5);
 if(initial){camera.radius=root.dataset.r5==="a"?3.06:2.86;camera.setTarget(new BABYLON.Vector3(0,.96,0));const key=s.getLightByName("renKey");if(key){key.direction.set(-.65,-1,-.5);key.diffuse=new BABYLON.Color3(1,.88,.72);key.intensity=1.35;}const fill=s.getLightByName("renFill");if(fill)fill.intensity=.84;initial=false;}
 engine.resize();
}
function choose(){root.dataset.r5=variant.value;if(variant.value==="b")rail.append(gear);else stageEl.insertBefore(gear,stageEl.querySelector(".gear-caption"));initial=true;requestAnimationFrame(decorate)}
variant.addEventListener("change",choose);new MutationObserver(decorate).observe(stageEl,{attributes:true,attributeFilter:["class"]});document.getElementById("renCardReset").addEventListener("click",()=>{initial=true;decorate()});
picker.addEventListener("change",()=>{const file=picker.files?.[0];if(!file)return;if(localUrl)URL.revokeObjectURL(localUrl);localUrl=URL.createObjectURL(file);root.style.setProperty("--r5-hall",'url("'+localUrl+'")')});
window.addEventListener("pagehide",()=>{if(localUrl){URL.revokeObjectURL(localUrl);localUrl=null;root.style.removeProperty("--r5-hall")}});
choose();
})();