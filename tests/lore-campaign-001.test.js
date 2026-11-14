"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Data=require("../lore-campaign-data.js");
const Core=require("../lore-campaign-core.js");
const clone=value=>JSON.parse(JSON.stringify(value));
const id=(n)=>"five-shadows:fs-0"+n;

test("LC-001: default pilot graph validates, is immutable and non-spoiler",()=>{
 const c=Data.catalog();
 assert.equal(Data.catalogIsValid(),true);
 assert.ok(Object.isFrozen(c.nodes[0]));
 assert.equal(c.nodes.length,3);
 assert.deepEqual(c.nodes.map(n=>n.id),[id(1),id(2),id(3)]);
 assert.ok(c.nodes.every(n=>n.rewardPoolId===null&&n.energyCostId===null&&n.contentId===null));
 assert.ok(c.nodes.every(n=>n.simulation.supported===false&&n.instantClaim.supported===false));
 assert.equal(Data.getStory("five-shadows").chapters.length,1);
 assert.equal(Data.getNode("invalid"),null);
});

test("LC-001: main path gates actual start, repeat does not mutate story",()=>{
 const c=Data.catalog(),p=Core.fresh(c);
 assert.equal(p.version,Core.VERSION);
 assert.equal(Core.available(c,p,id(1)),true);
 assert.equal(Core.available(c,p,id(2)),false);
 assert.equal(Core.begin(c,p,id(3)).code,"LOCKED");
 assert.equal(Core.begin(c,p,id(1)).mode,"primary");
 p.stories["five-shadows"].completedNodeIds.push(id(1));
 assert.equal(Core.begin(c,p,id(2)).mode,"primary");
 assert.equal(Core.begin(c,p,id(1)).mode,"replay");
 const before=JSON.stringify(p);
 assert.equal(Core.begin(c,p,id(1)).ok,true);
 assert.equal(JSON.stringify(p),before);
 assert.equal(Core.begin(c,p,"missing").code,"UNKNOWN_NODE");
});

test("LC-001: malformed links, cycles, incomplete catalogs and coordinates are rejected",()=>{
 const c=Data.catalog();
 const changes=[
  b=>{b.nodes[0].nextNodeIds.push("missing");},
  b=>{b.nodes[1].prerequisites=["missing"];},
  b=>{b.nodes[2].nextNodeIds=[id(1)];b.nodes[0].prerequisites=[id(3)];},
  b=>{b.nodes[1].marker.x=1.01;},
  b=>{b.nodes[1].marker.y=NaN;},
  b=>{b.nodes[1].kind="lootbox";},
  b=>{b.nodes[0].id=b.nodes[1].id;},
  b=>{b.nodes[1].nextNodeIds=[];},
  b=>{b.stories[0].entryNodeIds=[id(2)];},
  b=>{b.nodes[2].replay.changesPrimaryStory=true;},
  b=>{b.nodes[2].simulation.supported=true; b.nodes[2].simulation.unlock="bestStars:3";},
  b=>{b.nodes[1].rewardPoolId=123;}
 ];
 for(const mutate of changes){
  const altered=clone(c); mutate(altered);
  assert.equal(Data.catalogIsValid(altered),false,mutate.toString());
 }
});

test("LC-001: optional nodes never become mandatory for finale",()=>{
 const c=clone(Data.catalog());
 const opt={...clone(c.nodes[1]),id:"five-shadows:optional",title:"Тестовая боковая ветвь",
  optional:true,prerequisites:[id(1)],nextNodeIds:[]};
 c.nodes[0].nextNodeIds.push(opt.id);
 c.nodes.push(opt);
 assert.equal(Data.catalogIsValid(c),true);
 const p=Core.fresh(c);
 p.stories["five-shadows"].completedNodeIds.push(id(1),id(2));
 assert.equal(Core.available(c,p,id(3)),true,"optional can be skipped");
 assert.equal(Core.available(c,p,opt.id),true);
 opt.nextNodeIds.push(id(3));
 c.nodes[2].prerequisites.push(opt.id);
 assert.equal(Data.catalogIsValid(c),false,"main cannot require optional nodes");
});

