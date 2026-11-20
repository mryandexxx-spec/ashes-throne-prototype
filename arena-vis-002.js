/* ARENA-VIS-002: hit feedback for the SWGOH-style arena (audit section 4).
   - floating numbers in a DOM layer over the canvas: damage, critical,
     protection, heal, guard, "Уклонение", "Сопротивление";
   - hit-stop 60-90 ms (the animation clock pauses, the frame keeps rendering);
   - short camera shake on powerful / critical blows;
   - white flash of the target (~80 ms, Babylon overlay, no material changes);
   - no camera push-in: removed by the owner in ARENA-ART-004G (it was on
     powerful abilities); the camera only shakes.
   Presentation only: reads cues from BattleAnimation, never the rules engine.
   No render loop, timers or network. Every part is optional and fail-safe. */
const ArenaVis002=(()=>{
 "use strict";
 const C=Object.freeze({
  HIT_STOP_MS:65,        // ordinary blow
  HIT_STOP_STRONG_MS:90, // critical or powerful blow
  FLASH_MS:80,
  FLASH_ALPHA:.75,
  SHAKE_MS:200,
  SHAKE_PX:7,            // peak screen offset, CSS-independent (camera units below)
  FLOAT_MS:950,
  FLOAT_RISE_PX:34,
  MAX_FLOATERS:10,
  STACK_PX:22,
  FLOOR_PAD_PX:16,       // half a number's height (+pop) below the label
  FLOOR_PAD_NOTE_PX:28   // with a note ("крит") above the value
 });
 const fmt=n=>String(Math.max(0,Math.round(n)));
 // fx -> list of floating labels. Pure; tested in Node.
 function floatSpecs(fx){
  if(!fx||typeof fx!=="object")return [];
  switch(fx.kind){
   case "damage":{
    const crit=fx.crit===true,out=[];
    const hasSplit=Number.isFinite(fx.hp)&&Number.isFinite(fx.protection);
    if(hasSplit&&fx.protection>0)
     out.push({text:"−"+fmt(fx.protection),cls:"protection",note:fx.hp>0?null:"защита"});
    const hp=hasSplit?fx.hp:fx.amount;
    if(Number.isFinite(hp)&&(hp>0||!out.length))
     out.push({text:"−"+fmt(hp),cls:crit?"crit":"damage",note:crit?"крит":null});
    else if(crit&&out.length)out[out.length-1].note="крит";
    return out;
   }
   case "heal":return Number.isFinite(fx.amount)&&fx.amount>0?[{text:"+"+fmt(fx.amount),cls:"heal",note:null}]:[];
   case "guard":return [{text:Number.isFinite(fx.stacks)&&fx.stacks>0?"Защита ×"+fmt(fx.stacks):"Защита",cls:"guard",note:null}];
   case "miss":return [{text:"Уклонение",cls:"miss",note:null}];
   case "resist":return [{text:"Сопротивление",cls:"resist",note:null}];
   default:return [];
  }
 }
 const strongHit=fx=>fx?.kind==="damage"&&(fx.crit===true||fx.power===true);
 // Timing state without Babylon or DOM. Tested in Node.
 function createController(options={}){
  const reduced=options.reducedMotion===true;
  let stopMs=0,shakeMs=0,shakeTotal=0,seed=9137;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1;};
  function hitStop(ms){if(Number.isFinite(ms)&&ms>0)stopMs=Math.max(stopMs,ms);}
  // Real frame time in, animation time out: the clock pauses during hit-stop.
  function animationDelta(dt){
   if(!Number.isFinite(dt)||dt<=0)return 0;
   if(stopMs<=0)return dt;
   const used=Math.min(dt,stopMs);stopMs-=used;return dt-used;
  }
  function shake(ms){if(!reduced&&ms>0){shakeMs=Math.max(shakeMs,ms);shakeTotal=Math.max(shakeTotal,shakeMs);}}
  function step(dt){
   dt=Number.isFinite(dt)&&dt>0?Math.min(dt,100):0;
   let ox=0,oy=0;
   if(shakeMs>0){
    shakeMs=Math.max(0,shakeMs-dt);
    const k=shakeTotal>0?shakeMs/shakeTotal:0;
    ox=rand()*C.SHAKE_PX*k;oy=rand()*C.SHAKE_PX*.6*k;
    if(shakeMs===0)shakeTotal=0;
   }
   return {offsetX:ox,offsetY:oy};
  }
  function reset(){stopMs=0;shakeMs=0;shakeTotal=0;}
  return Object.freeze({hitStop,animationDelta,shake,step,reset,stopping:()=>stopMs>0});
 }
 // DOM floaters: fixed pool, transform/opacity only, positions computed in JS
 // so they follow battle speed and hit-stop. No layout reads per frame.
 // options.floor(id) (ARENA-UI-003B): bottom of the target's label in overlay
 // px, read at spawn and on every tick, because labels shift a few px while
 // fighters move. A number never rises into that label.
 function createFloaters(container,doc,options={}){
  const reduced=options.reducedMotion===true;
  const floorOf=id=>{const v=typeof options.floor==="function"?options.floor(id):null;return Number.isFinite(v)?v:null;};
  const items=[];
  const stacks=new Map(); // targetId -> recent count, for vertical stacking
  function node(){
   if(items.length<C.MAX_FLOATERS&&container&&doc?.createElement){
    const el=doc.createElement("div");el.className="arena-floater";el.setAttribute?.("aria-hidden","true");
    const note=doc.createElement("span");note.className="arena-floater-note";
    const value=doc.createElement("span");value.className="arena-floater-value";
    el.appendChild(note);el.appendChild(value);container.appendChild(el);
    const item={el,note,value,age:Infinity,x:0,y:0,id:null};items.push(item);return item;
   }
   let oldest=null;
   for(const item of items)if(!oldest||item.age>oldest.age)oldest=item;
   return oldest;
  }
  function spawn(id,specs,point){
   if(!point||!specs?.length)return 0;
   let n=0;
   for(const spec of specs){
    const item=node();if(!item)break;
    const stack=stacks.get(id)||0;stacks.set(id,stack+1);
    let y=point.y-stack*C.STACK_PX;
    const pad=spec.note?C.FLOOR_PAD_NOTE_PX:C.FLOOR_PAD_PX;
    const floor=floorOf(id);
    // Start low enough that the whole rise stays under the label.
    if(floor!==null&&y<floor+pad+(reduced?0:C.FLOAT_RISE_PX))y=floor+pad+(reduced?0:C.FLOAT_RISE_PX)+stack*C.STACK_PX;
    item.id=id;item.pad=pad;item.key=null;item.age=0;item.x=point.x+(specs.length>1?(n===0?-18:18):0);item.y=y;
    item.el.className="arena-floater on "+spec.cls;
    item.note.textContent=spec.note||"";item.note.hidden=!spec.note;
    item.value.textContent=spec.text;
    place(item);n++;
   }
   return n;
  }
  // Labels are placed after the floaters tick in a frame; re-apply the floor
  // so a number never trails a label that just moved (ARENA-UI-003B).
  function relayout(){
   for(const item of items)if(item.age<C.FLOAT_MS)place(item);
  }
  function place(item){
   const t=Math.min(1,item.age/C.FLOAT_MS);
   const rise=reduced?0:C.FLOAT_RISE_PX*(1-(1-t)*(1-t));
   const pop=reduced?1:t<.12?.6+t/.12*.55:t<.22?1.15-(t-.12)/.1*.15:1;
   const alpha=t<.7?1:Math.max(0,1-(t-.7)/.3);
   const floor=floorOf(item.id);
   const y=floor===null?item.y-rise:Math.max(item.y-rise,floor+item.pad);
   const key=item.x.toFixed(1)+"|"+y.toFixed(1)+"|"+pop.toFixed(3)+"|"+alpha.toFixed(3);
   if(item.key===key)return;
   item.key=key;
   item.el.style.transform=`translate3d(${item.x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) scale(${pop.toFixed(3)})`;
   item.el.style.opacity=alpha.toFixed(3);
  }
  function tick(dt){
   if(!Number.isFinite(dt)||dt<=0)return;
   let alive=0;
   for(const item of items){
    if(item.age>=C.FLOAT_MS)continue;
    item.age+=dt;
    if(item.age>=C.FLOAT_MS){item.el.className="arena-floater";item.el.style.opacity="0";continue;}
    alive++;place(item);
   }
   if(!alive)stacks.clear();
  }
  function clear(){
   for(const item of items){item.age=Infinity;item.el.className="arena-floater";item.el.style.opacity="0";}
   stacks.clear();
  }
  const active=()=>items.filter(i=>i.age<C.FLOAT_MS).length;
  return Object.freeze({spawn,tick,relayout,clear,active,nodes:()=>items.length});
 }
 // Babylon overlay flash: per-mesh, so shared GLB materials are never touched.
 function createFlash(B){
  const flashes=new Map(); // id -> {meshes,age}
  const white=B?.Color3?new B.Color3(1,1,1):null;
  function start(id,list){
   if(!white||!Array.isArray(list)||!list.length)return false;
   stop(id);
   for(const m of list){m.overlayColor=white;m.overlayAlpha=C.FLASH_ALPHA;m.renderOverlay=true;}
   flashes.set(id,{meshes:list,age:0});return true;
  }
  function stop(id){
   const f=flashes.get(id);if(!f)return;
   for(const m of f.meshes){m.renderOverlay=false;m.overlayAlpha=0;}
   flashes.delete(id);
  }
  // Real time: the flash belongs to the hit-stop, so it does not wait for the clock.
  function tick(dt){
   for(const [id,f] of flashes){
    f.age+=Math.max(0,Math.min(dt,100));
    if(f.age>=C.FLASH_MS){stop(id);continue;}
    const a=C.FLASH_ALPHA*(1-f.age/C.FLASH_MS);
    for(const m of f.meshes)m.overlayAlpha=a;
   }
  }
  function clear(){for(const id of [...flashes.keys()])stop(id);}
  return Object.freeze({start,tick,clear,active:()=>flashes.size});
 }
 function create(B,options={}){
  const reduced=options.reducedMotion===true;
  const controller=createController({reducedMotion:reduced});
  const floaters=createFloaters(options.container||null,options.document||null,{reducedMotion:reduced,floor:options.floor});
  const flash=createFlash(B);
  // ctx: {multiplier, project(id)->{x,y}|null, meshesFor(id)->Mesh[]}
  function handle(cues,ctx={}){
   if(!Array.isArray(cues)||!cues.length)return;
   const multiplier=Number.isFinite(ctx.multiplier)&&ctx.multiplier>0?ctx.multiplier:1;
   const scale=1/Math.sqrt(multiplier); // 4x autobattle keeps the beat but shorter
   for(const cue of cues){
    if(!cue||typeof cue.id!=="string")continue;
    if(cue.kind==="power")continue; // ARENA-ART-004G: no camera push-in
    const specs=floatSpecs(cue);
    if(specs.length&&typeof ctx.project==="function")floaters.spawn(cue.id,specs,ctx.project(cue.id));
    if(cue.kind==="damage"){
     const strong=strongHit(cue);
     controller.hitStop((strong?C.HIT_STOP_STRONG_MS:C.HIT_STOP_MS)*scale);
     if(strong)controller.shake(C.SHAKE_MS*scale);
     if(typeof ctx.meshesFor==="function")flash.start(cue.id,ctx.meshesFor(cue.id));
    }
   }
  }
  // Applies the shake to an ArcRotateCamera; the radius is never touched.
  function frame(dt,camera){
   const s=controller.step(dt);
   floaters.tick(dt);flash.tick(dt);
   if(!camera)return s;
   const off=camera.targetScreenOffset;
   // View-space units: at radius 7.6 and fov .85 one CSS pixel of a 390 px frame is ~.018.
   if(off){off.x=s.offsetX*.017;off.y=s.offsetY*.017;}
   return s;
  }
  function clear(camera){
   controller.reset();floaters.clear();flash.clear();
   if(camera?.targetScreenOffset){camera.targetScreenOffset.x=0;camera.targetScreenOffset.y=0;}
  }
  return Object.freeze({handle,frame,clear,animationDelta:dt=>controller.animationDelta(dt),
   controller,floaters,flash});
 }
 return Object.freeze({constants:C,floatSpecs,strongHit,createController,createFloaters,createFlash,create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ArenaVis002;
