/* ARENA-ENGINE-001 → ARENA-UI-003B: screen-space layout of the labels over
   fighters. Labels are pinned to their fighter (SWGOH): each one sits over its
   head anchor and may move at most MAX_SHIFT_X / MAX_SHIFT_Y to clear another
   label or a fixed HUD control. The former free "packer" (Dune v94) is gone:
   it moved labels far from their owners. No Babylon, combat state or 3D model
   dependencies. No measurements in a render frame: the overlay and each label
   are measured asynchronously by ResizeObserver. */
const ArenaWorldHud = (() => {
  "use strict";
  const GAP = 4;            // minimum clear space between two labels (as the browser checks)
  const LIFT = 4;           // label bottom sits this far above the head anchor
  const MAX_SHIFT_X = 16;   // [ПРЕДЛОЖЕНИЕ] px, either side
  const MAX_SHIFT_Y = 12;   // [ПРЕДЛОЖЕНИЕ] px, up or down
  const NAME_BELOW = 13;    // an enemy target's name hangs under its bars (out of flow)
  const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const intersects = (a,b,gap=GAP)=>a.x < b.x+b.w+gap && a.x+a.w+gap > b.x &&
    a.y < b.y+b.h+gap && a.y+a.h+gap > b.y;
  const area = (a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*
    Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  const STEPS_X=[0,-4,4,-8,8,-12,12,-16,16].filter(v=>Math.abs(v)<=MAX_SHIFT_X);
  const STEPS_Y=[0,-4,-8,-12,4,8,12].filter(v=>Math.abs(v)<=MAX_SHIFT_Y);

  // rows: {id, ax, ay, w, h} in overlay CSS px. Writes x, y (top-left), shiftX/Y
  // (shift from the pinned position) and crowded (no clear spot within reach).
  function anchor(rows,width,height,insets={left:8,right:8,top:8,bottom:8},obstacles=[]) {
    if(!rows.length || width<=0 || height<=0)return rows;
    const left=insets.left,right=width-insets.right,top=insets.top,bottom=height-insets.bottom;
    const blocks=(obstacles||[]).filter(o=>o&&o.w>0&&o.h>0);
    const placed=[];
    // Deterministic: an enemy target with a hanging name first (its name band
    // is wide), then nearer fighters (lower on screen) keep their exact spot.
    const ordered=[...rows].sort((a,b)=>(b.nameW>0)-(a.nameW>0)||b.ay-a.ay||String(a.id).localeCompare(String(b.id)));
    for(const r of ordered){
      const px=clamp(r.ax-r.w/2,left,Math.max(left,right-r.w));
      const py=clamp(r.ay-r.h-LIFT,top,Math.max(top,bottom-r.h));
      // A hidden label (its fighter ran out to strike) takes no room.
      if(r.ghost){r.x=px;r.y=py;r.shiftX=0;r.shiftY=0;r.crowded=false;continue;}
      let best=null,cost=Infinity,fallback=null,least=Infinity;
      for(const dy of STEPS_Y)for(const dx of STEPS_X){
        const box={x:clamp(px+dx,left,Math.max(left,right-r.w)),y:clamp(py+dy,top,Math.max(top,bottom-r.h)),w:r.w,h:r.h};
        const others=[...placed,...blocks];
        // Hysteresis: keep last frame's choice while it is still clear, so a
        // label does not hop when its neighbour sways during a hit.
        const keep=Number.isFinite(r.shiftX)?((box.x-px)-r.shiftX)**2+((box.y-py)-r.shiftY)**2:0;
        const score=dx*dx*2+dy*dy*(dy>0?3:1)+keep*1.5;
        if(!others.some(p=>intersects(box,p,p.block?0:GAP))){
          if(score<cost){best=box;cost=score;}
        }else if(!best){
          const lost=others.reduce((sum,p)=>sum+area(box,p),0)*1000+score;
          if(lost<least){fallback=box;least=lost;}
        }
      }
      const box=best||fallback||{x:px,y:py,w:r.w,h:r.h};
      r.x=box.x;r.y=box.y;r.shiftX=box.x-px;r.shiftY=box.y-py;r.crowded=!best;
      placed.push({x:r.x,y:r.y,w:r.w,h:r.h});
      // The name hanging under an enemy target's bars is wider than the bars:
      // neighbours must clear it too.
      if(r.nameW>0)placed.push({x:r.x+r.w/2-r.nameW/2,y:r.y+r.h,w:r.nameW,h:NAME_BELOW});
    }
    return rows;
  }
  const marked=list=>list.map(o=>({...o,block:true}));

  class Layout {
    constructor(overlay){
      this.overlay=overlay;
      this.rows=new Map();
      this.nodes=new WeakMap();
      this.width=0;this.height=0;this.dirty=true;
      this.insets={left:8,right:8,top:8,bottom:8};
      this.obstacleEls=[];this.obstacles=[];this.obstaclesDirty=false;
      this.observer=typeof ResizeObserver==="function"?new ResizeObserver(entries=>{
        for(const entry of entries){
          const size=entry.borderBoxSize && (Array.isArray(entry.borderBoxSize)?entry.borderBoxSize[0]:entry.borderBoxSize);
          const w=Math.ceil(size?size.inlineSize:entry.contentRect.width);
          const h=Math.ceil(size?size.blockSize:entry.contentRect.height);
          if(this.obstacleEls.includes(entry.target)){this.obstaclesDirty=true;this.dirty=true;continue;}
          if(entry.target===overlay){
            this.obstaclesDirty=true;
            if(w!==this.width||h!==this.height){this.width=w;this.height=h;this.dirty=true;}
            // Read notch/safe-area padding only on resize, never each WebGL frame.
            if(typeof getComputedStyle==="function"){
              const css=getComputedStyle(overlay);
              const left=Math.max(8,Math.ceil(parseFloat(css.paddingLeft)||0));
              const right=Math.max(8,Math.ceil(parseFloat(css.paddingRight)||0));
              if(left!==this.insets.left||right!==this.insets.right){this.insets={...this.insets,left,right};this.dirty=true;}
            }
          }else{
            const row=this.nodes.get(entry.target);
            if(row && (row.w!==w||row.h!==h)){row.w=w;row.h=h;this.dirty=true;}
          }
        }
        this.place();
      }):null;
      if(this.observer)this.observer.observe(overlay);
      else if(overlay){this.width=overlay.clientWidth||0;this.height=overlay.clientHeight||0;}
    }
    // Fixed HUD controls to avoid. Measured only after a resize notification,
    // never inside the WebGL frame loop.
    avoid(elements){
      for(const el of this.obstacleEls)if(this.observer)this.observer.unobserve(el);
      this.obstacleEls=[...elements].filter(Boolean);
      for(const el of this.obstacleEls)if(this.observer)this.observer.observe(el);
      this.obstaclesDirty=true;this.dirty=true;
    }
    measureObstacles(){
      this.obstaclesDirty=false;
      if(!this.overlay||typeof this.overlay.getBoundingClientRect!=="function"){this.obstacles=[];return;}
      const base=this.overlay.getBoundingClientRect();
      this.obstacles=this.obstacleEls.map(el=>{
        const r=el.getBoundingClientRect();
        return {x:r.left-base.left,y:r.top-base.top,w:r.width,h:r.height};
      }).filter(o=>o.w>0&&o.h>0);
    }
    begin(){for(const row of this.rows.values())row.seen=false;}
    // ghost: the label is hidden (fighter away from its place) and takes no room.
    track(id,el,ax,ay,ghost=false){
      if(!el||!Number.isFinite(ax)||!Number.isFinite(ay))return;
      let row=this.rows.get(id);
      if(!row){row={id,w:96,h:40};this.rows.set(id,row);this.dirty=true;}
      row.seen=true;
      if(row.ghost!==!!ghost){row.ghost=!!ghost;this.dirty=true;}
      // Class names only (no layout read): the enemy target's name hangs below.
      const cls=el.classList;
      const hanging=!!(cls?.contains?.("enemy")&&cls?.contains?.("named"));
      row.extraBottom=hanging?NAME_BELOW:0;
      const nameW=hanging?Math.max(row.w||0,Number(el.dataset?.nameW)||100):0;
      if(row.nameW!==nameW){row.nameW=nameW;this.dirty=true;}
      if(row.el!==el){
        if(this.observer&&row.el)this.observer.unobserve(row.el);
        row.el=el;row.dx=NaN;row.dy=NaN;this.nodes.set(el,row);
        if(this.observer)this.observer.observe(el);
        this.dirty=true;
      }
      if(row.ax===undefined||Math.abs(row.ax-ax)>.05||Math.abs(row.ay-ay)>.05){
        row.ax=ax;row.ay=ay;this.dirty=true;
      }
    }
    place(){
      for(const [id,row] of this.rows)if(!row.seen){
        if(this.observer&&row.el)this.observer.unobserve(row.el);
        this.rows.delete(id);this.dirty=true;
      }
      if(!this.dirty||!this.width||!this.height)return;
      this.dirty=false;
      const rows=[...this.rows.values()];
      if(this.obstaclesDirty)this.measureObstacles();
      anchor(rows,this.width,this.height,this.insets,marked(this.obstacles));
      for(const row of rows){
        const dx=row.x+row.w/2-row.ax,dy=row.y+row.h-row.ay;
        if(Math.abs(dx-row.dx)<.05&&Math.abs(dy-row.dy)<.05)continue;
        row.dx=dx;row.dy=dy;
        // Keep each label's existing anchor at mesh-head coordinates.
        // Offsets are applied to a wrapper via CSS variables (no DOM layout reads).
        row.el.style.setProperty("--arena-hud-x",dx.toFixed(1)+"px");
        row.el.style.setProperty("--arena-hud-y",dy.toFixed(1)+"px");
      }
    }
    // Bottom edge of a placed label (overlay px): floating numbers stay below it.
    bottomOf(id){
      const row=this.rows.get(id);
      return row&&Number.isFinite(row.y)?row.y+row.h+(row.extraBottom||0):null;
    }
    dispose(){
      if(this.observer)this.observer.disconnect();
      this.rows.clear();this.nodes=new WeakMap();
    }
  }
  return {anchor,Layout,MAX_SHIFT_X,MAX_SHIFT_Y,LIFT,NAME_BELOW};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ArenaWorldHud;
