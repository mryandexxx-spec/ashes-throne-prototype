// RESICON001: display-only Account XP and skill materials. No reward or wallet writes.
const ResourceIconUI=(()=>{
 "use strict";
 const IDS=Object.freeze(["account-xp","manual1","manual2","seal"]);
 const LABELS=Object.freeze({
  "account-xp":"Опыт аккаунта",manual1:"Учебник I",manual2:"Учебник II",seal:"Печать мастерства"
 });
 const DESCRIPTIONS=Object.freeze({
  "account-xp":"Повышает уровень аккаунта, открывая доступ к новым возможностям и пределам развития героев. Уровень героя повышается за игровую валюту, не за отдельный опыт.",
  manual1:"Материал раннего обучения: требуется для улучшения способностей с уровня 2 до 3 и с 3 до 4.",
  manual2:"Продвинутый учебник: требуется для улучшения способностей с уровня 4 до 5 и с 5 до 6.",
  seal:"Редкий материал, необходимый при улучшении способности с уровня 5 до 6."
 });
 // Replace one art without rebuilding the atlas: OVERRIDES.manual1="assets/resources/new-book.webp?v=2".
 const OVERRIDES=Object.create(null);
 const valid=n=>Number.isSafeInteger(n)&&n>=0;
 const known=id=>Object.prototype.hasOwnProperty.call(LABELS,id);
 const art=id=>{
  if(!known(id))return "";
  const override=OVERRIDES[id];
  const extra=typeof override==="string"&&/^assets\/[a-zA-Z0-9/_.-]+\.webp(?:\?v=\d+)?$/.test(override)
   ?' style="background-image:url(&quot;'+override+'&quot;);background-size:contain;background-position:center"':"";
  return '<span class="resource-art resource-art--'+id+'" aria-hidden="true"'+extra+'></span>';
 };
 function tile(id,quantity=null,{stock=null,need=null,mode="reward",compact=false}={}){
  if(!known(id)||!(quantity===null||valid(quantity))||
    !(stock===null||valid(stock))||!(need===null||valid(need)))return "";
  const recipe=need!==null,available=recipe&&stock>=need;
  const count=recipe?(stock===null?"?/":stock+"/")+need:
   quantity===null?"":id==="account-xp"?(mode==="reward"?"+":"")+quantity+" XP":
   "×"+quantity;
  const detail=recipe?"Есть "+(stock??"неизвестно")+", нужно "+need:
   quantity===null?"":(mode==="reward"?"Награда: ":"Количество: ")+quantity;
  return '<button type="button" class="resource-chip'+(compact?' resource-chip--compact':'')+
   (recipe?(available?' resource-chip--ready':' resource-chip--short'):'')+
   '" data-resource-id="'+id+'"'+(recipe?' data-resource-need="'+need+'"':'')+
   ' aria-haspopup="dialog" aria-controls="resourceDialog" aria-label="'+LABELS[id]+
   (detail?'. '+detail:'')+'. Открыть описание и источники">'+
   art(id)+(count?'<span class="resource-amount">'+count+'</span>':'')+'</button>';
 }
 function rewards(xp=0,materials=null,{compact=false}={}){
  const chunks=[];
  if(valid(xp)&&xp>0)chunks.push(tile("account-xp",xp,{compact}));
  for(const id of IDS.slice(1)){
   const n=materials?.[id];
   if(valid(n)&&n>0)chunks.push(tile(id,n,{compact}));
  }
  return chunks.length?'<span class="resource-group">'+chunks.join("")+'</span>':"";
 }
 function append(host,xp=0,materials=null,options={}){
  if(!host)return;
  const markup=rewards(xp,materials,options);
  if(markup)host.insertAdjacentHTML("beforeend",markup);
 }
 function appendCost(host,cost,inventory){
  if(!host)return;
  const markup=IDS.slice(1).filter(id=>valid(cost?.[id])&&cost[id]>0)
   .map(id=>tile(id,cost[id],{stock:valid(inventory?.[id])?inventory[id]:null,need:cost[id]})).join("");
  if(markup)host.insertAdjacentHTML("beforeend",'<span class="resource-group">'+markup+'</span>');
 }
 function sources(id,day){
  if(!known(id))return [];
  const rows=[];
  const add=(title,detail,screen)=>rows.push({title,detail,screen});
  if(id==="account-xp")add("Сюжетная кампания","Опыт за предусмотренные награды миссий и первые победы.","campaign");
  if(typeof DailyCore!=="undefined"){
   const tasks=DailyCore.TASKS.filter(t=>id==="account-xp"?t.xp>0:(t.skillMaterials?.[id]??0)>0);
   if(tasks.length)add("Задания дня",tasks.map(t=>t.label+" · +"+
    (id==="account-xp"?t.xp:t.skillMaterials[id])).join("; "),"dailyTasks");
  }
  if(typeof LoginCore!=="undefined"){
   const days=typeof day==="string"&&day.length>=7?LoginCore.daysInMonth(day.slice(0,7)):null;
   const dates=[];
   if(days)for(let n=1;n<=days;n++){
    const reward=LoginCore.rewardForDay(n);
    const amount=id==="account-xp"?reward?.xp:reward?.skillMaterials?.[id];
    if(amount>0)dates.push(n);
   }
   if(dates.length)add("Календарь входа",
    id==="account-xp"?"Опыт входит в ежедневные награды календаря.":
    "Дни месяца: "+dates.join(", ")+" · по 1 шт.","loginCalendar");
  }
  if(id==="account-xp")add("Повторные боевые миссии","XP начисляется в предусмотренных ресурсных повторах и симуляциях.","campaign");
  return rows;
 }
 function mount(getState,navigate){
  const dialog=document.getElementById("resourceDialog");
  if(!dialog||typeof getState!=="function")return;
  const get=id=>document.getElementById(id);
  let origin=null;
  document.addEventListener("click",event=>{
   const trigger=event.target.closest?.("button[data-resource-id]");
   if(!trigger||dialog.open)return;
   const id=trigger.dataset.resourceId;
   if(!known(id))return;
   const state=getState()||{},have=state.progress?.skillMaterials?.[id];
   const need=trigger.dataset.resourceNeed;
   const stock=id==="account-xp"
    ?"Всего получено: "+(state.progress?.accountXp??"—")+" XP":
    "В запасе: "+(valid(have)?have:"неизвестно")+
      (need===undefined?"":", нужно "+need);
   origin=trigger;
   get("resourceDialogTitle").textContent=LABELS[id];
   get("resourceDialogArt").innerHTML=art(id);
   get("resourceDialogStock").textContent=stock;
   get("resourceDialogDescription").textContent=DESCRIPTIONS[id];
   const host=get("resourceDialogSources");host.replaceChildren();
   for(const item of sources(id,state.day)){
    const section=document.createElement("section"),body=document.createElement("div");
    const name=document.createElement("strong"),desc=document.createElement("p");
    section.className="resource-source";name.textContent=item.title;desc.textContent=item.detail;
    body.append(name,desc);section.append(body);
    if(item.screen&&typeof navigate==="function"){
     const go=document.createElement("button");go.type="button";
     go.className="ghost";go.textContent="Перейти";go.dataset.resourceRoute=item.screen;
     section.append(go);
    }
    host.append(section);
   }
   if(!host.childElementCount)host.textContent="Подтверждённых игровых источников пока нет.";
   dialog.showModal();get("resourceDialogBody").scrollTop=0;
   get("resourceDialogClose").focus({preventScroll:true});
  });
  get("resourceDialogClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{
   const go=event.target.closest?.("[data-resource-route]");
   if(go&&dialog.contains(go)){
    const screen=go.dataset.resourceRoute;origin=null;dialog.close();
    const parent=document.getElementById("skillUpgradeDialog");
    if(parent?.open)parent.close();
    if(typeof navigate==="function")navigate(screen);
    return;
   }
   if(event.target!==dialog)return;
   const r=dialog.getBoundingClientRect();
   if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  });
  dialog.addEventListener("close",()=>{
   if(origin?.isConnected)origin.focus({preventScroll:true});
   origin=null;
  });
 }
 return Object.freeze({IDS,LABELS,OVERRIDES,art,tile,rewards,append,appendCost,sources,mount});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ResourceIconUI;
