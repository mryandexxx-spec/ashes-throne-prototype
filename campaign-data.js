/* Campaign-Data-002: chapter/route/mission navigation, no new story content.
   Routes are independent; only requiredMissionIds gates a mission. */
const CampaignData=(()=>{
 "use strict";
 const chapters=Object.freeze([
  Object.freeze({id:"chapter-1",title:"Пепельный тракт",label:"ГЛАВА I",order:1})
 ]);
 const routes=Object.freeze([
  Object.freeze({id:"main",chapterId:"chapter-1",kind:"main",title:"Основной путь",order:1})
 ]);
 const entries=Object.freeze([
  Object.freeze({missionId:"black-pass-ambush",chapterId:"chapter-1",routeId:"main",
   order:1,requiredMissionIds:Object.freeze([]),
   description:"Разведчики Конклава преградили путь. Разбей их отряд."})
 ]);
 // All entries must refer to known chapters, routes and mission definitions.
 function catalogIsValid(ch=chapters,rt=routes,en=entries){
  const unique=a=>new Set(a).size===a.length;
  const chapterIds=ch.map(x=>x.id),routeIds=rt.map(x=>x.id),missionIds=en.map(x=>x.missionId);
  if(!unique(chapterIds)||!unique(routeIds)||!unique(missionIds))return false;
  if(rt.some(x=>!chapterIds.includes(x.chapterId)||!["main","optional"].includes(x.kind)))return false;
  if(en.some(x=>!chapterIds.includes(x.chapterId)||!rt.some(r=>r.id===x.routeId&&r.chapterId===x.chapterId)))return false;
  if(en.some(x=>!Array.isArray(x.requiredMissionIds)||x.requiredMissionIds.some(id=>!missionIds.includes(id)||id===x.missionId)))return false;
  // A circular prerequisite chain would permanently lock all affected missions.
  const byId=new Map(en.map(x=>[x.missionId,x]));
  const visiting=new Set(),checked=new Set();
  function visit(id){
   if(visiting.has(id))return false;
   if(checked.has(id))return true;
   visiting.add(id);
   for(const required of byId.get(id).requiredMissionIds)if(!visit(required))return false;
   visiting.delete(id);checked.add(id);
   return true;
  }
  return missionIds.every(visit);
 }
 function allChapters(){return chapters.slice().sort((a,b)=>a.order-b.order);}
 function missions(chapterId){return entries.filter(e=>e.chapterId===chapterId).slice().sort((a,b)=>a.order-b.order);}
 function getMission(id){return entries.find(e=>e.missionId===id)||null;}
 function available(entry,progress){
  return !!entry && entry.requiredMissionIds.every(id=>progress.completed[id]===true);
 }
 function chapterProgress(id,progress){
  const list=missions(id);
  const completed=list.filter(e=>progress.completed[e.missionId]===true).length;
  const stars=list.reduce((sum,e)=>sum+(progress.bestStars[e.missionId]||0),0);
  return {completed,total:list.length,stars,maxStars:list.length*3};
 }
 return Object.freeze({allChapters,routes:()=>routes.slice(),missions,getMission,available,chapterProgress,catalogIsValid});
})();
