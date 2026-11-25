/* Research only, not runtime. V6 core exports factory. */
function labV9(){
"use strict";
const K={
ren:[118,32,135,["hit",1],["mark",.9,2],["execute",1.55,3]],
art:[135,25,110,["hit",1],["cover",1.05,2],["disrupt",1.1,3]],
nada:[102,23,122,["mark",.8],["disrupt",.85,2],["mark",1.15,3]],
liora:[150,23,104,["hit",1],["cover",1.25,2],["teamcover",.65,3]],
sava:[103,24,125,["hit",1],["signal",.85,2],["assist",.85,3]],
medic:[111,24,112,["hit",1],["heal",1.35,2],["teamheal",.7,3]],
ranger:[101,34,127,["hit",1],["mark",.95,2],["execute",1.45,3]],
breaker:[126,31,108,["hit",1],["disrupt",1.25,2],["execute",1.4,3]],
guard:[135,25,105,["hit",1],["cover",1.05,2],["hit",1.45,3]],
charger:[135,31,110,["hit",1],["charge",1.8,2],["hit",1.25,3]],
healer:[100,20,103,["hit",1],["heal",1.45,2],["hit",1.3,3]],
captain:[175,32,115,["hit",1],["charge",1.8,2],["mark",1.1,3]],
raider:[112,33,129,["hit",1],["mark",1.1,2],["execute",1.4,3]]
};
const teams=[["ren","art","nada","medic","breaker"],["ranger","liora","sava","medic","breaker"],["ren","liora","nada","ranger","sava"],["ren","art"],["ren","art","nada"],["ranger","liora","sava"],["art","nada","medic","sava","breaker"],["ren","art","nada","medic"],["ranger","liora","sava","breaker"]];
const enemies={assault:["guard","charger","healer","raider","raider"],intercept:["captain","guard","healer","raider","charger"],hold:["charger","charger","raider","raider","guard"]};
function fresh(team,mode,opt={}){
const e=enemies[mode].slice(0,team.length), all=[...team,...e],n=team.length;
const f=all.map((id,i)=>{const [hp,atk,speed,...skills]=K[id];const ally=i<n;
return {id,i,side:ally?0:1,hp:hp*(ally?1:opt.ehp??1),max:hp*(ally?1:opt.ehp??1),atk:atk*(ally?1:opt.eatk??.78),speed:speed*(ally?1:opt.espeed??1),skills,cd:[0,0,0],meter:0,own:0,mark:null,guard:null,charge:null}});
if(mode==="hold")f.push({id:"escort",i:f.length,side:0,hp:115,max:115,atk:0,speed:0,skills:[],cd:[],meter:0,own:0,mark:null,guard:null,charge:null});
return {f,n,mode,opt,t:0,actions:0,turns:0,active:-1,reason:null,stats:{mark:0,cover:0,reply:0,signal:0,assist:0,interrupt:0,heal:0},use:{},blocked:0,escort:mode==="hold"?f.length-1:-1,priority:mode==="intercept"?n:-1};
}
const alive=(s,side)=>s.f.filter(x=>x.side===side&&x.hp>1e-8);
const fighters=(s,side)=>alive(s,side).filter(x=>x.speed>0);
const copy=s=>({...s,f:s.f.map(x=>({...x,cd:[...x.cd]})),stats:{...s.stats},use:{...s.use}});
function finish(s){
if(s.reason)return s.reason;
if(!fighters(s,0).length||s.escort>=0&&s.f[s.escort].hp<=0)return s.reason="loss";
if(!fighters(s,1).length||s.priority>=0&&s.f[s.priority].hp<=0)return s.reason="win";
if(s.mode==="intercept"&&s.blocked>=(s.opt.blocksNeeded??2))return s.reason="win";
if(s.turns>=180||s.t>160)return s.reason="limit";
return null;
}
function next(s){
if(finish(s))return;
let all=s.f.filter(x=>x.hp>0&&x.speed>0);
let dt=Math.min(...all.map(x=>Math.max(0,1000-x.meter)/x.speed));
let end=s.mode==="hold"?(s.opt.holdTime??25):s.mode==="intercept"?(s.opt.interceptTime??34):Infinity;
// Clock resolves before any actor at exact deadline. No bonus action increments time.
if(s.t+dt>=end-1e-9){s.t=end;s.reason=s.mode==="hold"?"win":"loss";return}
for(let x of all)x.meter+=dt*x.speed;s.t+=dt;
let ready=all.filter(x=>x.meter>=1000-1e-6);
let a=ready.sort((x,y)=>x.i-y.i)[0];if(!a)throw Error("initiative");
s.active=a.i;a.meter=Math.max(0,a.meter-1000);a.own++;a.cd=a.cd.map(x=>Math.max(0,x-1));
for(let x of s.f){if(x.guard&&x.guard.time<=s.t)x.guard=null;}if(a.guard&&a.guard.expires<=a.own)a.guard=null;
if(a.mark&&a.mark.expires<=a.own)a.mark=null;
s.turns++;if(a.side===0)s.actions++;
}
function enumerate(s,policy="tactical"){
let a=s.f[s.active],al=alive(s,a.side),en=alive(s,1-a.side);
if(a.charge)return [{k:"resolve",j:0,b:a.charge.target,v:a.charge.mult}];
if(s.mode==="intercept"&&a.i===s.priority)return [{k:"escape",j:0,b:a.i,v:0}];
let out=[];
for(let j=0;j<3;j++){
if(a.cd[j]||policy==="basic"&&a.side===0&&j!==0)continue;
let [k,v]=a.skills[j];if(k==="signal"&&s.opt.pureSignal)k="tempo";
let targets=["cover","heal","tempo"].includes(k)?al.filter(x=>k!=="tempo"||x!==a&&x.speed>0):["teamcover","teamheal"].includes(k)?[a]:en;
for(let b of targets){
if(a.side===1&&b.i===s.escort&&k!=="charge")continue;
if(k==="cover"&&b.guard||k==="heal"&&b.hp>=b.max-1e-6||k==="tempo"&&b.meter>=950||k==="teamheal"&&!al.some(x=>x.hp<x.max-1e-6))continue;
out.push({k,j,b:b.i,v});
}}
return out;
}
function damage(s,a,b,d,roll=1,react=false){
if(a.hp<=0||b.hp<=0)return 0;
d*=roll;
if(!react&&b.mark&&b.mark.owner!==a.i){d*=1+(s.opt.noMark&&a.side===0?0:.25);b.mark=null;if(a.side===0)s.stats.mark++}
let reply=null;
if(b.guard){let g=b.guard;b.guard=null;let p=Math.min(g.amount,d);d-=p;
if(b.side===0)s.stats.cover+=p;
if(!react&&p>0&&g.owner!==b.i&&s.f[g.owner].hp>0&&b.atk>0&&!s.opt.noReply&&!(s.opt.trust==="art_shelter"&&s.f[g.owner].id==="art"))reply=b.atk*(s.opt.trust==="art_response"&&s.f[g.owner].id==="art"?.65:.48);
}
let prev=b.hp;b.hp=Math.max(0,b.hp-d);
if(b.hp>0&&b.charge?.escape&&a.side===0){let left=b.charge.left-(prev-b.hp);if(left<=0){b.charge=null;s.blocked++;s.stats.interrupt++;}else b.charge={...b.charge,left};}
if(b.hp<=0){b.charge=null;b.mark=null;b.guard=null;}
if(reply&&b.hp>0&&a.hp>0){damage(s,b,a,reply,1,true);if(b.side===0)s.stats.reply++}
return prev-b.hp;
}
function giveGuard(s,a,b,d){
if(a.id==="art"&&a.side===0){if(s.opt.trust==="art_shelter")d*=1.20;if(s.opt.trust==="art_response")d*=.85;}
if(!b.guard||b.guard.amount<d)b.guard={amount:d,owner:a.i,expires:b.speed>0?b.own+2:Infinity,time:s.t+14};
}
function tempo(s,a,b,amount){
if(!b||b.hp<=0||b.speed<=0)return;
let before=b.meter;
b.meter=Math.max(before,Math.min(950,b.meter+amount));if(b.meter<before-1e-8||b.meter>Math.max(before,950)+1e-8)throw Error("meter");
if(a.side===0&&b.meter>before)s.stats.signal++;
}
function signalTarget(s,a){
return fighters(s,a.side).filter(x=>x!==a&&x.meter<950).sort((x,y)=>(1000-x.meter)/x.speed-(1000-y.meter)/y.speed||x.i-y.i)[0];
}
function assistant(s,a){return fighters(s,a.side).filter(x=>x!==a).sort((x,y)=>y.atk-x.atk||x.i-y.i)[0]}
function act(s,o,roll=1){
if(s.reason||s.active<0||!Number.isFinite(roll)||roll<.9-1e-9||roll>1.1+1e-9||!enumerate(s).some(x=>x.k===o.k&&x.j===o.j&&x.b===o.b&&x.v===o.v))throw Error("illegal command");
let a=s.f[s.active],b=s.f[o.b],{k,v,j}=o,d=a.atk*v;
if(k==="signal"&&a.side===0&&s.opt.trust==="sava_tempo")d*=.85;
if(a.hp<=0)throw Error("dead active");
if(a.side===0)s.use[k]=(s.use[k]||0)+1;
if(j)a.cd[j]=a.skills[j][2]+1;
if(k==="resolve"){
let escaping=a.charge.escape;a.charge=null;if(escaping){s.reason="loss";s.active=-1;return;}if(b.hp>0)damage(s,a,b,d,roll);
}else if(k==="escape"){a.charge={target:a.i,mult:0,escape:true,left:s.opt.escapeThreshold??55};}
else if(k==="charge"){a.charge={target:b.i,mult:v};}
else if(["hit","execute","mark","disrupt","assist","signal"].includes(k)){
damage(s,a,b,d,roll);
if(k==="mark"&&b.hp>0)b.mark={owner:a.i,expires:b.own+2};
if(k==="disrupt"&&b.charge){let escape=b.charge.escape;b.charge=null;if(a.side===0){s.stats.interrupt++;if(escape)s.blocked++}}
if(k==="assist"&&b.hp>0){const h=assistant(s,a);if(h){damage(s,h,b,h.atk*.5,roll,true);if(a.side===0)s.stats.assist++;}}
if(k==="signal"&&a.hp>0&&!s.opt.noTempo)tempo(s,a,signalTarget(s,a),s.opt.trust==="sava_tempo"&&a.side===0?300:250);
}else if(k==="cover")giveGuard(s,a,b,d);
else if(k==="teamcover")for(let x of alive(s,a.side))giveGuard(s,a,x,d);
else if(k==="heal"||k==="teamheal"){for(let x of k==="heal"?[b]:alive(s,a.side)){let h=Math.min(x.max-x.hp,d);x.hp+=h;if(a.side===0)s.stats.heal+=h}}
else if(k==="tempo"&&!s.opt.noTempo)tempo(s,a,b,280);
for(let x of s.f){if(x.guard&&x.guard.time<=s.t)x.guard=null;if(x.mark&&x.hp<=0)x.mark=null;if(x.hp<0||x.hp>x.max+1e-7)throw Error("health")}
s.active=-1;finish(s);
}
function estimate(s,a,o,policy){
let b=s.f[o.b],{k,v}=o,en=alive(s,1-a.side),al=alive(s,a.side),d=a.atk*v;
let dmg=(x,raw)=>Math.max(0,raw*(x.mark&&x.mark.owner!==a.i?1.25:1)-(x.guard?.amount||0));
let hit=dmg(b,d),lethal=hit>=b.hp,base=Math.min(b.hp,hit)+(lethal?32:0)+(1-b.hp/b.max)*7;
if(s.mode==="intercept"&&a.side===0&&b.i===s.priority)base+=16;
if(s.mode==="intercept"&&a.side===1&&k==="cover"&&b.i===s.priority)base+=0;
if(a.side===1&&b.i===s.escort)base+=s.opt.escortFocus??14;
if(a.side===1&&s.mode==="hold"&&b.i!==s.escort&&b.guard)base-=4;
let attack=["hit","mark","disrupt","execute","assist","signal"].includes(k);
if(policy==="basic"||policy==="greedy"){return attack?base+(k==="assist"?(assistant(s,a)?.atk||0)*.5:0):k==="resolve"?base:k==="charge"?base*.85:-1}
const threat=x=>en.reduce((sum,e)=>{
let dt=(1000-e.meter)/e.speed;
if(e.charge?.target===x.i)return sum+e.atk*e.charge.mult*(dt<8?1:.5);
if(dt<4&&x===al.slice().sort((u,v)=>u.hp-v.hp||u.i-v.i)[0])return sum+e.atk*.55;
if(dt<5&&x.i===s.escort)return sum+e.atk*.6;
return sum;
},0);
let protect=x=>{let p=threat(x);return Math.min(d,p)+(p>=x.hp?30:0)+(p>0&&x.i!==a.i&&x.atk>0?x.atk*.35:0)};
if(attack){
if(k==="mark"&&!b.mark&&!lethal&&al.length>1)base+=Math.min(9,b.hp*.25);
if(k==="disrupt"&&b.charge&&!lethal)base+=b.charge.escape?58:Math.min(40,b.atk*b.charge.mult)*(b.charge.target===s.escort?1.4:.75);
if(b.charge?.escape&&!lethal)base+=Math.min(hit,b.charge.left)*.7;
if(k==="signal"&&signalTarget(s,a)&&!s.opt.noTempo)base+=8;
if(k==="assist"&&!lethal)base+=Math.min(Math.max(0,b.hp-hit), (assistant(s,a)?.atk||0)*.5)+(b.hp<=hit+(assistant(s,a)?.atk||0)*.5?24:0);
return base;
}
if(k==="resolve")return base;
if(k==="escape")return 100;
if(k==="charge")return base*.7+6+(b.i===s.escort?35:0);
if(k==="cover")return protect(b)+(s.mode==="intercept"&&a.side===1&&b.i===s.priority&&b.charge?.escape?24:0)+(s.mode==="hold"&&a.side===0&&b.i===s.escort&&threat(b)>0?18:0);
if(k==="teamcover")return al.reduce((n,x)=>n+(x.guard?0:protect(x)*.65),0);
if(k==="heal")return Math.min(b.max-b.hp,d)*.82+(threat(b)>=b.hp&&threat(b)<b.hp+d?35:0);
if(k==="teamheal")return al.reduce((n,x)=>n+Math.min(x.max-x.hp,d)*.72+(threat(x)>=x.hp&&threat(x)<x.hp+d?22:0),0);
if(k==="tempo")return 9;
return 0;
}
function pick(s,policy){const a=s.f[s.active];let opts=enumerate(s,policy);return opts.sort((x,y)=>estimate(s,a,y,policy)-estimate(s,a,x,policy)||x.j-y.j||x.b-y.b)[0]}
function utility(s,side){
if(s.reason==="win"||s.reason==="loss"){let bonus=s.f.slice(0,s.n).reduce((n,x)=>n+x.hp,0)*.1+(s.escort>=0?s.f[s.escort].hp:0)-s.t*.15;return (side===0?1:-1)*(s.reason==="win"?10000+bonus:-10000+bonus);}
let val=0;
for(let x of s.f){let sign=x.side===side?1:-1;val+=sign*(x.hp+(x.hp>0&&x.speed>0?35:0)+(x.guard?x.guard.amount*.28:0)+(x.charge?5:0));}
if(s.escort>=0){let e=s.f[s.escort],danger=fighters(s,1).filter(x=>x.charge?.target===s.escort).reduce((n,x)=>n+x.atk*x.charge.mult,0);val+=(side===0?1:-1)*(e.hp*2.5-Math.max(0,danger-(e.guard?.amount||0))*1.25);}
if(s.priority>=0)val+=(side===0?1:-1)*(-s.f[s.priority].hp*.55+s.blocked*55-(s.f[s.priority].charge?.escape?s.f[s.priority].charge.left*.5:0));
return val;
}
function rollout(s){
const a=s.f[s.active],opts=enumerate(s),rank=opts.map(o=>({o,h:estimate(s,a,o,"tactical")})).sort((x,y)=>y.h-x.h||x.o.j-y.o.j||x.o.b-y.o.b).slice(0,5);
let best=null;
for(let {o,h} of rank){let z=copy(s);act(z,o,1);
for(let k=0;k<(s.opt.depth??4)&&!z.reason;k++){next(z);if(z.reason)break;let o2=pick(z,"tactical");if(!o2)throw Error("no rollout move");act(z,o2,1);}
let score=utility(z,a.side)+h*.16;
if(!best||score>best.score)best={o,score};
}
return best.o;
}
function sim(team,mode,policy,seed,opt={}){
let s=fresh(team,mode,opt),rng=seed>>>0;function rand(){rng=(Math.imul(1664525,rng)+1013904223)>>>0;return .9+.2*rng/4294967296}
while(!s.reason){
next(s);if(s.reason)break;
let a=s.f[s.active],o=a.side===0&&policy==="rollout"?rollout(s):pick(s,a.side===0?policy:"tactical");
if(!o)throw Error("no move");
act(s,o,rand());
}
let hp=s.f.slice(0,s.n).reduce((n,x)=>n+x.hp,0)/s.f.slice(0,s.n).reduce((n,x)=>n+x.max,0);
return {win:s.reason==="win",limit:s.reason==="limit",hp,actions:s.actions,time:s.t,stats:s.stats,use:s.use,escort:s.escort>=0?s.f[s.escort].hp:null,blocked:s.blocked};
}
function aggregate(team,mode,policy,opt={},count=50,seedOffset=0){
let rs=Array.from({length:count},(_,i)=>sim(team,mode,policy,Math.imul(i+1+seedOffset,0x9e3779b1)>>>0,opt));
let avg=f=>+(rs.reduce((n,x)=>n+f(x),0)/rs.length).toFixed(2);
return {wins:rs.filter(x=>x.win).length,quality:rs.filter(x=>x.win&&(mode==="hold"?x.escort>=90:mode==="intercept"?x.hp>=.7:x.hp>=.35)).length,n:count,limits:rs.filter(x=>x.limit).length,hp:avg(x=>x.hp),actions:avg(x=>x.actions),time:avg(x=>x.time),escort:mode==="hold"?avg(x=>x.escort):null,blocks:avg(x=>x.blocked),stats:Object.fromEntries(Object.keys(rs[0].stats).map(k=>[k,avg(x=>x.stats[k])])),use:Object.fromEntries(["cover","teamcover","heal","teamheal","tempo","signal","assist","mark","disrupt"].map(k=>[k,avg(x=>x.use[k]||0)]))};
}
return {teams,sim,aggregate,fresh,act,next,enumerate,damage,tempo,copy,pick,rollout,finish};
}
if(typeof module!=="undefined")module.exports=labV9;
