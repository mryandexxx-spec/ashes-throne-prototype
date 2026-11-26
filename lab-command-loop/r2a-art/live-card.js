"use strict";
// Reuse the production dossier renderer, but own its lifetime only in this isolated lab.
(()=>{const card=document.getElementById("card"),stage=document.getElementById("detailHeroStage");let wanted=false;
function sync(){const visible=!card.hidden&&!document.hidden;if(visible===wanted)return;wanted=visible;if(visible){if(typeof RenCard3D==="undefined"||typeof BABYLON==="undefined"){document.getElementById("renCard3DStatus").textContent="3D недоступно · запасной портрет";return;}void RenCard3D.activate("art");}else if(typeof RenCard3D!=="undefined")RenCard3D.dispose();}
new MutationObserver(sync).observe(card,{attributes:true,attributeFilter:["hidden"]});
document.addEventListener("visibilitychange",sync);window.addEventListener("pagehide",()=>{wanted=false;if(typeof RenCard3D!=="undefined")RenCard3D.dispose()});window.addEventListener("pageshow",sync);sync();
})();