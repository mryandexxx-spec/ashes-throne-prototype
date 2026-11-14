/* LC-001: pure gate checks only. Persistence and rewards belong to later stages. */
const LoreCampaignCore=(function buildLoreCampaignCore(){
 "use strict";
 const KEY="ashes-throne.lore-campaign.v1",VERSION=1;
 function fresh(catalog){
  if(!catalog||!Array.isArray(catalog.stories))return null;
  const stories={};
  for(const story of catalog.stories)stories[story.id]={
   completedNodeIds:[],bestStarsByNodeId:{},primaryChoicesById:{},
   keyDecisionLog:[],seenBeatIds:[],seenEvidenceIds:[],
   activeNodeId:null,checkpointBeatId:null
  };
  return {version:VERSION,stories};
 }
 const record=(progress,id)=>progress?.stories?.[id];
 const hasCompleted=(s,id)=>Array.isArray(s?.completedNodeIds)&&s.completedNodeIds.includes(id);
 const findNode=(catalog,id)=>Array.isArray(catalog?.nodes)?catalog.nodes.find(n=>n.id===id)||null:null;
 function available(catalog,progress,nodeId){
  const node=findNode(catalog,nodeId),state=node&&record(progress,node.storyId);
  return !!node&&!!state&&
   node.prerequisites.every(id=>hasCompleted(state,id))&&
   (!hasCompleted(state,nodeId)||node.replay?.allowed===true);
 }
 function begin(catalog,progress,nodeId){
  const node=findNode(catalog,nodeId);
  if(!node)return Object.freeze({ok:false,code:"UNKNOWN_NODE"});
  const state=record(progress,node.storyId);
  if(!state||!available(catalog,progress,nodeId))
   return Object.freeze({ok:false,code:"LOCKED"});
  return Object.freeze({ok:true,nodeId,mode:hasCompleted(state,nodeId)?"replay":"primary"});
 }
 function rewardCheck(catalog,progress,nodeId,mode,count=1){
  const node=findNode(catalog,nodeId);
  if(!node)return Object.freeze({ok:false,code:"UNKNOWN_NODE"});
  if(!["repeat","simulate","instant"].includes(mode))
   return Object.freeze({ok:false,code:"INVALID_MODE"});
  if(!Number.isSafeInteger(count)||count<1||mode==="instant"&&count!==1)
   return Object.freeze({ok:false,code:"INVALID_COUNT"});
  const state=record(progress,node.storyId);
  if(!hasCompleted(state,nodeId))return Object.freeze({ok:false,code:"NOT_COMPLETED"});
  if(!node.replay?.allowed)return Object.freeze({ok:false,code:"REPLAY_DISABLED"});
  if(mode==="simulate"&&!node.simulation?.supported||
     mode==="instant"&&!node.instantClaim?.supported)
   return Object.freeze({ok:false,code:"MODE_UNSUPPORTED"});
  if((mode==="simulate"||mode==="instant")&&
   (node.rating?.mode!=="stars-1-3"||state.bestStarsByNodeId?.[nodeId]!==3))
   return Object.freeze({ok:false,code:"RATING_REQUIRED"});
  if(!node.rewardPoolId||!node.energyCostId)
   return Object.freeze({ok:false,code:"REWARDS_NOT_CONFIGURED"});
  // Explicitly prevent payout before LC-008 adds an idempotent wallet transaction.
  return Object.freeze({ok:false,code:"REWARD_ENGINE_NOT_IMPLEMENTED"});
 }
 return Object.freeze({KEY,VERSION,fresh,available,begin,rewardCheck});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignCore;
