"use strict";
(()=>{const root=document.documentElement,stageEl=document.getElementById("detailHeroStage"),gear=document.getElementById("r4Gear"),rail=document.getElementById("r5GearRail"),variant=document.getElementById("r5Variant"),picker=document.getElementById("r5Background");
let scene=null,localUrl=null,initial=false;
RegionalCardBackgrounds.apply(root,"art");
for(const b of gear.querySelectorAll("button")){const id=b.dataset.slot,svg=b.querySelector("svg"),img=document.createElement("img");img.src="lab-command-loop/r5-art/gear-"+id+".svg";img.alt="";svg.replaceWith(img);if(id==="utility")b.querySelector("small").textContent="Пояс";}
function current(){return typeof BABYLON!=="undefined"?BABYLON.EngineStore.Instances.find(e=>e.getRenderingCanvas()?.id==="renCard3DCanvas"):null}
function decorate(){if(!stageEl.classList.contains("has-ren-3d"))return;const engine=current(),s=engine?.scenes[0],camera=s?.activeCamera;if(!s||!camera)return;
 if(scene!==s){scene=s;initial=true;}
 R5Stage.mount(s,root.dataset.r5);
 if(initial){camera.radius=root.dataset.r5==="a"?3.06:3.02;camera.setTarget(new BABYLON.Vector3(0,1.00,0));const key=s.getLightByName("renKey");if(key){key.direction.set(-.65,-1,-.5);key.diffuse=new BABYLON.Color3(1,.88,.72);key.intensity=1.25;}const fill=s.getLightByName("renFill");if(fill)fill.intensity=.95;initial=false;}
 // The renderer owns the render loop and its ResizeObserver. Do not clear the
 // WebGL drawing buffer by resizing/rendering again during a variant transition.
}
function choose(){root.dataset.r5=variant.value;if(variant.value==="b")rail.append(gear);else stageEl.insertBefore(gear,stageEl.querySelector(".gear-caption"));initial=true;requestAnimationFrame(decorate)}
variant.addEventListener("change",choose);new MutationObserver(decorate).observe(stageEl,{attributes:true,attributeFilter:["class"]});document.getElementById("renCardReset").addEventListener("click",()=>{initial=true;decorate()});
picker.addEventListener("change",()=>{const file=picker.files?.[0];if(!file)return;if(localUrl)URL.revokeObjectURL(localUrl);localUrl=URL.createObjectURL(file);root.style.setProperty("--r5-hall",'url("'+localUrl+'")');root.dataset.regionBackground="local-preview"});
window.addEventListener("pagehide",()=>{if(localUrl){URL.revokeObjectURL(localUrl);localUrl=null;RegionalCardBackgrounds.apply(root,"art")}});
choose();
})();