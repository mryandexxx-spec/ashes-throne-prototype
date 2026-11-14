/* LC-003: isolated one-key, fail-closed story persistence. Never touches wallet/roster. */
const LoreCampaignSceneSave=(()=>{
 "use strict";
 const KEY="ashes-throne.lore-campaign.v1",VERSION=1;
 const plain=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
 const str=x=>typeof x==="string"&&x.length>0&&x.length<=300;
 const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 const clone=x=>JSON.parse(JSON.stringify(x));
 const unique=x=>new Set(x).size===x.length;
 function validate(progress,graph,pack,graphCore,scriptData){
  if(!plain(progress)||progress.version!==VERSION||!plain(progress.stories)||
   Object.keys(progress.stories).some(id=>!graph.stories.some(s=>s.id===id)))return false;
  for(const [storyId,state] of Object.entries(progress.stories)){
   if(!plain(state)||!Array.isArray(state.completedNodeIds)||!unique(state.completedNodeIds)||
    !plain(state.bestStarsByNodeId)||!plain(state.primaryChoicesById)||
    !Array.isArray(state.keyDecisionLog)||!Array.isArray(state.seenBeatIds)||
    !Array.isArray(state.seenEvidenceIds)||!unique(state.seenBeatIds)||!unique(state.seenEvidenceIds))return false;
   const nodes=graph.nodes.filter(n=>n.storyId===storyId);
   const byNode=new Map(nodes.map(n=>[n.id,n]));
   if(state.completedNodeIds.some(id=>!byNode.has(id)))return false;
   if(state.completedNodeIds.some(id=>byNode.get(id).prerequisites.some(pre=>!state.completedNodeIds.includes(pre))))return false;
   if(Object.entries(state.bestStarsByNodeId).some(([id,star])=>!byNode.has(id)||
      byNode.get(id).rating.mode!=="stars-1-3"||!Number.isInteger(star)||star<1||star>3))return false;
   const sceneFor=nodeId=>scriptData.sceneFor(nodeId,pack);
   const knownBeats=new Set(),knownEvidence=new Set(),decisions=new Map();
   for(const node of nodes){
    const scene=sceneFor(node.id);
    if(!scene)continue;
    for(const b of scene.beats){
     knownBeats.add(node.id+"/"+b.id);
     for(const e of b.effects)knownEvidence.add(node.id+"/"+e.id);
    }
    for(const c of scene.choices){
     const key=node.id+"/"+c.decisionId;
     const allowed=decisions.get(key)||new Set();
     allowed.add(c.id);decisions.set(key,allowed);
     for(const e of c.effects)knownEvidence.add(node.id+"/"+e.id);
    }
   }
   if(state.seenBeatIds.some(id=>!knownBeats.has(id))||
      state.seenEvidenceIds.some(id=>!knownEvidence.has(id)))return false;
   const choiceEntries=Object.entries(state.primaryChoicesById);
   if(choiceEntries.some(([id,value])=>!decisions.has(id)||!decisions.get(id).has(value)))return false;
   if(state.keyDecisionLog.length!==choiceEntries.length)return false;
   const logged=new Set();
   for(const row of state.keyDecisionLog){
    if(!plain(row)||!str(row.nodeId)||!str(row.decisionId)||!str(row.choiceId))return false;
    const key=row.nodeId+"/"+row.decisionId;
    if(!byNode.has(row.nodeId)||logged.has(key)||state.primaryChoicesById[key]!==row.choiceId)return false;
    logged.add(key);
   }
   if(!(state.activeNodeId===null&&state.checkpointBeatId===null)){
    if(!str(state.activeNodeId)||!str(state.checkpointBeatId)||
      !byNode.has(state.activeNodeId)||state.completedNodeIds.includes(state.activeNodeId))return false;
    const scene=sceneFor(state.activeNodeId);
    if(!scene||!scene.beats.some(b=>b.id===state.checkpointBeatId)||
      !state.seenBeatIds.includes(state.activeNodeId+"/"+state.checkpointBeatId)||
      byNode.get(state.activeNodeId).prerequisites.some(pre=>!state.completedNodeIds.includes(pre)))return false;
   }
  }
  return true;
 }
 function normalize(progress,graph,graphCore){
  const fresh=graphCore.fresh(graph);
  for(const [id,state] of Object.entries(progress.stories)){
   fresh.stories[id]=clone(state);
  }
  return fresh;
 }
 function create(graph,pack,graphCore,scriptData,storage){
  let raw=null,mode="unknown";
  const fresh=()=>graphCore.fresh(graph);
  function load(){
   if(!storage||typeof storage.getItem!=="function"||typeof storage.setItem!=="function"){
    mode="volatile";return {status:mode,progress:fresh()};
   }
   try{
    raw=storage.getItem(KEY);
   }catch{
    mode="volatile";return {status:mode,progress:fresh()};
   }
   if(raw===null){mode="new";return {status:mode,progress:fresh()};}
   let parsed;
   try{parsed=JSON.parse(raw);}catch{mode="corrupt";return {status:mode,progress:fresh()};}
   if(!validate(parsed,graph,pack,graphCore,scriptData)){
    mode="corrupt";return {status:mode,progress:fresh()};
   }
   mode="saved";return {status:mode,progress:normalize(parsed,graph,graphCore)};
  }
  function commit(next){
   if(mode==="corrupt")return {ok:false,code:"CORRUPT_SAVE_PROTECTED"};
   if(!validate(next,graph,pack,graphCore,scriptData))return {ok:false,code:"INVALID_SAVE_STATE"};
   if(mode==="volatile")return {ok:true,volatile:true};
   if(mode==="unknown")return {ok:false,code:"SAVE_NOT_LOADED"};
   try{
    if(storage.getItem(KEY)!==raw)return {ok:false,code:"SAVE_CONFLICT"};
    const data=JSON.stringify(next);
    storage.setItem(KEY,data);
    if(storage.getItem(KEY)!==data)return {ok:false,code:"SAVE_VERIFY_FAILED"};
    raw=data;mode="saved";
    return {ok:true,volatile:false};
   }catch{
    return {ok:false,code:"SAVE_WRITE_FAILED"};
   }
  }
  return Object.freeze({load,commit,status:()=>mode,KEY});
 }
 return Object.freeze({KEY,VERSION,validate,create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignSceneSave;
