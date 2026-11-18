/* NET-004: test-only HTML controller, opt-in through ?networkPilot=1.
 * Uses the approved graphite/bronze visual language. No production rewards.
 */
const NetworkPilotUI=(()=>{
 "use strict";
 let session=null,onSquad=null,mounted=false,notice="";
 const $=id=>document.getElementById(id);
 const names=Object.freeze({
  "net-route-watch":"Дозор на маршруте",
  "net-lost-cargo":"След пропавшей поклажи",
  "net-watch-trace":"Сведения о дозоре"
 });
 const types=Object.freeze({supply:"Снабжение",trophies:"Трофеи",
  "threat-trace":"След угрозы","recruit-intel":"Сведения о человеке"});
 const prep=Object.freeze({survey:"Разведать",cover:"Подготовить прикрытие"});
 const approach=Object.freeze({quiet:"Тихий подход",cordon:"Окружение"});
 const errorText=Object.freeze({
  SESSION_BLOCKED_RELOAD_REQUIRED:"Сохранение заблокировано. Перезагрузите страницу.",
  OPERATION_IN_PROGRESS:"Сначала дождитесь завершения записи.",
  WALLET_WRITER_NOT_OWNED:"Нет права записи: активна другая вкладка.",
  SAVE_FAILED:"Не удалось подтвердить запись. Перезагрузите страницу, не повторяйте действие.",
  LOAD_FAILED:"Пробное сохранение повреждено или недоступно. Оно не перезаписано.",
  INVALID_TRANSITION:"Действие недоступно в текущей фазе.",
  EXCLUSIVE_LOCK_FAILED:"Ошибка эксклюзивной записи. Перезагрузите страницу."
 });
 function line(text,tag="p"){const el=document.createElement(tag);el.textContent=text;return el;}
 function button(text,action,value){
  const el=document.createElement("button");
  el.type="button";el.textContent=text;el.className="net004-choice";
  el.dataset.netAction=action;if(value!==undefined)el.dataset.netValue=String(value);
  return el;
 }
 function render(){
  if(!mounted)return;
  const s=session.read(),blocked=session.isBlocked(),busy=session.isBusy();
  $("net004Notice").textContent=blocked?
   "Режим заблокирован: нет безопасной записи. Перезагрузите страницу.":
   notice||"Пробный режим без наград и расхода энергии. Данные хранятся отдельно.";
  const board=$("net004Board"),active=$("net004Active"),result=$("net004Result");
  board.hidden=!!s?.active||!s;
  active.hidden=!s?.active||s.active.phase==="result";
  result.hidden=s?.active?.phase!=="result";
  if(!s){$("net004Meta").textContent="Ожидание сохранения…";return;}
  $("net004Meta").textContent="Сады над пропастью · "+s.board.length+"/"+s.config.capacity+
   " зацепок · влияние (проба): "+(s.influence["gardens-over-abyss"]??0);
  $("net004Refresh").disabled=busy||blocked;
  $("net004Clues").replaceChildren();
  if(!s.board.length)$("net004Clues").append(line("Новых донесений пока нет."));
  for(const clue of s.board){
   const el=document.createElement("article");el.className="net004-clue";
   el.append(line(names[clue.templateId]||"Неизвестная зацепка","h3"),
    line((types[clue.type]||clue.type)+" · Уровень "+clue.level+
     " · Зацепка №"+clue.id),
    line("Пробный бой. Реальные награды не назначены."));
   const start=button("Изучить", "start",clue.id);start.disabled=busy||blocked;
   el.append(start);$("net004Clues").append(el);
  }
  if(s.active&&s.active.phase!=="result"){
   const a=s.active;
   $("net004ActiveTitle").textContent=names[a.clue.templateId]||"Зацепка №"+a.clue.id;
   $("net004ActiveDetail").textContent=
    a.phase==="brief"?"Выберите подготовку. Разведка раскрывает рекомендуемую цель; прикрытие снижает атаку противника только в пробе.":
    a.phase==="approach"?"Выберите подход. Тихий — одна волна, окружение — две отдельные волны.":
    "Контрольная точка: волна "+(a.wave+1)+"/"+
      a.clue.approaches.find(x=>x.id===a.approach).waves+
      ". Состав героев и бой будут начаты заново при перезагрузке.";
   const slot=$("net004Choices");slot.replaceChildren();
   if(a.phase==="brief")for(const id of a.clue.preparationIds)
    slot.append(button(prep[id]||id,"prepare",id));
   if(a.phase==="approach")for(const choice of a.clue.approaches)
    slot.append(button((approach[choice.id]||choice.id)+" · "+choice.waves+
     (choice.waves===1?" волна":" волны"),"approach",choice.id));
   $("net004Fight").hidden=a.phase!=="battle";
   $("net004Fight").disabled=busy||blocked;
   $("net004Cancel").disabled=busy||blocked;
  }
  if(s.active?.phase==="result"){
   $("net004ResultTitle").textContent="Зацепка пройдена";
   $("net004ResultDetail").textContent="Пробная оценка: "+s.active.score+
    " (технический placeholder; не утверждённый баланс). "+
    "Завершение сохранит тестовый результат, но не начислит награду.";
   $("net004Finish").disabled=blocked||busy;
  }
  $("net004History").replaceChildren();
  const recent=s.completed.slice(-3).reverse();
  if(recent.length)$("net004History").append(line("Тестовые завершения: "+
   recent.map(e=>"№"+e.serial+" ("+(names[e.templateId]||e.templateId)+")").join(" · ")));
  $("net004Claim").disabled=true;
  document.querySelectorAll("#network [data-net-action]").forEach(el=>{
   if(el.dataset.netAction!=="fight")el.disabled=blocked||busy||
    (el.dataset.netAction==="finish"&&s.active?.phase!=="result");
  });
 }
 async function change(action,value){
  if(!session||session.isBlocked())return;
  notice="";
  let result;
  try{result=await session.change(action,value);}catch(_){result={ok:false,code:"SAVE_FAILED"};}
  if(!result.ok)notice=errorText[result.code]||"Действие отклонено: "+result.code;
  render();
  if(result.ok&&action==="approach"&&session.read()?.active?.phase==="battle")
   onSquad();
 }
 function mount({pilot,onOpenSquad}={}){
  if(mounted||!pilot||typeof onOpenSquad!=="function"||!$("network"))return false;
  session=pilot;onSquad=onOpenSquad;mounted=true;
  $("network").addEventListener("click",event=>{
   const b=event.target.closest?.("[data-net-action]");
   if(!b||!$("network").contains(b))return;
   const action=b.dataset.netAction;
   if(action==="fight"){if(session.isReady()&&session.read()?.active?.phase==="battle")onSquad();return;}
   if(!["refresh","start","prepare","approach","abandon","finish"].includes(action))return;
   const arg=action==="start"?Number(b.dataset.netValue):b.dataset.netValue;
   void change(action,arg);
  });
  render();
  pilot.open().then(result=>{
   if(!result.ok)notice=errorText[result.code]||result.code;
   render();
  }).catch(()=>{notice="Не удалось загрузить тестовую сеть.";render();});
  return true;
 }
 return Object.freeze({mount,render});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkPilotUI;
