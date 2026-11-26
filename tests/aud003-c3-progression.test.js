"use strict";
const assert=require("node:assert/strict"),M=require("../design/aud003-c3-progression.js");
function proof(s,m,i,extra={}){return {hero:s.hero,milestone:m.id,mode:m.mode,route:m.routes[0],occurrence:s.hero+":"+i,startSeq:i,endSeq:i,success:true,contribution:true,accepted:true,...extra}}
let states=0,transitions=0;
for(const hero of M.HEROES){
 const fresh=M.initial(hero),joined=M.join(fresh,1),cat=M.catalog[hero];assert.equal(M.rank(fresh),0);assert.equal(M.rank(joined),1);
 assert.equal(M.apply(fresh,4,proof(fresh,cat[0],2)),fresh);
 // Exhaust every order, both authorized variants, all gates; every reachable state below V has eventual continuation.
 const walk=(s,stage,i)=>{states++;const options=M.eligible(s,stage);
  for(const m of cat){const p=proof(s,m,i);if(!options.includes(m))assert.equal(M.apply(s,stage,p),s)}
  for(const m of options){for(const route of m.routes){const p=proof(s,m,i,{route});for(const bad of [{success:false},{contribution:false},{accepted:false},{hero:"unknown"},{mode:"wrong"},{route:"unknown"},{startSeq:s.rankSeq},{endSeq:i-1}])assert.equal(M.apply(s,stage,{...p,...bad}),s);
   const next=M.apply(s,stage,p);assert.notEqual(next,s);assert.ok(M.rank(next)>=M.rank(s));assert.equal(M.apply(next,stage,p),next);transitions++;walk(next,stage,i+1);}}
 };
 for(let stage=0;stage<5;stage++)walk(joined,stage,2);
 let s=joined;for(let i=0;i<100;i++){s=M.apply(s,0,proof(s,cat[0],i+2))}assert.equal(M.rank(s),2);
 // Early account: cannot attain III even if every future proof is attempted.
 for(let i=0;i<6;i++)s=M.apply(s,0,proof(s,cat[i],200+i));assert.equal(M.rank(s),2);
 // Mature account, late join: still six post-join proofs; no old evidence or same-run double reward.
 s=M.join(M.initial(hero),1000);assert.equal(M.apply(s,4,proof(s,cat[0],99)),s);
 for(let i=0;i<6;i++){const p=proof(s,cat[i],1001+i,{route:cat[i].routes[1]});const next=M.apply(s,4,p);assert.notEqual(next,s);if(i===1){assert.equal(M.apply(next,4,proof(next,cat[2],1002,{occurrence:p.occurrence})),next)}s=next}
 assert.equal(M.rank(s),5);assert.equal(M.eligible(s,4).length,0);
 // Different gate maxima with all valid available milestones.
 for(const [stage,max] of [[0,2],[1,2],[2,3],[3,4],[4,5]]){let s=joined;for(let i=0;i<6;i++)s=M.apply(s,stage,proof(s,cat[i],10+i));assert.equal(M.rank(s),max);}
}
console.log("C3: 5 heroes; "+states+" reachable traversal visits, "+transitions+" valid transitions; no replay, pre-join proof, early stage or same-occurrence rank exploit.");