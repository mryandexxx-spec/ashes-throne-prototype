/* LC-008C — UNWIRED, read-only persisted proof for five lore act first-clears.
 * No reward catalogue, wallet mutation, live claim, energy or new economy rules.
 * The caller must still supply the real shared wallet writer and an approved
 * reward source to RewardPolicyCore.claim in a SEPARATE integration phase. */
const LoreRewardProofCore=(()=>{
 "use strict";
 const STORY_ID="five-shadows",OCCURRENCE_ID="once";
 const SOURCE_IDS=Object.freeze(Array.from({length:5},(_,i)=>STORY_ID+"-act-"+(i+1)));
 const getModule=(globalName,path)=>{
  // The module is intentionally not loaded by index.html in this stage.
  const known=globalName==="LoreCampaignAct5"?
   (typeof LoreCampaignAct5!=="undefined"?LoreCampaignAct5:null):
   globalName==="LoreCampaignCore"?
   (typeof LoreCampaignCore!=="undefined"?LoreCampaignCore:null):
   globalName==="LoreCampaignSceneSave"?
   (typeof LoreCampaignSceneSave!=="undefined"?LoreCampaignSceneSave:null):
   (typeof LoreCampaignScenes!=="undefined"?LoreCampaignScenes:null);
  return known||(typeof require==="function"?require(path):null);
 };
 function authorize({storage,kind,sourceId,occurrenceId,count}={}){
  // No "best stars", replay, alternative-choice or inspection payouts.
  if(kind!=="first-clear"||occurrenceId!==OCCURRENCE_ID||count!==1||
     !SOURCE_IDS.includes(sourceId)||!storage||
     typeof storage.getItem!=="function")return false;
  try{
   const bundle=getModule("LoreCampaignAct5","./lore-campaign-act5.js");
   const core=getModule("LoreCampaignCore","./lore-campaign-core.js");
   const save=getModule("LoreCampaignSceneSave","./lore-campaign-scene-save.js");
   const scripts=getModule("LoreCampaignScenes","./lore-campaign-scenes.js");
   if(!bundle||!core||!save||!scripts)return false;
   const graph=bundle.data.catalog(),pack=bundle.pack;
   // Fixed 15-node/5-act contract. Do not silently authorize future graphs.
   if(!bundle.data.catalogIsValid(graph)||!scripts.valid(pack,graph)||
      graph.nodes.length!==15||graph.chapters.length!==5||
      graph.stories.length!==1||graph.stories[0].id!==STORY_ID)return false;
   const chapters=graph.chapters.slice().sort((a,b)=>a.order-b.order);
   if(chapters.some((ch,i)=>ch.id!==SOURCE_IDS[i]||ch.order!==i+1||
      ch.storyId!==STORY_ID))return false;
   const raw=storage.getItem(save.KEY);
   if(typeof raw!=="string"||!raw.length)return false;
   const persisted=JSON.parse(raw);
   if(!save.validate(persisted,graph,pack,core,scripts))return false;
   const state=persisted.stories[STORY_ID];
   if(!state)return false;
   const claimedOrder=SOURCE_IDS.indexOf(sourceId)+1;
   const orderByChapter=new Map(chapters.map(ch=>[ch.id,ch.order]));
   const required=graph.nodes.filter(node=>node.storyId===STORY_ID&&
    orderByChapter.get(node.chapterId)<=claimedOrder);
   // Each existing act has exactly three required nodes.
   if(required.length!==claimedOrder*3||required.some(node=>node.optional===true))
    return false;
   const completed=new Set(state.completedNodeIds);
   const cleared=new Set(state.battleClearedNodeIds||[]);
   // A completed dialogue isn't proof of a required combat victory.
   // Earlier chapter battles are also required, even if the later scene
   // happened to exist in a historical or externally modified v1 save.
   return required.every(node=>completed.has(node.id)&&
    (!node.requiredBattleId||cleared.has(node.id)));
  }catch(_){
   // Missing, corrupt, blocked or inaccessible domain saves never earn proof.
   return false;
  }
 }
 return Object.freeze({STORY_ID,OCCURRENCE_ID,SOURCE_IDS,authorize});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreRewardProofCore;
