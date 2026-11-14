/* LC-001: inert, non-spoiler lore graph; no DOM, combat or wallet access. */
const LoreCampaignData=(function buildLoreCampaignData(){
 "use strict";
 const KINDS=["scene","investigation","task","choice","battle","finale"];
 const CANON=["source","adaptation","hypothetical"];
 const RATINGS=["none","stars-1-3"];
 const string=x=>typeof x==="string"&&x.length>0;
 const obj=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
 const unique=arr=>new Set(arr).size===arr.length;
 function freezeDeep(value){
  if(value&&typeof value==="object"&&!Object.isFrozen(value)){
   Object.values(value).forEach(freezeDeep);
   Object.freeze(value);
  }
  return value;
 }
 const policy=()=>({
  firstClear:{tracksCompletion:true},
  replay:{allowed:true,changesPrimaryStory:false},
  rating:{mode:"none"},
  simulation:{supported:false,unlock:null},
  instantClaim:{supported:false},
  rewardPoolId:null,energyCostId:null,dailyLimitId:null
 });
 const base={
  stories:[{
   id:"five-shadows",title:"Пять теней",subtitle:"Интерактивная хроника",
   status:"pilot",canonicalSource:"FIVE_SHADOWS_CHAPTER_01_OTHER_SIDE_1.3.1.md",
   chapters:["five-shadows-act-1"],
   mapLayers:[{id:"gardens-route",title:"Схематический маршрут"}],
   entryNodeIds:["five-shadows:fs-01"]
  }],
  chapters:[{
   id:"five-shadows-act-1",storyId:"five-shadows",title:"Акт I · Другая сторона",
   order:1,mapLayerId:"gardens-route"
  }],
  nodes:[
   {id:"five-shadows:fs-01",storyId:"five-shadows",chapterId:"five-shadows-act-1",
    title:"Другая сторона",kind:"scene",mapLayerId:"gardens-route",marker:{x:.14,y:.68},
    prerequisites:[],nextNodeIds:["five-shadows:fs-02"],optional:false,
    contentId:null,canonicalRef:"part-1",canonClass:"source",...policy()},
   {id:"five-shadows:fs-02",storyId:"five-shadows",chapterId:"five-shadows-act-1",
    title:"Под камнем",kind:"investigation",mapLayerId:"gardens-route",marker:{x:.42,y:.44},
    prerequisites:["five-shadows:fs-01"],nextNodeIds:["five-shadows:fs-03"],optional:false,
    contentId:null,canonicalRef:"part-1",canonClass:"source",...policy()},
   {id:"five-shadows:fs-03",storyId:"five-shadows",chapterId:"five-shadows-act-1",
    title:"Имя Элы",kind:"investigation",mapLayerId:"gardens-route",marker:{x:.72,y:.34},
    prerequisites:["five-shadows:fs-02"],nextNodeIds:[],optional:false,
    contentId:null,canonicalRef:"part-1",canonClass:"source",...policy()}
  ]
 };
 const DEFAULT=freezeDeep(base);
 function catalog(){return DEFAULT;}
 function getStory(id,c=DEFAULT){return Array.isArray(c?.stories)?c.stories.find(x=>x.id===id)||null:null;}
 function getNode(id,c=DEFAULT){return Array.isArray(c?.nodes)?c.nodes.find(x=>x.id===id)||null:null;}
 function nodesForStory(id,c=DEFAULT){return Array.isArray(c?.nodes)?c.nodes.filter(x=>x.storyId===id):[];}
 function catalogIsValid(c=DEFAULT){
  if(!obj(c)||!Array.isArray(c.stories)||!Array.isArray(c.chapters)||!Array.isArray(c.nodes)||
   !c.stories.length||!c.chapters.length||!c.nodes.length)return false;
  if([...c.stories,...c.chapters,...c.nodes].some(x=>!obj(x)||!string(x.id)))return false;
  if(!unique(c.stories.map(x=>x.id))||!unique(c.chapters.map(x=>x.id))||!unique(c.nodes.map(x=>x.id)))return false;
  const stories=new Map(c.stories.map(x=>[x.id,x]));
  const chapters=new Map(c.chapters.map(x=>[x.id,x]));
  const nodes=new Map(c.nodes.map(x=>[x.id,x]));
  for(const story of c.stories){
   if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(story.id)||!string(story.title)||
    !string(story.subtitle)||!string(story.status)||!string(story.canonicalSource)||
    !Array.isArray(story.chapters)||!story.chapters.length||!unique(story.chapters)||
    !Array.isArray(story.mapLayers)||!story.mapLayers.length||
    story.mapLayers.some(layer=>!obj(layer)||!string(layer.id)||!string(layer.title))||
    !unique(story.mapLayers.map(x=>x.id))||!Array.isArray(story.entryNodeIds)||
    !story.entryNodeIds.length||!unique(story.entryNodeIds))return false;
   if(story.chapters.some(id=>chapters.get(id)?.storyId!==story.id))return false;
  }
  for(const chapter of c.chapters){
   const story=stories.get(chapter.storyId);
   if(!story||!story.chapters.includes(chapter.id)||!string(chapter.title)||
    !Number.isSafeInteger(chapter.order)||chapter.order<1||
    !story.mapLayers.some(x=>x.id===chapter.mapLayerId))return false;
  }
  for(const node of c.nodes){
   const story=stories.get(node.storyId),chapter=chapters.get(node.chapterId);
   if(!story||!chapter||chapter.storyId!==node.storyId||
    !node.id.startsWith(node.storyId+":")||!string(node.title)||
    !KINDS.includes(node.kind)||!CANON.includes(node.canonClass)||
    !string(node.canonicalRef)||!(node.contentId===null||string(node.contentId))||
    !story.mapLayers.some(x=>x.id===node.mapLayerId)||
    !obj(node.marker)||!Number.isFinite(node.marker.x)||!Number.isFinite(node.marker.y)||
    node.marker.x<0||node.marker.x>1||node.marker.y<0||node.marker.y>1||
    typeof node.optional!=="boolean"||!Array.isArray(node.prerequisites)||
    !Array.isArray(node.nextNodeIds)||!unique(node.prerequisites)||!unique(node.nextNodeIds)||
    !obj(node.firstClear)||node.firstClear.tracksCompletion!==true||
    !obj(node.replay)||node.replay.allowed!==true||node.replay.changesPrimaryStory!==false||
    !obj(node.rating)||!RATINGS.includes(node.rating.mode)||
    !obj(node.simulation)||typeof node.simulation.supported!=="boolean"||
    !obj(node.instantClaim)||typeof node.instantClaim.supported!=="boolean"||
    !(node.rewardPoolId===null||string(node.rewardPoolId))||
    !(node.energyCostId===null||string(node.energyCostId))||
    !(node.dailyLimitId===null||string(node.dailyLimitId)))return false;
   if(node.requiredBattleId!==undefined&&
      (!string(node.requiredBattleId)||node.kind==="battle"||node.nextNodeIds.length===0))return false;
   // Optional written battle bridges are content only; they must not define
   // combat rules, effects, rewards or hidden script execution.
   if(node.requiredBattleNarrative!==undefined){
    const n=node.requiredBattleNarrative;
    if(!string(node.requiredBattleId)||!obj(n)||
       !string(n.title)||n.title.length>100||
       !string(n.intro)||n.intro.length>600||
       !string(n.victory)||n.victory.length>700||
       !string(n.defeat)||n.defeat.length>450||
       !Array.isArray(n.lines)||n.lines.length>3||
       n.lines.some(line=>!obj(line)||!string(line.speakerId)||
         !string(line.text)||line.text.length>250))return false;
   }
   if(node.prerequisites.includes(node.id)||node.nextNodeIds.includes(node.id)||
    [...node.prerequisites,...node.nextNodeIds].some(id=>nodes.get(id)?.storyId!==node.storyId))return false;
   if(node.kind==="battle"){
    if(!string(node.battleDefinitionId)||node.rating.mode!=="stars-1-3")return false;
   }else if(node.battleDefinitionId!==undefined||node.rating.mode!=="none")return false;
   if(node.simulation.supported){
    if(node.kind!=="battle"||node.simulation.unlock!=="bestStars:3")return false;
   }else if(node.simulation.unlock!==null)return false;
   if(node.instantClaim.supported&&
     (node.kind!=="battle"||node.rating.mode!=="stars-1-3"))return false;
  }
  const gates=c.nodes.filter(node=>node.requiredBattleId!==undefined).map(node=>node.requiredBattleId);
  if(!unique(gates))return false;
  for(const node of c.nodes){
   if(node.prerequisites.some(id=>!nodes.get(id).nextNodeIds.includes(node.id)))return false;
   if(!node.optional&&node.prerequisites.some(id=>nodes.get(id).optional))return false;
  }
  for(const story of c.stories){
   const own=c.nodes.filter(n=>n.storyId===story.id);
   if(!own.length||story.entryNodeIds.some(id=>nodes.get(id)?.storyId!==story.id||
     nodes.get(id).prerequisites.length>0))return false;
   const seen=new Set(story.entryNodeIds),queue=[...story.entryNodeIds];
   for(let i=0;i<queue.length;i++){
    for(const id of nodes.get(queue[i]).nextNodeIds)if(!seen.has(id)){seen.add(id);queue.push(id);}
   }
   if(own.some(n=>!seen.has(n.id)))return false;
   if(!own.some(n=>!n.optional&&n.nextNodeIds.length===0))return false;
  }
  const visiting=new Set(),checked=new Set();
  function visit(id){
   if(visiting.has(id))return false;
   if(checked.has(id))return true;
   visiting.add(id);
   for(const next of nodes.get(id).nextNodeIds)if(!visit(next))return false;
   visiting.delete(id);checked.add(id);
   return true;
  }
  return c.nodes.every(x=>visit(x.id));
 }
 return Object.freeze({KINDS:Object.freeze(KINDS),catalog,getStory,getNode,nodesForStory,catalogIsValid});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignData;
