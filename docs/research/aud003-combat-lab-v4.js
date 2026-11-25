/* [ПРЕДЛОЖЕНИЕ] Isolated numeric toy model, not runtime. Run node docs/research/aud003-combat-lab.js. No production dependencies. */
function combatDesignLab(){
const kits={
ren:[118,32,135,["hit",1],["mark",.9,2],["execute",1.55,3]],
art:[135,25,110,["hit",1],["cover",.65,2],["disrupt",1.1,3]],
nada:[102,23,122,["mark",.8],["disrupt",.85,2],["mark",1.15,3]],
liora:[150,23,104,["hit",1],["cover",.85,2],["teamcover",.5,3]],
sava:[103,24,125,["hit",1],["tempo",.28,2],["assist",.8,3]],
medic:[111,24,112,["hit",1],["heal",1.35,2],["teamheal",.7,3]],
ranger:[101,34,127,["hit",1],["mark",.85,2],["execute",1.45,3]],
breaker:[126,31,108,["hit",1],["disrupt",1.25,2],["execute",1.4,3]],
guard:[135,25,105,["hit",1],["cover",.75,2],["hit",1.45,3]],
charger:[135,31,110,["hit",1],["charge",1.8,2],["hit",1.25,3]],
healer:[100,20,103,["hit",1],["heal",1.45,2],["hit",1.3,3]],
captain:[175,32,115,["hit",1],["charge",1.8,2],["mark",1.1,3]],
raider:[112,33,129,["hit",1],["mark",1.1,2],["execute",1.4,3]]
};
const teams=[["ren","art","nada","medic","breaker"],["ranger","liora","sava","medic","breaker"],["ren","liora","nada","ranger","sava"]];
const encounters={assault:["guard","charger","healer","raider","raider"],intercept:["captain","guard","healer","raider","charger"],hold:["charger","charger","raider","raider","guard"]};
function sim(team,scenario,policy,seed,variant="v2",trust=0){
let rng=seed>>>0;function rand(){rng=(Math.imul(1664525,rng)+1013904223)>>>0;return rng/4294967296}
let f=[...team,...encounters[scenario]].map((id,i)=>{let [hp,atk,speed,...skills]=kits[id];return{id,i,side:i<team.length?0:1,hp,max:hp,atk:atk*(i<team.length?1+trust:1),speed,skills,cd:[0,0,0],meter:0,mark:null,guard:null,charge:null,delay:0}});
let actions=0,t=0,combos=0,prevents=0,temps=0,turns=0,reason="limit";
const living=side=>f.filter(x=>x.side===side&&x.hp>0);
const protectedHero=f.slice(0,team.length).find(x=>x.id==="art"||x.id==="liora")||f[0],priority=f[team.length];
if(variant==="v3"){for(let x of f.filter(x=>x.side===1)){x.atk*=.78;if(scenario==="intercept"&&x===priority){x.hp*=1.32;x.max=x.hp;}}}
const health=()=>living(0).reduce((s,x)=>s+x.hp,0)/f.slice(0,team.length).reduce((s,x)=>s+x.max,0);
function damage(a,b,base,react=false){if(b.hp<=0)return;let d=base*(.9+.2*rand());if(!react&&b.mark&&b.mark.owner!==a.i){d*=1+b.mark.bonus;b.mark=null;if(a.side===0)combos++}
if(b.guard){let g=b.guard;b.guard=null;let prevented=Math.min(d,g.amount);d-=prevented;if(b.side===0)prevents+=prevented;if(variant!=="v1"&&g.owner!==b.i&&f[g.owner].hp>0&&!react&&prevented>0){a.hp=Math.max(0,a.hp-b.atk*.48);if(b.side===0)combos++}}
b.hp=Math.max(0,b.hp-d);}
function candidates(a){let out=[];let al=living(a.side),en=living(1-a.side);for(let i=0;i<3;i++){if(a.cd[i]||policy==="basic"&&a.side===0&&i!==0)continue;let [k,v]=a.skills[i];let targets=["cover","heal","tempo"].includes(k)?al.filter(x=>k!=="tempo"||x!==a):["teamcover","teamheal","assist"].includes(k)?[a]:en;for(let b of targets){if(k==="charge"&&a.charge)continue;out.push({i,k,v,b})}}return out;}

function value(a,o){let {k,v,b,i}=o;let al=living(a.side),en=living(1-a.side);let d=a.atk*v;let incoming=x=>en.filter(e=>e.charge?.target===x.i).reduce((s,e)=>s+e.atk*1.8,0);let focus=scenario==="intercept"&&a.side===0&&b===priority?14:0;
let base=Math.min(b.hp,d)*(b.mark&&b.mark.owner!==a.i?1.3:1)+ (b.hp<=d?22:0)+focus+(1-b.hp/b.max)*8;
if(a.side===0&&policy==="tactical"&&scenario==="intercept"&&b===priority)base+=28;
if(variant==="v3"&&a.side===0&&scenario==="hold"&&b.charge?.target===protectedHero.i)base+=12;
if(variant==="v3"&&b.guard)base-=Math.min(d,b.guard.amount)*.8;
if(a.side===0&&policy==="greedy")return ["hit","mark","disrupt","execute","charge"].includes(k)?base: k==="heal"?Math.min(b.max-b.hp,d)*.8:0;
switch(k){
case "hit":case "execute":return base+(k==="execute"&&b.mark&&b.mark.owner!==a.i?5:0);
case "mark":return base+(b.mark?0:Math.min(b.hp,34)*.3*(al.length>1?1:0));
case "disrupt":return base+(b.charge?Math.min(55,b.atk*1.8):0);
case "charge":return base*.95+(a.side===1?10:0);
case "cover":return b.guard?0:(incoming(b)>0?Math.min(d,incoming(b))*1.2+12:Math.min(d,22)*.5)+(scenario==="hold"&&a.side===0&&b===protectedHero?(variant==="v3"?25:12):0)+(variant!=="v1"&&b!==a?8:0);
case "teamcover":return al.reduce((s,x)=>s+(x.guard?0:incoming(x)>0?Math.min(d,incoming(x))*1.1+7:3),0);
case "heal":return Math.min(b.max-b.hp,d)*(b.hp/b.max<.4?1.7:1.1)+(incoming(b)>b.hp?15:0);
case "teamheal":return al.reduce((s,x)=>s+Math.min(x.max-x.hp,d)*(x.hp/x.max<.4?1.5:1),0);
case "tempo":return b.meter<1000?Math.min(1000-b.meter,1000*v)*b.atk/1000*(variant==="v3"?1.7:.95):0;
case "assist":return Math.max(...en.map(x=>Math.min(x.hp,a.atk*v+Math.max(0,...al.filter(x=>x!==a).map(x=>x.atk))*.5)+(x.hp<a.atk*v+15?20:0)));
default:return 0;
}}
while(turns++<180){
if(!living(0).length){reason="loss";break}if(scenario==="hold"&&protectedHero.hp<=0){reason="loss";break}
if(!living(1).length||(scenario==="intercept"&&priority.hp<=0)||(scenario==="hold"&&actions>=(variant==="v3"?10:14))){reason="win";break}
if(scenario==="intercept"&&actions>=(variant==="v3"?9:12)){reason="loss";break}
let all=f.filter(x=>x.hp>0),dt=Math.min(...all.map(x=>Math.max(0,1000-x.meter)/x.speed));for(let x of all)x.meter+=dt*x.speed;t+=dt;let a=all.filter(x=>x.meter>=999.999999).sort((a,b)=>a.i-b.i)[0];if(!a)throw Error("initiative");a.meter=Math.max(0,a.meter-1000);a.cd=a.cd.map(x=>Math.max(0,x-1));for(let x of all){if(x.guard&&x.guard.expires<=turns)x.guard=null;if(x.mark&&x.mark.expires<=turns)x.mark=null;}if(a.side===0)actions++;
if(a.charge){let b=f[a.charge.target];if(b.hp<=0)b=living(1-a.side)[0];a.charge=null;if(b)damage(a,b,a.atk*1.8);continue}
let opts=candidates(a);let adjusted=o=>{let v=value(a,o);if(a.side===0&&policy==="tactical"&&scenario==="intercept"&&["heal","teamheal","cover","teamcover","tempo"].includes(o.k))v*=.6;return v};let o=opts.sort((x,y)=>adjusted(y)-adjusted(x)||x.i-y.i||x.b.i-y.b.i)[0];if(!o)throw Error("no action");let {k,v,b,i}=o;let d=a.atk*v;if(i)a.cd[i]=a.skills[i][2]+1;
switch(k){
case "hit":case "execute":damage(a,b,d);break;
case "mark":damage(a,b,d);if(b.hp>0)b.mark={owner:a.i,bonus:variant==="v1"?0.12:.30,expires:turns+12};break;
case "disrupt":damage(a,b,d);if(b.charge){b.charge=null;if(a.side===0)combos++}break;
case "charge":a.charge={target:b.i};break;
case "cover":b.guard={amount:d*(variant==="v3"?1.4:1),owner:a.i,expires:turns+10};break;
case "teamcover":for(let x of living(a.side))x.guard={amount:d,owner:a.i,expires:turns+10};break;
case "heal":b.hp=Math.min(b.max,b.hp+d);break;
case "teamheal":for(let x of living(a.side))x.hp=Math.min(x.max,x.hp+d);break;
case "tempo":b.meter=Math.min(variant==="v1"?1000:950,b.meter+1000*v);temps++;break;
case "assist":{let en=living(1-a.side).sort((x,y)=>x.hp-y.hp||x.i-y.i),al=living(a.side).filter(x=>x!==a).sort((x,y)=>y.atk-x.atk||x.i-y.i),target=en[0];damage(a,target,d);if(target.hp>0&&al[0]){damage(al[0],target,al[0].atk*.5,true);if(a.side===0)combos++}break}
}
}
return {win:reason==="win",limit:reason==="limit",actions,hp:health(),combos,prevents,temps};
}
const rows=[];for(let variant of ["v3"])for(let [ti,team] of teams.entries())for(let scenario of Object.keys(encounters))for(let policy of ["basic","greedy","tactical"])for(let trust of policy==="tactical"?[0,.08]:[0]){let rs=Array.from({length:100},(_,i)=>sim(team,scenario,policy,Math.imul(i+1,0x9e3779b1),variant,trust));let avg=k=>+(rs.reduce((s,x)=>s+x[k],0)/rs.length).toFixed(2);rows.push({variant,team:ti+1,scenario,policy,trust,wins:rs.filter(x=>x.win).length,limits:rs.filter(x=>x.limit).length,actions:avg("actions"),hp:avg("hp"),combos:avg("combos")})}
return rows;
}
console.log(JSON.stringify(combatDesignLab(),null,2));
