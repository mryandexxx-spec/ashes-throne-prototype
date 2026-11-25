/* B13.3 iteration 2: controlled response windows and candidate doctrines. */
function run(source){
function patch(s){
 const change=(a,b)=>{if(s.split(a).length!==2)throw Error("source mismatch "+a);s=s.replace(a,b)};
 change("function trust(s,id)","function stable(s,a,b){const key=x=>x.side+':'+x.id+':'+s.f.slice(0,x.i).filter(z=>z.side===x.side&&z.id===x.id).length;const ka=key(a),kb=key(b);return ka<kb?-1:ka>kb?1:0;}\nfunction trust(s,id)");
 change("(1000-y.meter)/y.speed||x.i-y.i","(1000-y.meter)/y.speed||stable(s,x,y)");
 change("y.atk-x.atk||x.i-y.i","y.atk-x.atk||stable(s,x,y)");
 change("u.hp-v.hp||u.i-v.i","u.hp-v.hp||stable(s,u,v)");
 change("||x.j-y.j||x.b-y.b)[0]","||x.j-y.j||stable(s,s.f[x.b],s.f[y.b]))[0]");return s;
}
const stable=patch(source);
function candidate(s){
 const change=(a,b)=>{if(s.split(a).length!==2)throw Error("source mismatch "+a);s=s.replace(a,b)};
 change("if(b.guard){let g=b.guard;b.guard=null;let p=Math.min(g.amount,d);d-=p;guardPrevented=p;","if(b.guard){let g=b.guard;b.guard=null;let p=Math.min(g.amount,d);d-=p;guardPrevented=p;if(s.opt.lab?.doctrine==='pool'&&trust(s,'art')==='art_shelter'&&s.f[g.owner].id==='art'&&g.amount-p>1e-8)b.guard={...g,amount:g.amount-p};");
 change('if(trust(s,"art")==="art_shelter")d*=1.20;', 'if(trust(s,"art")==="art_shelter")d*=s.opt.lab?.doctrine==="pool"?1.75:1.20;');
 change('trust(s,"sava")==="sava_tempo"&&a.side===0?300:250','trust(s,"sava")==="sava_tempo"&&a.side===0?(s.opt.lab?.doctrine==="pool"?400:300):250');return s;
}
const factory=s=>new Function(s+"\nreturn labV11();")(),base=factory(stable),revised=factory(candidate(stable));
const fixtures=[];
function inspect(L,name,{target="escort",hp=135,second=false,disruptCD=0,trust=false,doctrine="base",escortHP=115,weak=1,enemyCharge=1.8}={}){
 const team=["ren","art","nada"],en=["charger",second?"charger":"guard","healer"];
 const s=L.fresh(team,"hold",{enemyTeam:en,eatk:.78,holdTime:50,trace:true,lab:{tie:"seeded",seed:42,doctrine,trust:trust?{art:"art_shelter"}:{}}});
 const a=s.f[1],e=s.f[3],e2=s.f[4],b=s.f[target==="escort"?s.escort:0];s.t=8;s.active=1;s.turns=1;s.actions=1;a.own=1;a.cd[2]=disruptCD;
 e.hp=hp;e.meter=990;e.charge={target:b.i,mult:enemyCharge};if(second){e2.meter=980;e2.charge={target:b.i,mult:enemyCharge};}
 if(target==="escort")b.hp=escortHP;else b.hp*=weak;
 const opts=L.enumerate(s).filter(o=>(o.k==="cover"&&o.b===b.i)||(["hit","disrupt"].includes(o.k)&&o.b===e.i));const results=[];
 for(const o of opts){const z=L.copy(s);z.events=[];L.act(z,o,1);let resolved=0;
 // Directly isolate the pending attacks at one instant. Ordinary subsequent turns deliberately excluded.
 // All actions still go through legality and effect resolution in L.act; not a full played turn sequence.
 for(const i of second?[3,4]:[3]){const x=z.f[i];if(z.reason||x.hp<=0||!x.charge)continue;z.active=i;const cmd=L.enumerate(z)[0];if(cmd.k!=="resolve")throw Error("expected charge resolution");L.act(z,cmd,1);resolved++;}
 results.push({action:o.k,target:o.b,protectedHP:+z.f[b.i].hp.toFixed(2),enemyHP:+z.f[e.i].hp.toFixed(2),guardRemaining:+(z.f[b.i].guard?.amount||0).toFixed(2),damagePrevented:+z.stats.cover.toFixed(2),interrupts:z.stats.interrupt,resolved,reason:z.reason,events:z.events.filter(x=>["guard","counter","damage","interrupt","death","resolve","terminal"].includes(x.type))});}
 fixtures.push({name,target,hp,second,disruptCD,trust,doctrine,escortHP,weak,enemyCharge,results});
}
inspect(base,"single full threat");inspect(base,"low HP, eliminate threat",{hp:20});inspect(base,"interrupt unavailable",{disruptCD:1,escortHP:42});inspect(base,"two threats",{second:true,escortHP:80});inspect(base,"two threats, current shelter",{second:true,escortHP:80,trust:true});inspect(revised,"two threats, pool shelter",{second:true,escortHP:80,trust:true,doctrine:"pool"});inspect(base,"protect combat ally",{target:"ren",weak:.35});inspect(revised,"two small hits, pool shelter",{second:true,escortHP:65,enemyCharge:.8,trust:true,doctrine:"pool"});inspect(base,"two small hits, current shelter",{second:true,escortHP:65,enemyCharge:.8,trust:true});
const rows=[];
function cell(t,mode,variant,eatk,offset,n=40){
 const L=variant==="candidate"?revised:base,team=L.teams[t],trust=variant==="base"?{}:{art:"art_shelter",sava:"sava_tempo"};
 const en=mode==="assault"?["guard","charger","healer","raider","raider"]:mode==="hold"?["charger","charger","raider","raider","guard"]:["captain","guard","healer","raider","charger"];
 const rr=[];
 for(let j=0;j<n;j++){const seed=Math.imul(offset+j+1,0x9e3779b1)>>>0;let rng=seed;const s=L.fresh(team,mode,{enemyTeam:en,eatk,espeed:1.1,holdTime:42,lab:{tie:"seeded",seed,strictBasic:true,trust,doctrine:variant==="candidate"?"pool":"base"}});
 while(!s.reason){L.next(s);if(s.reason)break;const o=L.pick(s,"tactical");rng=(Math.imul(1664525,rng)+1013904223)>>>0;L.act(s,o,.9+.2*rng/4294967296);}
 const hp=s.f.slice(0,s.n).reduce((n,x)=>n+x.hp,0)/s.f.slice(0,s.n).reduce((n,x)=>n+x.max,0),escort=s.escort<0?null:s.f[s.escort].hp,win=s.reason==="win";rr.push({win,q:win&&(mode==="hold"?escort>=90:mode==="intercept"?hp>=.7:hp>=.35),hp,escort,cover:s.stats.cover,signal:s.stats.signal,assist:s.stats.assist,limit:s.reason==="limit"});}
 const mean=k=>+(rr.reduce((n,x)=>n+x[k],0)/rr.length).toFixed(3);
 rows.push({t,mode,variant,eatk,offset,n,w:rr.filter(x=>x.win).length,q:rr.filter(x=>x.q).length,hp:mean("hp"),escort:mode==="hold"?mean("escort"):null,cover:mean("cover"),signal:mean("signal"),assist:mean("assist"),limits:rr.filter(x=>x.limit).length});
}
for(const t of [0,1,2,6])for(const mode of ["assault","hold","intercept"])for(const variant of ["base","current","candidate"])for(const eatk of [.78,.9])cell(t,mode,variant,eatk,132000);
return {schema:1,sourceBlob:"68dfc45f8a409f8f7c9ac1362e32ad61414cc5bc",total:rows.reduce((n,x)=>n+x.n,0),fixtures,rows};
}
if(typeof module!=="undefined"){module.exports=run;if(require.main===module)console.log(JSON.stringify(run(require("node:fs").readFileSync(require("node:path").join(__dirname,"aud003-combat-lab-v11.js"),"utf8")),null,2));}
