(()=>{"use strict";
const $=id=>document.getElementById(id),H=Combat2HUD,C=CombatCore,T=CombatStatusCore,D=AbilityData;
let session,options={preset:"full",tier:"early",seed:7,hard:false},history=[],timer=null,running=false,inspectedId=null,knownNames=new Map();
const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
const name=id=>session.b.fighters.find(f=>f.id===id)?.name??knownNames.get(id)??id??"—";
const short=f=>f.side==="ally"?f.name:({"npc-trail-interceptor":"Перехватчик","npc-ridge-slinger":"Пращник","npc-pass-guard":"Страж","npc-field-medic":"Лекарь","npc-watch-captain":"Дозорный"}[f.archetypeId]??f.name);
function face(f){const div=make("div",undefined,"face"),src=ArenaUI003.portrait(f);
 if(src){const img=make("img");img.src=src;img.alt="";img.draggable=false;img.onerror=()=>div.replaceChildren(make("span",ArenaUI003.initials(f.name)));div.append(img);}
 else{const art=AbilityIconCore.element(f,"basic","npc-art");if(art){art.style.width="100%";art.style.height="100%";div.append(art);}else div.append(make("span",ArenaUI003.initials(f.name)));}
 return div;
}
function bar(v,m,kind){const out=make("div",undefined,"bar "+kind),i=make("i");i.style.width=Math.max(0,Math.min(100,100*v/Math.max(1,m)))+"%";out.append(i);return out;}
function statuses(f){const tags=[],mark=T.read(f,"read-move"),taunt=T.read(f,"taunt");
 if(f.hp<=0)return ["Выбыл"];
 if(mark)tags.push("Зацепки "+mark.stacks);
 if(f.guardHits)tags.push("Щит "+f.guardHits);
 if(f.weakenAttacks)tags.push("Ослаблен "+f.weakenAttacks);
 if(taunt)tags.push("Провокация "+taunt.remaining);
 if(T.read(f,"slowed"))tags.push("Медленнее");
 if(T.read(f,"disrupted-plan"))tags.push("Срыв");
 if(f.combat2Prepared)tags.push("⚠ Готовит удар");
 if(f.combat2Boost)tags.push("Сигнал +"+f.combat2Boost);
 return tags;
}
function record(){for(const f of session.b.fighters)knownNames.set(f.id,f.name);for(const e of session.b.events){
 const a=name(e.actorId),t=name(e.targetId);let line="";
 if(e.type==="ability"){const f=session.b.fighters.find(x=>x.id===e.actorId);line=a+" · "+(f?D.get(f,e.abilityId)?.name??e.abilityId:e.abilityId)+" → "+t;}
 if(e.type==="damage")line=(e.assist?"Совместный удар · ":"")+a+" → "+t+": "+(e.hpDamage??e.amount)+" HP"+(e.protectionDamage?" · "+e.protectionDamage+" защ.":"");
 if(e.type==="combat2-threat-prepared")line="⚠ "+a+" готовит удар по "+t;
 if(e.type==="combat2-threat-resolved")line=a+" атакует "+name(e.actualTargetId??e.targetId);
 if(e.type==="combat2-threat-cancelled")line="Подготовка сорвана: "+a;
 if(e.type==="combat2-cover")line="Арт прикрывает "+t+": "+e.amount+" предотвращено";
 if(e.type==="combat2-protection")line="Арт восстанавливает защиту: "+e.amount;
 if(e.type==="combat2-meter")line=t+" +"+Math.round(e.amount)+" инициативы"+(e.cross?" · опережает врага":"");
 if(e.type==="read-move-predicted")line="Нада: опасная атака ослаблена";
 if(e.type==="death")line=t+" выбыл";
 if(e.type==="miss")line=a+" промахивается";
 if(e.type==="wave-start")line="— Волна "+e.wave+" —";
 if(e.type==="battle-end")line=e.winner==="ally"?"Победа":"Поражение";
 if(line)history.push(line);
 }history=history.slice(-400);}
function stop(){running=false;if(timer!==null)clearTimeout(timer);timer=null;$("autoRun").textContent="Авто";}
function perform(fn){if(!session?.b.active)return;try{const actions=session.b.allyActions;if(!fn()){ stop();$("error").textContent="Действие недоступно.";render();return; }$("error").textContent="";if(session.b.allyActions!==actions){record();$("feedback").textContent=history.at(-1)??session.b.message;}render();}catch(e){stop();$("error").textContent=e.message;render();}}
function start(o){stop();const b=H.makeBattle(o);session=H.create(b);options={...o};history=[];knownNames=new Map();inspectedId=null;record();$("feedback").textContent="Выбери цель и способность.";$("error").textContent="";render();}
function render(){
 const b=session.b,a=session.actor(),active=b.active;
 $("stage").textContent=H.presets[options.preset].label+" · Волна "+b.wave+"/"+b.totalWaves;
 $("actor").textContent=active?a.name:b.winner==="ally"?"Победа":"Поражение";
 $("turnLabel").textContent=active?"СЕЙЧАС ХОДИТ":"БОЙ ЗАВЕРШЁН";
 const forecast=ArenaUI003.forecast(b,6,{speedOf:f=>C.effectiveStat(b,f,"speed")});
 $("queue").replaceChildren();
 for(const [i,id] of forecast.entries()){const f=b.fighters.find(x=>x.id===id),li=make("li",undefined,f.side+(i===0?" now":""));li.title=f.name;li.setAttribute("aria-label",f.name);const src=ArenaUI003.portrait(f);if(src){const img=make("img");img.src=src;img.alt=f.name;li.append(img);}else li.textContent=ArenaUI003.initials(f.name);$("queue").append(li);}
 $("allies").replaceChildren();$("enemies").replaceChildren();
 const selectedEnemy=session.enemy,selectedAlly=session.ally;
 for(const f of b.fighters){
  const chosen=f.side==="ally"?f.id===selectedAlly:f.id===selectedEnemy,labels=statuses(f),el=make("button",undefined,"unit"+(chosen?" selected":"")+(f.id===a?.id?" current":"")+(f.hp<=0?" dead":"")+(f.combat2Prepared?" threatened":""));
  el.dataset.fighter=f.id;el.disabled=!active||running||f.hp<=0;
  el.setAttribute("aria-pressed",String(chosen));el.setAttribute("aria-label",f.name+" · "+f.hp+" HP · "+f.protection+" защита · "+labels.join(", "));
  el.title=el.getAttribute("aria-label");
  el.append(face(f),make("b",short(f)),make("span",f.hp+"/"+f.maxHp+" · "+f.protection,"numbers"));
  const bars=make("div",undefined,"bars");bars.append(bar(f.hp,f.maxHp,"hp"),bar(f.protection,f.maxProtection,"prot"),bar(f.meter,1000,"meter"));
  el.append(bars,make("span",labels.join(" · "),"unit-status"));el.onclick=()=>{inspectedId=f.id;if(f.side==="enemy"||session.pending)session.select(f.id);$("feedback").textContent=f.name+" · "+(labels.join(" · ")||"Нет активных эффектов");render();};
  $(f.side==="ally"?"allies":"enemies").append(el);
 }
 for(const [side,id] of [["ally","allyCount"],["enemy","enemyCount"]]){const units=b.fighters.filter(f=>f.side===side);$(id).textContent=units.filter(f=>f.hp>0).length+"/"+units.length;}
 const taunter=b.fighters.find(f=>f.side==="ally"&&f.hp>0&&T.read(f,"taunt"));
 const threats=b.fighters.filter(f=>f.side==="enemy"&&f.hp>0&&f.combat2Prepared);
 $("threat").classList.toggle("none",!threats.length);
 $("threat").textContent=threats.length?"⚠ На следующем ходу: "+threats.map(f=>short(f)+" → "+name(f.combat2Prepared)+(taunter&&taunter.id!==f.combat2Prepared?" (провокация: "+taunter.name+")":"")).join(" · "):"Нет объявленных опасных атак";
 $("skills").replaceChildren();
 for(const [id,label] of [["basic","Базовая"],["special","Специальная"],["powerful","Мощная"]]){
  const {d,cd,ready,reason}=session.info(id),el=make("button",undefined,"skill");el.dataset.skill=id;
  el.disabled=!active||running||!ready||!!session.pending;el.title=reason||H.describe(a,d);
  const icon=active?AbilityIconCore.element(a,id,"icon"):null,face=icon??make("span",undefined,"icon");
  if(cd)face.append(make("span",cd,"cd"));
  const copy=make("div",undefined,"copy");copy.append(make("b",d?.name??label),make("small",cd?"Осталось "+cd:ready?(d.combat2Assist?"Выбрать помощника":d.target==="ally"?"Выбрать союзника":d.target==="self"?"На себя":d.target==="all-allies"?"На отряд":d.target==="all-enemies"?"Все враги":"Выбранная цель"):reason??""));
  el.append(face,copy);el.setAttribute("aria-label",d?.name??label);el.onclick=()=>perform(()=>session.skill(id));$("skills").append(el);
 }
 $("selection").hidden=!session.pending;$("screen").classList.toggle("choosing",!!session.pending);
 if(session.pending){const d=session.info(session.pending).d,p=session.preview();$("selectTitle").textContent=d?.name??"Выбор цели";$("preview").textContent=p.text??"";$("confirm").disabled=!p.ok;}
 $("autoStep").disabled=!active||running||!!session.pending;$("autoRun").disabled=!active||!!session.pending;$("infoBtn").disabled=!active||running;
 if(!active)stop();
}
function dialog(id){stop();render();$(id).showModal();}
$("setupBtn").onclick=()=>{$("setupError").textContent="";dialog("setup");};$("logBtn").onclick=()=>{ $("log").replaceChildren(...history.slice().reverse().map(t=>make("div",t,"entry")));dialog("journal");};
$("infoBtn").onclick=()=>{const a=session.actor();$("descriptions").replaceChildren(...["basic","special","powerful","passive"].map(id=>{const d=D.get(a,id),el=make("div",undefined,"entry");el.append(make("b",d?.name??id));let desc=id==="passive"?({ren:"Дополнительный урон по зацепкам Нады и уклонение союзников Садов.",nada:"Региональная точность союзников.",art:"Перехватывает часть подготовленного удара по другому союзнику, расходуя собственную защиту.",liora:"Прикрывает тяжелораненого союзника.",sava:"Успешная помощь усиливает следующий сигнал."}[a.id]??""):H.describe(a,d);el.append(make("p",desc));return el;}));const unit=session.b.fighters.find(f=>f.id===(inspectedId??session.enemy));if(unit){const item=make("div",undefined,"entry");item.append(make("b","Состояние · "+unit.name),make("p","HP "+unit.hp+"/"+unit.maxHp+" · защита "+unit.protection+"/"+unit.maxProtection+" · инициатива "+Math.round(unit.meter)+"/1000"),make("p",statuses(unit).join(" · ")||"Нет активных эффектов"));const marks=T.read(unit,"read-move"),slow=T.read(unit,"slowed");if(marks)item.append(make("p","Зацепки: "+marks.remaining+" собственных хода до истечения."));if(slow)item.append(make("p","Замедление: "+slow.amount+"%, осталось "+slow.remaining+" х."));$("descriptions").append(item);}dialog("details");};
document.querySelectorAll("[data-close]").forEach(btn=>btn.onclick=()=>$(btn.dataset.close).close());
for(const [id,p] of Object.entries(H.presets)){const o=make("option",p.label);o.value=id;$("preset").append(o);}$("preset").value=options.preset;
$("start").onclick=()=>{try{start({preset:$("preset").value,tier:$("tier").value,seed:Number($("seed").value),hard:$("hard").checked});$("setup").close();}catch(e){$("setupError").textContent=e.message;}};
$("restart").onclick=()=>start(options);$("cancel").onclick=()=>{session.cancel();$("error").textContent="";render();};$("confirm").onclick=()=>perform(()=>session.confirm());
$("autoStep").onclick=()=>perform(()=>session.auto());$("autoRun").onclick=()=>{if(running){stop();render();return;}running=true;$("autoRun").textContent="Стоп";render();const tick=()=>{if(!running)return;perform(()=>session.auto());if(running&&session.b.active)timer=setTimeout(tick,450);};timer=setTimeout(tick,100);};
document.addEventListener("visibilitychange",()=>{if(document.hidden){stop();if(session)render();}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&session?.pending&&!document.querySelector("dialog[open]")){session.cancel();render();}});
try{start(options);document.documentElement.dataset.ready="true";}catch(e){$("error").textContent=e.stack??e.message;document.documentElement.dataset.ready="false";}
})();
