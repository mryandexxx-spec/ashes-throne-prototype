(()=>{"use strict";
const $=id=>document.getElementById(id);
let source,api,b,mode,enemy,ally,history=[],traceCount=0;
const label={rush:"Штурм",mixed:"Смешанный отряд",hold:"Удержать подопечного",priority:"Сначала лекарь"};
const pct=(x,m)=>Math.max(0,Math.min(100,100*x/Math.max(m,1)));
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
function bar(v,m,kind){const d=node("div",undefined,"bar "+kind);const i=node("i");i.style.width=pct(v,m)+"%";d.append(i);return d;}
function live(i,side){return Number.isInteger(i)&&b.fighters[i]?.side===side&&b.fighters[i].hp>0;}
function selected(){if(!live(enemy,"enemy"))enemy=b.fighters.findIndex(f=>f.side==="enemy"&&f.hp>0);if(!live(ally,"ally")||ally===b.currentActor)ally=b.fighters.findIndex((f,i)=>f.side==="ally"&&f.hp>0&&i!==b.currentActor);}
function record(){const trace=b.b14Trace??[];if(mode==="visible")history.push(...trace.slice(traceCount));traceCount=trace.length;for(const e of b.events){const name=id=>b.fighters.find(f=>f.id===id)?.name??id??"";if(e.type==="damage")history.push(name(e.actorId)+" → "+name(e.targetId)+": "+e.amount+" урона");if(e.type==="death")history.push(name(e.targetId)+" выбыл");if(e.type==="heal")history.push(name(e.targetId)+": +"+e.amount+" HP");}history=history.slice(-250);}
function description(f,id,d){if(f.id==="sava"&&id==="special")return "Сава + "+(b.fighters[ally]?.name??"выбери союзника")+" → "+(b.fighters[enemy]?.name??"выбери врага");if(f.id==="art"&&id==="special")return "Прикрыть "+(b.fighters[ally]?.name??"союзника");if(f.id==="art"&&id==="powerful")return "Удар и срыв подготовки";if(f.id==="nada")return "Наблюдение · особая связь с Реном";if(d.target==="all-enemies")return "Все противники";if(d.target==="all-allies")return "Вся команда";if(d.target==="self")return "На себя";if(d.target==="ally")return b.fighters[ally]?.name??"Выбери союзника";return b.fighters[enemy]?.name??"Выбери врага";}
function render(){
 selected();const actor=b.fighters[b.currentActor];$("turn").textContent=b.active?"Ход: "+actor.name:b.winner==="ally"?"Победа":"Поражение";
 $("objective").textContent=label[$("scenario").value]+(b.tacticalObjective?.kind==="hold-or-defeat"?" · "+Math.min(8,b.allyActions)+"/8":"")+(b.tacticalObjective?.kind==="priority-first"?(b.priorityCleared?" · цель устранена":" · лекарь первым"):"");
 $("allies").replaceChildren();$("enemies").replaceChildren();
 b.fighters.forEach((f,i)=>{const box=node("button",undefined,"unit"+(i===b.currentActor?" active":"")+(i===(f.side==="ally"?ally:enemy)?" selected":"")+(f.hp<=0?" dead":"")+(mode==="visible"&&f.b14Prepared&&f.hp>0?" threat":""));
 box.disabled=f.hp<=0||!b.active;box.setAttribute("aria-pressed",String(i===(f.side==="ally"?ally:enemy)));box.append(node("b",f.name),node("small",f.hp+"/"+f.maxHp+" · "+f.protection+" щ."));
 const bars=node("div",undefined,"bars");bars.append(bar(f.hp,f.maxHp,"hp"),bar(f.protection,f.maxProtection,"prot"),bar(f.meter,1000,"meter"));box.append(bars);
 const marks=api.T.read(f,"read-move")?.stacks??0;const detail=[];if(marks)detail.push("Зацепки "+marks);if(f.guardHits)detail.push("Прикрытие "+f.guardHits);if(api.T.read(f,"taunt"))detail.push("Провокация");if(mode==="visible"&&f.b14Prepared&&f.hp>0)detail.push("Готовит удар → "+(b.fighters.find(x=>x.id===f.b14Prepared)?.name??"цель"));if(detail.length)box.append(node("span",detail.join(" · "),"warn"));
 box.onclick=()=>{if(f.side==="ally")ally=i;else enemy=i;render();};$(f.side==="ally"?"allies":"enemies").append(box);});
 const threats=mode==="visible"?b.fighters.filter(f=>f.hp>0&&f.b14Prepared).map(f=>f.name+" → "+(b.fighters.find(x=>x.id===f.b14Prepared)?.name??"цель")+" · следующий ход"):[];
 $("threat").textContent=threats.length?"⚠ "+threats.join("  /  "):"";
 $("skills").replaceChildren();if(!b.active){const again=node("button","Повторить бой");again.onclick=start;$("skills").append(again);return;}
 for(const id of ["basic","special","powerful"]){const d=api.D.get(actor,id);if(!d)continue;let t=d.target==="self"||d.target==="all-allies"?b.currentActor:d.target==="ally"?ally:enemy;
 const button=node("button",actor.id==="sava"&&id==="special"?"Совместный удар":actor.id==="art"&&id==="special"?"Прикрытие":d.name);button.append(node("small",description(actor,id,d)));
 button.disabled=!api.C.abilityReady(b,id)||(d.target==="ally"&&(!live(t,"ally")||((actor.id==="art"||actor.id==="sava")&&t===b.currentActor)))||((d.target==="enemy"||d.target==="all-enemies")&&!live(t,"enemy"));
 button.onclick=()=>{try{$("error").textContent="";if(!api.step(api,b,id,t,live(enemy,"enemy")?enemy:undefined))throw Error("Выбранное действие недоступно");record();$("feedback").textContent=b.message??"";render();}catch(e){$("error").textContent=e.message;}};$("skills").append(button);}
}
function start(){try{if(!source)return;const seed=Number($("seed").value);if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error("Seed должен быть целым от 0 до 4294967295");mode=$("mode").value;api=B146.make(source,mode);b=B146.start(api,B146.squads[Number($("squad").value)],$("scenario").value,seed);enemy=ally=-1;history=[];traceCount=0;record();$("feedback").textContent="Выбери цель и навык. Синяя полоска — защита, золотая — инициатива.";$("error").textContent="";if($("setup").open)$("setup").close();render();}catch(e){$("error").textContent=e.message;if($("setup").open)$("setup").close();}}
B146.squads.forEach((s,i)=>{const o=node("option",s.map(id=>B146.names[id]).join(" · "));o.value=i;$("squad").append(o);});
$("setupbtn").onclick=()=>$("setup").showModal();$("close").onclick=()=>$("setup").close();$("start").onclick=start;$("restart").onclick=start;$("logbtn").onclick=()=>{$("loglist").replaceChildren(...history.map(s=>node("div",s)));$("journal").showModal();};$("logclose").onclick=()=>$("journal").close();
B146.load().then(s=>{source=s;start();}).catch(e=>{$("error").textContent="Не удалось загрузить ядро: "+e.message;$("objective").textContent="Ошибка загрузки";});
})();