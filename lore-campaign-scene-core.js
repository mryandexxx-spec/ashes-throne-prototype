/* LC-003: pure story transitions. No DOM, localStorage, wallet or literary content. */
const LoreCampaignSceneCore=(()=>{
 "use strict";
 const copy=x=>JSON.parse(JSON.stringify(x));
 const ok=(progress,session)=>({ok:true,progress,session});
 const fail=code=>({ok:false,code});
 function create(graph,pack,graphCore,scriptData){
  if(!scriptData.valid(pack,graph))throw Error("INVALID_SCENE_CATALOG");
  const lookup=nodeId=>scriptData.sceneFor(nodeId,pack);
  const sceneNode=id=>graph.nodes.find(n=>n.id===id)||null;
  const beat=(scene,id)=>scene.beats.find(b=>b.id===id)||null;
  const choice=(scene,id)=>scene.choices.find(c=>c.id===id)||null;
  const beatKey=(nodeId,id)=>nodeId+"/"+id;
  const decisionKey=(nodeId,id)=>nodeId+"/"+id;
  function enter(work,scene,node,beatId,mode){
   const next=beat(scene,beatId),state=work.stories[node.storyId];
   if(!next)return false;
   const key=beatKey(node.id,beatId);
   if(!state.seenBeatIds.includes(key))state.seenBeatIds.push(key);
   for(const effect of next.effects){
    const evidence=beatKey(node.id,effect.id);
    if(!state.seenEvidenceIds.includes(evidence))state.seenEvidenceIds.push(evidence);
   }
   if(mode==="primary"){
    state.activeNodeId=node.id;state.checkpointBeatId=beatId;
   }
   return true;
  }
  const seenKey=(nodeId,id)=>beatKey(nodeId,id);
  const compareKey=(nodeId,id)=>beatKey(nodeId,"comparison:"+id);
  const inspections=b=>b.inspections||[];
  const comparisons=b=>b.comparisons||[];
  function interactionsReady(session,b){
   const evidence=session.work.stories[session.storyId].seenEvidenceIds;
   return (b.requiredInspectionIds||[]).every(id=>evidence.includes(seenKey(session.nodeId,id)))&&
     (b.requiredComparisonIds||[]).every(id=>evidence.includes(compareKey(session.nodeId,id)));
  }
  function inspect(progress,session,id){
   const scene=session&&lookup(session.nodeId);
   if(!scene)return fail("NOT_IN_SCENE");
   const b=beat(scene,session.beatId);
   const entry=b&&inspections(b).find(x=>x.id===id);
   if(!entry)return fail("INSPECTION_NOT_AVAILABLE");
   const work=copy(session.work),state=work.stories[session.storyId];
   const key=seenKey(session.nodeId,id);
   if(!state.seenEvidenceIds.includes(key))state.seenEvidenceIds.push(key);
   return ok(session.mode==="primary"?work:progress,{
    ...session,work,openedInspectionId:id,openedComparisonId:null
   });
  }
  function compare(progress,session,id){
   const scene=session&&lookup(session.nodeId);
   if(!scene)return fail("NOT_IN_SCENE");
   const b=beat(scene,session.beatId);
   const entry=b&&comparisons(b).find(x=>x.id===id);
   if(!entry)return fail("COMPARISON_NOT_AVAILABLE");
   const seen=session.work.stories[session.storyId].seenEvidenceIds;
   if(entry.evidenceIds.some(eid=>!seen.includes(seenKey(session.nodeId,eid))))
    return fail("INSPECTION_REQUIRED");
   const work=copy(session.work),state=work.stories[session.storyId];
   const key=compareKey(session.nodeId,id);
   if(!state.seenEvidenceIds.includes(key))state.seenEvidenceIds.push(key);
   return ok(session.mode==="primary"?work:progress,{
    ...session,work,openedComparisonId:id,openedInspectionId:null
   });
  }
  function current(session){
   if(!session)return null;
   const scene=lookup(session.nodeId);
   if(!scene)return null;
   const b=beat(scene,session.beatId);
   if(!b)return null;
   return {
    nodeId:session.nodeId,mode:session.mode,beatId:b.id,speakerId:b.speakerId,text:b.text,
    skipSafe:b.skipSafe,choiceIds:b.choiceIds.slice(),
    choices:b.choiceIds.map(id=>{const c=choice(scene,id);return {id:c.id,label:c.label};}),
    canContinue:b.choiceIds.length===0&&b.nextBeatId!==null,
    canFinish:b.choiceIds.length===0&&b.nextBeatId===null,
    interactionsReady:interactionsReady(session,b),
    inspections:inspections(b).map(item=>({
      id:item.id,label:item.label,done:session.work.stories[session.storyId].seenEvidenceIds.includes(seenKey(session.nodeId,item.id)),
      text:session.openedInspectionId===item.id?item.text:null
    })),
    comparisons:comparisons(b).map(item=>({
      id:item.id,label:item.label,
      ready:item.evidenceIds.every(id=>session.work.stories[session.storyId].seenEvidenceIds.includes(seenKey(session.nodeId,id))),
      done:session.work.stories[session.storyId].seenEvidenceIds.includes(compareKey(session.nodeId,item.id)),
      text:session.openedComparisonId===item.id?item.text:null
    })),
    objectives:scene.objectives.map(o=>({id:o.id,hint:o.hint,required:o.required,done:completed(session,o)}))
   };
  }
  function completed(session,objective){
   const record=session.work.stories[session.storyId],key=id=>beatKey(session.nodeId,id);
   if(objective.kind==="view")return record.seenBeatIds.includes(key(objective.beatId));
   if(objective.kind==="choose")return typeof record.primaryChoicesById[decisionKey(session.nodeId,objective.decisionId)]==="string";
   if(objective.kind==="compare"&&objective.comparisonId)
    return record.seenEvidenceIds.includes(compareKey(session.nodeId,objective.comparisonId));
   if(objective.kind==="inspect"||objective.kind==="compare")
    return objective.evidenceIds.every(id=>record.seenEvidenceIds.includes(key(id)));
   return false;
  }
  function begin(progress,nodeId){
   const node=sceneNode(nodeId);
   if(!node)return fail("UNKNOWN_NODE");
   const allowed=graphCore.begin(graph,progress,nodeId);
   if(!allowed.ok)return fail(allowed.code);
   const scene=lookup(nodeId);
   if(!scene||node.contentId!==scene.id)return fail("CONTENT_NOT_READY");
   const mode=allowed.mode,state=progress.stories[node.storyId];
   const resume=mode==="primary"&&state.activeNodeId===nodeId&&
      beat(scene,state.checkpointBeatId);
   const first=resume?state.checkpointBeatId:scene.entryBeatId;
   const work=copy(progress);
   if(!enter(work,scene,node,first,mode))return fail("INVALID_CHECKPOINT");
   const session={storyId:node.storyId,nodeId,mode,beatId:first,work};
   return ok(mode==="primary"?work:progress,session);
  }
  function next(progress,session){
   const scene=session&&lookup(session.nodeId);
   if(!scene)return fail("NOT_IN_SCENE");
   const b=beat(scene,session.beatId);
   if(!b||b.choiceIds.length||!b.nextBeatId)return fail("CHOICE_OR_FINISH_REQUIRED");
   if(!interactionsReady(session,b))return fail("INSPECTION_REQUIRED");
   const work=copy(session.work),node=sceneNode(session.nodeId);
   enter(work,scene,node,b.nextBeatId,session.mode);
   return ok(session.mode==="primary"?work:progress,
    {...session,beatId:b.nextBeatId,work});
  }
  function choose(progress,session,choiceId){
   const scene=session&&lookup(session.nodeId);
   if(!scene)return fail("NOT_IN_SCENE");
   const b=beat(scene,session.beatId);
   if(!b||!b.choiceIds.includes(choiceId))return fail("INVALID_CHOICE");
   if(!interactionsReady(session,b))return fail("INSPECTION_REQUIRED");
   const selected=choice(scene,choiceId),node=sceneNode(session.nodeId);
   const key=decisionKey(node.id,selected.decisionId),work=copy(session.work);
   const state=work.stories[node.storyId],previous=state.primaryChoicesById[key];
   if(session.mode==="primary"&&previous&&previous!==selected.id)
    return fail("PRIMARY_CHOICE_IMMUTABLE");
   if(!previous||session.mode==="replay"){
    state.primaryChoicesById[key]=selected.id;
    if(session.mode==="primary"){
     // The journal records only the first primary decision, never a replay.
     if(!state.keyDecisionLog.some(x=>x.nodeId===node.id&&x.decisionId===selected.decisionId))
      state.keyDecisionLog.push({nodeId:node.id,decisionId:selected.decisionId,choiceId:selected.id});
    }
   }
   for(const effect of selected.effects){
    const evidence=beatKey(node.id,effect.id);
    if(!state.seenEvidenceIds.includes(evidence))state.seenEvidenceIds.push(evidence);
   }
   enter(work,scene,node,selected.nextBeatId,session.mode);
   return ok(session.mode==="primary"?work:progress,
    {...session,beatId:selected.nextBeatId,work});
  }
  function skipSeen(progress,session){
   const scene=session&&lookup(session.nodeId);
   if(!scene)return fail("NOT_IN_SCENE");
   let now=beat(scene,session.beatId);
   if(!now||now.choiceIds.length||!now.skipSafe||
      !interactionsReady(session,now))return fail("SKIP_UNAVAILABLE");
   const work=copy(session.work),record=work.stories[session.storyId],node=sceneNode(session.nodeId);
   let destination=now.id,steps=0;
   while(now.nextBeatId&&!now.choiceIds.length&&now.skipSafe){
    const nextBeat=beat(scene,now.nextBeatId);
    if(!nextBeat||!nextBeat.skipSafe||nextBeat.choiceIds.length||
       !record.seenBeatIds.includes(beatKey(node.id,nextBeat.id))||
       !interactionsReady(session,nextBeat))break;
    destination=nextBeat.id;now=nextBeat;
    if(++steps>scene.beats.length)break;
   }
   if(destination===session.beatId)return fail("SKIP_UNAVAILABLE");
   enter(work,scene,node,destination,session.mode);
   return ok(session.mode==="primary"?work:progress,
    {...session,beatId:destination,work});
  }
  function finish(progress,session){
   const scene=session&&lookup(session.nodeId);
   if(!scene)return fail("NOT_IN_SCENE");
   const b=beat(scene,session.beatId);
   if(!b||b.choiceIds.length||b.nextBeatId!==null)return fail("NOT_AT_END");
   if(!interactionsReady(session,b))return fail("INSPECTION_REQUIRED");
   if(scene.objectives.some(o=>o.required&&!completed(session,o)))return fail("OBJECTIVE_INCOMPLETE");
   if(session.mode==="replay")return ok(progress,null);
   const work=copy(session.work),state=work.stories[session.storyId];
   if(!state.completedNodeIds.includes(session.nodeId))state.completedNodeIds.push(session.nodeId);
   state.activeNodeId=null;state.checkpointBeatId=null;
   return ok(work,null);
  }
  return Object.freeze({begin,next,choose,inspect,compare,skipSeen,finish,current});
 }
 return Object.freeze({create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignSceneCore;
