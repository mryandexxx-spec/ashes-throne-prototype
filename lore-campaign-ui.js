/* LC-003: generic scene runtime and safe lore-only saves; no authored story yet. */
const LoreCampaignUI=(()=>{
 "use strict";
 const escMap={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};
 const escapeHtml=value=>String(value).replace(/[&<>"']/g,ch=>escMap[ch]);
 let root=null,data=null,core=null,catalog=null,progress=null,sceneRuntime=null,notice="";
 let view="stories",storyId=null,nodeId=null,layerId=null,globalKeyRegistered=false;
 const hasOwn=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 function nodeStatus(node,c= catalog,p=progress,engine=core){
  const completed=p?.stories?.[node.storyId]?.completedNodeIds;
  if(Array.isArray(completed)&&completed.includes(node.id))
   return Object.freeze({code:"completed",label:"Пройдено",reason:"Этот узел уже пройден. Повторное прохождение появится на следующем этапе."});
  if(engine.available(c,p,node.id))
   return Object.freeze({code:"available",label:"Доступно",reason:"Условия открытия выполнены. Игровая сцена находится в разработке."});
  return Object.freeze({code:"locked",label:"Закрыто",reason:"Для открытия завершите предыдущий сюжетный узел."});
 }
 function visibleTitle(node,status){
  return status.code==="locked"?"Неизвестный узел":node.title;
 }
 function initializeScenes(options={}){
  const scripts=options.scripts||(typeof LoreCampaignScenes!=="undefined"?LoreCampaignScenes:null);
  const engine=options.engine||(typeof LoreCampaignSceneCore!=="undefined"?LoreCampaignSceneCore:null);
  const save=options.save||(typeof LoreCampaignSceneSave!=="undefined"?LoreCampaignSceneSave:null);
  const runtime=options.runtime||(typeof LoreCampaignSceneRuntime!=="undefined"?LoreCampaignSceneRuntime:null);
  if(!scripts||!engine||!save||!runtime)return null;
  let storage=null;
  if(Object.prototype.hasOwnProperty.call(options,"storage"))storage=options.storage;
  else try{storage=window.localStorage;}catch{storage=null;}
  return runtime.create({graph:catalog,graphCore:core,pack:options.pack||scripts.catalog(),
    scriptData:scripts,sceneCore:engine,saveModule:save,storage});
 }
 function syncProgress(){progress=sceneRuntime?sceneRuntime.progress():core.fresh(catalog);}
 function saveMessage(){
  const status=sceneRuntime?.storageStatus();
  if(status==="corrupt")return "Сохранение истории повреждено или несовместимо. Исходные данные не перезаписаны. Игровые сцены временно заблокированы.";
  if(status==="volatile")return "Прогресс истории не сохраняется в этом браузере. После закрытия вкладки прохождение может исчезнуть.";
  return "История сохраняется отдельно от коллекции героев и учебной кампании.";
 }
 function actionMessage(code){
  return ({
   CONTENT_NOT_READY:"Текст этой сцены ещё не утверждён.",
   LOCKED:"Сначала завершите предыдущий сюжетный узел.",
   CORRUPT_SAVE_PROTECTED:"Запись истории повреждена; данные сохранены без изменений.",
   SAVE_WRITE_FAILED:"Не удалось записать прогресс. Действие не выполнено.",
   SAVE_VERIFY_FAILED:"Не удалось подтвердить сохранение. Действие не выполнено.",
   SAVE_CONFLICT:"История изменилась в другой вкладке. Перезагрузите страницу, чтобы не потерять данные.",
   INVALID_CHOICE:"Этот вариант здесь недоступен.",
   PRIMARY_CHOICE_IMMUTABLE:"Первый сюжетный выбор уже сохранён и не изменяется.",
   OBJECTIVE_INCOMPLETE:"Сначала выполните обязательные задачи сцены.",
   SKIP_UNAVAILABLE:"Пропустить можно только уже просмотренные безопасные кадры.",
   NOT_AT_END:"Сцена ещё не завершена."
  })[code]||"Действие недоступно: "+String(code);
 }
 function mount(element,d,c,options={}){
  if(!element||!d||!c||!d.catalogIsValid(d.catalog()))
   return false;
  if(root===element)return true;
  if(root){root.removeEventListener("click",onClick);root.removeEventListener("keydown",onKeydown);}
  root=element;data=d;core=c;catalog=d.catalog();
  try{sceneRuntime=initializeScenes(options);}
  catch(error){sceneRuntime=null;notice="Не удалось открыть сценарный модуль: "+String(error?.message||error);}
  syncProgress();
  view="stories";storyId=null;nodeId=null;layerId=null;
  root.addEventListener("click",onClick);
  root.addEventListener("keydown",onKeydown);
  // Rerendering a beat removes the focused button. Keep Escape working when
  // focus temporarily falls back to <body>, but only while lore is visible.
  if(!globalKeyRegistered&&typeof document!=="undefined"){
   document.addEventListener("keydown",onGlobalKeydown);
   globalKeyRegistered=true;
  }
  render();
  return true;
 }
 function open(){
  if(!root)return false;
  view="stories";storyId=null;nodeId=null;layerId=null;
  render();
  return true;
 }
 function close(){
  if(!root)return false;
  view="stories";storyId=null;nodeId=null;layerId=null;
  return true;
 }
 function back(){
  if(!root)return false;
  if(view==="scene"){sceneRuntime?.leave();view="map";syncProgress();render();return true;}
  if(view==="result"){view="map";syncProgress();render();return true;}
  if(view!=="map")return false;
  const previousStory=storyId;
  view="stories";storyId=null;nodeId=null;layerId=null;
  render();
  const backCard=root.querySelector('[data-lore-story="'+previousStory+'"]');
  backCard?.focus?.();
  return true;
 }
 function openStory(id){
  const story=data.getStory(id,catalog);
  if(!story)return false;
  view="map";storyId=id;
  layerId=story.mapLayers[0].id;
  const nodes=data.nodesForStory(id,catalog).filter(n=>n.mapLayerId===layerId);
  const active=sceneRuntime?.stateFor(id)?.activeNodeId;
  nodeId=(nodes.find(n=>n.id===active)||nodes.find(n=>nodeStatus(n).code==="available")||nodes[0])?.id||null;
  render();
  return true;
 }
 function changeLayer(id){
  const story=data.getStory(storyId,catalog);
  if(!story||!story.mapLayers.some(layer=>layer.id===id))return false;
  layerId=id;
  const nodes=data.nodesForStory(storyId,catalog).filter(n=>n.mapLayerId===id);
  if(!nodes.some(n=>n.id===nodeId))nodeId=nodes[0]?.id||null;
  render();
  return true;
 }
 function selectNode(id){
  const node=data.getNode(id,catalog);
  if(view!=="map"||!node||node.storyId!==storyId||node.mapLayerId!==layerId)return false;
  nodeId=id;
  render();
  return true;
 }
 function actInScene(action,choiceId){
  if(!sceneRuntime)return false;
  const result=action==="next"?sceneRuntime.next():
   action==="choose"?sceneRuntime.choose(choiceId):
   action==="skip"?sceneRuntime.skipSeen():
   action==="finish"?sceneRuntime.finish():{ok:false,code:"UNKNOWN_ACTION"};
  if(!result.ok){notice=actionMessage(result.code);render();return false;}
  notice="";syncProgress();
  if(action==="finish")view="result";
  render();return true;
 }
 function startScene(){
  const node=data.getNode(nodeId,catalog);
  if(!node||node.storyId!==storyId||nodeStatus(node).code==="locked"||
    !sceneRuntime?.hasContent(nodeId))return false;
  const result=sceneRuntime.start(nodeId);
  if(!result.ok){notice=actionMessage(result.code);render();return false;}
  notice="";syncProgress();view="scene";render();return true;
 }
 function renderScene(){
  const current=sceneRuntime?.current();
  if(!current)return '<section class="lore-scene"><p>Сцена недоступна.</p>'+
    '<button type="button" data-lore-action="leave-scene" class="ghost">← К карте</button></section>';
  const node=data.getNode(current.nodeId,catalog);
  const choiceButtons=current.choices.map(choice=>
   '<button type="button" class="lore-scene-choice" data-lore-action="scene-choose"'+
   ' data-lore-choice="'+escapeHtml(choice.id)+'">'+escapeHtml(choice.label)+'</button>').join("");
  const actions=choiceButtons||(current.canContinue?
   '<button type="button" class="primary" data-lore-action="scene-next">Продолжить</button>':
   current.canFinish?
    '<button type="button" class="primary" data-lore-action="scene-finish">Завершить узел</button>':'');
  const objectives=current.objectives.length?
   '<div class="lore-scene-objectives"><strong>ЗАДАЧИ СЦЕНЫ</strong>'+
    current.objectives.map(o=>'<div class="'+(o.done?'is-done':'')+'">'+
      (o.done?'✓ ':'◌ ')+escapeHtml(o.hint)+(o.required?'':' · дополнительно')+'</div>').join("")+'</div>':"";
  return '<section class="lore-scene" aria-label="Сюжетная сцена">'+
   '<div class="lore-scene-header"><button type="button" class="ghost" data-lore-action="leave-scene">← К карте</button>'+
    '<div><small>ЛОРНАЯ ИСТОРИЯ · '+(current.mode==="replay"?"ПОВТОР":"ОСНОВНОЙ ПРОХОД")+'</small>'+
    '<h3>'+escapeHtml(node.title)+'</h3></div></div>'+
   '<article class="lore-scene-card" aria-live="polite">'+
    (current.speakerId?'<div class="lore-scene-speaker">'+escapeHtml(current.speakerId)+'</div>':'')+
    '<p class="lore-scene-text">'+escapeHtml(current.text)+'</p>'+
    '<div class="lore-scene-choices">'+actions+'</div>'+
    '<button type="button" class="lore-scene-skip ghost" data-lore-action="scene-skip"'+
      (!current.canContinue||!current.skipSafe?' disabled':'')+
      '>Пропустить просмотренное</button></article>'+
   objectives+
   '<p class="lore-scene-storage" role="status">'+escapeHtml(saveMessage())+'</p>'+
   (notice?'<p class="lore-scene-notice" role="alert">'+escapeHtml(notice)+'</p>':'')+
   '</section>';
 }
 function renderResult(){
  const title=data.getNode(nodeId,catalog)?.title||"Узел";
  return '<section class="lore-scene lore-scene-result"><div class="lore-scene-card">'+
   '<span class="lore-detail-eyebrow">РЕЗУЛЬТАТ · БЕЗ НАГРАД</span>'+
   '<h3>'+escapeHtml(title)+'</h3><p>Просмотр сцены завершён. '+
   'Первичные решения сохраняются только в основном прохождении.</p>'+
   '<button type="button" class="primary" data-lore-action="leave-result">Вернуться к карте</button></div></section>';
 }
 function onClick(event){
  const button=event.target.closest?.("button[data-lore-action]");
  if(!button||!root.contains(button))return;
  const action=button.dataset.loreAction;
  if(action==="open-story")openStory(button.dataset.loreStory);
  else if(action==="choose-node")selectNode(button.dataset.loreNode);
  else if(action==="choose-layer")changeLayer(button.dataset.loreLayer);
  else if(action==="back")back();
  else if(action==="start-node")startScene();
  else if(action==="leave-scene"||action==="leave-result")back();
  else if(action==="scene-next")actInScene("next");
  else if(action==="scene-choose")actInScene("choose",button.dataset.loreChoice);
  else if(action==="scene-skip")actInScene("skip");
  else if(action==="scene-finish")actInScene("finish");
 }
 function onGlobalKeydown(event){
  if(!root?.isConnected||typeof document==="undefined"||
     document.querySelector("#campaignLoreContent")?.hidden||
     !document.querySelector("#campaign")?.classList.contains("active"))return;
  onKeydown(event);
 }
 function onKeydown(event){
  if(event.key==="Escape"&&["map","scene","result"].includes(view)){
   event.preventDefault();event.stopPropagation();back();
  }
 }
 function renderStories(){
  const cards=catalog.stories.map(story=>{
   const total=data.nodesForStory(story.id,catalog).length;
   const cover=story.id==="five-shadows"?" lore-story-cover--five":"";
   return '<button type="button" class="lore-story-cover'+cover+'" data-lore-action="open-story" data-lore-story="'+escapeHtml(story.id)+'">'+
    '<span class="lore-cover-eyebrow">ЛОРНАЯ ИСТОРИЯ · КАРТА</span>'+
    '<strong>'+escapeHtml(story.title)+'</strong>'+
    '<span>'+escapeHtml(story.subtitle)+'</span>'+
    '<small>Открыть схему · '+total+' сюжетных узла</small>'+
    '<span class="lore-cover-chevron" aria-hidden="true">›</span></button>';
  }).join("");
  return '<section class="lore-chronicle">'+
   '<div class="lore-chronicle-heading"><span>ИСТОРИИ МИРА</span><h3>Кампании лора</h3>'+
   '<p>Исследуйте истории мира на интерактивных схемах. Первые сцены ещё готовятся.</p></div>'+
   '<div class="lore-story-grid">'+cards+'</div>'+
   '<p class="lore-stage-note">LC-003 · Механизм сцен и сохранения готов. Авторские тексты «Пяти теней» добавляются на следующем этапе.</p></section>';
 }
 function edgeSvg(nodes){
  const availableIds=new Set(nodes.map(n=>n.id));
  const list=[];
  for(const n of nodes){
   for(const nextId of n.nextNodeIds){
    if(!availableIds.has(nextId))continue;
    const to=nodes.find(x=>x.id===nextId);
    const x1=Math.round(n.marker.x*1000),y1=Math.round(n.marker.y*560);
    const x2=Math.round(to.marker.x*1000),y2=Math.round(to.marker.y*560);
    const cx=Math.round((x1+x2)/2),cy=Math.round((y1+y2)/2-50);
    list.push('<path d="M'+x1+' '+y1+' Q'+cx+' '+cy+' '+x2+' '+y2+
     '" fill="none" stroke="#efc37b" stroke-width="4" stroke-dasharray="12 11" opacity=".68"/>');
   }
  }
  return '<svg class="lore-map-edges" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true" focusable="false">'+
   '<path d="M 250 -40 C 160 145 380 195 270 340 S 445 550 485 640" fill="none" stroke="#090e14" stroke-width="135" opacity=".75"/>'+
   '<path d="M 250 -40 C 160 145 380 195 270 340 S 445 550 485 640" fill="none" stroke="#a37b4d" stroke-width="3" stroke-dasharray="4 12" opacity=".38"/>'+
   list.join("")+'</svg>';
 }
 function nodeButton(node,index,cls){
  const status=nodeStatus(node),selected=node.id===nodeId;
  const text=visibleTitle(node,status);
  const common='type="button" data-lore-action="choose-node" data-lore-node="'+escapeHtml(node.id)+
   '" aria-pressed="'+(selected?"true":"false")+'"';
  if(cls==="marker")
   return '<button '+common+' class="lore-map-marker lore-state-'+status.code+(selected?' is-selected':'')+
    '" style="left:'+(node.marker.x*100)+'%;top:'+(node.marker.y*100)+'%"'+
    ' aria-label="Узел '+(index+1)+'. '+escapeHtml(text)+'. '+status.label+'">'+
    '<span aria-hidden="true">'+(index+1)+'</span></button>';
  return '<button '+common+' class="lore-list-node lore-state-'+status.code+(selected?' is-selected':'')+'">'+
   '<b>0'+(index+1)+'</b><span>'+escapeHtml(text)+'</span><small>'+status.label+'</small></button>';
 }
 function renderDetail(node){
  if(!node)return '<aside class="lore-node-detail"><p>Выберите узел на карте.</p></aside>';
  const status=nodeStatus(node);
  const known=status.code!=="locked";
  const deps=node.prerequisites.length?
   '<p class="lore-detail-prereq">'+(known?'Предыдущие события учтены.':'Сначала завершите предыдущий узел.')+'</p>':
   '<p class="lore-detail-prereq">Начало истории.</p>';
  const type={scene:"Сцена",investigation:"Исследование",task:"Задание",
   choice:"Выбор",battle:"Испытание",finale:"Финал"}[node.kind]||"Узел";
  return '<aside class="lore-node-detail" aria-label="Карточка выбранного узла">'+
   '<span class="lore-detail-eyebrow">'+(known?escapeHtml(type)+" · ":"")+'КАРТОЧКА УЗЛА</span>'+
   '<h4>'+escapeHtml(visibleTitle(node,status))+'</h4>'+
   '<span class="lore-detail-status lore-state-'+status.code+'">'+status.label+'</span>'+
   '<p class="lore-detail-reason">'+escapeHtml(status.reason)+'</p>'+
   deps+
   '<div class="lore-detail-actions">'+
   (known&&sceneRuntime?.hasContent(node.id)&&sceneRuntime?.storageStatus()!=="corrupt"?
    '<button type="button" class="primary" data-lore-action="start-node">'+
       (sceneRuntime.hasCheckpoint(node.id)?"Продолжить":status.code==="completed"?"Перепройти":"Начать сцену")+
    '</button>':
    '<button type="button" class="primary" disabled aria-disabled="true">'+
      (sceneRuntime?.storageStatus()==="corrupt"?"Сохранение повреждено":"Сюжетная сцена готовится")+'</button>')+
   '<small>Реплики и задачи будут добавлены после сценарного утверждения. Награды пока не определены.</small></div>'+
   '</aside>';
 }
 function renderMap(){
  const story=data.getStory(storyId,catalog);
  if(!story)return renderStories();
  const chapters=catalog.chapters.filter(ch=>ch.storyId===story.id);
  const layers=story.mapLayers.map(layer=>{
   const active=layer.id===layerId;
   return '<button type="button" data-lore-action="choose-layer" data-lore-layer="'+escapeHtml(layer.id)+
    '" aria-pressed="'+(active?"true":"false")+'" class="'+(active?"is-active":"")+'">'+escapeHtml(layer.title)+'</button>';
  }).join("");
  const nodes=data.nodesForStory(story.id,catalog).filter(n=>n.mapLayerId===layerId);
  const markers=nodes.map((n,i)=>nodeButton(n,i,"marker")).join("");
  const list=nodes.map((n,i)=>nodeButton(n,i,"list")).join("");
  const chosen=nodes.find(n=>n.id===nodeId)||null;
  return '<section class="lore-chronicle lore-chronicle--map">'+
   '<div class="lore-map-heading">'+
   '<button type="button" class="ghost lore-map-return" data-lore-action="back">← К историям</button>'+
   '<div><span class="lore-map-eyebrow">ХРОНИКА / ИНТЕРАКТИВНАЯ СХЕМА</span>'+
   '<h3>'+escapeHtml(story.title)+'</h3><small>'+escapeHtml(chapters[0]?.title||story.subtitle)+'</small></div></div>'+
   '<nav class="lore-layer-list" aria-label="Слои карты">'+layers+'</nav>'+
   '<div class="lore-map-layout">'+
   '<div class="lore-map-surface" role="group" aria-label="Схема последовательности узлов. Не географическая карта.">'+
   edgeSvg(nodes)+markers+
   '<span class="lore-map-mark">ПЯТЬ ТЕНЕЙ</span>'+
   '<span class="lore-map-caption">Схема событий · не географический маршрут</span></div>'+
   renderDetail(chosen)+'</div>'+
   '<div class="lore-legend" aria-label="Условные обозначения"><span class="lore-state-completed">● Пройдено</span><span class="lore-state-available">● Доступно</span><span class="lore-state-locked">● Закрыто</span></div>'+
   '<div class="lore-node-list" role="group" aria-label="Список сюжетных узлов">'+list+'</div>'+
   '<p class="lore-stage-note">'+escapeHtml(saveMessage())+' Игровые сцены включаются после утверждения текста.</p>'+
   '</section>';
 }
 function render(){
  if(!root)return;
  root.innerHTML=view==="scene"?renderScene():view==="result"?renderResult():view==="map"?renderMap():renderStories();
 }
 function snapshot(){
  return Object.freeze({view,storyId,nodeId,layerId,hasRoot:!!root});
 }
 return Object.freeze({mount,open,close,back,openStory,changeLayer,selectNode,
  render,nodeStatus,snapshot,startScene,actInScene,saveMessage});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignUI;
