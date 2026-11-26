"use strict";
const lab=TreeR1.create(localStorage,CombatCore,AbilityData,NpcEnemyData),main=document.getElementById("main");
let selected="guardian-2",target=null,pending=null;
const el=(tag,text,cls)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x};
const btn=(label,fn,cls="",disabled=false)=>{const b=el("button",label,cls);b.type="button";b.disabled=disabled;b.onclick=fn;return b};
const img=(src,alt)=>{const x=el("img");x.src=src;x.alt=alt;return x};
const bar=(v,max,cls)=>{const b=el("div",undefined,"bar "+cls),i=el("i");i.style.width=(max?Math.max(0,Math.min(100,v/max*100)):0)+"%";b.append(i);return b};

const names={"art-intercept":"Следующая одиночная атака по выбранному союзнику направляется в Арта; Арт получает прикрытие ×1. Массовые атаки не перехватываются.","art-reserve":"Передать собственный запас защиты союзнику до заполнения его Protection и дать прикрытие ×1."};
function start(id){if(lab.start(id)){target=pending=null;render()}}
let hero="art",tab="route";
const pathView=R2APath.create({view:()=>lab.view(),equip:id=>lab.equip(id),changed:()=>render(),start:id=>start(id)});
function brief(v){
 const routes=el("section",undefined,"r-route"),center=el("section",undefined,"r-center"),panel=el("section",undefined,"r-panel");
 routes.append(el("small","МАРШРУТ · "+(v.rank===2?"ПОЛЕВЫЕ ОПЕРАЦИИ":"ГЛАВА I"),"kicker"));
 const list=el("div",undefined,"r-scroll");
 for(const m of v.missions){if(m.arc&&v.arc)continue;if(m.operation&&!v.arc)continue;if(m.id==="campaign2"&&!v.trained)continue;
 const b=btn(undefined,()=>start(m.id),"r-mission",!m.ok||!!v.blocked);b.dataset.mission=m.id;b.append(el("strong",m.name),el("small",m.claimed?"Награда получена":m.ok?m.description:m.reason));list.append(b)}
 routes.append(list);
 const art=el("div",undefined,"hero-art");art.append(img("assets/"+hero+"-portrait-roster.webp",({art:"Арт",ren:"Рен",nada:"Нада"})[hero]));const cap=el("div",undefined,"hero-caption");cap.append(el("small","СОРАТНИК","kicker"),el("h1",({art:"Арт",ren:"Рен",nada:"Нада"})[hero]));art.append(cap);center.append(art);
 const roster=el("div",undefined,"r-roster");for(const h of v.heroes){const b=btn(({art:"Арт",ren:"Рен",nada:"Нада"})[h.id],()=>{hero=h.id;render()},hero===h.id?"primary":"quiet");roster.append(b)}center.append(roster);
 const tabs=el("div",undefined,"r-tabs");for(const [id,label] of [["route","Развитие"],["build","Сборка"],["results","Итоги"]]){const b=btn(label,()=>{tab=id;render()},tab===id?"primary":"quiet");b.dataset.tab=id;tabs.append(b)}panel.append(tabs);
 const body=el("div",undefined,"r-scroll");panel.append(body);
 if(tab==="route"){
 const h=v.heroes.find(x=>x.id===hero);const level=btn("Уровень +1 · "+(h.levelCost??"—")+" ◈",()=>{lab.upgrade("level",hero);render()},"",!h.canLevel),skill=btn("Особая +1 · "+(h.skillCost??"—")+" ◈",()=>{lab.upgrade("special",hero);render()},"",!h.canSkill);level.id="upgradeLevel";skill.id="upgradeSkill";body.append(el("h2","Развитие героя"),el("p","Ур. "+h.level+" · Особая "+h.skill),level,skill,el("small","Порог личной арки Арта","kicker"));
 for(const req of v.nodes[0].requirements)body.append(el("p",(req.ok?"✓ ":"○ ")+req.label+" "+req.value+"/"+req.need));
 body.append(el("p","Доверие "+(v.rank===1?"I · совместная работа":"II · личное обязательство")));
 }else if(tab==="build"){
 const path=btn("Специализация Арта ›",()=>pathView.open("tree"),"primary");path.id="openR2APath";
 const story=btn("Личное приключение ›",()=>pathView.open("story"),"quiet");story.id="openR2AStory";
 body.append(el("h2","Путь Арта"),el("p","Обычные способности сохраняются. Дополнительная: "+(v.nodes.find(n=>n.id===v.selected)?.name||"не выбрана")),path,story);
 }else{
 body.append(el("h2","Сравнение операций"),el("p","Последняя попытка каждой сборки. Одинаковая последовательность случайных чисел на старте боя; сравнивайте только одинаковые характеристики. Повторы без наград."));
 for(const r of v.results){const name=r.build===null?"База":v.nodes.find(n=>n.id===r.build)?.name;body.append(el("small",TreeR1.MISSIONS[r.mission].name+" · "+name,"kicker"),el("p",(r.winner==="ally"?"Победа":"Поражение")+" · "+r.actions+" ходов · Рен "+r.renHp+" HP · Арт "+r.artHp+" HP · снижено "+r.prevented+" · перехватов "+r.redirected+" · передано "+r.transferred+" · на Арта перенесено "+r.redirectedHp+" HP / "+r.redirectedProtection+" защиты · запас Арта "+r.artProtection+" · отряд "+r.allyHp+" HP"),el("small",r.stamp+" · seed "+r.seed))}
 }
 if(v.last)body.append(el("p",v.last.earned?"Личная арка завершена. Обе техники освоены; выберите сборку.":v.last.reward?"Награда: +"+v.last.reward+" ◈":v.last.winner==="ally"?(v.last.eligible?"Победа":"Победа без доказательства прикрытия"):"Задание не завершено","tree-result"));
 if(v.blocked)body.append(el("p",v.blocked,"tree-error"));if(v.pending)body.append(btn("Повторить сохранение",()=>{lab.retry();render()},"primary"));
 main.append(routes,center,panel);
}
function execute(id,who){if(lab.action(id,who)){target=pending=null;if(lab.view().last?.earned)tab="build";else if(lab.view().last&&TreeR1.MISSIONS[lab.view().mission]?.operation)tab="results";render()}}
function selectUnit(id){const v=lab.view();if(pending&&v.actions.find(a=>a.id===pending)?.targets.includes(id)){execute(pending,id);return}target=id;pending=null;render()}
function selectAbility(a){if(target&&a.targets.includes(target)){execute(a.id,target);return}if(a.targets.length===1&&!(a.id in names)){execute(a.id,a.targets[0]);return}pending=a.id;target=null;render()}
function unit(f,v){const valid=pending&&v.actions.find(a=>a.id===pending)?.targets.includes(f.id),armed=v.intercept?.targetId===f.id;
 const b=btn(undefined,()=>selectUnit(f.id),"unit "+f.side+(f.id===v.actor?" current":"")+(f.id===target?" targeted":"")+(f.hp<=0?" dead":"")+(valid?" r1-legal":"")+(armed?" r1-armed":""),f.hp<=0);b.dataset.unit=f.id;b.dataset.guard=String(f.guard);b.setAttribute("aria-label",f.name+", здоровье "+f.hp+", защита "+f.protection+", прикрытие "+f.guard);
 const face=el("div",undefined,"face");if(f.side==="ally")face.append(img("assets/"+f.id+"-portrait-roster.webp",f.name));else face.append(AbilityIconCore.element(f.archetypeId,"basic","enemy-art"));
 if(armed)face.append(el("span","ПЕРЕХВАТ","r1-badge"));else if(f.prepared)face.append(el("span","УДАР → "+(v.fighters.find(x=>x.id===f.prepared)?.name??"цель"),"r1-badge threat"));else if(f.guard)face.append(el("span","ПРИКРЫТИЕ ×"+f.guard,"r1-badge"));
 const vit=el("div",undefined,"vitals");vit.append(el("span",f.hp+"/"+f.maxHp+" · "+f.protection,"nums"),bar(f.hp,f.maxHp,"hp"),bar(f.protection,f.maxProtection,"prot"));const preview=v.actions.find(a=>a.id===pending)?.previews?.[f.id];if(preview?.amount)vit.append(el("small","+"+preview.amount+" защиты · Арт: "+Math.max(0,(v.fighters.find(x=>x.id==="art")?.protection??0)-preview.amount),"nums"));if(preview?.recipientId)vit.append(el("small","Перехват → Арт","nums"));b.append(face,el("b",f.name),vit);return b;
}
function feedback(v){if(pending)return names[pending]??"Выберите цель";if(target)return "Цель: "+v.fighters.find(f=>f.id===target)?.name;const event=[...v.events].reverse().find(e=>["trust-bypass","trust-intercept-resolved","trust-intercept-armed","trust-reserve-transferred"].includes(e.type));if(event?.type==="trust-bypass")return "Рен обошёл прикрытие";if(event?.type==="trust-intercept-resolved")return "Арт принял удар вместо союзника";if(event?.type==="trust-reserve-transferred")return "Передано "+event.amount+" защиты";if(event?.type==="trust-intercept-armed")return "Арт готов перехватить удар";return "Выберите действие";}
function fight(v){const head=el("section",undefined,"battle-head"),title=el("div"),goal=el("div",undefined,"goal");title.append(el("small","ДОВЕРИЕ · ПОЛЕВОЕ ИСПЫТАНИЕ","kicker"),el("h2",TreeR1.MISSIONS[v.mission].name));goal.append(el("b",TreeR1.MISSIONS[v.mission].arc?"Рен и Арт живы · прикрытие":TreeR1.MISSIONS[v.mission].description),el("small",TreeR1.MISSIONS[v.mission].arc?(v.proof.hit?"Прикрытие подтверждено":v.proof.cover?"Дождитесь атаки по Рену":"Особая способность Арта → Рен"):"Ход "+(v.turns+1)+" · Волна "+v.wave+"/"+v.totalWaves));const exit=btn("Выход",()=>{lab.abandon();target=pending=null;render()},"quiet exit");exit.id="abandon";head.append(title,goal,exit);
 const arena=el("section",undefined,"arena");for(const side of ["ally","enemy"]){if(side==="enemy")arena.append(el("div","✦","versus"));const s=el("section",undefined,"squad "+side),u=el("div",undefined,"units");s.append(el("h3",side==="ally"?"ВАШ ОТРЯД":"ПРОТИВНИКИ"));v.fighters.filter(f=>f.side===side).forEach(f=>u.append(unit(f,v)));s.append(u);arena.append(s)}
 const bottom=el("div",undefined,"battle-bottom r1-bottom"),turn=el("div",undefined,"turn-info");turn.append(el("small","АКТИВНЫЙ ГЕРОЙ"),el("strong",v.fighters.find(f=>f.id===v.actor)?.name),el("span",feedback(v),"feedback"));const skills=el("div",undefined,"skills r1-skills");for(const a of v.actions){const personal=a.id in names,b=btn(undefined,()=>selectAbility(a),"skill"+(personal?" personal":"")+(pending===a.id?" selected":""),!a.targets.length);b.dataset.skill=a.id;b.title=personal?names[a.id]:a.name;b.setAttribute("aria-label",a.name+(a.cooldown?" · перезарядка "+a.cooldown:""));const icon=personal?img("lab-command-loop/"+a.id+".svg",a.name):AbilityIconCore.element(v.actor,a.id,"icon");icon.className="icon";const c=el("div",undefined,"copy");c.append(el("b",a.name),el("small",a.cooldown?"Ходов: "+a.cooldown:!a.targets.length?"Нет цели":personal?"Доверие II":a.id==="basic"?"Базовая":a.id==="special"?"Особая":"Мощная"));b.append(icon,c);skills.append(b)}bottom.append(turn,skills);main.append(head,arena,bottom);
}

function render(){const v=lab.view();main.replaceChildren();main.className=v.active?"battle r1-battle":"r-home";document.getElementById("wallet").textContent=v.currency+" ◈";document.getElementById("heading").textContent=v.active?"Боевая операция":"Кампания · соратники";document.documentElement.dataset.active=String(v.active);document.documentElement.dataset.actor=v.actor??"";document.documentElement.dataset.rank=String(v.rank);document.documentElement.dataset.earned=v.earned.join(",");document.documentElement.dataset.trained=String(v.trained);document.documentElement.dataset.build=v.selected??"base";document.documentElement.dataset.ready="true";if(v.active)fight(v);else brief(v)}
render();
