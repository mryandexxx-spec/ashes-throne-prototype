/* Combat-005: deterministic presentation timeline.
   Consumes CombatCore events; delegates per-character slot lookup to AnimationProfiles.
   Babylon meshes and battle mechanics are intentionally outside this module. */
const BattleAnimation=(()=>{
 "use strict";
 const queue=[];
 const dying=new Set();
 // Presentation-only cues: the first frame of each queued action, no combat side-effects.
 const started=[];
 let current=null,elapsed=0,idleTime=0;
 function enqueue(events,positions){
  let renAction=null;
  if(!Array.isArray(events))return;
  for(let i=0;i<events.length;i++){
   const event=events[i];
   if(event.type==="ability"&&typeof event.actorId==="string"){
    const guard=events.slice(i+1).some(next=>(next.type==="effect"&&next.effect==="guard"||next.type==="heal")&&
     next.actorId===event.actorId&&next.targetId===event.targetId);
    const action={id:event.actorId,targetId:event.targetId,slot:guard?"guard":
     AnimationProfiles.slots.includes(event.abilityId)?event.abilityId:"special"};
    if(action.id==="ren"&&action.slot==="basic"&&typeof RenChoreography!=="undefined"){
     const origin=positions?.[action.id],target=positions?.[action.targetId];
     if(origin&&target){
      action.plan=RenChoreography.plan(Math.hypot(target.x-origin.x,target.z-origin.z));
      action.reactions=[];renAction=action;
     }
    }else renAction=null;
    queue.push(action);
   }else if(event.type==="heal"&&typeof event.targetId==="string"){
    queue.push({id:event.targetId,slot:"ward"});
   }else if(event.type==="effect"&&event.effect==="guard"&&typeof event.targetId==="string"){
    queue.push({id:event.targetId,slot:"ward"});
   }else if(event.type==="damage"&&typeof event.targetId==="string"){
    if(renAction&&event.actorId==="ren")renAction.reactions.push({id:event.targetId,slot:"hit"});
    else queue.push({id:event.targetId,slot:"hit"});
   }else if(event.type==="death"&&typeof event.targetId==="string"){
    dying.add(event.targetId);
    queue.push({id:event.targetId,slot:"death"});
   }
  }
 }
 function clear(){
  queue.length=0;current=null;elapsed=0;idleTime=0;dying.clear();started.length=0;
 }
 function tick(deltaMs,multiplier=1){
  if(!Number.isFinite(deltaMs)||deltaMs<0||!Number.isFinite(multiplier)||multiplier<=0)return;
  // Tab wake-ups cannot skip unbounded queued actions.
  let remaining=Math.min(deltaMs,100)*multiplier;
  idleTime+=remaining;
  if(!current&&queue.length){
   current=queue.shift();elapsed=0;
   if(current.slot==="hit")started.push({id:current.id,slot:current.slot});
  }
  while(current&&remaining>0){
   const profile=AnimationProfiles.resolve(current.id,current.slot);
   const duration=current.plan?.durationMs||profile.durationMs;
   const step=Math.min(remaining,duration-elapsed);
   const before=elapsed;
   elapsed+=step;remaining-=step;
   if(current.plan&&before<current.plan.contactMs&&elapsed>=current.plan.contactMs)
    started.push(...current.reactions);
   if(elapsed>=duration){
    if(current.slot==="death")dying.delete(current.id);
    current=queue.shift()||null;
    if(current?.slot==="hit")started.push({id:current.id,slot:current.slot});
    elapsed=0;
   }
  }
 }
 const empty=()=>({x:0,y:0,tilt:0});
 function motion(profile,progress){
  const a=profile.amplitude;
  const pulse=progress<.42?progress/.42:(1-progress)/.58;
  switch(profile.kind){
   case "idle":return empty(); // Feet stay planted; breathing belongs to the skeleton.
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
   return current.plan?empty():motion(profile,Math.min(1,elapsed/profile.durationMs));
  }
  if(current?.plan&&current.reactions.some(cue=>cue.id===heroId)){
   const reactionMs=elapsed-current.plan.contactMs,profile=AnimationProfiles.resolve(heroId,"hit");
   if(reactionMs>=0&&reactionMs<profile.durationMs)return motion(profile,reactionMs/profile.durationMs);
  }
  const idle=AnimationProfiles.resolve(heroId,"idle");
  return motion(idle,(idleTime%idle.durationMs)/idle.durationMs);
 }
 // Read-only animation slot + normalized timing for external GLB adapters.
 function activity(heroId){
  if(current&&current.id===heroId){
   const profile=AnimationProfiles.resolve(heroId,current.slot);
   return {slot:current.slot,progress:Math.min(1,elapsed/(current.plan?.durationMs||profile.durationMs)),targetId:current.targetId||null,
    ...(current.plan?{plan:current.plan,elapsedMs:elapsed}: {})};
  }
  if(current?.plan&&current.reactions.some(cue=>cue.id===heroId)){
   const reactionMs=elapsed-current.plan.contactMs,duration=AnimationProfiles.resolve(heroId,"hit").durationMs;
   if(reactionMs>=0&&reactionMs<duration)return {slot:"hit",progress:reactionMs/duration,targetId:null};
  }
  const idle=AnimationProfiles.resolve(heroId,"idle");
  return {slot:"idle",progress:(idleTime%idle.durationMs)/idle.durationMs,targetId:null};
 }
 // MELEE009: purely visual approach/hold/retreat with a fixed safe gap to the target.
 // All results were already calculated by CombatCore; this cannot alter hit or damage.
 function approach(activity,origin,target){
  if(!activity||!["basic","special","powerful"].includes(activity.slot)||!target||!origin)return {x:0,z:0};
  if(activity.plan&&typeof RenChoreography!=="undefined")
   return RenChoreography.offset(activity.plan,activity.elapsedMs,origin,target);
  const dx=target.x-origin.x,dz=target.z-origin.z;
  const distance=Math.hypot(dx,dz);
  if(!Number.isFinite(distance)||distance<=1.25)return {x:0,z:0};
  const p=Math.max(0,Math.min(1,activity.progress));
  const fraction=p<.38?p/.38:p<.64?1:(1-p)/.36;
  const travel=(distance-1.25)*Math.max(0,fraction);
  return {x:dx/distance*travel,z:dz/distance*travel};
 }
 function isDying(heroId){return dying.has(heroId);}
 function pending(){return queue.length+(current?1:0);}
 function drainStarted(){const cues=started.splice(0);return cues;}
 return Object.freeze({enqueue,clear,tick,pose,activity,approach,isDying,pending,drainStarted});
})();
