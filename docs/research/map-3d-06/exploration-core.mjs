// MAP-3D-06: neutral test location; existing campaign battle only.
export {fresh} from './checkpoint.mjs';
export const points={spawn:[-3.8,0,1.55],direct:[.2,0,1.7],court:[-2,0,-6.6],exit:[5.3,0,.9]};
export function nearby(pos,walking){if(!pos||walking)return null;return Object.keys(points).find(id=>Math.hypot(...pos.map((v,i)=>v-points[id][i]))<=.8)||null;}
export function actions(s,at){
 if(s.phase==='complete')return [];
 if(s.phase==='encounter')return at==='exit'?(s.won?['fight']:['fight','cancel']):[];

 if(s.phase==='return')return at==='spawn'?['finish']:[];
 if(at==='direct'&&!s.post)return ['inspect'];
 if(at==='court'&&!s.intel)return ['scout'];
 if(at==='exit')return [...(s.post?['challenge']:[]),...(s.intel?['bypass']:[])];
 return [];
}
export function act(s,action,pos,walking){
 if(!actions(s,nearby(pos,walking)).includes(action))return s;
 switch(action){
 case 'inspect':return {...s,post:true,at:'direct'};
 case 'scout':return {...s,intel:true,at:'court'};
 case 'challenge':return {...s,phase:'encounter',at:'exit'};
 case 'cancel':return {...s,phase:'explore'};
 case 'fight':return s;
 case 'bypass':return {...s,phase:'return',route:'bypass',at:'exit'};
 case 'finish':return {...s,phase:'complete',at:'spawn'};
 default:return s;
 }
}
export function objective(s){
 if(s.phase==='complete')return 'Маршрут завершён';
 if(s.phase==='return')return 'Вернись к началу';
 if(s.phase==='encounter')return 'Боевой эпизод';
 if(s.post||s.intel)return 'Доберись до выхода — выбери путь';
 return 'Осмотри пост или исследуй двор';
}
