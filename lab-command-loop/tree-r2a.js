"use strict";
// R2/A: isolated UI prototype. No gameplay, wallet, save or canon mutations.
const $=id=>document.getElementById(id);
const defs={
 base:{tag:"БАЗОВЫЙ НАБОР",title:"Обычные навыки",name:"Базовый набор",text:"Арт сражается и прикрывает союзников обычными способностями.",use:"Если не требуется отдельный защитный приём.",cost:"Нет дополнительного навыка. Все ходы остаются в вашем распоряжении."},
 "guardian-2":{tag:"ХРАНИТЕЛЬ",title:"Перехват",name:"Хранитель · Перехват",text:"Арт принимает следующую одиночную атаку вместо выбранного союзника и получает прикрытие на один удар.",use:"Один союзник под угрозой сильного удара.",cost:"Тратится ход Арта. Он сам принимает урон; массовые атаки не перехватываются."},
 "command-2":{tag:"КОМАНДИР",title:"Переброска резерва",name:"Командир · Переброска резерва",text:"Арт отдаёт союзнику часть собственного запаса защиты до заполнения его шкалы и даёт прикрытие на один удар.",use:"У союзника иссякла защита, а у Арта ещё есть запас.",cost:"Тратится ход и собственная защита Арта. Новая защита не создаётся."}
};
let stage="ready",screen="card",chosen="base",node="base";
function show(id){screen=id;for(const s of ["card","tree","story"])$(s).hidden=s!==id;$("back").hidden=id==="card";$("screenTitle").textContent=({card:"Соратник",tree:"Специализация",story:"Личное приключение"})[id];document.documentElement.dataset.screen=id;render()}
function render(){
 const ready=stage==="ready",d=defs[node];document.documentElement.dataset.stage=stage;document.documentElement.dataset.chosen=chosen;
 $("level").textContent=ready?"3":"1";$("cardBuild").textContent=defs[chosen].name;$("storyStatus").textContent=ready?"Завершено":"Впереди";$("cardTip").textContent=ready?"Доступна новая тактика. Выберите, как Арт будет защищать союзников.":"Развивайте Арта, чтобы открыть его личное приключение.";$("primary").firstChild.nodeValue=ready?"Выбрать специализацию ":"Как открыть приключение ";
 for(const b of document.querySelectorAll("[data-node]")){const id=b.dataset.node;b.setAttribute("aria-pressed",String(node===id));b.dataset.equipped=String(chosen===id);b.dataset.locked=String(!ready&&id!=="base")}
 $("baseStatus").textContent=chosen==="base"?"Активен":"Доступен";$("guardianStatus").textContent=!ready?"Закрыт":chosen==="guardian-2"?"Активен":"Освоен";$("commandStatus").textContent=!ready?"Закрыт":chosen==="command-2"?"Активен":"Освоен";
 $("nodeTag").textContent=d.tag;$("nodeTitle").textContent=d.title;$("nodeText").textContent=d.text;$("nodeUse").textContent=d.use;$("nodeCost").textContent=d.cost;
 $("nodeHint").textContent=!ready&&node!=="base"?"Откроется после личного приключения.":node===chosen?"Сейчас используется в бою.":"Выбор действует в следующем бою.";
 $("equip").textContent=!ready&&node!=="base"?"Как открыть":node===chosen?"Уже выбрано":node==="base"?"Вернуть базовый набор":"Выбрать способность";$("equip").disabled=node===chosen;
 $("storyTitle").textContent=ready?"Личное обязательство":"Приключение Арта";$("storyText").textContent=ready?"Арт завершил личное приключение. Теперь доступны две дополнительные техники.":"Продолжайте кампанию и подготовьте Арта к личному приключению.";$("storyUnlock").textContent=ready?"Выберите одну из двух освоенных техник.":"Для текущего пилота: уровень 3, 1 звезда, G1, особый навык 2. Приключение нельзя купить.";$("storyAction").textContent=ready?"К специализации":"К развитию героя";
}
$("stage").onchange=e=>{stage=e.target.value;chosen=node="base";show("card")};$("back").onclick=()=>show("card");$("openTree").onclick=()=>{node=chosen;show("tree")};$("openStory").onclick=()=>show("story");$("primary").onclick=()=>stage==="ready"?$("openTree").click():show("story");$("storyAction").onclick=()=>stage==="ready"?$("openTree").click():show("card");
for(const b of document.querySelectorAll("[data-node]"))b.onclick=()=>{node=b.dataset.node;render()};$("equip").onclick=()=>{if(stage!=="ready"&&node!=="base"){show("story");return}chosen=node;render()};
function info(title,text){$("infoTitle").textContent=title;$("infoText").textContent=text;$("info").showModal()}
$("closeInfo").onclick=()=>$("info").close();$("growth").onclick=()=>info("Развитие Арта","Уровни, звёзды, снаряжение и улучшение навыков находятся в обычной карточке героя. Этот макет показывает только навигацию; покупок и изменения ресурсов нет.");
for(const [id,label,description] of [["basic","Базовая атака","Обычная атака Арта."],["special","Страховочный узел","Обычный защитный навык Арта."],["powerful","Снять нагрузку","Мощная атака Арта."],["passive","Знать предел","Пассивная способность Арта."],["leader","Работа по риску","Лидерская способность Арта."]]){const b=document.createElement("button");b.type="button";b.setAttribute("aria-label",label);b.append(AbilityIconCore.element("art",id,"skill-art"));b.onclick=()=>info(label,description);$("skills").append(b)}
show("card");