test("LC-001: graph accepts second independent lore story without engine edits",()=>{
 const c=clone(Data.catalog());
 c.stories.push({id:"another-story",title:"Вторая история",subtitle:"Тест",
  status:"pilot",canonicalSource:"test-only",chapters:["another-chapter"],
  mapLayers:[{id:"another-layer",title:"Карта"}],entryNodeIds:["another-story:start"]});
 c.chapters.push({id:"another-chapter",storyId:"another-story",title:"Акт",
  order:1,mapLayerId:"another-layer"});
 c.nodes.push({...clone(c.nodes[0]),id:"another-story:start",storyId:"another-story",
  chapterId:"another-chapter",mapLayerId:"another-layer",
  prerequisites:[],nextNodeIds:[]});
 assert.equal(Data.catalogIsValid(c),true);
 assert.equal(Core.begin(c,Core.fresh(c),"another-story:start").ok,true);
 assert.equal(Data.nodesForStory("another-story",c).length,1);
});

test("LC-001: reward modes have no payouts before rules and transaction layer",()=>{
 const catalog=Data.catalog(),p=Core.fresh(catalog);
 assert.equal(Core.rewardCheck(catalog,p,id(1),"repeat").code,"NOT_COMPLETED");
 p.stories["five-shadows"].completedNodeIds.push(id(1));
 assert.equal(Core.rewardCheck(catalog,p,id(1),"repeat").code,"REWARDS_NOT_CONFIGURED");
 assert.equal(Core.rewardCheck(catalog,p,id(1),"simulate").code,"MODE_UNSUPPORTED");
 assert.equal(Core.rewardCheck(catalog,p,id(1),"instant").code,"MODE_UNSUPPORTED");
 assert.equal(Core.rewardCheck(catalog,p,id(1),"repeat",0).code,"INVALID_COUNT");
 assert.equal(Core.rewardCheck(catalog,p,id(1),"repeat",Infinity).code,"INVALID_COUNT");
 assert.equal(Core.rewardCheck(catalog,p,id(1),"instant",2).code,"INVALID_COUNT");
 assert.equal(Core.rewardCheck(catalog,p,id(1),"unknown").code,"INVALID_MODE");
 const battle=clone(catalog);
 const node=battle.nodes[2];
 node.kind="battle"; node.canonClass="hypothetical"; node.rating={mode:"stars-1-3"};
 node.battleDefinitionId="test-battle-only"; node.simulation={supported:true,unlock:"bestStars:3"};
 node.instantClaim={supported:true};
 assert.equal(Data.catalogIsValid(battle),true);
 const state=Core.fresh(battle);
 state.stories["five-shadows"].completedNodeIds.push(id(3));
 assert.equal(Core.rewardCheck(battle,state,id(3),"simulate",1).code,"RATING_REQUIRED");
 state.stories["five-shadows"].bestStarsByNodeId[id(3)]=3;
 const unchanged=JSON.stringify(state);
 assert.equal(Core.rewardCheck(battle,state,id(3),"simulate",10).code,"REWARDS_NOT_CONFIGURED");
 assert.equal(Core.rewardCheck(battle,state,id(3),"instant").code,"REWARDS_NOT_CONFIGURED");
 node.rewardPoolId="configured-later";node.energyCostId="configured-later";
 assert.equal(Core.rewardCheck(battle,state,id(3),"simulate").code,"REWARD_ENGINE_NOT_IMPLEMENTED");
 assert.equal(Core.rewardCheck(battle,state,id(3),"instant").code,"REWARD_ENGINE_NOT_IMPLEMENTED");
 assert.equal(JSON.stringify(state),unchanged,"reward checks never mutate progress");
});
