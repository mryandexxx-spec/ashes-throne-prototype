/* B13.2 research only; node docs/research/aud003-b13-initiative.js */
function run(L){
const configs=[["base",1,0,1],["compression",.65,0,1],["protection",1,.15,1],["opening",1,0,.8],["combined",.65,.15,1],["compression+opening",.65,0,.8],["all",.65,.15,.8]];
const rush={assault:["raider","raider","raider","charger","guard"],hold:["charger","raider","raider","charger","guard"],intercept:["captain","raider","raider","charger","guard"]};
function sim(team,mode,c,scenario,seed,policy="tactical",tie="seeded"){
 const [name,scale,protection,opening]=c, [espeed,perm,enemyPolicy]=scenario;
 let en=rush[mode].slice(0,team.length);
 if(perm){const i=mode==="intercept"?1:0;en=[...en.slice(0,i),...en.slice(i).reverse()]}
 const opt={enemyTeam:en,espeed,speedScale:scale,lab:{tie,seed,strictBasic:true,units:Object.fromEntries(team.map((_,i)=>["a"+i,{protection}]))}};
 const s=L.fresh(team,mode,opt);let rng=seed>>>0,firstAlly=false,enemyBefore=0,hpAtFirst=1;const firstSeen=new Set();
 const ratio=()=>s.f.slice(0,s.n).reduce((n,x)=>n+x.hp,0)/s.f.slice(0,s.n).reduce((n,x)=>n+x.max,0);
 while(!s.reason){L.next(s);if(s.reason)break;const a=s.f[s.active];if(!a.side&&!firstAlly){firstAlly=true;hpAtFirst=ratio()}if(a.side&&!firstAlly)enemyBefore++;
 // One-time opening modifier applies to enemy first turn (including buffs/charge selection), not subsequent charge resolution. No rollout: it would not model the adapter.
 const original=a.atk;if(a.side&&!firstSeen.has(a.i)){a.atk*=opening;firstSeen.add(a.i);}
 const o=L.pick(s,a.side?enemyPolicy:policy);rng=(Math.imul(1664525,rng)+1013904223)>>>0;L.act(s,o,.9+.2*rng/4294967296);a.atk=original;
 }
 const hp=ratio(),escort=s.escort<0?null:s.f[s.escort].hp,win=s.reason==="win";return {win,q:win&&(mode==="hold"?escort>=90:mode==="intercept"?hp>=.7:hp>=.35),hp,escort,enemyBefore,hpAtFirst,actions:s.actions,limit:s.reason==="limit",cover:s.stats.cover,interrupt:s.stats.interrupt};
}
const rows=[];function cell(c,teamIndex,mode,scenario,offset,n=20,policy="tactical",tie="seeded"){
 let a=Array.from({length:n},(_,i)=>sim(L.teams[teamIndex],mode,c,scenario,Math.imul(offset+1+i,0x9e3779b1)>>>0,policy,tie));let mean=k=>+(a.reduce((v,x)=>v+x[k],0)/n).toFixed(3);
 rows.push({config:c[0],team:teamIndex,mode,speed:scenario[0],perm:scenario[1],enemyPolicy:scenario[2],policy,tie,offset,n,w:a.filter(x=>x.win).length,q:a.filter(x=>x.q).length,hp:mean("hp"),escort:mode==="hold"?mean("escort"):null,enemyBefore:mean("enemyBefore"),hpAtFirst:mean("hpAtFirst"),actions:mean("actions"),cover:mean("cover"),interrupt:mean("interrupt"),limits:a.filter(x=>x.limit).length});
}
// Factorial screening: three teams, common unseen seeds; speed stress separated from order.
for(const c of configs)for(const t of [0,1,2])for(const sc of [[1,false,"tactical"],[1.1,false,"tactical"],[1.1,true,"tactical"]])cell(c,t,"assault",sc,104000);
// Cross-mode validation, independent seeds; enemy basic/greedy/tactical differ.
for(const c of configs.filter(x=>["base","combined","compression+opening","all"].includes(x[0])))for(const t of [0,1,2])for(const mode of ["hold","intercept"])for(const ep of ["tactical","greedy"])cell(c,t,mode,[1.1,false,ep],106000);
// Tie experiment: both policies with same underlying scenario and seeds; order change not pure tie ablation.
for(const tie of ["seeded","slot"])for(const t of [0,1,2])for(const perm of [false,true])cell(configs[0],t,"assault",[1.1,perm,"tactical"],108000,20,"tactical",tie);
// Small rosters and policy sensitivity; fresh seeds.
for(const c of configs.filter(x=>["base","combined","compression+opening","all"].includes(x[0])))for(const t of [3,4,5,7,8])for(const policy of ["basic","tactical"])cell(c,t,"assault",[1.1,false,"tactical"],110000,20,policy);
return {schema:1,sourceBlob:"68dfc45f8a409f8f7c9ac1362e32ad61414cc5bc",configs,total:rows.reduce((n,x)=>n+x.n,0),rows};
}
if(typeof module!=="undefined"){module.exports=run;if(require.main===module)console.log(JSON.stringify(run(require("./aud003-combat-lab-v11.js")()),null,2));}
