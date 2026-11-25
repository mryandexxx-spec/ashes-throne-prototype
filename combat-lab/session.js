/* AUD003-B12 — browser/Node adapter. V11 is the sole rules authority. */
(function(root,factory){if(typeof module==="object"&&module.exports)module.exports=factory(require("../docs/research/aud003-combat-lab-v11.js"));else root.CombatLabSession=factory(root.labV11);})(typeof globalThis!=="undefined"?globalThis:this,function(make){
"use strict";
const heroes=["ren","art","nada","liora","sava","medic","ranger","breaker"];
const foes=["guard","charger","healer","captain","raider"];
const policies=["basic","greedy","tactical","rollout"];
const presets={mixed:["guard","charger","healer","raider","raider"],rush:["raider","raider","raider","charger","raider"],telegraph:["charger","charger","raider","guard","healer"],defensive:["guard","guard","healer","healer","charger"],intercept:["captain","guard","healer","raider","charger"]};
const names={ren:"Рен",art:"Арт",nada:"Нада",liora:"Лиора",sava:"Сава",medic:"Медик",ranger:"Стрелок",breaker:"Боец срыва",guard:"Страж",charger:"Тяжёлый боец",healer:"Лекарь",captain:"Курьер",raider:"Налётчик",escort:"Подопечный"};
const kinds={hit:"Удар",mark:"Уязвимость",execute:"Сильный удар",cover:"Прикрытие",teamcover:"Защита отряда",disrupt:"Срыв",signal:"Координация",assist:"Совместная атака",heal:"Восстановление",teamheal:"Лечение отряда",tempo:"Инициатива",charge:"Подготовить атаку",resolve:"Завершить действие",escape:"Подготовить побег"};
const defaults=()=>({version:1,team:["ren","art","nada"],enemyTeam:["guard","charger","healer"],mode:"assault",seed:12345,playerAI:"tactical",enemyAI:"tactical",opt:{eatk:.78,ehp:1,aspeed:1,espeed:1,speedScale:1,holdTime:25,interceptTime:34,blocksNeeded:2,escapeThreshold:55,depth:4,trust:"base",diverse:true,noMark:false,noReply:false,noTempo:false,pureSignal:false}});
function validate(raw){
const d=defaults(),c={...d,...raw,opt:{...d.opt,...raw?.opt}};
const fail=m=>{throw Error(m)};
if(c.version!==1||!Array.isArray(c.team)||c.team.length<2||c.team.length>5||new Set(c.team).size!==c.team.length||c.team.some(x=>!heroes.includes(x)))fail("Выберите 2–5 разных героев");
if(!Array.isArray(c.enemyTeam)||c.enemyTeam.length<1||c.enemyTeam.length>c.team.length||c.enemyTeam.some(x=>!foes.includes(x)))fail("Выберите 1–N противников (N — размер отряда)");
if(!["assault","hold","intercept"].includes(c.mode)||c.mode==="intercept"&&c.enemyTeam[0]!=="captain")fail("Для перехвата первым должен быть курьер");
if(!Number.isInteger(c.seed)||c.seed<0||c.seed>4294967295||!policies.includes(c.playerAI)||!policies.includes(c.enemyAI))fail("Некорректный seed или ИИ");
const ranges={eatk:[.25,2],ehp:[.25,3],aspeed:[.5,1.5],espeed:[.5,1.5],speedScale:[0,1],holdTime:[5,100],interceptTime:[5,100],blocksNeeded:[1,5],escapeThreshold:[1,300],depth:[1,8]};
for(const [k,[lo,hi]] of Object.entries(ranges)){const v=c.opt[k];if(!Number.isFinite(v)||v<lo||v>hi||["blocksNeeded","depth"].includes(k)&&!Number.isInteger(v))fail("Некорректный параметр "+k)}
for(const k of ["diverse","noMark","noReply","noTempo","pureSignal"])if(typeof c.opt[k]!=="boolean")fail("Некорректный "+k);
if(!["base","art_shelter","art_response","sava_tempo"].includes(c.opt.trust))fail("Неизвестная специализация");
if(Object.keys(c.opt).some(k=>!(k in d.opt)))fail("Неизвестный параметр");
return {version:1,team:[...c.team],enemyTeam:[...c.enemyTeam],mode:c.mode,seed:c.seed,playerAI:c.playerAI,enemyAI:c.enemyAI,opt:c.opt};
}
function create(config){
const c=validate(config),L=make(),s=L.fresh(c.team,c.mode,{...c.opt,enemyTeam:c.enemyTeam}),log=[],commands=[];let rng=c.seed>>>0;
const name=x=>names[x.id]||x.id;
function advance(){if(s.active===-1&&!s.reason)L.next(s);return s;}
function step(o){
if(s.reason||s.active<0)throw Error("Нет активного хода");
const a=s.f[s.active],b=s.f[o.b];if(!L.enumerate(s).some(x=>x.k===o.k&&x.j===o.j&&x.b===o.b&&x.v===o.v))throw Error("Недоступное действие");
const before=s.f.map(x=>({hp:x.hp,mark:x.mark,guard:x.guard,charge:x.charge,meter:x.meter})),stats={...s.stats},t=s.t;
rng=(Math.imul(1664525,rng)+1013904223)>>>0;const roll=.9+.2*rng/4294967296;
L.act(s,o,roll);commands.push({...o});
const changes=s.f.flatMap((x,i)=>{const p=before[i],out=[];if(Math.abs(x.hp-p.hp)>1e-6)out.push(name(x)+" HP "+(x.hp>p.hp?"+":"")+(x.hp-p.hp).toFixed(1));for(const [k,label] of [["mark","уязвимость"],["guard","прикрытие"],["charge","подготовка"]])if(JSON.stringify(x[k])!==JSON.stringify(p[k]))out.push(name(x)+": "+label+" "+(x[k]?"установлено":"снято"));if(Math.abs(x.meter-p.meter)>1e-6)out.push(name(x)+": инициатива "+(x.meter-p.meter).toFixed(0));return out});
for(const k of Object.keys(stats))if(s.stats[k]!==stats[k])changes.push(k+" +"+(s.stats[k]-stats[k]).toFixed(1));
log.push({t,actor:name(a),action:kinds[o.k],target:name(b),roll:+roll.toFixed(5),base:+(a.atk*o.v).toFixed(2),changes});
return advance();
}
function auto(){const a=s.f[s.active];if(!a||s.reason)return s;const p=a.side===0?c.playerAI:c.enemyAI;return step(p==="rollout"?L.rollout(s):L.pick(s,p));}
function legal(){return s.active<0||s.reason?[]:L.enumerate(s);}
function queue(){if(s.reason)return [];const f=s.f.filter(x=>x.hp>0&&x.speed>0);let q=f.map(x=>({i:x.i,dt:Math.max(0,1000-x.meter)/x.speed})),out=[];for(let j=0;j<8&&q.length;j++){q.sort((a,b)=>a.dt-b.dt||a.i-b.i);let x=q[0];out.push(x.i);x.dt+=1000/s.f[x.i].speed;}return out;}
function result(){const hp=s.f.slice(0,s.n).reduce((a,x)=>a+x.hp,0)/s.f.slice(0,s.n).reduce((a,x)=>a+x.max,0);const escort=s.escort>=0?s.f[s.escort].hp:null;return {reason:s.reason,win:s.reason==="win",quality:s.reason==="win"&&(s.mode==="hold"?escort>=90:s.mode==="intercept"?hp>=.7:hp>=.35),hp,escort,actions:s.actions,time:s.t,blocked:s.blocked,stats:{...s.stats}};}
advance();
return {config:c,state:s,legal,step,auto,queue,result,log,commands};
}
function run(config){const x=create(config);while(!x.state.reason)x.auto();return x.result();}
function summarize(rows){if(!rows.length)throw Error("Пустая серия");const median=k=>{const v=rows.map(x=>x[k]).sort((a,b)=>a-b),m=Math.floor(v.length/2);return (v[m]+v[Math.floor((v.length-1)/2)])/2;};return {n:rows.length,wins:rows.filter(x=>x.win).length,quality:rows.filter(x=>x.quality).length,limits:rows.filter(x=>x.reason==="limit").length,medianHp:median("hp"),medianActions:median("actions"),medianTime:median("time"),medianEscort:rows[0].escort===null?null:median("escort"),medianBlocks:median("blocked")};}
return {heroes,foes,policies,presets,names,kinds,defaults,validate,create,run,summarize};
});