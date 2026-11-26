"use strict";
// Accepted R5.7 tree/adventure view, shared by live locked route and the isolated real TreeR1 pilot.
const R2APath=(()=>{
 const defs={
 base:{tag:"БЕЗ СПЕЦИАЛИЗАЦИИ",title:"Без дополнительного навыка",name:"Не выбрана",text:"Все обычные способности Арта остаются доступными при любом выборе.",use:"Если хотите использовать только обычные способности.",cost:"Дополнительная способность не назначается."},
 "guardian-2":{tag:"ХРАНИТЕЛЬ",title:"Перехват",name:"Хранитель · Перехват",text:"Арт принимает следующую одиночную атаку вместо выбранного союзника и получает прикрытие на один удар.",use:"Один союзник под угрозой сильного удара.",cost:"Тратится ход Арта. Он сам принимает урон; массовые атаки не перехватываются."},
 "command-2":{tag:"КОМАНДИР",title:"Переброска резерва",name:"Командир · Переброска резерва",text:"Арт отдаёт союзнику часть собственного запаса защиты до заполнения его шкалы и даёт прикрытие на один удар.",use:"У союзника иссякла защита, а у Арта ещё есть запас.",cost:"Тратится ход и собственная защита Арта. Новая защита не создаётся."}
};
 const markup="<section data-field=\"tree\" class=\"tree-screen\" hidden>\n<section class=\"tree-left\"><div class=\"mini-hero\"><img src=\"assets/art-portrait-roster.webp\" alt=\"\"><div><small class=\"eyebrow\">АРТ</small><h2>Специализация</h2><p>Одна дополнительная способность. Обычные навыки остаются.</p></div></div><div class=\"graph\" aria-label=\"Дерево специализации\"><button class=\"root node\" data-node=\"base\"><img src=\"assets/hero-card-r57/medal-base.svg\" alt=\"\"><span>Без специализации</span><small data-field=\"baseStatus\">Выбрано</small></button><div class=\"fork\" aria-hidden=\"true\"></div><div class=\"branches\"><button class=\"node\" data-node=\"guardian-2\"><img src=\"assets/hero-card-r57/medal-guardian.svg\" alt=\"\"><span>Хранитель</span><span class=\"branch-effect\">Перехват удара</span><small data-field=\"guardianStatus\">Освоен</small></button><button class=\"node\" data-node=\"command-2\"><img src=\"assets/hero-card-r57/medal-commander.svg\" alt=\"\"><span>Командир</span><span class=\"branch-effect\">Передача защиты</span><small data-field=\"commandStatus\">Освоен</small></button></div></div></section>\n<section class=\"detail\"><small class=\"eyebrow\" data-field=\"nodeTag\">БАЗОВЫЙ НАБОР</small><h2 data-field=\"nodeTitle\">Обычные навыки</h2><p data-field=\"nodeText\"></p><div class=\"impact\"><p><b>Когда полезно</b><span data-field=\"nodeUse\"></span></p><p><b>Цена решения</b><span data-field=\"nodeCost\"></span></p></div><div class=\"detail-footer\"><p data-field=\"nodeHint\"></p><button data-field=\"equip\" class=\"primary\"></button></div></section>\n</section>\n<section data-field=\"story\" class=\"story-screen\" hidden><div class=\"story-art\"><img src=\"assets/art-portrait-roster.webp\" alt=\"Арт\"></div><section class=\"story-content\"><small class=\"eyebrow\">ЛИЧНОЕ ПРИКЛЮЧЕНИЕ · АРТ</small><h1 data-field=\"storyTitle\">Личное обязательство</h1><p data-field=\"storyText\"></p><div class=\"rule\"></div><p data-field=\"storyUnlock\"></p><div data-field=\"storyRequirements\"></div><div data-field=\"storyMissions\"></div><button data-field=\"storyAction\" class=\"primary\">К специализации</button></section></section>";
 const get=id=>document.getElementById(id);
 function create(adapter){
  const dlg=document.createElement("dialog");dlg.className="hero-card-dialog r2a-path";dlg.setAttribute("aria-label","Путь Арта");
  dlg.innerHTML='<header class="r2a-path-head"><button type="button" class="ghost r2a-path-back">‹ Назад</button><div><small>ПЕПЕЛЬНЫЙ ПРЕСТОЛ</small><strong data-field="title">Специализация</strong></div></header>'+markup;
  document.body.append(dlg);
  const field=id=>dlg.querySelector('[data-field="'+id+'"]');
  const put=(id,t)=>{field(id).textContent=t};
  let node="base",screen="tree",previous=null;
  function show(next){screen=next;field("tree").hidden=screen!=="tree";field("story").hidden=screen!=="story";put("title",screen==="tree"?"Специализация":"Личное приключение");render();}
  function render(){
   const v=adapter.view(),chosen=v.selected||"base",earned=v.earned||[],ready=!!v.arc,d=defs[node];
   for(const b of dlg.querySelectorAll("[data-node]")){
    const id=b.dataset.node;b.setAttribute("aria-pressed",String(node===id));b.dataset.equipped=String(chosen===id);b.dataset.locked=String(id!=="base"&&!earned.includes(id));
   }
   const state=id=>chosen===id?"Активен":earned.includes(id)?"Освоен":"Закрыт";
   put("baseStatus",chosen==="base"?"Выбрано":"Снять специализацию");put("guardianStatus",state("guardian-2"));put("commandStatus",state("command-2"));
   put("nodeTag",d.tag);put("nodeTitle",d.title);put("nodeText",d.text);put("nodeUse",d.use);put("nodeCost",d.cost);
   const locked=node!=="base"&&!earned.includes(node);
   put("nodeHint",v.blocked|| (locked?"Откроется после личного приключения.":node===chosen?(node==="base"?"Дополнительный навык не назначен.":"Сейчас выбрана эта техника."):"Выбор действует в следующем бою."));
   const equip=field("equip");equip.textContent=locked?"Как открыть":node===chosen?"Уже выбрано":node==="base"?"Снять специализацию":"Выбрать способность";
   equip.disabled=node===chosen||(!locked&&(!adapter.equip||!!v.blocked||v.pending||v.active));
   put("storyTitle",ready?"Личное обязательство":"Приключение Арта");
   put("storyText",ready?"Арт завершил личное приключение. Теперь доступны две дополнительные техники.":adapter.production?"Личное приключение Арта пока недоступно.":"Продолжайте кампанию и подготовьте Арта к личному приключению.");
   put("storyUnlock",ready?"Выберите одну из двух освоенных техник.":adapter.production?"Когда приключение станет доступно, его завершение откроет специализации.":"Требования к открытию приключения");
   const req=field("storyRequirements"),missions=field("storyMissions");req.replaceChildren();missions.replaceChildren();
   if(!ready&&!adapter.production){
    for(const r of v.nodes?.[0]?.requirements||[]){const p=document.createElement("p");p.textContent=(r.ok?"✓ ":"○ ")+r.label+" "+r.value+"/"+r.need;req.append(p)}
    for(const m of v.missions?.filter(m=>m.arc)||[]){const b=document.createElement("button");b.type="button";b.className="secondary";b.dataset.pathMission=m.id;b.textContent=m.name+(m.ok?"":" · "+m.reason);b.disabled=!m.ok||!!v.blocked||v.pending||v.active;b.onclick=()=>{if(adapter.start){dlg.close();adapter.start(m.id)}};missions.append(b);}
   }
   const action=field("storyAction");action.textContent=ready?"К специализации":"К карточке героя";
  }
  for(const b of dlg.querySelectorAll("[data-node]"))b.onclick=()=>{node=b.dataset.node;render()};
  field("equip").onclick=()=>{const v=adapter.view();if(node!=="base"&&!v.earned.includes(node)){show("story");return;}if(adapter.equip?.(node==="base"?null:node)){adapter.changed?.();render();}};
  field("storyAction").onclick=()=>{if(adapter.view().arc)show("tree");else dlg.close()};
  dlg.querySelector(".r2a-path-back").onclick=()=>dlg.close();
  dlg.addEventListener("close",()=>{adapter.closed?.();if(previous?.isConnected)previous.focus();previous=null});
  function open(next="tree"){if(dlg.open){show(next);return}previous=document.activeElement;node=adapter.view().selected||"base";show(next);dlg.showModal();adapter.opened?.();}
  return Object.freeze({open,close:()=>{if(dlg.open)dlg.close()},isOpen:()=>dlg.open,refresh:()=>{if(dlg.open)render()}});
 }
 let prodPath=null,prodView=null,compact=null,modal=null,moved=null;
 function restore(){
  if(!moved)return;
  compact.before(moved);moved=null;
  // Restore level before stars, regardless of which panel was last opened.
  const level=compact.parentNode.querySelector(".hero-card-level"),stars=compact.parentNode.querySelector(".star-panel");
  if(level&&stars)stars.before(level);
 }
 function setupProduction(){
  const root=get("heroDetail"),panel=root?.querySelector(".hero-detail-progression"),links=panel?.querySelector(".hero-card-links");
  if(!root||!links)return;
  compact=document.createElement("div");compact.id="r2aCompact";compact.hidden=true;
  compact.innerHTML='<small class="r2a-kicker">РАЗВИТИЕ</small><button type="button" id="r2aLevel" class="r2a-secondary"><span>Уровень <b></b></span><span>›</span></button><button type="button" id="r2aStars" class="r2a-secondary"><span>Звёздный ранг <b></b></span><span>›</span></button><small class="r2a-kicker">ПУТЬ ГЕРОЯ</small><button type="button" id="r2aTree" class="r2a-feature"><img src="assets/hero-card-r57/medal-guardian.svg" alt=""><span><strong>Специализация</strong><small>Не выбрана</small></span><span>›</span></button><button type="button" id="r2aStory" class="r2a-feature"><img src="assets/hero-card-r57/icon-adventure.svg" alt=""><span><strong>Личное приключение</strong><small>Пока недоступно</small></span><span>›</span></button>';
  links.before(compact);
  modal=document.createElement("dialog");modal.id="r2aProgressDialog";modal.className="hero-card-dialog";modal.setAttribute("aria-labelledby","r2aProgressTitle");
  modal.innerHTML='<div class="hero-card-dialog-heading"><h2 id="r2aProgressTitle"></h2><button type="button" id="r2aProgressClose" class="ghost" aria-label="Закрыть">×</button></div><div class="hero-card-dialog-body"></div>';
  root.append(modal);
  modal.addEventListener("close",restore);get("r2aProgressClose").onclick=()=>modal.close();
  function openProgress(kind){
   if(modal.open)return;restore();
   moved=panel.querySelector(kind==="level"?".hero-card-level":".star-panel");if(!moved)return;
   get("r2aProgressTitle").textContent=kind==="level"?"Уровень Арта":"Звёздный ранг Арта";
   modal.querySelector(".hero-card-dialog-body").append(moved);modal.showModal();
  }
  get("r2aLevel").onclick=()=>openProgress("level");get("r2aStars").onclick=()=>openProgress("stars");
  prodPath=create({production:true,view:()=>prodView,
   opened:()=>{if(typeof RenCard3D!=="undefined")RenCard3D.dispose()},
   closed:()=>{if(get("heroDetail")?.classList.contains("active")&&typeof selectedHeroId!=="undefined"&&selectedHeroId==="art"&&typeof RenCard3D!=="undefined")void RenCard3D.activate("art")}});
  get("r2aTree").onclick=()=>prodPath.open("tree");get("r2aStory").onclick=()=>prodPath.open("story");
 }
 function syncProduction(heroId,progress){
  if(heroId!=="art"){if(compact){compact.hidden=true;if(modal.open)modal.close();restore();prodPath.close()}return;}
  if(!compact)setupProduction();if(!compact)return;
  compact.hidden=false;
  get("r2aLevel").querySelector("b").textContent=String(ProgressCore.levelOf(progress,"art"));
  get("r2aStars").querySelector("b").textContent="★ "+StarCore.rankOf(progress,"art");
  // Story/balance are not released. Do not copy isolated pilot state into the live wallet.
  prodView={selected:null,earned:[],arc:null};prodPath.refresh();
 }
 return Object.freeze({create,syncProduction});
})();
