/* Combat-005: visual-only attack motion. No Babylon, DOM or combat rules.
   Queue each resolved ability as an independent lunge/recoil sequence. */
const BattleAnimation=(()=>{
 "use strict";
 const BASE_MS=280;
 const queue=[];
 let current=null;
 let elapsed=0;
 function enqueue(events){
  if(!Array.isArray(events))return;
  for(const event of events){
   if(event.type==="ability"&&typeof event.actorId==="string"&&typeof event.targetId==="string"&&
      events.some(hit=>hit.type==="damage"&&hit.actorId===event.actorId&&hit.targetId===event.targetId))
    queue.push({actorId:event.actorId,targetId:event.targetId});
  }
 }
 function clear(){queue.length=0;current=null;elapsed=0;}
 function tick(deltaMs,multiplier=1){
  if(!Number.isFinite(deltaMs)||deltaMs<0||!Number.isFinite(multiplier)||multiplier<=0)return;
  let remaining=Math.min(deltaMs,100)*multiplier;
  if(!current&&queue.length){current=queue.shift();elapsed=0;}
  while(current&&remaining>0){
   const step=Math.min(remaining,BASE_MS-elapsed);
   elapsed+=step;remaining-=step;
   if(elapsed>=BASE_MS){
    current=queue.shift()||null;
    elapsed=0;
   }
  }
 }
 function pose(id){
  if(!current)return 0;
  const p=elapsed/BASE_MS;
  // Fast forward lunge, then return to original position. Target recoils.
  const pulse=p<0.42?p/0.42:(1-p)/0.58;
  if(id===current.actorId)return 0.55*pulse;
  if(id===current.targetId)return -0.18*pulse;
  return 0;
 }
 function pending(){return queue.length+(current?1:0);}
 return Object.freeze({enqueue,clear,tick,pose,pending});
})();
