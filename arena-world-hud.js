/* ARENA-ENGINE-001: isolated screen-space layout adapted from Dune v94's world-hud.js.
   No Babylon, combat state or 3D model dependencies. No measurements in a render frame.
   The overlay and each indicator are measured asynchronously by ResizeObserver. */
const ArenaWorldHud = (() => {
  "use strict";
  const GAP = 5;
  const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const intersects = (a,b)=>a.x < b.x+b.w+GAP && a.x+a.w+GAP > b.x &&
    a.y < b.y+b.h+GAP && a.y+a.h+GAP > b.y;

  function pack(rows,width,height,insets={left:8,right:8,top:8,bottom:8}) {
    if(!rows.length || width<=0 || height<=0)return rows;
    const left=insets.left,right=width-insets.right;
    // Reserve the fixed battle title above and action bar below (Dune v94).
    // Scale the reserve down on unusually short embedded arena viewports.
    const top=Math.max(insets.top,Math.min(60,Math.floor(height*.16)));
    const bottom=height-Math.max(insets.bottom,Math.min(100,Math.floor(height*.25)));
    const placed=[];
    let crowded=false;
    const ordered=[...rows].sort((a,b)=>b.ay-a.ay||String(a.id).localeCompare(String(b.id)));
    for(const r of ordered){
      const nx=clamp(r.ax-r.w/2,left,Math.max(left,right-r.w));
      const ny=clamp(r.ay-r.h-8,top,Math.max(top,bottom-r.h));
      const xs=[nx],ys=[ny,top];
      for(const p of placed){
        xs.push(clamp(p.x-r.w-GAP,left,Math.max(left,right-r.w)),
          clamp(p.x+p.w+GAP,left,Math.max(left,right-r.w)));
        ys.push(p.y-r.h-GAP,p.y+p.h+GAP);
      }
      let best=null,cost=Infinity;
      for(const x of xs)for(const y of ys){
        if(y<top||y+r.h>bottom)continue;
        const box={x,y,w:r.w,h:r.h};
        if(placed.some(p=>intersects(box,p)))continue;
        const dx=x-nx,dy=y-ny;
        const score=dx*dx*2+dy*dy*(dy>0?8:1);
        if(score<cost){best=box;cost=score;}
      }
      if(!best)crowded=true;
      r.x=best?best.x:nx;r.y=best?best.y:ny;
      placed.push({x:r.x,y:r.y,w:r.w,h:r.h});
    }
    if(!crowded)return rows;
    // Dune's deterministic shelf fallback: retry the whole group, never quietly
    // accept partial overlaps if the available viewport can fit the rectangles.
    const cellW=Math.max(...rows.map(r=>r.w))+GAP;
    const cols=Math.max(1,Math.floor((right-left+GAP)/cellW));
    const shelves=[...rows].sort((a,b)=>a.ay-b.ay||String(a.id).localeCompare(String(b.id)));
    const groups=[];
    for(let i=0;i<shelves.length;i+=cols)groups.push(shelves.slice(i,i+cols));
    const heights=groups.map(g=>Math.max(...g.map(r=>r.h)));
    const total=heights.reduce((sum,h)=>sum+h+GAP,-GAP);
    if(total>bottom-top)return rows; // Not enough space: no false zero-overlap claim.
    let y=clamp(rows.reduce((sum,r)=>sum+r.ay,0)/rows.length-total/2,top,bottom-total);
    for(let i=0;i<groups.length;i++){
      const group=groups[i].sort((a,b)=>a.ax-b.ax||String(a.id).localeCompare(String(b.id)));
      const span=group.length*cellW-GAP;
      const x0=left+(right-left-span)/2;
      group.forEach((r,n)=>{r.x=x0+n*cellW+(cellW-GAP-r.w)/2;r.y=y;});
      y+=heights[i]+GAP;
    }
    return rows;
  }

  class Layout {
    constructor(overlay){
      this.overlay=overlay;
      this.rows=new Map();
      this.nodes=new WeakMap();
      this.width=0;this.height=0;this.dirty=true;
      this.insets={left:8,right:8,top:8,bottom:8};
      this.observer=typeof ResizeObserver==="function"?new ResizeObserver(entries=>{
        for(const entry of entries){
          const size=entry.borderBoxSize && (Array.isArray(entry.borderBoxSize)?entry.borderBoxSize[0]:entry.borderBoxSize);
          const w=Math.ceil(size?size.inlineSize:entry.contentRect.width);
          const h=Math.ceil(size?size.blockSize:entry.contentRect.height);
          if(entry.target===overlay){
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
    begin(){for(const row of this.rows.values())row.seen=false;}
    track(id,el,ax,ay){
      if(!el||!Number.isFinite(ax)||!Number.isFinite(ay))return;
      let row=this.rows.get(id);
      if(!row){row={id,w:96,h:40};this.rows.set(id,row);this.dirty=true;}
      row.seen=true;
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
      pack(rows,this.width,this.height,this.insets);
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
    dispose(){
      if(this.observer)this.observer.disconnect();
      this.rows.clear();this.nodes=new WeakMap();
    }
  }
  return {pack,Layout};
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ArenaWorldHud;
