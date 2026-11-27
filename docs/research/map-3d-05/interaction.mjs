import {fresh,points,nearby,actions,act,objective} from './exploration-core.mjs';
const names={spawn:'Начало',direct:'Пост',court:'Двор',exit:'Выход'};
const labels={inspect:'Осмотреть пост',scout:'Найти обход',challenge:'Запросить бой',bypass:'Пройти в обход',simulate:'Симулировать победу (тест)',cancel:'Отмена',finish:'Завершить маршрут'};
export function createInteractions(adapter){
 const root=document.querySelector('#poi'),panel=document.querySelector('#interaction'),title=document.querySelector('#interaction-title'),buttons=document.querySelector('#interaction-actions'),goal=document.querySelector('#objective');
 let state=fresh(),signature='',nodes={};
 for(const [id,name] of Object.entries(names)){
  const b=document.createElement('button');b.type='button';b.dataset.poi=id;b.textContent=name;b.setAttribute('aria-label','Идти: '+name);
  b.onclick=()=>{const v=adapter.view();if(!v.ready||state.phase==='encounter'||state.phase==='complete')return;if(nearby(v.pos,v.walking)!==id)adapter.move(points[id]);};
  root.append(b);nodes[id]=b;
 }
 function reset(){state=fresh();signature='';panel.hidden=true;root.hidden=true;goal.textContent=objective(state);}
 function update(){
  const v=adapter.view();root.hidden=!v.ready;
  if(!v.ready){panel.hidden=true;return;}
  const at=nearby(v.pos,v.walking);
  const a=actions(state,at),key=JSON.stringify([state,at,a]);
  if(key!==signature){
   signature=key;goal.textContent=objective(state);
   panel.hidden=!a.length&&state.phase!=='complete'&&!(at==='exit'&&state.phase==='explore');
   title.textContent=state.phase==='complete'?(state.route==='bypass'?'Обход завершён':'Тестовый бой и возвращение завершены'):state.phase==='encounter'?'Бой ещё не подключён':at==='exit'?'Выход: выбери маршрут':at==='court'?'Двор: разведка':at==='direct'?'Пост: наблюдение':'Возвращение';
   if(at==='exit'&&!a.length&&state.phase==='explore')title.textContent='Сначала осмотри пост или двор';
   buttons.replaceChildren(...a.map(action=>{const b=document.createElement('button');b.type='button';b.dataset.action=action;b.textContent=labels[action];b.onclick=()=>{const now=adapter.view();if(!now.ready)return;state=act(state,action,now.pos,now.walking);update();};return b;}));
   nodes.direct.textContent=state.post?'Пост ✓':'Пост';nodes.court.textContent=state.intel?'Двор ✓':'Двор';nodes.spawn.textContent=state.phase==='return'?'Вернуться':'Начало';
  }
  for(const [id,b] of Object.entries(nodes)){
   const p=adapter.project([points[id][0],points[id][1]+.55,points[id][2]]);
   b.hidden=state.phase==='encounter'||state.phase==='complete'||at===id||p.x<45||p.x>innerWidth-45||p.y<65||p.y>innerHeight-65;
   if(!b.hidden){b.style.left=p.x+'px';b.style.top=p.y+'px';}
  }
 }
 return {reset,update,snapshot:()=>({...state}),canMove:()=>state.phase!=='encounter'&&state.phase!=='complete'};
}
