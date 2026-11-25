(()=>{"use strict";
const $=id=>document.getElementById(id),E=B15D,labels={starter:"Рен + Арт · 2",three:"Рен + Арт + Нада · 3",tempo:"Рен + Арт + Сава · 3",support:"Арт + Нада + Сава · 3",four:"Четыре героя",full:"Все пять героев",alternative:"Без Рена · тестовая роль*",independent:"Без Рена и Нады · роли*"};
let input,cal,ctx,b,opts,enemy=-1,ally=-1,history=[],traceCursor=0,auto=false,timer=null,lastStats={};
const cache=new Map(),pct=(v,m)=>Math.max(0,Math.min(100,100*v/Math.max(1,m))),make=(tag,t,c)=>{const el=document.createElement(tag);if(t!==undefined)el.textContent=t;if(c)el.className=c;return el;};
function context(v){if(!cache.has(v)){if(cache.size>=4)cache.delete(cache.keys().next().value);cache.set(v,E.setup(input,v));}return cache.get(v);}
function chooseSelect(el,values,initial){for(const [value,label] of Object.entries(values)){const o=make("option",label);o.value=value;el.append(o);}el.value=initial;}
function stop(){auto=false;if(timer!==null)clearTimeout(timer);timer=null;$("autorun").textContent="Автобой";}
function valid(i,side){return Number.isInteger(i)&&b?.fighters[i]?.side===side&&b.fighters[i].hp>0;}
function selection(){if(!valid(enemy,"enemy"))enemy=b.fighters.findIndex(f=>f.side==="enemy"&&f.hp>0);if(!valid(ally,"ally")||ally===b.currentActor){const a=b.fighters.flatMap((f,i)=>f.side==="ally"&&f.hp>0&&i!==b.currentActor?[i]:[]);a.sort((i,j)=>b.fighters[j].physicalAttack-b.fighters[i].physicalAttack||i-j);ally=a[0]??-1;}}
function bar(v,m,c){const d=make("div",undefined,"bar "+c),i=make("i");i.style.width=pct(v,m)+"%";d.append(i);return d;}
function title(id){return b.fighters.find(f=>f.id===id)?.name??id??"";}
function record(){
 const threat=b.b14Trace??[];history.push(...threat.slice(traceCursor));traceCursor=threat.length;
 for(const e of b.events){if(e.type==="ability"){const f=b.fighters.find(f=>f.id===e.actorId);history.push(title(e.actorId)+" · "+(f?ctx.api.D.get(f,e.abilityId)?.name??e.abilityId:e.abilityId)+" → "+title(e.targetId));}
  if(e.type==="damage")history.push((e.assist?"Помощь · ":"")+title(e.actorId)+" → "+title(e.targetId)+": "+(e.hpDamage??e.amount)+" HP, "+(e.protectionDamage??0)+" Protection");
  if(e.type==="b15-meter")history.push("Инициатива "+title(e.targetId)+" +"+Math.round(e.amount)+(e.cross?" · раньше угрозы":""));
  if(e.type==="read-move-predicted")history.push("Наблюдение: атака ослаблена");
  if(e.type==="miss")history.push("Промах: "+title(e.actorId));
  if(e.type==="status-resisted")history.push("Сопротивление: "+title(e.targetId));
  if(e.type==="death")history.push(title(e.targetId)+" выбыл");
  if(e.type==="wave-start")history.push("— Волна "+e.wave+" —");
 }
 const keys={artGuardBlocked:"Арт · прикрытие",artReactBlocked:"Арт · предотвращённый HP урон (расход Protection)",artRestored:"Арт · восстановлено Protection",lioraGuardBlocked:"Лиора · прикрытие",lioraPassiveUsed:"Лиора · экстренный щит",assistCapped:"Сава · ограничение помощи",boostSpent:"Сава · усиленный сигнал"};
 for(const [key,label] of Object.entries(keys)){const delta=(b.b15Stats?.[key]??0)-(lastStats[key]??0);if(delta>0)history.push(label+": "+Math.round(delta));}
 lastStats={...b.b15Stats};history=history.slice(-500);
}
function options(){return {variant:$("variant").value,tier:$("tier").value,squad:$("squad").value,scenario:$("scenario").value,difficulty:$("difficulty").value,order:$("order").value,leader:$("leader").checked,seed:Number($("seed").value)};}
function start(o){
 stop();$("error").textContent="";const next=context(o.variant),scale=E.pressure(cal,o.tier,o.squad,o.scenario,o.difficulty)*(o.scenario==="hold"&&o.squad==="support"&&o.difficulty==="normal"?.70:1);
 const nextOpts={...o,scale},nextBattle=E.create(next,nextOpts);
 ctx=next;opts=nextOpts;b=nextBattle;enemy=ally=-1;history=[];traceCursor=0;lastStats={};record();$("feedback").textContent="Выбери цель, затем способность.";render();
}
function details(f){
 const parts=[],T=ctx.api.T,marks=T.read(f,"read-move")?.stacks??0,taunt=T.read(f,"taunt")?.remaining??0,slow=T.read(f,"slowed");
 if(marks)parts.push("Зацепки ×"+marks);
 if(f.guardHits)parts.push("Щит ×"+f.guardHits);
 for(const g of f.b15Guards??[])parts.push((g.kind==="art"?"Арт":"Лиора")+" ×"+g.hits+" / "+g.turns+"х");
 if(taunt)parts.push("Провокация "+taunt+"х");
 if(f.weakenAttacks)parts.push("Ослаблен ×"+f.weakenAttacks);
 if(slow)parts.push("Замедлен");
 if(f.b15SignalBoost)parts.push("Сигнал +"+f.b15SignalBoost);
 if(f.b14Prepared)parts.push("⚠ "+title(f.b14Prepared));
 return parts.join(" · ")||" ";
}
function describe(a,d,id){
 const en=title(b.fighters[enemy]?.id),al=title(b.fighters[ally]?.id);
 if(d.b15Assist)return en+" + "+(al||"выбери помощника");
 if(d.b15Signal){if(!valid(ally,"ally"))return "Выбери союзника";const p=ctx.api.C.b15preview(b,a,d.signalMeter+(a.b15SignalBoost??0),b.fighters[ally]);return "+"+Math.round(p.gain)+" → "+al+(p.cross?" · раньше врага":"");}
 if(a.id==="sava"&&id==="special"&&ctx.variant!=="legacy")return "Вместе с "+(al||"союзником")+" → "+en;
 if(d.b15Guard)return (d.target==="all-allies"?"Отряд":d.target==="self"?"Себя":al)+" · "+d.b15Guard.hits+" заряд.";
 if(d.b15Disrupt)return (b.fighters[enemy]?.b14Prepared?"Срыв: ":"Ослабить: ")+en;
 if(d.target==="self")return "На себя";
 if(d.target==="all-allies")return "На весь отряд";
 if(d.target==="all-enemies")return "Все противники";
 if(d.target==="ally")return al||"Выбери союзника";
 return en||"Выбери противника";
}
function render(){
 selection();const a=b.fighters[b.currentActor];
 $("scenarioLabel").textContent=E.VARIANTS[opts.variant].label+" · "+E.TIER_LABEL[opts.tier]+" · "+E.SCENARIOS[opts.scenario].label+" · волна "+b.wave+"/"+b.totalWaves;
 $("turn").textContent=b.active?"Ход: "+a.name:b.winner==="ally"?"ПОБЕДА":"ПОРАЖЕНИЕ";
 $("allies").replaceChildren();$("enemies").replaceChildren();
 for(const [i,f] of b.fighters.entries()){
  const selected=i===(f.side==="ally"?ally:enemy),el=make("button",undefined,"unit"+(selected?" selected":"")+(i===b.currentActor?" active":"")+(f.hp<=0?" dead":"")+(f.b14Prepared&&f.hp>0?" threat":""));
  el.dataset.id=f.id;el.disabled=f.hp<=0||!b.active||auto;el.setAttribute("aria-pressed",String(selected));el.setAttribute("aria-label",f.name+", "+f.hp+" HP, "+f.protection+" Protection, "+details(f));
  el.append(make("b",f.name),make("small",f.hp+"/"+f.maxHp+" · "+f.protection+" щ"));
  const bars=make("div",undefined,"bars");bars.append(bar(f.hp,f.maxHp,"hp"),bar(f.protection,f.maxProtection,"prot"),bar(f.meter,1000,"meter"));el.append(bars,make("div",details(f),"state"));
  el.onclick=()=>{if(f.side==="ally")ally=i;else enemy=i;render();};$(f.side==="ally"?"allies":"enemies").append(el);
 }
 for(const [side,id] of [["ally","allyCount"],["enemy","enemyCount"]]){const units=b.fighters.filter(f=>f.side===side);$(id).textContent=units.filter(f=>f.hp>0).length+"/"+units.length;}
 const taunter=b.fighters.find(f=>f.side==="ally"&&f.hp>0&&ctx.api.T.read(f,"taunt"));
 const threats=b.fighters.filter(f=>f.side==="enemy"&&f.hp>0&&f.b14Prepared).map(f=>f.name+" → "+title(f.b14Prepared)+(taunter&&taunter.id!==f.b14Prepared?" (провокация: "+taunter.name+")":""));
 $("threat").textContent=threats.length?"⚠ "+threats.join(" · "):b.tacticalObjective?.kind==="hold-or-defeat"?"Удержать "+title(b.tacticalObjective.protectAllyId)+" · "+Math.min(b.allyActions,8)+"/8":b.tacticalObjective?.kind==="priority-first"&&!b.priorityCleared?"Сначала "+title(b.tacticalObjective.priorityEnemyId):"Нет объявленных атак";
 $("skills").replaceChildren();
 if(b.active&&a){
  for(const id of ["basic","special","powerful"]){
   const d=ctx.api.D.get(a,id),button=make("button");button.dataset.ability=id;
   if(!d){button.disabled=true;button.textContent="Недоступно";$("skills").append(button);continue;}
   const target=d.target==="self"||d.target==="all-allies"?b.currentActor:d.target==="ally"?ally:enemy,cd=id==="special"?a.specialCooldown:id==="powerful"?a.powerfulCooldown:0;
   button.append(make("b",(id==="basic"?"Б · ":id==="special"?"С · ":"М · ")+d.name+(cd?" · "+cd+"х":"")),make("small",describe(a,d,id)));
   button.disabled=auto||!E.legal(ctx,b,id,target,ally,enemy);button.onclick=()=>command({abilityId:id,targetIndex:target,helper:ally,enemy});$("skills").append(button);
  }
 }else{const end=make("button",b.winner==="ally"?"Победа · начать заново":"Поражение · попробовать снова","primary");end.style.gridColumn="1/-1";end.onclick=()=>start(opts);$("skills").append(end);}
 if(b.active){const state=b.fighters.filter(f=>f.hp>0).map(f=>({...f,meter:f.id===a.id?Math.max(0,f.meter-1000):f.meter})),next=[];for(let i=0;i<3;i++){const n=ctx.api.I.nextActor(state,f=>ctx.api.C.effectiveStat(b,f,"speed"));if(!n)break;next.push(title(n.id));ctx.api.I.finishTurn(state,n.id);}$("choice").textContent="Далее без новых эффектов: "+next.join(" → ");}else $("choice").textContent="Без наград и сохранений";
 $("autostep").disabled=!b.active||auto;$("autorun").disabled=!b.active;$("restart").disabled=false;$("compare").disabled=false;
 if(!b.active)stop();
}
function command(p){
 if(!b.active)return false;
 try{if(!E.step(ctx,b,p.abilityId,p.targetIndex,p.helper,p.enemy)){$("error").textContent="Действие недоступно";return false;}
  record();$("feedback").textContent=b.message+(b.active?"":" · "+b.allyActions+" действий");$("error").textContent="";render();return true;
 }catch(err){stop();$("error").textContent=String(err.message??err);render();return false;}
}
function tick(){if(!auto||!b.active){stop();render();return;}if(b.allyActions>=240){stop();render();$("error").textContent="Предел исследовательского автобоя: 240 действий";return;}const p=E.plan(ctx,b);if(!command(p)){stop();render();return;}if(auto&&b.active)timer=setTimeout(tick,100);else{stop();render();}}
$("autostep").onclick=()=>{if(!auto&&b?.active)command(E.plan(ctx,b));};$("autorun").onclick=()=>{if(auto){stop();render();return;}if(b?.active){auto=true;$("autorun").textContent="Стоп";render();tick();}};
$("restart").onclick=()=>{if(opts)start(opts);};$("setupbtn").onclick=()=>{stop();if(b)render();$("setup").showModal();};$("start").onclick=()=>{try{$("setupError").textContent="";if(!$("seed").checkValidity()||$("seed").value==="")throw Error("Seed — целое число от 0 до 4294967295");start(options());$("setup").close();}catch(e){$("setupError").textContent=e.message;}};
$("journalbtn").onclick=()=>{stop();if(b)render();$("loglist").textContent=history.join("\n")||"Пока нет действий.";$("journal").showModal();};
document.querySelectorAll("[data-close]").forEach(button=>button.onclick=()=>$(button.dataset.close).close());
$("compare").onclick=()=>{if(!opts)return;stop();render();const rows=$("compareRows");rows.replaceChildren();$("comparison").showModal();try{for(const id of [...new Set(["ref","sava","art-only",opts.variant])]){
 const result=E.run(context(id),opts,"tactical"),el=make("div",undefined,"compareRow");el.append(make("b",E.VARIANTS[id].label),make("span",(result.w?"Победа":"Поражение")+(result.q?" · без потерь":"")+" · "+Math.round(result.pool*100)+"% ресурса · "+result.actions+" действий"));rows.append(el);}
 }catch(e){rows.append(make("p",e.message));}};
async function boot(){try{
 const get=async name=>{const res=await fetch(name,{cache:"no-cache"});if(!res.ok)throw Error(name+" "+res.status);return res.json();};
 const [a,p,c]=await Promise.all([get("source-snapshot.json"),get("parts-snapshot.json"),get("calibration.json")]);if(a.baseCommit!==p.baseCommit||a.baseCommit!==c.baseCommit)throw Error("Несовместимые снимки ядра");
 input=E.loadSources(a.labSource,a.source,a.extra,p.parts);cal=c.selected;
 chooseSelect($("variant"),Object.fromEntries(["ref","sava","art-only","full","bridge","recover","scaled","scaled-group","liora-only","bridge-noshare","recover-nopassive","legacy"].map(id=>[id,E.VARIANTS[id].label])),"sava");
 chooseSelect($("tier"),E.TIER_LABEL,"early");chooseSelect($("squad"),labels,"full");chooseSelect($("scenario"),Object.fromEntries(Object.entries(E.SCENARIOS).map(([k,v])=>[k,v.label])),"duel");
 $("squad").onchange=()=>{const ok=E.SQUADS[$("squad").value].includes("liora");$("leader").disabled=!ok;if(!ok)$("leader").checked=false;};$("squad").onchange();start(options());document.documentElement.dataset.ready="true";
 }catch(e){$("scenarioLabel").textContent="Ошибка загрузки";$("error").textContent=e.message;document.documentElement.dataset.ready="error";}}
 boot();
})();