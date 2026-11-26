"use strict";
// R2/A: isolated UI prototype. No gameplay, wallet, save or canon mutations.
const $=id=>document.getElementById(id);
const defs={
 base:{tag:"БЕЗ СПЕЦИАЛИЗАЦИИ",title:"Без дополнительного навыка",name:"Не выбрана",text:"Все обычные способности Арта остаются доступными при любом выборе.",use:"Если хотите использовать только обычные способности.",cost:"Дополнительная способность не назначается."},
 "guardian-2":{tag:"ХРАНИТЕЛЬ",title:"Перехват",name:"Хранитель · Перехват",text:"Арт принимает следующую одиночную атаку вместо выбранного союзника и получает прикрытие на один удар.",use:"Один союзник под угрозой сильного удара.",cost:"Тратится ход Арта. Он сам принимает урон; массовые атаки не перехватываются."},
 "command-2":{tag:"КОМАНДИР",title:"Переброска резерва",name:"Командир · Переброска резерва",text:"Арт отдаёт союзнику часть собственного запаса защиты до заполнения его шкалы и даёт прикрытие на один удар.",use:"У союзника иссякла защита, а у Арта ещё есть запас.",cost:"Тратится ход и собственная защита Арта. Новая защита не создаётся."}
};
let stage="ready",screen="card",chosen="base",node="base";
function show(id){screen=id;for(const s of ["card","tree","story"])$(s).hidden=s!==id;$("back").hidden=id==="card";$("screenTitle").textContent=({card:"Соратник",tree:"Специализация",story:"Личное приключение"})[id];document.documentElement.dataset.screen=id;render()}
function render(){
 const ready=stage==="ready",d=defs[node];document.documentElement.dataset.stage=stage;document.documentElement.dataset.chosen=chosen;
 $("level").textContent=ready?"3":"1";$("cardBuild").textContent=defs[chosen].name;$("storyStatus").textContent=ready?"Завершено":"Впереди";$("cardTip").textContent=ready?"Доступна новая тактика. Выберите, как Арт будет защищать союзников.":"Развивайте Арта, чтобы открыть его личное приключение.";$("primary").firstChild.nodeValue=ready?"Выбрать специализацию ":"Как открыть приключение ";
 for(const b of document.querySelectorAll("[data-node]")){const id=b.dataset.node;b.setAttribute("aria-pressed",String(node===id));b.dataset.equipped=String(chosen===id);b.dataset.locked=String(!ready&&id!=="base")}
 $("baseStatus").textContent=chosen==="base"?"Выбрано":"Снять специализацию";$("guardianStatus").textContent=!ready?"Закрыт":chosen==="guardian-2"?"Активен":"Освоен";$("commandStatus").textContent=!ready?"Закрыт":chosen==="command-2"?"Активен":"Освоен";
 $("nodeTag").textContent=d.tag;$("nodeTitle").textContent=d.title;$("nodeText").textContent=d.text;$("nodeUse").textContent=d.use;$("nodeCost").textContent=d.cost;
 $("nodeHint").textContent=!ready&&node!=="base"?"Откроется после личного приключения.":node===chosen?(node==="base"?"Дополнительный навык не назначен.":"Сейчас выбрана эта техника."):"Выбор действует в следующем бою.";
 $("equip").textContent=!ready&&node!=="base"?"Как открыть":node===chosen?"Уже выбрано":node==="base"?"Снять специализацию":"Выбрать способность";$("equip").disabled=node===chosen;
 $("storyTitle").textContent=ready?"Личное обязательство":"Приключение Арта";$("storyText").textContent=ready?"Арт завершил личное приключение. Теперь доступны две дополнительные техники.":"Продолжайте кампанию и подготовьте Арта к личному приключению.";$("storyUnlock").textContent=ready?"Выберите одну из двух освоенных техник.":"Для текущего пилота: уровень 3, 1 звезда, G1, особый навык 2. Приключение нельзя купить.";$("storyAction").textContent=ready?"К специализации":"К развитию героя";
}
$("stage").onchange=e=>{stage=e.target.value;chosen=node="base";show("card")};$("back").onclick=()=>show("card");$("openTree").onclick=()=>{node=chosen;show("tree")};$("openStory").onclick=()=>show("story");$("primary").onclick=()=>stage==="ready"?$("openTree").click():show("story");$("storyAction").onclick=()=>stage==="ready"?$("openTree").click():show("card");
for(const b of document.querySelectorAll("[data-node]"))b.onclick=()=>{node=b.dataset.node;render()};$("equip").onclick=()=>{if(stage!=="ready"&&node!=="base"){show("story");return}chosen=node;render()};
function info(title,text){$("infoTitle").textContent=title;$("infoText").textContent=text;$("r4Recipe").hidden=true;$("r4Recipe").replaceChildren();$("info").showModal()}
$("closeInfo").onclick=()=>$("info").close();$("growth").onclick=()=>info("Развитие Арта","Уровни, звёзды, снаряжение и улучшение навыков находятся в обычной карточке героя. Этот макет показывает только навигацию; покупок и изменения ресурсов нет.");
for(const [id,label,description] of [["basic","Базовая атака","Обычная атака Арта."],["special","Страховочный узел","Обычный защитный навык Арта."],["powerful","Снять нагрузку","Мощная атака Арта."],["passive","Знать предел","Пассивная способность Арта."],["leader","Работа по риску","Лидерская способность Арта."]]){const b=document.createElement("button");b.type="button";b.setAttribute("aria-label",label);b.append(AbilityIconCore.element("art",id,"skill-art"));b.onclick=()=>info(label,description);$("skills").append(b)}
show("card");
// R4: existing catalog and production glyph paths; read-only lab, no invented inventory.
const gearPaths={
  basic:'M5 31 29 5 32 4 31 9 9 33 M4 23 13 32 M4 34 8 30',
  special:'M6 8 16 18 6 28 M30 8 20 18 30 28 M18 3 18 10 M18 26 18 33',
  powerful:'M18 3 18 12 M18 24 18 33 M3 18 12 18 M24 18 33 18 M7 7 13 13 M23 23 29 29 M7 29 13 23 M23 13 29 7',
  passive:'M5 30 12 20 20 23 29 6 M23 6 29 6 30 12',
  leader:'M11 16 11 10 C11 1 25 1 25 10 L25 16 M8 16 28 16 28 32 8 32 Z',
  torso:'M12 5 5 10 2 20 8 23 10 17 10 32 26 32 26 17 28 23 34 20 31 10 24 5 M12 5 Q18 14 24 5',
  head:'M11 30 11 22 C1 7 10 3 18 3 C26 3 35 7 25 22 L25 30 Z',
  hands:'M8 29 5 19 8 16 13 20 13 7 17 7 17 18 20 6 24 7 23 19 28 12 31 14 27 28 21 32 12 32 Z',
  feet:'M10 3 23 3 23 21 31 25 31 32 6 32 6 26 10 21 Z',
  utility:'M3 13 33 13 33 25 3 25 Z M14 10 22 10 22 28 14 28 Z',
  find:'M24 15 A9 9 0 1 1 6 15 A9 9 0 1 1 24 15 M23 23 32 32'};
