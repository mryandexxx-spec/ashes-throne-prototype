/* LC-003: transactional coordinator of pure scene transitions and a single lore save. */
const LoreCampaignSceneRuntime=(()=>{
 "use strict";
 const clone=x=>JSON.parse(JSON.stringify(x));
 function create({graph,graphCore,pack,scriptData,sceneCore,saveModule,storage}){
  const scene=sceneCore.create(graph,pack,graphCore,scriptData);
  const save=saveModule.create(graph,pack,graphCore,scriptData,storage);
  const loaded=save.load();
  let progress=loaded.progress,session=null,pendingBattleNodeId=null;
  let storageState=loaded.status;
  const fail=code=>({ok:false,code});
  function progressCopy(){return clone(progress);}
  function hasContent(nodeId){
   const node=graph.nodes.find(n=>n.id===nodeId);
   return !!node&&!!node.contentId&&
    scriptData.sceneFor(nodeId,pack)?.id===node.contentId;
  }
  function apply(plan){
   if(!plan.ok)return plan;
   // Commit before publishing changes in runtime/UI. On failed writes nothing advances.
   if(plan.session?.mode!=="replay"&&JSON.stringify(plan.progress)!==JSON.stringify(progress)){
    const written=save.commit(plan.progress);
    if(!written.ok)return written;
    storageState=written.volatile?"volatile":"saved";
   }
   progress=plan.progress;
   session=plan.session;
   return {ok:true,view:scene.current(session),storageStatus:storageState};
  }
  function start(nodeId){
   if(storageState==="corrupt")return fail("CORRUPT_SAVE_PROTECTED");
   if(session)return fail("SCENE_ALREADY_ACTIVE");
   if(!hasContent(nodeId))return fail("CONTENT_NOT_READY");
   return apply(scene.begin(progress,nodeId));
  }
  function resume(nodeId){return start(nodeId);}
  function next(){
   if(!session)return fail("NOT_IN_SCENE");
   return apply(scene.next(progress,session));
  }
  function choose(id){
   if(!session)return fail("NOT_IN_SCENE");
   return apply(scene.choose(progress,session,id));
  }
  function inspect(id){
   if(!session)return fail("NOT_IN_SCENE");
   return apply(scene.inspect(progress,session,id));
  }
  function compare(id){
   if(!session)return fail("NOT_IN_SCENE");
   return apply(scene.compare(progress,session,id));
  }
  function skipSeen(){
   if(!session)return fail("NOT_IN_SCENE");
   return apply(scene.skipSeen(progress,session));
  }
  function finish(){
   if(!session)return fail("NOT_IN_SCENE");
   return apply(scene.finish(progress,session));
  }
  function beginRequiredBattle(nodeId){
   if(storageState==="corrupt")return fail("CORRUPT_SAVE_PROTECTED");
   if(session||pendingBattleNodeId)return fail("BATTLE_OR_SCENE_ACTIVE");
   const node=graph.nodes.find(n=>n.id===nodeId);
   const record=node&&progress.stories[node.storyId];
   if(!node?.requiredBattleId||!record?.completedNodeIds.includes(nodeId)||
      record.battleClearedNodeIds?.includes(nodeId))return fail("BATTLE_NOT_AVAILABLE");
   pendingBattleNodeId=nodeId;
   return {ok:true,nodeId,battleId:node.requiredBattleId};
  }
  function recordBattleVictory(nodeId,battleId){
   if(pendingBattleNodeId!==nodeId)return fail("BATTLE_NOT_ACTIVE");
   const node=graph.nodes.find(n=>n.id===nodeId);
   if(!node?.requiredBattleId||node.requiredBattleId!==battleId)return fail("INVALID_BATTLE");
   if(!progress.stories[node.storyId]?.completedNodeIds.includes(nodeId))
    return fail("STORY_NOT_COMPLETED");
   const work=clone(progress);
   const cleared=work.stories[node.storyId].battleClearedNodeIds||[];
   if(cleared.includes(nodeId))return fail("ALREADY_CLEARED");
   work.stories[node.storyId].battleClearedNodeIds=[...cleared,nodeId];
   const saved=save.commit(work);
   if(!saved.ok)return saved; // fail closed: no UI unlock, no fabricated victory
   progress=work;
   pendingBattleNodeId=null;
   storageState=saved.volatile?"volatile":"saved";
   return {ok:true,storyId:node.storyId,nodeId,battleId};
  }
  function cancelRequiredBattle(){pendingBattleNodeId=null;return {ok:true};}
  function leave(){
   session=null;return {ok:true};
  }
  function current(){return scene.current(session);}
  function stateFor(storyId){return progress.stories[storyId]?clone(progress.stories[storyId]):null;}
  function journal(storyId){return stateFor(storyId)?.keyDecisionLog||[];}
  function hasCheckpoint(nodeId){
   const node=graph.nodes.find(n=>n.id===nodeId);
   return !!node&&progress.stories[node.storyId]?.activeNodeId===nodeId;
  }
  return Object.freeze({start,resume,next,choose,inspect,compare,skipSeen,finish,leave,
   beginRequiredBattle,recordBattleVictory,cancelRequiredBattle,
   current,progress:progressCopy,stateFor,journal,hasCheckpoint,hasContent,
   storageStatus:()=>storageState,snapshot:()=>({
    storageStatus:storageState,session:session?{nodeId:session.nodeId,mode:session.mode,
     beatId:session.beatId}:null,pendingBattleNodeId
   })});
 }
 return Object.freeze({create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignSceneRuntime;
