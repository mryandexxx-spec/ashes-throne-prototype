/* Combat-005: deterministic presentation timeline.
   Consumes CombatCore events; delegates per-character slot lookup to AnimationProfiles.
   Babylon meshes and battle mechanics are intentionally outside this module. */
const BattleAnimation=(()=>{
 "use strict";
 const queue=[];
 const dying=new Set();
 // Presentation-only cues: the first frame of each queued action, no combat side-effects.
 const started=[];
 // HUDSYNC001: HP/protection the HUD is allowed to show while the batch is still being
 // drawn. CombatCore has already applied every event; these numbers only lag behind it
 // until the matching hit/heal cue starts, then snap to the value the event recorded.
 const shown=new Map();
 let revision=0; // bumps whenever a shown HP/protection value changes
 let current=null,elapsed=0,idleTime=0;
 function recordAfter(cue,event,snapshot){
  if(!Number.isFinite(event.remainingHp))return;
  cue.after={hp:event.remainingHp,
   protection:Number.isFinite(event.remainingProtection)?event.remainingProtection:null};
  const base=snapshot?.find?.(f=>f.id===event.targetId)??snapshot?.[event.targetId];
  if(!shown.has(event.targetId)){
   if(!base||!Number.isFinite(base.hp))return; // no snapshot — nothing to hold back
   shown.set(event.targetId,{hp:base.hp,protection:Number.isFinite(base.protection)?base.protection:null,pending:0});
  }
  shown.get(event.targetId).pending++;
 }
 function begin(cue){
  if(cue.slot==="hit")started.push({id:cue.id,slot:cue.slot});
  if(cue.after){
   const entry=shown.get(cue.id);
   if(entry){
    revision++;
    entry.hp=cue.after.hp;
    if(cue.after.protection!==null)entry.protection=cue.after.protection;
    if(--entry.pending<=0)shown.delete(cue.id);
   }
  }
 }
 function enqueue(events,positions,snapshot){
  let contactAction=null;
  if(!Array.isArray(events))return;
  for(let i=0;i<events.length;i++){
   const event=events[i];
   if(event.type==="ability"&&typeof event.actorId==="string"){
    const guard=events.slice(i+1).some(next=>(next.type==="effect"&&next.effect==="guard"||next.type==="heal")&&
     next.actorId===event.actorId&&next.targetId===event.targetId);
    contactAction=null;
    const action={id:event.actorId,targetId:event.targetId,slot:guard?"guard":
     AnimationProfiles.slots.includes(event.abilityId)?event.abilityId:"special"};
    if(action.id==="ren"&&action.slot==="basic"&&typeof RenChoreography!=="undefined"){
     const origin=positions?.[action.id],target=positions?.[action.targetId];
     if(origin&&target&&origin.choreographyReady!==false){
      action.plan=RenChoreography.plan(Math.hypot(target.x-origin.x,target.z-origin.z));
      action.reactions=[];contactAction=action;
     }
    }else{
     // HUDSYNC001: a profile may name the moment the blow lands; the targets' hit
     // reactions (and the HUD numbers) then start there instead of after the clip.
     const profile=AnimationProfiles.resolve(action.id,action.slot);
     if(Number.isFinite(profile.contactFraction)){
      action.contactMs=profile.durationMs*profile.contactFraction;
      action.reactions=[];contactAction=action;
     }
    }
    queue.push(action);
   }else if(event.type==="heal"&&typeof event.targetId==="string"){
    const cue={id:event.targetId,slot:"ward"};
    recordAfter(cue,event,snapshot);
    queue.push(cue);
   }else if(event.type==="effect"&&event.effect==="guard"&&typeof event.targetId==="string"){
    queue.push({id:event.targetId,slot:"ward"});
   }else if(event.type==="damage"&&typeof event.targetId==="string"){
    const cue={id:event.targetId,slot:"hit"};
    recordAfter(cue,event,snapshot);
    if(contactAction&&event.actorId===contactAction.id)contactAction.reactions.push(cue);
    else queue.push(cue);
   }else if(event.type==="death"&&typeof event.targetId==="string"){
    dying.add(event.targetId);
    queue.push({id:event.targetId,slot:"death"});
   }
  }
 }
 function clear(){
  queue.length=0;current=null;elapsed=0;idleTime=0;dying.clear();started.length=0;
  if(shown.size)revision++;shown.clear();
 }
 const contactOf=action=>action?.plan?.contactMs??action?.contactMs;
 function tick(deltaMs,multiplier=1){
  if(!Number.isFinite(deltaMs)||deltaMs<0||!Number.isFinite(multiplier)||multiplier<=0)return;
  // Tab wake-ups cannot skip unbounded queued actions.
  let remaining=Math.min(deltaMs,100)*multiplier;
  idleTime+=remaining;
  if(!current&&queue.length){
   current=queue.shift();elapsed=0;
   begin(current);
  }
  while(current&&remaining>0){
   const profile=AnimationProfiles.resolve(current.id,current.slot);
   const duration=current.plan?.durationMs||profile.durationMs;
   const step=Math.min(remaining,duration-elapsed);
   const before=elapsed;
   elapsed+=step;remaining-=step;
   const contactMs=contactOf(current);
   if(current.reactions&&before<contactMs&&elapsed>=contactMs)
    for(const cue of current.reactions)begin(cue);
   if(elapsed>=duration){
    if(current.slot==="death")dying.delete(current.id);
    current=queue.shift()||null;
    if(current)begin(current);
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
 // A target reacting to the current action at its contact moment, or null.
 function reactionMs(heroId){
  if(!current?.reactions||!current.reactions.some(cue=>cue.id===heroId))return null;
  const ms=elapsed-contactOf(current);
  return ms>=0&&ms<AnimationProfiles.resolve(heroId,"hit").durationMs?ms:null;
 }
 function pose(heroId){
  if(current&&current.id===heroId){
   const profile=AnimationProfiles.resolve(heroId,current.slot);
   return current.plan?empty():motion(profile,Math.min(1,elapsed/profile.durationMs));
  }
  const reaction=reactionMs(heroId);
  if(reaction!==null){
   const profile=AnimationProfiles.resolve(heroId,"hit");
   return motion(profile,reaction/profile.durationMs);
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
  const reaction=reactionMs(heroId);
  if(reaction!==null)return {slot:"hit",progress:reaction/AnimationProfiles.resolve(heroId,"hit").durationMs,targetId:null};
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
 // HUDSYNC001: what the HUD should draw for a fighter right now. Falls back to the
 // fighter's real values once every pending hit/heal on it has been shown.
 function displayed(fighter){
  const entry=fighter&&shown.get(fighter.id);
  if(!entry)return {hp:fighter?.hp,protection:fighter?.protection};
  return {hp:entry.hp,protection:entry.protection===null?fighter.protection:entry.protection};
 }
 // HUDSYNC001: redraw HUD numbers when this changes; cheaper than diffing every fighter.
 function displayRevision(){return revision;}
 function isDying(heroId){return dying.has(heroId);}
 function pending(){return queue.length+(current?1:0);}
 function drainStarted(){const cues=started.splice(0);return cues;}
 return Object.freeze({enqueue,clear,tick,pose,activity,approach,displayed,displayRevision,isDying,pending,drainStarted});
})();
