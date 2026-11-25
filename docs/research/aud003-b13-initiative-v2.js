/* B13.2 second iteration: stable AI ties and opening readiness. Research only. */
function run(source){
function stableSource(s){
 const replace=(a,b)=>{if(s.split(a).length!==2)throw Error("source mismatch "+a);s=s.replace(a,b)};
 replace("function trust(s,id)", "function stable(s,a,b){const key=x=>x.side+':'+x.id+':'+s.f.slice(0,x.i).filter(z=>z.side===x.side&&z.id===x.id).length;const ka=key(a),kb=key(b);return ka<kb?-1:ka>kb?1:0;}\nfunction trust(s,id)");
 replace("(1000-y.meter)/y.speed||x.i-y.i", "(1000-y.meter)/y.speed||stable(s,x,y)");
 replace("y.atk-x.atk||x.i-y.i","y.atk-x.atk||stable(s,x,y)");
 replace("u.hp-v.hp||u.i-v.i","u.hp-v.hp||stable(s,u,v)");
 replace("||x.j-y.j||x.b-y.b)[0]","||x.j-y.j||stable(s,s.f[x.b],s.f[y.b]))[0]");
 return s;
}
const make=s=>new Function(s+"\nreturn labV11();")(),base=make(source),stable=make(stableSource(source));
const configs=[["baseline",false,0,1],["stable",true,0,1],["ready80",true,80,1],["ready140",true,140,1],["ready140+opening",true,140,.8]];
const rows=[];
function cell(c,t,speed,perm,offset,mode="assault",policy="tactical",enemyPolicy="tactical"){
 const [name,fix,meter,opening]=c,L=fix?stable:base,team=L.teams[t];let enemies=(mode==="assault"?["raider","raider","raider","charger","guard"]:mode==="hold"?["charger","raider","raider","charger","guard"]:["captain","raider","raider","charger","guard"]).slice(0,team.length);if(perm){let i=mode==="intercept"?1:0;enemies=[...enemies.slice(0,i),...enemies.slice(i).reverse()]}
 const arr=[];for(let j=0;j<20;j++){let seed=Math.imul(offset+j+1,0x9e3779b1)>>>0,rng=seed,s=L.fresh(team,mode,{enemyTeam:enemies,espeed:speed,lab:{tie:"seeded",seed,strictBasic:true}});for(const a of s.f.slice(0,s.n))a.meter=meter;
 let before=0,first=false,firstHP=1;const seen=new Set(),hp=()=>s.f.slice(0,s.n).reduce((n,x)=>n+x.hp,0)/s.f.slice(0,s.n).reduce((n,x)=>n+x.max,0);
 while(!s.reason){L.next(s);if(s.reason)break;const a=s.f[s.active];if(!first){if(a.side)before++;else{first=true;firstHP=hp()}}
 const old=a.atk;if(a.side&&!seen.has(a.i)){a.atk*=opening;seen.add(a.i)}const o=L.pick(s,a.side?enemyPolicy:policy);rng=(Math.imul(1664525,rng)+1013904223)>>>0;L.act(s,o,.9+.2*rng/4294967296);a.atk=old;}
 const win=s.reason==="win",h=hp();arr.push({win,q:win&&(mode==="hold"?s.f[s.escort].hp>=90:mode==="intercept"?h>=.7:h>=.35),hp:h,before,firstHP,limit:s.reason==="limit",actions:s.actions});}
 const mean=k=>+(arr.reduce((n,x)=>n+x[k],0)/arr.length).toFixed(3);rows.push({name,t,speed,perm,offset,mode,policy,enemyPolicy,n:arr.length,w:arr.filter(x=>x.win).length,q:arr.filter(x=>x.q).length,hp:mean("hp"),before:mean("before"),firstHP:mean("firstHP"),actions:mean("actions"),limits:arr.filter(x=>x.limit).length});
}
for(const c of configs)for(const t of [0,1,2])for(const speed of [1,1.1])for(const perm of [false,true])cell(c,t,speed,perm,112000);
for(const c of configs.filter(x=>["baseline","stable","ready80","ready140+opening"].includes(x[0])))for(const t of [0,1,2])for(const mode of ["hold","intercept"])cell(c,t,1.1,true,114000,mode);
for(const c of configs.filter(x=>["baseline","stable","ready80","ready140+opening"].includes(x[0])))for(const t of [3,4,5,7,8])for(const policy of ["basic","tactical"])cell(c,t,1.1,true,116000,"assault",policy);
return {schema:1,sourceBlob:"68dfc45f8a409f8f7c9ac1362e32ad61414cc5bc",configs,total:rows.reduce((n,x)=>n+x.n,0),rows};
}
if(typeof module!=="undefined"){module.exports=run;if(require.main===module)console.log(JSON.stringify(run(require("node:fs").readFileSync(require("node:path").join(__dirname,"aud003-combat-lab-v11.js"),"utf8")),null,2));}
