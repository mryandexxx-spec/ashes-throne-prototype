/* Run node docs/research/aud003-v6-v10-replay.js. Models are research-only.
   Full matrix results from separate V9/V11 runners. */
const rows=[];
for(const v of [6,7,8]){
 const L=require('./aud003-combat-lab-v'+v+'.js')(),n=v===6?30:40,offset=v===6?4000:v===7?5000:6000;
 for(let ti=0;ti<7;ti++)for(const mode of ["assault","intercept","hold"])for(const policy of ["basic","greedy","tactical","rollout"]){
  const opt=v===8&&ti===3&&mode==="intercept"?{blocksNeeded:1,escapeThreshold:48}:{};
  rows.push({v,team:ti+1,mode,policy,...L.aggregate(L.teams[ti],mode,policy,opt,n,offset)});
 }
}
{
 const L=require('./aud003-combat-lab-v9.js')();
 for(const ti of [0,1,2,6,7,8])for(const mode of ["assault","intercept","hold"])for(const policy of ["basic","greedy","rollout"])
  rows.push({v:9,team:ti+1,mode,policy,...L.aggregate(L.teams[ti],mode,policy,{},60,9000)});
}
{
 const L=require('./aud003-combat-lab-v10.js')();
 for(let ti=0;ti<3;ti++)for(const variant of [{name:"v9",opt:{}},{name:"compress75",opt:{speedScale:.75}},{name:"compress50",opt:{speedScale:.5}},{name:"diverse",opt:{diverse:true}},{name:"horizon",opt:{diverse:true,horizon:6}}])for(const espeed of [.9,1,1.1])
  rows.push({v:10,team:ti+1,mode:"assault",variant:variant.name,espeed,...L.aggregate(L.teams[ti],"assault","rollout",{...variant.opt,espeed},60,42000)});
}
console.log(JSON.stringify(rows,null,2));
