import {fresh,points,nearby,actions,act,objective} from './exploration-core.mjs';
import {read,write} from './checkpoint.mjs';
const durable=new URLSearchParams(location.search).get("durable")==="1";
const provider=()=>{if(!ProgressWriterCore.canPersist())throw Error("MAP3D_WRITER_REQUIRED");return durable?Map3DProfile.storage():window.sessionStorage;};
const names={spawn:'Начало',direct:'Пост',court:'Двор',exit:'Выход'};
const labels={inspect:'Осмотреть пост',scout:'Найти обход',challenge:'Запросить бой',bypass:'Пройти в обход',fight:'Открыть настоящий бой',cancel:'Отмена',finish:'Завершить маршрут'};
export function createInteractions(adapter){
 const root=document.querySelector('#poi'),panel=document.querySelector('#interaction'),title=document.querySelector('#interaction-title'),buttons=document.querySelector('#interaction-actions'),goal=document.querySelector('#objective');
 let loaded=read(provider),state=loaded.state,blocked=!loaded.ok,signature='',nodes={};
 for(const [id,name] of Object.entries(names)){
  const b=document.createElement('button');b.type='button';b.dataset.poi=id;b.textContent=name;b.setAttribute('aria-label','Идти: '+name);
  b.onclick=()=>{const v=adapter.view();if(blocked||!v.ready||state.phase==='encounter'||state.phase==='complete')return;if(nearby(v.pos,v.walking)!==id)adapter.move(points[id]);};
  root.append(b);nodes[id]=b;
 }
 function reset(){loaded=read(provider);state=loaded.state;blocked=!loaded.ok;signature='';panel.hidden=true;root.hidden=true;goal.textContent=blocked?'Сохранение недоступно. Проверь вкладки и перезагрузи.':objective(state);}
 function restart(){const next=fresh();if(!write(provider,next)){blocked=true;goal.textContent='Не удалось сохранить маршрут';return false;}reset();return true;}
 function checkpoint(){return points[state.at]||points.spawn;}
 function update(){
  const v=adapter.view();root.hidden=!v.ready;
  if(!v.ready){panel.hidden=true;return;}
  const at=nearby(v.pos,v.walking);
  const a=blocked?[]:actions(state,at),key=JSON.stringify([state,at,a]);
  if(key!==signature){
   signature=key;goal.textContent=blocked?'Сохранение недоступно. Сбросить маршрут.':objective(state);
   panel.hidden=!a.length&&state.phase!=='complete'&&!(at==='exit'&&state.phase==='explore');
   title.textContent=state.phase==='complete'?(state.route==='bypass'?'Обход завершён':'Бой и возвращение завершены'):state.phase==='encounter'?(state.won?'Победа сохранена · завершить получение награды':'Переход в настоящий бой'):at==='exit'?'Выход: выбери маршрут':at==='court'?'Двор: разведка':at==='direct'?'Пост: наблюдение':'Возвращение';
   if(at==='exit'&&!a.length&&state.phase==='explore')title.textContent='Сначала осмотри пост или двор';
   buttons.replaceChildren(...a.map(action=>{const b=document.createElement('button');b.type='button';b.dataset.action=action;b.textContent=labels[action];b.onclick=()=>{const now=adapter.view();if(!now.ready)return;if(blocked)return;if(action==='fight'){if(!actions(state,nearby(now.pos,now.walking)).includes(action))return;adapter.handoff();return;}const next=act(state,action,now.pos,now.walking);if(next!==state&&!write(provider,next)){blocked=true;signature='';update();return;}state=next;update();};return b;}));
   nodes.direct.textContent=state.post?'Пост ✓':'Пост';nodes.court.textContent=state.intel?'Двор ✓':'Двор';nodes.spawn.textContent=state.phase==='return'?'Вернуться':'Начало';
  }
  for(const [id,b] of Object.entries(nodes)){
   const p=adapter.project([points[id][0],points[id][1]+.55,points[id][2]]);
   const y=v.overview?Math.max(76,Math.min(innerHeight-65,p.y)):p.y;
   b.hidden=state.phase==='encounter'||state.phase==='complete'||at===id||p.x<45||p.x>innerWidth-45||y<65||y>innerHeight-65;
   if(!b.hidden){b.style.left=p.x+'px';b.style.top=y+'px';}
  }
 }
 return {reset,restart,checkpoint,update,snapshot:()=>({...state}),canMove:()=>!blocked&&state.phase!=='encounter'&&state.phase!=='complete'};
}
