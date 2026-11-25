/* B13.3 research only. Role utility, trust and objective response. */
function run(source){
function stable(s){
 const replace=(a,b)=>{if(s.split(a).length!==2)throw Error("source mismatch "+a);s=s.replace(a,b)};
 replace("function trust(s,id)","function stable(s,a,b){const key=x=>x.side+':'+x.id+':'+s.f.slice(0,x.i).filter(z=>z.side===x.side&&z.id===x.id).length;const ka=key(a),kb=key(b);return ka<kb?-1:ka>kb?1:0;}\nfunction trust(s,id)");
 replace("(1000-y.meter)/y.speed||x.i-y.i","(1000-y.meter)/y.speed||stable(s,x,y)");
 replace("y.atk-x.atk||x.i-y.i","y.atk-x.atk||stable(s,x,y)");
 replace("u.hp-v.hp||u.i-v.i","u.hp-v.hp||stable(s,u,v)");
 replace("||x.j-y.j||x.b-y.b)[0]","||x.j-y.j||stable(s,s.f[x.b],s.f[y.b]))[0]");
 return s;
}
const L=new Function(stable(source)+"\nreturn labV11();")();
const profiles={assault:["guard","charger","healer","raider","raider"],hold:["charger","charger","raider","raider","guard"],intercept:["captain","guard","healer","raider","charger"]};
const trusts={ren:"ren_precision",art:"art_shelter",nada:"nada_observe",liora:"liora_formation",sava:"sava_tempo"};
const groups={mark:["mark"],guard:["cover","teamcover"],interrupt:["disrupt"],heal:["heal","teamheal"],coordination:["signal","assist"]};
function simulate(team,mode,scenario,seed,variant="base",policy="tactical",enemyPolicy="tactical",gear=1){
 const opt={enemyTeam:profiles[mode].slice(0,team.length),eatk:scenario==="stress"?.9:.78,espeed:scenario==="stress"?1.1:1,holdTime:scenario==="stress"?42:25,interceptTime:scenario==="stress"?34:28,blocksNeeded:team.length<4?1:2,escapeThreshold:team.length<4?48:55,lab:{strictBasic:true,tie:"seeded",seed,units:Object.fromEntries(team.map((_,i)=>["a"+i,{atk:gear,hp:gear}]))}};
 if(variant==="trustAll")opt.lab.trust=trusts;
 if(variant.startsWith("trust:")){const id=variant.slice(6);opt.lab.trust=id==="response"?{art:"art_response"}:{[id]:trusts[id]};}
 const s=L.fresh(team,mode,opt);let rng=seed>>>0;const used={};let guards=0,interrupts=0,killCharge=0,threatActions=0,chargeResolves=0;
 // Replace a skill's effect by an ordinary damage action at the original coefficient and cooldown.
 // Support -> attack is a replacement test, not a pure effect removal.
 if(groups[variant])for(const a of s.f.slice(0,s.n))a.skills=a.skills.map(([k,v,cd])=>groups[variant].includes(k)?["hit",v,cd]:[k,v,cd]);
 while(!s.reason){L.next(s);if(s.reason)break;const a=s.f[s.active];const o=L.pick(s,a.side?enemyPolicy:policy),t=s.f[o.b];const threat=s.f.filter(x=>x.side&&x.hp>0&&x.charge);
 if(!a.side){used[o.k]=(used[o.k]||0)+1;if(threat.length){threatActions++;if(["cover","teamcover"].includes(o.k))guards++;} }
 if(a.side&&o.k==="resolve")chargeResolves++;
 const was=!!t.charge,prev=s.stats.interrupt;rng=(Math.imul(1664525,rng)+1013904223)>>>0;L.act(s,o,.9+.2*rng/4294967296);
 if(!a.side){interrupts+=s.stats.interrupt-prev;if(was&&t.hp<=0)killCharge++;}
 }
 const hp=s.f.slice(0,s.n).reduce((n,x)=>n+x.hp,0)/s.f.slice(0,s.n).reduce((n,x)=>n+x.max,0),escort=s.escort<0?null:s.f[s.escort].hp,win=s.reason==="win";
 return {win,q:win&&(mode==="hold"?escort>=90:mode==="intercept"?hp>=.7:hp>=.35),hp,escort,used,guards,interrupts,killCharge,threatActions,chargeResolves,cover:s.stats.cover,heal:s.stats.heal,mark:s.stats.mark,signal:s.stats.signal,assist:s.stats.assist,reply:s.stats.reply,actions:s.actions,limit:s.reason==="limit"};
}
const rows=[];
function cell(t,mode,scenario,variant,offset,n=30,policy="tactical",enemyPolicy="tactical",gear=1){
 const team=L.teams[t];let rr=Array.from({length:n},(_,i)=>simulate(team,mode,scenario,Math.imul(offset+1+i,0x9e3779b1)>>>0,variant,policy,enemyPolicy,gear));let mean=k=>+(rr.reduce((n,x)=>n+x[k],0)/rr.length).toFixed(3);
 rows.push({t,team,mode,scenario,variant,offset,n,policy,enemyPolicy,gear,w:rr.filter(x=>x.win).length,q:rr.filter(x=>x.q).length,hp:mean("hp"),escort:mode==="hold"?mean("escort"):null,guards:mean("guards"),interrupts:mean("interrupts"),killCharge:mean("killCharge"),threatActions:mean("threatActions"),chargeResolves:mean("chargeResolves"),cover:mean("cover"),heal:mean("heal"),mark:mean("mark"),signal:mean("signal"),assist:mean("assist"),reply:mean("reply"),actions:mean("actions"),limits:rr.filter(x=>x.limit).length,used:Object.fromEntries(Object.keys(Object.assign({},...rr.map(x=>x.used))).sort().map(k=>[k,+(rr.reduce((n,x)=>n+(x.used[k]||0),0)/rr.length).toFixed(2)]))});
}
// Broad role screen at two difficulty levels. Some teams lack a given role by construction.
for(const t of [0,1,2,6])for(const mode of ["assault","hold","intercept"])for(const scenario of ["normal","stress"])for(const variant of ["base",...Object.keys(groups)])cell(t,mode,scenario,variant,124000,20);
// Trust individually and together on stressed conditions, then holdout on stronger gear.
for(const t of [0,1,2,6])for(const mode of ["assault","hold","intercept"])for(const variant of ["base","trustAll",...L.teams[t].filter(x=>trusts[x]).map(x=>"trust:"+x),...(L.teams[t].includes("art")?["trust:response"]:[])])cell(t,mode,"stress",variant,126000,30);
for(const t of [0,1,2,6])for(const mode of ["assault","hold","intercept"])for(const variant of ["base","trustAll"])cell(t,mode,"stress",variant,128000,30,"tactical","greedy",1.15);
// Small rosters, role vs basic; not real novice test.
for(const t of [3,4,5,7,8])for(const mode of ["assault","hold","intercept"])for(const policy of ["basic","tactical"])cell(t,mode,"normal","base",130000,20,policy);
return {schema:1,sourceBlob:"68dfc45f8a409f8f7c9ac1362e32ad61414cc5bc",total:rows.reduce((n,x)=>n+x.n,0),rows};
}
if(typeof module!=="undefined"){module.exports=run;if(require.main===module)console.log(JSON.stringify(run(require("node:fs").readFileSync(require("node:path").join(__dirname,"aud003-combat-lab-v11.js"),"utf8")),null,2));}
