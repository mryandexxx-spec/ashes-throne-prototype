/* LC-003: authored scene packages only. The shipped pack is intentionally empty until LC-004.
   No privately drafted dialogue, speculative canonical events or rewards are published here. */
const LoreCampaignScenes=(()=>{
 "use strict";
 const PACK=Object.freeze({scenes:Object.freeze([])});
 const object=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
 const str=x=>typeof x==="string"&&x.length>0&&x.length<=300;
 const distinct=a=>new Set(a).size===a.length;
 function sceneFor(nodeId,pack=PACK){
  return Array.isArray(pack?.scenes)?pack.scenes.find(s=>s.nodeId===nodeId)||null:null;
 }
 function validEffects(effects){
  return Array.isArray(effects)&&effects.every(e=>object(e)&&e.type==="markEvidenceSeen"&&str(e.id));
 }
 function valid(pack=PACK,graph){
  if(!object(pack)||!Array.isArray(pack.scenes)||!graph||!Array.isArray(graph.nodes))return false;
  if(!distinct(pack.scenes.map(x=>x?.id))||!distinct(pack.scenes.map(x=>x?.nodeId)))return false;
  for(const scene of pack.scenes){
   const node=graph.nodes.find(n=>n.id===scene.nodeId);
   if(!node||node.contentId!==scene.id||node.kind==="battle"||
    !str(scene.id)||!str(scene.entryBeatId)||!Array.isArray(scene.beats)||!scene.beats.length||
    !Array.isArray(scene.choices)||!Array.isArray(scene.objectives)||
    !distinct(scene.beats.map(b=>b?.id))||!distinct(scene.choices.map(c=>c?.id))||
    !distinct(scene.objectives.map(o=>o?.id)))return false;
   const beats=new Map(scene.beats.map(b=>[b.id,b]));
   const choices=new Map(scene.choices.map(c=>[c.id,c]));
   if(!beats.has(scene.entryBeatId))return false;
   let terminals=0;
   for(const beat of scene.beats){
    if(!object(beat)||!str(beat.id)||typeof beat.text!=="string"||
      !beat.text.trim()||beat.text.length>2000||
      !(beat.speakerId===null||str(beat.speakerId))||
      !(beat.nextBeatId===null||str(beat.nextBeatId))||
      !Array.isArray(beat.choiceIds)||!distinct(beat.choiceIds)||
      !validEffects(beat.effects)||typeof beat.skipSafe!=="boolean")return false;
    if(beat.nextBeatId===null&&beat.choiceIds.length===0)terminals++;
    if(beat.choiceIds.length&&beat.nextBeatId!==null)return false;
    if(beat.nextBeatId!==null&&!beats.has(beat.nextBeatId))return false;
    if(beat.choiceIds.some(id=>!choices.has(id)))return false;
   }
   if(!terminals)return false;
   const referencedChoices=new Set(scene.beats.flatMap(b=>b.choiceIds));
   for(const choice of scene.choices){
    if(!object(choice)||!str(choice.id)||!str(choice.label)||choice.label.length>300||
       !str(choice.decisionId)||!str(choice.nextBeatId)||!beats.has(choice.nextBeatId)||
       !validEffects(choice.effects)||!referencedChoices.has(choice.id))return false;
   }
   for(const beat of scene.beats){
    if(beat.choiceIds.length&&
      !distinct(beat.choiceIds.map(id=>choices.get(id).decisionId)))return false;
   }
   // A decision can offer multiple choices, but cannot be independently repeated in unrelated beats.
   const location=new Map();
   for(const beat of scene.beats)for(const id of beat.choiceIds){
    const decision=choices.get(id).decisionId;
    if(location.has(decision)&&location.get(decision)!==beat.id)return false;
    location.set(decision,beat.id);
   }
   for(const objective of scene.objectives){
    if(!object(objective)||!str(objective.id)||!str(objective.kind)||
       !["view","inspect","compare","choose"].includes(objective.kind)||
       !str(objective.hint)||typeof objective.required!=="boolean")return false;
    if(objective.kind==="view"&&(!str(objective.beatId)||!beats.has(objective.beatId)))return false;
    if(objective.kind==="choose"&&(!str(objective.decisionId)||!location.has(objective.decisionId)))return false;
    if(["inspect","compare"].includes(objective.kind)&&
      (!Array.isArray(objective.evidenceIds)||!objective.evidenceIds.length||
       !distinct(objective.evidenceIds)||objective.evidenceIds.some(id=>!str(id))))return false;
    if(objective.kind==="inspect"&&objective.evidenceIds.length!==1)return false;
   }
   const seen=new Set(),visiting=new Set();
   function walk(id){
    if(visiting.has(id))return false;
    if(seen.has(id))return true;
    visiting.add(id);
    const b=beats.get(id),dest=b.choiceIds.length?
      b.choiceIds.map(cid=>choices.get(cid).nextBeatId):(b.nextBeatId?[b.nextBeatId]:[]);
    for(const next of dest)if(!walk(next))return false;
    visiting.delete(id);seen.add(id);return true;
   }
   if(!walk(scene.entryBeatId)||seen.size!==scene.beats.length)return false;
   const possibleEvidence=new Set([
    ...scene.beats.flatMap(b=>b.effects.map(e=>e.id)),
    ...scene.choices.flatMap(c=>c.effects.map(e=>e.id))
   ]);
   for(const o of scene.objectives)if(["inspect","compare"].includes(o.kind)&&
      o.evidenceIds.some(id=>!possibleEvidence.has(id)))return false;
  }
  return true;
 }
 return Object.freeze({catalog:()=>PACK,sceneFor,valid});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignScenes;
