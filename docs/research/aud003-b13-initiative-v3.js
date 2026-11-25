/* B13.2 iteration 3: encounter composition, stable target ties and speed value. Research only. */
function run(source){
const fix=(s)=>s.replace("function trust(s,id)","function stable(s,a,b){const key=x=>x.side+':'+x.id+':'+s.f.slice(0,x.i).filter(z=>z.side===x.side&&z.id===x.id).length;const ka=key(a),kb=key(b);return ka<kb?-1:ka>kb?1:0;}\nfunction trust(s,id)").replace("(1000-y.meter)/y.speed||x.i-y.i","(1000-y.meter)/y.speed||stable(s,x,y)").replace("y.atk-x.atk||x.i-y.i","y.atk-x.atk||stable(s,x,y)").replace("u.hp-v.hp||u.i-v.i","u.hp-v.hp||stable(s,u,v)").replace("||x.j-y.j||x.b-y.b)[0]","||x.j-y.j||stable(s,s.f[x.b],s.f[y.b]))[0]");
const L=new Function(fix(source)+"\nreturn labV11();")();
const rows=[];const profiles={rush:["raider","raider","raider","charger","guard"],mixed:["guard","charger","healer","raider","raider"],twoRaiders:["guard","raider","raider","charger","healer"],slowThreat:["guard","charger","healer","charger","raider"]};
function cell(team,profile,ep,policy,espeed,aspeed,eatk,offset,small=false){
 const t=L.teams[team],en=small?(t.length===2?["guard","charger"]:["guard","charger","healer","raider"].slice(0,t.length)):profiles[profile];
 const rr=[];for(let i=0;i<30;i++){let seed=Math.imul(offset+i+1,0x9e3779b1)>>>0,rng=seed,s=L.fresh(t,"assault",{enemyTeam:en,espeed,aspeed,eatk,lab:{tie:"seeded",seed,strictBasic:true}}),before=0,first=false;while(!s.reason){L.next(s);if(s.reason)break;const a=s.f[s.active];if(!first){if(a.side)before++;else first=true;}const o=L.pick(s,a.side?ep:policy);rng=(Math.imul(1664525,rng)+1013904223)>>>0;L.act(s,o,.9+.2*rng/4294967296);}
 let hp=s.f.slice(0,s.n).reduce((n,x)=>n+x.hp,0)/s.f.slice(0,s.n).reduce((n,x)=>n+x.max,0);rr.push({win:s.reason==="win",q:s.reason==="win"&&hp>=.35,hp,before,actions:s.actions,limit:s.reason==="limit",cover:s.stats.cover,interrupt:s.stats.interrupt});}
 const mean=k=>+(rr.reduce((n,x)=>n+x[k],0)/rr.length).toFixed(3);rows.push({team,profile,ep,policy,espeed,aspeed,eatk,offset,small,n:rr.length,w:rr.filter(x=>x.win).length,q:rr.filter(x=>x.q).length,hp:mean("hp"),before:mean("before"),actions:mean("actions"),cover:mean("cover"),interrupt:mean("interrupt"),limits:rr.filter(x=>x.limit).length});
}
for(const t of [0,1,2])for(const profile of ["rush","mixed","slowThreat"])for(const eatk of [.78,.68])for(const espeed of [1,1.1])cell(t,profile,"tactical","tactical",espeed,1,eatk,118000);
for(const t of [0,1,2])for(const profile of ["mixed","slowThreat"])for(const aspeed of [.9,1,1.1])cell(t,profile,"greedy","tactical",1.1,aspeed,.78,120000);
for(const t of [3,4,5,7,8])for(const policy of ["basic","tactical"])for(const espeed of [1,1.1])cell(t,"early", "tactical",policy,espeed,1,.78,122000,true);
return {schema:1,sourceBlob:"68dfc45f8a409f8f7c9ac1362e32ad61414cc5bc",profiles,total:rows.reduce((n,x)=>n+x.n,0),rows};
}
if(typeof module!=="undefined"){module.exports=run;if(require.main===module)console.log(JSON.stringify(run(require("node:fs").readFileSync(require("node:path").join(__dirname,"aud003-combat-lab-v11.js"),"utf8")),null,2));}
