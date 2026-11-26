"use strict";
let lab=CommandLoopLab.create(CombatCore,AbilityData),selected=null;
const main=document.getElementById("main"),reset=document.getElementById("reset");
const names={1:"Сотрудничество",2:"Взаимопонимание",3:"Сработанность"};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function btn(label,fn,disabled=false){const b=el("button",label);b.type="button";b.disabled=disabled;b.addEventListener("click",fn);return b;}
function render(){
 const v=lab.view(),left=el("section"),right=el("section");main.replaceChildren(left,right);
 left.append(el("h2","Досье Арта"),el("div","Доверие "+["","I","II","III"][v.rank],"rank"),el("p",names[v.rank]));
 for(const [id,label] of [["agreement","Личное обязательство"],["field","Полевое подтверждение"],["joint","Сотрудничество"]])left.append(el("p",(v.earned.includes(id)?"✓ ":"○ ")+label,"pill"));
 left.append(el("p",v.rank===3?"Доступен альтернативный план операции.":"План Арта откроется после трёх подтверждений.","notice"));
 if(v.active){const t=v.tasks.find(t=>t.id===v.active);left.append(el("h3",t.name),el("p",t.detail),el("p","Страховка: "+(v.cover?"выполнена":"нет")+" · Особая атака: "+(v.strike?"выполнена":"нет"),"muted"),btn("Отказаться",()=>{lab.abandon();selected=null;render()}));}
 if(!v.active){
  right.append(el("h2","Оперативный центр"));
  if(v.last){const r=v.last;right.append(el("p",(r.winner==="ally"?"Победа":r.winner==="enemy"?"Поражение":"Отказ")+" · "+(r.outcome==="held"?"Удержано":r.outcome==="wrong-order"?"Неверная цель":r.outcome==="protected-fallen"?"Союзник потерян":"Ходов: "+r.actions)+" · осталось врагов: "+r.remainingEnemies+(r.gained?" · Новое достижение":r.winner==="ally"&&!r.proof?" · Условие обязательства не выполнено":""),"notice"));}
  for(const t of v.tasks){const n=el("div",undefined,"task");n.append(btn(t.name+(t.done?" ✓":t.allowed?"":" · закрыто"),()=>{if(lab.start(t.id)){selected=null;render()}},!t.allowed),el("p",t.detail,"muted"));right.append(n);}
 }else{
  right.append(el("h2","Ход: "+v.fighters.find(f=>f.id===v.actor).name+" · "+v.turns));
  const grid=el("div",undefined,"fighters");for(const f of v.fighters){const b=btn(f.name+" · "+f.hp+"/"+f.maxHp+" HP · щит "+f.protection+(f.guard?" · прикрытие":""),()=>{selected=f.id;render()},f.hp<=0);b.className="fighter "+f.side+(f.id===v.actor?" active":"")+(selected===f.id?" targeted":"");b.setAttribute("aria-pressed",String(selected===f.id));const bar=el("progress",undefined,"hp");bar.max=f.maxHp;bar.value=f.hp;b.append(bar);grid.append(b);}right.append(grid,el("p","Выберите цель, затем способность.","muted"));
  const actions=el("div",undefined,"actions");for(const a of v.actions)actions.append(btn(a.name,()=>{if(lab.action(a.id,selected)){selected=null;render()}},!a.targets.includes(selected)));right.append(actions);
 }
}
reset.addEventListener("click",()=>{lab=CommandLoopLab.create(CombatCore,AbilityData);selected=null;render()});render();