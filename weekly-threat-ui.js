/* NET-008A: compact 2D weekly threat control; no extra Babylon scene. */
const WeeklyThreatUI=(()=>{
 "use strict";
 let session=null,onSquad=null,onDevelop=null,network=null,mounted=false,notice="";
 const $=id=>document.getElementById(id);
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
  $("netuxWeeklyIntel").textContent=intel+"/3";
  $("netuxWeeklyIntelMeter").value=intel;
  $("net008aSurvey").textContent="Разведать цель · HP "+(intel>=2?"−24%":"−10%");
  $("net008aCover").textContent="Прикрытие · атака врагов "+(intel>=2?"−22%":"−10%");
  $("netuxWeeklyAttempts").textContent=String(s.attempts);
  $("netuxWeeklyBest").textContent=s.bestScore?
   s.bestScore+"/100 · "+WeeklyThreatCore.TIERS.filter(t=>s.bestScore>=t.score).length+"★":"Нет";
  WeeklyThreatCore.TIERS.forEach((tier,i)=>{
   const el=$("netuxWeeklyTier"+(i+1));if(!el)return;
   const won=s.bestScore>=tier.score,
    due=pend.some(x=>x.weekStart===s.weekStart&&x.stage===i+1),
    materialCount=Object.values(tier.materials).reduce((sum,n)=>sum+n,0);
   el.dataset.status=won?(due?"pending":"paid"):"locked";
   el.textContent=(i+1)+"★ · от "+tier.score+"/100 · "+
    (won?(due?"К получению":"Получено"):"Пока не достигнуто")+
    " · +"+tier.currency+" валюты · +"+tier.xp+" XP · "+
    materialCount+" материалов ("+Object.keys(tier.materials).length+" видов)";
  });
  $("net008aStatus").textContent=notice||(session.isClockBack()?
   "Часы устройства переведены назад: недельные действия приостановлены. Верните правильное время.":
   "Разведданные этой недели: "+intel+"/3 · попыток: "+s.attempts+
   " · лучший результат: "+(s.bestScore?s.bestScore+"/100 ("+
   WeeklyThreatCore.TIERS.filter(t=>s.bestScore>=t.score).length+"★)":"нет")+
   ". Поражение не лишает награды и допускает повтор.");
  $("net008aRewards").innerHTML=WeeklyThreatCore.TIERS.map((tier,i)=>
   (i+1)+"★ · "+tier.score+" очков · +"+tier.currency+" валюты · +"+tier.xp+
   " XP"+GearMaterialUI.group(tier.materials)).join("");
  $("net008aSurvey").hidden=!!s.active;
  $("net008aCover").hidden=!!s.active;
  $("net008aFight").hidden=!s.active;
  $("net008aAbandon").hidden=!s.active;
  $("net008aContinue").textContent=s.active?
   "Текущая попытка №"+s.active.attempt+" · "+
   (s.active.preparation==="survey"?"Разведка: HP главной цели "+(s.active.intel>=2?"−24%.":"−10%."):
    "Прикрытие: физическая атака противников "+(s.active.intel>=2?"−22%.":"−10%."))+
   " Учтено сведений при начале: "+s.active.intel+"/3.":
   "До 2 сведений: HP цели −10% либо атака врагов −10%. От 2 сведений: −24% либо −22%."+
   (intel>=2?" Усиление уже максимальное; третье сведение — запас без дополнительного эффекта.":
    " Сведения дают завершённые вручную зацепки с меткой угрозы.");
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
   notice=r.win?"Победа! Оценка "+r.score+"/100. Результат сохранён; можно улучшить оценку.":
    "Поражение. Попытка завершена; можно изменить тактику и повторить.";
   await collect();
   if(r.ok&&r.win)notice="Победа: оценка "+r.score+"/100. "+notice;
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
