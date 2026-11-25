/* AUD003-B12 — browser/Node adapter. V11 is the sole rules authority. */
(function(root,factory){if(typeof module==="object"&&module.exports)module.exports=factory(require("../docs/research/aud003-combat-lab-v11.js"));else root.CombatLabSession=factory(root.labV11);})(typeof globalThis!=="undefined"?globalThis:this,function(make){
"use strict";
const heroes=["ren","art","nada","liora","sava","medic","ranger","breaker"];
const foes=["guard","charger","healer","captain","raider"];
const policies=["basic","greedy","tactical","rollout"];
const presets={mixed:["guard","charger","healer","raider","raider"],rush:["raider","raider","raider","charger","raider"],telegraph:["charger","charger","raider","guard","healer"],defensive:["guard","guard","healer","healer","charger"],intercept:["captain","guard","healer","raider","charger"]};
const names={ren:"Рен",art:"Арт",nada:"Нада",liora:"Лиора",sava:"Сава",medic:"Медик",ranger:"Стрелок",breaker:"Боец срыва",guard:"Страж",charger:"Тяжёлый боец",healer:"Лекарь",captain:"Курьер",raider:"Налётчик",escort:"Подопечный"};
const kinds={hit:"Удар",mark:"Уязвимость",execute:"Сильный удар",cover:"Прикрытие",teamcover:"Защита отряда",disrupt:"Срыв",signal:"Координация",assist:"Совместная атака",heal:"Восстановление",teamheal:"Лечение отряда",tempo:"Инициатива",charge:"Подготовить атаку",resolve:"Завершить действие",escape:"Подготовить побег"};
const skillKinds=["hit","mark","execute","cover","teamcover","disrupt","signal","assist","heal","teamheal","tempo","charge"];
const defaults=()=>({version:1,team:["ren","art","nada"],enemyTeam:["guard","charger","healer"],mode:"assault",seed:12345,playerAI:"tactical",enemyAI:"tactical",opt:{eatk:.78,ehp:1,aspeed:1,espeed:1,speedScale:1,holdTime:25,interceptTime:34,blocksNeeded:2,escapeThreshold:55,depth:4,horizon:0,trust:"base",diverse:true,noMark:false,noReply:false,noTempo:false,pureSignal:false}});
function validate(raw){
const d=defaults(),c={...d,...raw,opt:{...d.opt,...raw?.opt}};
const fail=m=>{throw Error(m)};
if(c.version!==1||!Array.isArray(c.team)||c.team.length<2||c.team.length>5||new Set(c.team).size!==c.team.length||c.team.some(x=>!heroes.includes(x)))fail("Выберите 2–5 разных героев");
if(!Array.isArray(c.enemyTeam)||c.enemyTeam.length<1||c.enemyTeam.length>c.team.length||c.enemyTeam.some(x=>!foes.includes(x)))fail("Выберите 1–N противников (N — размер отряда)");
if(!["assault","hold","intercept","waves","boss"].includes(c.mode)||c.mode==="intercept"&&c.enemyTeam[0]!=="captain")fail("Для перехвата первым должен быть курьер");
if(!Number.isInteger(c.seed)||c.seed<0||c.seed>4294967295||!policies.includes(c.playerAI)||!policies.includes(c.enemyAI))fail("Некорректный seed или ИИ");
const ranges={eatk:[.25,2],ehp:[.25,3],aspeed:[.5,1.5],espeed:[.5,1.5],speedScale:[0,1],holdTime:[5,100],interceptTime:[5,100],blocksNeeded:[1,5],escapeThreshold:[1,300],depth:[1,8],horizon:[0,30]};
for(const [k,[lo,hi]] of Object.entries(ranges)){const v=c.opt[k];if(!Number.isFinite(v)||v<lo||v>hi||["blocksNeeded","depth"].includes(k)&&!Number.isInteger(v))fail("Некорректный параметр "+k)}
for(const k of ["diverse","noMark","noReply","noTempo","pureSignal"])if(typeof c.opt[k]!=="boolean")fail("Некорректный "+k);
if(!["base","art_shelter","art_response","sava_tempo"].includes(c.opt.trust))fail("Неизвестная специализация");
if(Object.keys(c.opt).some(k=>!(k in d.opt)))fail("Неизвестный параметр");
let ext=null;
if(c.ext!=null){const x=c.ext;if(typeof x!=="object"||Array.isArray(x))fail("Некорректные расширения");
ext={units:{},waves:[],openingGuard:x.openingGuard??0,tie:x.tie??"slot",trust:{art:x.trust?.art??(["art_shelter","art_response"].includes(c.opt.trust)?c.opt.trust:"base"),sava:x.trust?.sava??(c.opt.trust==="sava_tempo"?"sava_tempo":"base")},strictBasic:true,maxTurns:x.maxTurns??180,maxTime:x.maxTime??160,bossPhase:{enabled:x.bossPhase?.enabled??false,threshold:x.bossPhase?.threshold??.5,protection:x.bossPhase?.protection??.2,atk:x.bossPhase?.atk??1.2}};
if(!Number.isFinite(ext.openingGuard)||ext.openingGuard<0||ext.openingGuard>.5||!["slot","seeded"].includes(ext.tie))fail("Некорректная стартовая защита или tie");
for(const id of ["ren","nada","liora"])ext.trust[id]=x.trust?.[id]??"base";
if(!Number.isInteger(ext.maxTurns)||ext.maxTurns<60||ext.maxTurns>600||!Number.isFinite(ext.maxTime)||ext.maxTime<50||ext.maxTime>600)fail("Некорректный лимит боя");
const phase=ext.bossPhase;if(typeof phase.enabled!=="boolean"||!Number.isFinite(phase.threshold)||phase.threshold<.1||phase.threshold>.9||!Number.isFinite(phase.protection)||phase.protection<0||phase.protection>1||!Number.isFinite(phase.atk)||phase.atk<.5||phase.atk>3)fail("Некорректная фаза босса");
if(c.mode!=="boss")phase.enabled=false;
for(const [id,values] of Object.entries({art:["base","art_shelter","art_response"],sava:["base","sava_tempo"],ren:["base","ren_precision"],nada:["base","nada_observe"],liora:["base","liora_formation"]})){if(!values.includes(ext.trust[id]))fail("Некорректное доверие "+id);}
for(const [slot,u] of Object.entries(x.units||{})){if(!/^[ae][0-4]$/.test(slot)||!u||typeof u!=="object")fail("Некорректный слот");let z={};for(const [k,lo,hi] of [["hp",.25,8],["atk",.25,4],["speed",.5,1.5],["armor",0,.75],["protection",0,2],["passivePower",0,.15]])if(u[k]!==undefined){if(!Number.isFinite(u[k])||u[k]<lo||u[k]>hi)fail("Некорректный "+slot+" "+k);z[k]=u[k];}
if(u.passive!==undefined){if(!["none","recover","opening"].includes(u.passive))fail("Некорректная пассивка");z.passive=u.passive;}
if(u.skills!==undefined){if(!Array.isArray(u.skills)||u.skills.length!==3)fail("Нужно три способности");z.skills=u.skills.map((a,i)=>{if(a===null)return null;if(!Array.isArray(a)||!skillKinds.includes(a[0])||i===0&&!["hit","mark","execute","disrupt","signal","assist"].includes(a[0])||!Number.isFinite(a[1])||a[1]<.1||a[1]>4||i>0&&(!Number.isInteger(a[2])||a[2]<1||a[2]>8))fail("Некорректная способность "+slot);return i?[a[0],a[1],a[2]]:[a[0],a[1]];});}ext.units[slot]=z;}
if(x.waves!==undefined){if(!Array.isArray(x.waves)||x.waves.length>3||x.waves.some(w=>!Array.isArray(w)||w.length<1||w.length>c.team.length||w.some(id=>!foes.includes(id))))fail("Некорректные волны");ext.waves=x.waves.map(w=>[...w]);}
}
if(c.mode==="waves"&&(!ext||!ext.waves.length))fail("Добавьте хотя бы одну будущую волну");
if(c.mode!=="waves"&&ext)ext.waves=[];
return {version:1,team:[...c.team],enemyTeam:[...c.enemyTeam],mode:c.mode,seed:c.seed,playerAI:c.playerAI,enemyAI:c.enemyAI,opt:c.opt,...(ext?{ext}:{})};
}
function create(config,{capture=true}={}){
const c=validate(config),L=make(),engineMode=["waves","boss"].includes(c.mode)?"assault":c.mode,s=L.fresh(c.team,engineMode,{...c.opt,enemyTeam:c.enemyTeam,...(c.ext?{lab:{...c.ext,seed:c.seed}}:{}),trace:capture}),log=[],commands=[];let rng=c.seed>>>0,eventCursor=0;
const name=x=>names[x.id]||x.id;
function advance(){if(s.active===-1&&!s.reason)L.next(s);return s;}
function step(o){
if(s.reason||s.active<0)throw Error("Нет активного хода");
const a=s.f[s.active],b=s.f[o.b];if(!L.enumerate(s).some(x=>x.k===o.k&&x.j===o.j&&x.b===o.b&&x.v===o.v))throw Error("Недоступное действие");
const before=capture?s.f.map(x=>({id:x.id,hp:x.hp,protection:x.protection||0,mark:x.mark,guard:x.guard,charge:x.charge,meter:x.meter})):null,stats={...s.stats},t=s.t,wave=s.wave;
rng=(Math.imul(1664525,rng)+1013904223)>>>0;const roll=.9+.2*rng/4294967296;
L.act(s,o,roll);if(!capture)return advance();commands.push({...o});
const changes=s.f.flatMap((x,i)=>{const p=before[i],out=[];if(!p||wave!==s.wave&&x.side){return [name(x)+": новая волна"]}if(Math.abs((x.protection||0)-p.protection)>1e-6)out.push(name(x)+" Protection "+((x.protection||0)-p.protection).toFixed(1));if(Math.abs(x.hp-p.hp)>1e-6)out.push(name(x)+" HP "+(x.hp>p.hp?"+":"")+(x.hp-p.hp).toFixed(1));for(const [k,label] of [["mark","уязвимость"],["guard","прикрытие"],["charge","подготовка"]])if(JSON.stringify(x[k])!==JSON.stringify(p[k]))out.push(name(x)+": "+label+" "+(x[k]?"установлено":"снято"));if(Math.abs(x.meter-p.meter)>1e-6)out.push(name(x)+": инициатива "+(x.meter-p.meter).toFixed(0));return out});
for(const k of Object.keys(stats))if(s.stats[k]!==stats[k])changes.push(k+" +"+(s.stats[k]-stats[k]).toFixed(1));
advance();const events=s.events.slice(eventCursor);eventCursor=s.events.length;
log.push({t,actor:name(a),action:kinds[o.k],target:name(b),roll:+roll.toFixed(5),base:+(a.atk*o.v).toFixed(2),changes,events});
return s;
}
function auto(){const a=s.f[s.active];if(!a||s.reason)return s;const p=a.side===0?c.playerAI:c.enemyAI;if(p==="basic"&&a.side===1&&!c.ext){const z=L.copy(s);z.f[z.active].cd[1]=z.f[z.active].cd[2]=999;return step(L.pick(z,p));}return step(p==="rollout"?L.rollout(s):L.pick(s,p));}
function legal(){return s.active<0||s.reason?[]:L.enumerate(s);}
function queue(){if(s.reason)return [];const f=s.f.filter(x=>x.hp>0&&x.speed>0);let q=f.map(x=>({i:x.i,dt:Math.max(0,1000-x.meter)/x.speed})),out=[];for(let j=0;j<8&&q.length;j++){q.sort((a,b)=>a.dt-b.dt||L.tie(s,s.f[a.i],s.f[b.i]));let x=q[0];out.push(x.i);x.dt+=1000/s.f[x.i].speed;}return out;}
function result(){const hp=s.f.slice(0,s.n).reduce((a,x)=>a+x.hp,0)/s.f.slice(0,s.n).reduce((a,x)=>a+x.max,0);const escort=s.escort>=0?s.f[s.escort].hp:null;return {reason:s.reason,win:s.reason==="win",quality:s.reason==="win"&&(s.mode==="hold"?escort>=90:s.mode==="intercept"?hp>=.7:hp>=.35),hp,escort,actions:s.actions,time:s.t,blocked:s.blocked,stats:{...s.stats}};}
advance();
return {config:c,state:s,legal,step,auto,queue,result,log,commands,preview:o=>L.preview(s,o),forecast:(depth=4)=>L.counterfactual(s,depth)};
}
function run(config){const x=create(config,{capture:false});while(!x.state.reason)x.auto();return x.result();}
function summarize(rows){if(!rows.length)throw Error("Пустая серия");const median=k=>{const v=rows.map(x=>x[k]).sort((a,b)=>a-b),m=Math.floor(v.length/2);return (v[m]+v[Math.floor((v.length-1)/2)])/2;};return {n:rows.length,wins:rows.filter(x=>x.win).length,quality:rows.filter(x=>x.quality).length,limits:rows.filter(x=>x.reason==="limit").length,medianHp:median("hp"),medianActions:median("actions"),medianTime:median("time"),medianEscort:rows[0].escort===null?null:median("escort"),medianBlocks:median("blocked")};}
function baseUnit(id){const x=make().fresh([id],"assault",{enemyTeam:["guard"]}).f[0];return {hp:x.max,atk:x.atk,speed:x.speed,skills:x.skills};}
return {heroes,foes,policies,presets,names,kinds,skillKinds,baseUnit,defaults,validate,create,run,summarize};
});