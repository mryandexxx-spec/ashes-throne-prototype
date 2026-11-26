/* R2/C2 — isolated encounter candidate and fresh-seed validation, no live runtime. */
const TreeR2CValidation=(()=>{
"use strict";
const development=[101,103,107,109,113,127];
const validation=[3001,3011,3019,3037,3041,3049,3061,3067,3079,3083,3089,3109];
const candidate=Object.freeze({level:7,hold:8,enemies:Object.freeze(["npc-trail-interceptor","npc-ridge-slinger"]),squad:Object.freeze(["ren","art"])});
const early=["starter","pilot","team6"],advanced=["team12","team20"];
const api=TreeR2C;
function spec(level,hold,id=level+"-"+hold){
 return {id,squad:candidate.squad,enemies:candidate.enemies,level,objective:hold?{kind:"hold-or-defeat",protectAllyId:"ren",allyActionsToHold:hold}:{kind:"protect-and-defeat",protectAllyId:"ren"}};
}
function sweep(){
 const rows=[];
 for(const [levels,holds,stage] of [[[4,6,8,10,12],[0,6,8,9,10],"coarse"],[[7,8],[0,7,8],"fine"]])
  for(const level of levels)for(const profile of early)for(const policy of api.policies)for(const seed of development)for(const hold of holds)
   rows.push({level,hold,stage,...api.run(spec(level,hold),profile,"base",policy,seed,true)});
 return rows;
}
function validate(){
 const rows=[],routes=[];
 for(const seed of validation)for(const op of api.ops)for(const profile of early)for(const policy of ["reactive","protect"])for(const build of ["base","guardian","commander"])
  rows.push(api.run(op,profile,build,policy,seed));
 // Only research fixtures; never mutate production progression or persist these levels.
 const original12=api.profiles.team12,original20=api.profiles.team20;
 try{
  api.profiles.team12={art:12,ren:12,nada:12,skill:2};
  api.profiles.team20={art:20,ren:20,nada:20,skill:2};
  for(const seed of validation)for(const profile of [...early,...advanced])for(const policy of api.policies)for(const hold of [0,candidate.hold])
   routes.push(api.run(spec(candidate.level,hold,hold?"hold8":"direct"),profile,"base",policy,seed,true));
 }finally{
  if(original12===undefined)delete api.profiles.team12;else api.profiles.team12=original12;
  if(original20===undefined)delete api.profiles.team20;else api.profiles.team20=original20;
 }
 return {rows,routes};
}
function summary(rows,keys){
 return api.aggregate(rows,keys).map(o=>{
  const sel=rows.filter(x=>keys.map(k=>x[k]).join("|")===o.key),wins=sel.filter(x=>x.eligible);
  return {...o,winActions:wins.length?Math.round(wins.reduce((n,x)=>n+x.actions,0)/wins.length*100)/100:null};
 });
}
function pairs(rows){
 const groups={};
 for(let i=0;i<rows.length;i+=3){
  const [b,g,c]=rows.slice(i,i+3);
  if(!(b.id===g.id&&g.id===c.id&&b.seed===c.seed&&b.profile===g.profile&&g.profile===c.profile&&b.policy===g.policy&&g.policy===c.policy&&b.build==="base"&&g.build==="guardian"&&c.build==="commander"))throw Error("unpaired comparison");
  const x=groups[b.id]??(groups[b.id]={gOnly:0,cOnly:0,both:0,baseOnly:0,gAlive:0,cAlive:0});
  x.gOnly+=Number(g.eligible&&!c.eligible);x.cOnly+=Number(c.eligible&&!g.eligible);
  x.both+=Number(g.eligible&&c.eligible);x.baseOnly+=Number(b.eligible&&!g.eligible&&!c.eligible);
  x.gAlive+=Number(g.allAlive&&!c.allAlive);x.cAlive+=Number(c.allAlive&&!g.allAlive);
 }
 return groups;
}
return {candidate,development,validation,spec,sweep,validate,summary,pairs};
})();
