// Isolated MAP-3D-06 domain checkpoint; same sessionStorage provider as existing combat2Pilot.
export const KEY='ashes-throne.map-3d-06.v1';
export const MISSION='main-cam-001-m1';
export const fresh=()=>({version:1,post:false,intel:false,phase:'explore',route:null,at:'spawn',won:false});
export function valid(s){
 return !!s&&s.version===1&&typeof s.post==='boolean'&&typeof s.intel==='boolean'&&typeof s.won==='boolean'&&
 ['spawn','direct','court','exit'].includes(s.at)&&['explore','encounter','return','complete'].includes(s.phase)&&
 (s.phase==='encounter'?s.post&&s.at==='exit'&&s.route===null:
 s.phase==='return'||s.phase==='complete'?(s.route==='encounter'?s.post&&s.won:s.route==='bypass'&&s.intel&&!s.won)&&s.at===(s.phase==='return'?'exit':'spawn'):
 s.route===null&&!s.won);
}
export function read(provider){try{const st=provider(),raw=st.getItem(KEY);if(raw===null)return {ok:true,state:fresh()};const s=JSON.parse(raw);return valid(s)?{ok:true,state:s}:{ok:false,state:fresh()};}catch{return {ok:false,state:fresh()};}}
export function write(provider,s){if(!valid(s))return false;try{const st=provider(),raw=JSON.stringify(s);st.setItem(KEY,raw);return st.getItem(KEY)===raw;}catch{return false;}}
export function record(s,result){if(!valid(s)||s.phase!=='encounter'||result?.missionId!==MISSION||!result.ok||!result.earned)return s;return {...s,won:true};}
export function leave(s,status){if(!valid(s)||s.phase!=='encounter')return s;if(s.won&&status==='claimed')return {...s,phase:'return',route:'encounter'};if(s.won)return s;return {...s,phase:'explore',won:false};}
