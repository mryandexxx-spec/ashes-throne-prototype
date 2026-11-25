"use strict";
importScripts("../docs/research/aud003-combat-lab-v11.js","session.js");
self.onmessage=e=>{try{
const {jobs,n,seed}=e.data;if(!Array.isArray(jobs)||jobs.length<1||jobs.length>5||!Number.isInteger(n)||n<1||n>100||!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error("Некорректная серия");
for(const job of jobs){const config=CombatLabSession.validate(job.config),rows=[];for(let i=0;i<n;i++){rows.push(CombatLabSession.run({...config,seed:(seed+Math.imul(i,0x9e3779b1))>>>0}));if(i===0||(i+1)%5===0||i===n-1)self.postMessage({type:"progress",label:job.label,done:i+1});}self.postMessage({type:"row",label:job.label,result:CombatLabSession.summarize(rows)});}self.postMessage({type:"done"});
}catch(error){self.postMessage({type:"error",message:error.message});}};