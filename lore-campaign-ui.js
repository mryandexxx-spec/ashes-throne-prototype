/* LC-002: presentation-only lore campaign map. No rewards, combat or saved progress. */
const LoreCampaignUI=(()=>{
 "use strict";
 const escMap={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};
 const escapeHtml=value=>String(value).replace(/[&<>"']/g,ch=>escMap[ch]);
 let root=null,data=null,core=null,catalog=null,progress=null;
 let view="stories",storyId=null,nodeId=null,layerId=null;
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
 function safeProgress(){
  // LC-003 implements actual storage, schema validation and primary decisions.
  return core.fresh(catalog);
 }
 function mount(element,d,c){
  if(!element||!d||!c||!d.catalogIsValid(d.catalog()))
   return false;
  if(root===element)return true;
  if(root){root.removeEventListener("click",onClick);root.removeEventListener("keydown",onKeydown);}
  root=element;data=d;core=c;catalog=d.catalog();progress=safeProgress();
  view="stories";storyId=null;nodeId=null;layerId=null;
  root.addEventListener("click",onClick);
  root.addEventListener("keydown",onKeydown);
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
  if(!root||view!=="map")return false;
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
  nodeId=(nodes.find(n=>nodeStatus(n).code==="available")||nodes[0])?.id||null;
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
 function onClick(event){
  const button=event.target.closest?.("button[data-lore-action]");
  if(!button||!root.contains(button))return;
  const action=button.dataset.loreAction;
  if(action==="open-story")openStory(button.dataset.loreStory);
  else if(action==="choose-node")selectNode(button.dataset.loreNode);
  else if(action==="choose-layer")changeLayer(button.dataset.loreLayer);
  else if(action==="back")back();
 }
 function onKeydown(event){
  if(event.key==="Escape"&&view==="map"){
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
   '<p class="lore-stage-note">LC-002 · Доступен просмотр карты. Игровые сцены и сохранение прогресса появятся позже.</p></section>';
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
   '<button type="button" class="primary" disabled aria-disabled="true">Сюжетная сцена готовится</button>'+
   '<small>Запуск, решения и повтор — этап LC-003/004. Награды пока не определены.</small></div>'+
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
   '<p class="lore-stage-note">Это предварительная схема. До LC-003 прогресс не сохраняется, главы и награды не запускаются.</p>'+
   '</section>';
 }
 function render(){
  if(!root)return;
  root.innerHTML=view==="map"?renderMap():renderStories();
 }
 function snapshot(){
  return Object.freeze({view,storyId,nodeId,layerId,hasRoot:!!root});
 }
 return Object.freeze({mount,open,close,back,openStory,changeLayer,selectNode,
  render,nodeStatus,snapshot});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignUI;
