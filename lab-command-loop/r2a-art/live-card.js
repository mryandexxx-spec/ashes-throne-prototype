"use strict";
// Reuse the production dossier renderer, but own its lifetime only in this isolated lab.
(()=>{const card=document.getElementById("card"),stage=document.getElementById("detailHeroStage");let wanted=false;let configured=null;
function sync(){const visible=!card.hidden&&!document.hidden;if(visible===wanted)return;wanted=visible;if(visible){if(typeof RenCard3D==="undefined"||typeof BABYLON==="undefined"){document.getElementById("renCard3DStatus").textContent="3D недоступно · запасной портрет";return;}void RenCard3D.activate("art");}else if(typeof RenCard3D!=="undefined")RenCard3D.dispose();}
function frame(){if(!stage.classList.contains("has-ren-3d")||typeof BABYLON==="undefined")return;const engine=BABYLON.EngineStore.Instances.find(e=>e.getRenderingCanvas()?.id==="renCard3DCanvas");const camera=engine?.scenes[0]?.activeCamera;if(!camera||configured===camera)return;configured=camera;camera.radius=2.85;const scene=engine.scenes[0];const fill=scene.getLightByName('renFill'),key=scene.getLightByName('renKey');if(fill)fill.intensity=.95;if(key)key.intensity=1.2;}
new MutationObserver(frame).observe(stage,{attributes:true,attributeFilter:["class"]});
document.getElementById("renCardReset").addEventListener("click",()=>{configured=null;frame()});
new MutationObserver(sync).observe(card,{attributes:true,attributeFilter:["hidden"]});
document.addEventListener("visibilitychange",sync);window.addEventListener("pagehide",()=>{wanted=false;if(typeof RenCard3D!=="undefined")RenCard3D.dispose()});window.addEventListener("pageshow",sync);sync();
})();