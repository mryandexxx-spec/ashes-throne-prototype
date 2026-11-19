/* NET-008A: compact 2D weekly threat control; no extra Babylon scene. */
const WeeklyThreatUI=(()=>{
 "use strict";
 let session=null,onSquad=null,onDevelop=null,network=null,mounted=false,notice="";
 const $=id=>document.getElementById(id);
 const labels={Fe:"Железо",Le:"Кожа",Cl:"Ткань",Wo:"Древесина",
  Fa:"Волокно",Th:"Нить",Gl:"Стекло"};
 function render(){
  if(!mounted)return;
  const root=$("net008aThreat"),s=session.read();
  if(!s){$("net008aStatus").textContent=notice||"Недельный отчёт загружается…";return;}
  const def=WeeklyThreatCore.variant(s.weekStart),
   week=WeeklyThreatCore.weekId(s.weekStart),
   intel=Math.min(3,network?.read()?.threatIntel?.[week]??0),
   pend=session.pending(),blocked=!session.isReady(),busy=session.isBusy();
  $("net008aTitle").textContent=def.title+" · неделя с "+
   new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",timeZone:"UTC"}).format(new Date(s.weekStart));
  $("net008aGoal").textContent=def.goal+
   ". Первый отмеченный противник должен погибнуть первым. Нокауты и число ходов влияют на оценку.";
  $("net008aStatus").textContent=notice||(session.isClockBack()?
   "Часы устройства переведены назад: недельные действия приостановлены. Верните правильное время.":
   "Разведданные этой недели: "+intel+"/3 · попыток: "+s.attempts+
   " · лучший результат: "+(s.bestScore?s.bestScore+"/100 ("+
   WeeklyThreatCore.TIERS.filter(t=>s.bestScore>=t.score).length+"★)":"нет")+
   ". Поражение не лишает награды и допускает повтор.");
  $("net008aRewards").textContent="Награды за 1★ / 2★ / 3★ (однократно в неделю): "+
   WeeklyThreatCore.TIERS.map((x,i)=>(i+1)+"★ от "+x.score+
   ": +"+x.currency+" валюты, +"+x.xp+" XP, "+
   Object.entries(x.materials).map(([id,n])=>n+" "+(typeof GearData!=="undefined"?
    GearData.MATERIAL_LABELS[id]||id:labels[id])).join(", ")).join(" · ");
  $("net008aSurvey").hidden=!!s.active;
  $("net008aCover").hidden=!!s.active;
  $("net008aFight").hidden=!s.active;
  $("net008aAbandon").hidden=!s.active;
  $("net008aContinue").textContent=s.active?
   "Подготовка: "+(s.active.preparation==="survey"?"изучить цель":"укрыть отряд")+
   " · разведданные "+s.active.intel+"/3 · попытка "+s.active.attempt:
   "Выберите способ подготовки. Разведка ослабит главную цель, прикрытие — урон противников. "+
   "После двух донесений преимущество усиливается.";
  $("net008aCollect").textContent="Забрать награды: "+pend.length;
  $("net008aCollect").hidden=pend.length===0;
  root.querySelectorAll("button[data-week-action]").forEach(b=>b.disabled=blocked||busy);
 }
 async function collect(){
  if(!session?.isReady())return;
  // A new profile has not earned any weekly reward; do not imply a previous claim.
  if(session.pending().length===0){
   notice=session.read()?.bestScore>0?"Награды за достигнутые ступени уже получены.":"";
   render();return;
  }
  const r=await session.collect().catch(()=>({ok:false,code:"COLLECT_FAILED"}));
  notice=r.ok?(r.count?"Получено: "+r.count+" наградных ступеней, +"+r.currency+
   " валюты, +"+r.xp+" XP, +"+r.materials+" материалов.":""):
   "Выплата не подтверждена: "+r.code+". Не запускайте повторную выдачу без проверки.";
  render();
 }
 async function finish(battle){
  const r=await session.finish(battle).catch(()=>({ok:false,code:"FINISH_FAILED"}));
  if(r.ok){
   notice=r.win?"Победа! S1 "+r.score+"/100. Результат сохранён; можно улучшить оценку.":
    "Поражение. Попытка завершена; можно изменить тактику и повторить.";
   await collect();
   if(r.ok&&r.win)notice="Победа: S1 "+r.score+"/100. "+notice;
  }else notice="Результат боя не записан: "+r.code+". Перезагрузите страницу и повторите попытку.";
  render();return r;
 }
 function mount({weekly,onOpenSquad,onOpenHeroes,networkSession}={}){
  if(mounted||!weekly||typeof onOpenSquad!=="function"||!$("net008aThreat"))return false;
  session=weekly;onSquad=onOpenSquad;onDevelop=onOpenHeroes;network=networkSession;mounted=true;
  $("net008aThreat").addEventListener("click",async event=>{
   const b=event.target.closest?.("button[data-week-action]");
   if(!b||b.disabled)return;
   const action=b.dataset.weekAction;
   if(action==="develop"){if(typeof onDevelop==="function")onDevelop();return;}
   if(action==="fight"){if(session.isReady()&&session.read()?.active)onSquad();return;}
   if(action==="collect"){await collect();return;}
   const r=action==="abandon"?await session.abandon():
    await session.begin(action);
   notice=r.ok?"":("Действие отклонено: "+r.code);
   render();
   if(r.ok&&action!=="abandon")onSquad();
  });
  void session.open().then(r=>{
   if(!r.ok)notice="Недельный режим: "+r.code;
   render();if(r.ok&&session.pending().length>0)void collect();
  }).catch(()=>{notice="Не удалось загрузить недельную угрозу.";render();});
  return true;
 }
 function refresh(){if(!session)return;void session.open().then(()=>render());}
 return Object.freeze({mount,render,refresh,finish});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=WeeklyThreatUI;
