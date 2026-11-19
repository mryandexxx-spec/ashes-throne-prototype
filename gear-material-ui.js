// Shared presentation of the seven physical equipment materials.
const GearMaterialUI=(()=>{
 "use strict";
 const descriptions=Object.freeze({
  Fe:"Тяжёлые железные заготовки. Из них куют клинки и металлические детали доспехов.",
  Le:"Выделанная кожа. Идёт на перчатки, сапоги и усиление походной одежды.",
  Cl:"Тканое полотно для капюшонов, одежды и мягких подкладок.",
  Wo:"Деревянные заготовки для луков, рукоятей и жезлов.",
  Fa:"Скобы, гвозди и другие мелкие детали, которыми скрепляют части снаряжения.",
  Th:"Кручёная нить для прочных швов на коже и ткани. Нужна и при изготовлении луков.",
  Gl:"Стекло для линз и вставок. Входит, например, в рецепт жезла с линзой."
 });
 const valid=n=>Number.isSafeInteger(n)&&n>=0;
 const icon=id=>"assets/gear-materials/"+id+".webp?v=1";
 function tile(id,quantity,need=null){
  if(!Object.hasOwn(descriptions,id)||!(quantity===null||valid(quantity))||
    !(need===null||valid(need)))return "";
  const label=GearData.MATERIAL_LABELS[id],recipe=need!==null;
  const count=recipe?quantity+"/"+need:quantity===null?"":"×"+quantity;
  const available=recipe&&quantity>=need;
  const details=recipe?"Есть "+quantity+" из "+need+(available?", достаточно":", не хватает "+(need-quantity)):
   count?label+" "+count:label;
  return '<button type="button" class="material-tile'+(recipe?(available?' is-ready':' is-short'):'')+
   '" data-material="'+id+'"'+(recipe?' data-need="'+need+'"':'')+
   ' aria-haspopup="dialog" aria-controls="materialDialog" aria-label="'+(recipe?label+'. ':'')+
   details+'" title="'+label+'"><img width="40" height="40" alt="'+label+'" src="'+icon(id)+'">'+
   (recipe?'<span class="material-check" aria-hidden="true">'+(available?'✓':'−')+'</span>':'')+
   (count?'<span class="material-count" aria-hidden="true">'+count+'</span>':'')+'</button>';
 }
 function group(materials,{stock=false,inventory=null}={}){
  const tiles=GearData.MATERIALS.filter(id=>valid(materials?.[id])&&(stock||materials[id]>0))
   .map(id=>inventory?tile(id,inventory[id],materials[id]):tile(id,materials[id])).join("");
  return tiles?'<span class="material-group">'+tiles+'</span>':"";
 }
 function append(host,materials,options){
  const html=group(materials,options);
  if(html)host.insertAdjacentHTML("beforeend",html);
 }
 function sources(id,profile,campaign,{liveNetwork=false,weekly=false,day=null}={}){
  const sections=[];
  const add=(title,lines)=>{if(lines.length)sections.push({title,lines});};
  const missions=GearSourceData.findSources(id,campaign,profile.energy?.value);
  add("Миссии кампании",missions.map(s=>{
   const gate=s.access==="locked"?"сначала «"+s.missingPrerequisites.map(m=>MissionData.get(m).title).join("», «")+"»":
    s.access==="first-clear"?"первый вход бесплатно":s.access==="repeat"?"повтор за "+s.energyCost+" ⚡":"за победу";
   return s.title+" · ×"+s.quantity+" · "+gate;
  }));
  if(liveNetwork){
   const lines=NetworkData.LIVE_CATALOG.templates.filter(t=>t.materialId===id).map(t=>{
    const qty=NetworkLiveEconomy.preview(t.rewardRef)?.materials[id];
    if(!qty)return null;
    const region=NetworkData.LIVE_CATALOG.regions.find(r=>r.id===t.regionId);
    return region.name+" · ×"+qty+" за зацепку · влияние от "+t.minInfluence;
   }).filter(Boolean);
   add("Разведсеть · снабжение",lines);
  }
  if(weekly)add("Главная угроза · раз в неделю",WeeklyThreatCore.TIERS.flatMap(t=>
   t.materials[id]>0?[t.score+" очков · ×"+t.materials[id]]:[]));
  add("Задания дня",DailyCore.TASKS.filter(t=>t.materials[id]>0).map(t=>t.label+" · ×"+t.materials[id]));
  const days=day&&LoginCore.daysInMonth(day.slice(0,7)),calendar=[];
  for(let i=1;i<=days;i++){
   const n=LoginCore.rewardForDay(i).materials[id];
   if(n)calendar.push(i+"-й (×"+n+")");
  }
  add("Календарь входа",calendar.length?["Дни получения в этом месяце: "+calendar.join(", ")]:[]);
  if(typeof LoreActOneRewardCore!=="undefined")add("Пять теней · один раз за акт",
   LoreActOneRewardCore.ACTS.filter(a=>a.source.reward.materials[id]>0).map(a=>
    "Акт "+a.act+" · ×"+a.source.reward.materials[id]+
    (profile.rewardReceipts?.some(r=>r.id===a.receiptId)?" · получено":"")));
  return sections;
 }
 function mount(getState){
  const dialog=document.getElementById("materialDialog");
  if(!dialog)return;
  const get=id=>document.getElementById(id);
  const close=get("materialClose"),find=get("materialFind");
  let origin=null;
  document.addEventListener("click",event=>{
   const button=event.target.closest?.("button[data-material]");
   if(!button||dialog.open)return;
   const id=button.dataset.material;
   if(!Object.hasOwn(descriptions,id))return;
   const {profile,campaign,liveNetwork,weekly,day}=getState();
   const name=GearData.MATERIAL_LABELS[id];
   const stock=profile.materials?.[id],need=button.dataset.need;
   origin=button;
   get("materialIcon").src=icon(id);get("materialName").textContent=name;
   get("materialDescription").textContent=descriptions[id];
   get("materialStock").textContent=(valid(stock)?"В запасе "+stock:"Запас неизвестен")+
    (need===undefined?"":" · Нужно "+need+(stock<Number(need)?" · Не хватает "+(Number(need)-stock):" · Достаточно"));
   const list=get("materialSources");list.replaceChildren();
   for(const {title,lines} of sources(id,profile,campaign,{liveNetwork,weekly,day})){
    const section=document.createElement("section"),heading=document.createElement("h4"),ul=document.createElement("ul");
    heading.textContent=title;
    for(const text of lines){const li=document.createElement("li");li.textContent=text;ul.append(li);}
    section.append(heading,ul);list.append(section);
   }
   if(!list.childElementCount)list.textContent="В каталоге пока нет источников.";
   find.hidden=!button.closest("#gearUxRight");
   dialog.showModal();get("materialBody").scrollTop=0;close.focus({preventScroll:true});
  });
  close.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",e=>{
   if(e.target!==dialog)return;
   const r=dialog.getBoundingClientRect();
   if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();
  });
  dialog.addEventListener("close",()=>{
   if(origin?.isConnected)origin.focus({preventScroll:true});
   origin=null;
  });
  find.addEventListener("click",()=>{
   const id=origin?.dataset.material;
   origin=null;dialog.close();
   if(id)GearUX004.showSources(id);
  });
 }
 return Object.freeze({tile,group,append,mount,sources});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=GearMaterialUI;
