/* AUD003-B13.1 research only. node docs/research/aud003-b13-holdout.js */
function run(L){
const B=L.teams[1],C=L.teams[2],rush=["raider","raider","raider","charger","guard"],alt=["raider","raider","charger","raider","guard"];
function sim(team,policy,seed,opt,self=false){
 let s=L.fresh(team,"assault",opt),rng=seed>>>0;
 // Lab-only ablation: eliminate counter reaction from opening guard, not subsequent guard.
 if(self)for(const x of s.f.slice(0,s.n))if(x.guard)x.guard={...x.guard,owner:x.i};
 while(!s.reason){L.next(s);if(s.reason)break;const a=s.f[s.active],o=a.side===0&&policy==="rollout"?L.rollout(s):L.pick(s,a.side===0?policy:"tactical");rng=(Math.imul(1664525,rng)+1013904223)>>>0;L.act(s,o,.9+.2*rng/4294967296);}
 return {win:s.reason==="win",hp:s.f.slice(0,s.n).reduce((n,x)=>n+x.hp,0)/s.f.slice(0,s.n).reduce((n,x)=>n+x.max,0),reply:s.stats.reply,actions:s.actions,reason:s.reason};
}
const rows=[];
function cell(name,team,policy,scenario,opt,self=false,offset=91000){
 const a=Array.from({length:40},(_,i)=>sim(team,policy,Math.imul(offset+1+i,0x9e3779b1)>>>0,opt,self));
 const med=k=>{const q=a.map(x=>x[k]).sort((a,b)=>a-b);return +((q[19]+q[20])/2).toFixed(3)};
 rows.push({name,team,policy,scenario,opt,self,offset,n:a.length,w:a.filter(x=>x.win).length,q:a.filter(x=>x.win&&x.hp>=.35).length,hp:med("hp"),reply:med("reply"),actions:med("actions"),limits:a.filter(x=>x.reason==="limit").length});
}
for(const [name,team,policy,options,self] of [
 ["B baseline",B,"rollout",{},false],["B guard .2",B,"rollout",{lab:{openingGuard:.2}},false],["B own guard .2",B,"rollout",{lab:{openingGuard:.2}},true],
 ["B protection .2",B,"rollout",{lab:{units:Object.fromEntries(B.map((_,i)=>["a"+i,{protection:.2}]))}},false],
 ["C greedy",C,"greedy",{},false],["C rollout",C,"rollout",{},false],["C horizon9",C,"rollout",{diverse:true,horizon:9},false]
])for(const [scenario,en,espeed] of [["rush",rush,1],["rush permuted + faster",alt,1.1],["rush permuted only",alt,1],["rush faster only",rush,1.1]])cell(name,team,policy,scenario,{enemyTeam:en,espeed,...options},self);
for(const [scenario,enemyTeam] of [["starter guard/charger",["guard","charger"]],["starter double raider",["raider","raider"]]])for(const policy of ["basic","greedy","tactical"])cell("Ren/Art",L.teams[3],policy,scenario,{enemyTeam},false,93000);
return {schema:1,sourceBlob:"68dfc45f8a409f8f7c9ac1362e32ad61414cc5bc",method:"40 paired unseen seeds per cell; W=win, Q=win with HP >=35%; all medians include losses; independent seeds, not independent engine or human playtest",total:rows.reduce((n,x)=>n+x.n,0),rows};
}
if(typeof module!=="undefined"){module.exports=run;if(require.main===module)console.log(JSON.stringify(run(require("./aud003-combat-lab-v11.js")()),null,2));}
