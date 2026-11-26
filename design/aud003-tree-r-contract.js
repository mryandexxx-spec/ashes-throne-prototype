/* TREE-R design contract — proposed, not production. Earned story facts are external
 * inputs; actual C5 writer must source these from authoritative receipts. */
const TreeRContract=(()=>{
 "use strict";
 const NODE=Object.freeze({
 "cover-focus":{slot:"technique",cost:1,level:3,rank:1,parents:[],status:"optional-review"},
 "cover-shared":{slot:"technique",cost:1,level:3,rank:1,parents:[],status:"optional-review"},
 "cover-self":{slot:"technique",cost:1,level:3,rank:1,parents:[],status:"rejected-forced"},
 "intercept":{slot:"signature",cost:2,level:3,rank:2,parents:[],status:"candidate"},
 "reserve":{slot:"signature",cost:2,level:3,rank:2,parents:[],status:"candidate"},
 "bastion":{slot:"signature",cost:2,level:3,rank:2,parents:[],status:"unproven"},
 "last-line":{slot:"reserve",cost:2,level:25,rank:3,parents:["intercept"],status:"future"},
 "field-reserve":{slot:"reserve",cost:2,level:25,rank:3,parents:["reserve","intercept"],status:"future"},
 "hold-sector":{slot:"reserve",cost:2,level:25,rank:3,parents:["bastion","reserve"],status:"future"},
 "rescue-doctrine":{slot:"doctrine",cost:0,level:55,rank:4,parents:["last-line","field-reserve"],status:"future"},
 "command-doctrine":{slot:"doctrine",cost:0,level:55,rank:4,parents:["field-reserve","hold-sector"],status:"future"},
 "finale-rescue":{slot:"reserve",cost:2,level:75,rank:5,parents:["last-line","hold-sector"],status:"future"},
 "finale-command":{slot:"reserve",cost:2,level:75,rank:5,parents:["field-reserve","hold-sector"],status:"future"}
 });
 const GATE={2:[3,1,1,2],3:[25,3,4,3],4:[55,5,8,5],5:[75,6,11,6]};
 const validProfile=p=>p&&Number.isInteger(p.level)&&p.level>=1&&p.level<=85&&Number.isInteger(p.stars)&&p.stars>=1&&p.stars<=7&&Number.isInteger(p.gear)&&p.gear>=1&&p.gear<=13&&Number.isInteger(p.skill)&&p.skill>=1&&p.skill<=6&&Number.isInteger(p.rank)&&p.rank>=1&&p.rank<=5;
 function entry(p,rank){return validProfile(p)&&Object.hasOwn(GATE,rank)&&p.rank>=rank-1&&[p.level,p.stars,p.gear,p.skill].every((v,i)=>v>=GATE[rank][i]);}
 const budget=p=>!validProfile(p)?0:p.level>=25?5:p.level>=8?3:p.level>=3?2:0;
 const known=id=>Object.hasOwn(NODE,id);
 // implemented = actual reviewed catalogue supplied by host, not a save flag. Lab default
 // deliberately has no live TREE-R activation. Parent dependencies are ANY-of mastery.
 function eligible(p,id,earned,implemented){const n=known(id)?NODE[id]:null;return !!n&&validProfile(p)&&Array.isArray(earned)&&Array.isArray(implemented)&&implemented.includes(id)&&!["unproven","rejected-forced"].includes(n.status)&&p.level>=n.level&&p.rank>=n.rank&&(n.rank===1||entry(p,n.rank))&&(!n.parents.length||n.parents.some(parent=>earned.includes(parent)));}
 function loadout(p,ids,earned,implemented,teamReserveUsed=false){
  if(!validProfile(p)||!Array.isArray(ids)||!Array.isArray(earned)||!Array.isArray(implemented)||new Set(ids).size!==ids.length)return false;
  const slots=new Set();let cost=0;
  for(const id of ids){if(!earned.includes(id)||!eligible(p,id,earned,implemented))return false;const n=NODE[id];if(slots.has(n.slot)||n.slot==="reserve"&&teamReserveUsed)return false;slots.add(n.slot);cost+=n.cost;}
  return cost<=budget(p);
 }
 return Object.freeze({NODE,GATE,entry,budget,eligible,loadout});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=TreeRContract;
