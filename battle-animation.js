/* Combat-005: deterministic presentation timeline.
   Consumes CombatCore events; delegates per-character slot lookup to AnimationProfiles.
   Babylon meshes and battle mechanics are intentionally outside this module. */
const BattleAnimation=(()=>{
 "use strict";
 const queue=[];
 const dying=new Set();
 let current=null,elapsed=0,idleTime=0;
 function enqueue(events){
  if(!Array.isArray(events))return;
  for(let i=0;i<events.length;i++){
   const event=events[i];
   if(event.type==="ability"&&typeof event.actorId==="string"){
    const guard=events.slice(i+1).some(next=>next.type==="effect"&&next.actorId===event.actorId&&
     next.targetId===event.targetId&&next.effect==="guard");
    queue.push({id:event.actorId,slot:guard?"guard":
     AnimationProfiles.slots.includes(event.abilityId)?event.abilityId:"special"});
   }else if(event.type==="effect"&&event.effect==="guard"&&typeof event.targetId==="string"){
    queue.push({id:event.targetId,slot:"ward"});
   }else if(event.type==="damage"&&typeof event.targetId==="string"){
    queue.push({id:event.targetId,slot:"hit"});
   }else if(event.type==="death"&&typeof event.targetId==="string"){
    dying.add(event.targetId);
    queue.push({id:event.targetId,slot:"death"});
   }
  }
 }
 function clear(){
  queue.length=0;current=null;elapsed=0;idleTime=0;dying.clear();
 }
 function tick(deltaMs,multiplier=1){
  if(!Number.isFinite(deltaMs)||deltaMs<0||!Number.isFinite(multiplier)||multiplier<=0)return;
  // Tab wake-ups cannot skip unbounded queued actions.
  let remaining=Math.min(deltaMs,100)*multiplier;
  idleTime+=remaining;
  if(!current&&queue.length){current=queue.shift();elapsed=0;}
  while(current&&remaining>0){
   const profile=AnimationProfiles.resolve(current.id,current.slot);
   const step=Math.min(remaining,profile.durationMs-elapsed);
   elapsed+=step;remaining-=step;
   if(elapsed>=profile.durationMs){
    if(current.slot==="death")dying.delete(current.id);
    current=queue.shift()||null;
    elapsed=0;
   }
  }
 }
 const empty=()=>({x:0,y:0,tilt:0});
 function motion(profile,progress){
  const a=profile.amplitude;
  const pulse=progress<.42?progress/.42:(1-progress)/.58;
  switch(profile.kind){
   case "idle":return {x:0,y:Math.sin(progress*Math.PI*2)*a,tilt:0};
   case "lunge":return {x:a*pulse,y:.07*pulse,tilt:-.14*pulse};
   case "guard":return {x:-.05*pulse,y:a*pulse,tilt:.11*pulse};
   case "ward":return {x:0,y:a*Math.sin(progress*Math.PI),tilt:.05*pulse};
   case "hit":return {x:-a*pulse,y:0,tilt:.14*pulse};
   case "death":return {x:0,y:-a*progress,tilt:Math.PI*.38*progress};
   default:return empty();
  }
 }
 function pose(heroId){
  if(current&&current.id===heroId){
   const profile=AnimationProfiles.resolve(heroId,current.slot);
   return motion(profile,Math.min(1,elapsed/profile.durationMs));
  }
  const idle=AnimationProfiles.resolve(heroId,"idle");
  return motion(idle,(idleTime%idle.durationMs)/idle.durationMs);
 }
 function isDying(heroId){return dying.has(heroId);}
 function pending(){return queue.length+(current?1:0);}
 return Object.freeze({enqueue,clear,tick,pose,isDying,pending});
})();
