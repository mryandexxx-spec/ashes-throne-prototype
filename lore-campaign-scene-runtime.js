/* LC-003: transactional coordinator of pure scene transitions and a single lore save. */
const LoreCampaignSceneRuntime=(()=>{
 "use strict";
 const clone=x=>JSON.parse(JSON.stringify(x));
 function create({graph,graphCore,pack,scriptData,sceneCore,saveModule,storage}){
  const scene=sceneCore.create(graph,pack,graphCore,scriptData);
  const save=saveModule.create(graph,pack,graphCore,scriptData,storage);
  const loaded=save.load();
  let progress=loaded.progress,session=null;
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
  function skipSeen(){
   if(!session)return fail("NOT_IN_SCENE");
   return apply(scene.skipSeen(progress,session));
  }
  function finish(){
   if(!session)return fail("NOT_IN_SCENE");
   return apply(scene.finish(progress,session));
  }
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
  return Object.freeze({start,resume,next,choose,skipSeen,finish,leave,
   current,progress:progressCopy,stateFor,journal,hasCheckpoint,hasContent,
   storageStatus:()=>storageState,snapshot:()=>({
    storageStatus:storageState,session:session?{nodeId:session.nodeId,mode:session.mode,
     beatId:session.beatId}:null
   })});
 }
 return Object.freeze({create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignSceneRuntime;