function gearIcon(kind){const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("viewBox","0 0 36 36");svg.setAttribute("aria-hidden","true");const p=document.createElementNS(svg.namespaceURI,"path");p.setAttribute("d",gearPaths[kind==="weapon"?"basic":kind]);p.setAttribute("fill","none");p.setAttribute("stroke","currentColor");p.setAttribute("stroke-width","2");p.setAttribute("stroke-linecap","round");p.setAttribute("stroke-linejoin","round");svg.append(p);return svg}
for(const slot of GearData.SLOTS){
 const b=document.createElement("button");b.type="button";b.className="r4-gear-slot";b.dataset.slot=slot.id;b.setAttribute("aria-label",slot.label+" · рецепт G1");
 const label=document.createElement("small");label.textContent=slot.label;b.append(gearIcon(slot.id),label);
 b.onclick=()=>{const item=GearData.offered("tank",slot.id,1)[0];if(!item){info(slot.label,"Рецепт недоступен.");return;}info(item.name,"G1 · рецепт из действующего каталога. Здесь только просмотр; экипировка и ресурсы не изменяются.");const list=$("r4Recipe");list.hidden=false;for(const [id,count] of Object.entries(item.ingredients)){const line=document.createElement("div"),img=document.createElement("img"),name=document.createElement("span"),qty=document.createElement("b");img.src="assets/gear-materials/"+id+".webp";img.alt="";name.textContent=GearData.MATERIAL_LABELS[id];qty.textContent="×"+count;line.append(img,name,qty);list.append(line)}};
 $("r4Gear").append(b);
}
$("r4Stars").onclick=()=>info("Звёздный ранг","В этом макете у Арта одна звезда. Действующие улучшения и осколки остаются в обычной карточке героя.");
$("growth").onclick=()=>info("Уровень Арта","Текущий уровень в выбранном демонстрационном состоянии: "+$("level").textContent+". Повышение уровня использует действующую систему развития; этот экран не меняет сохранение.");
