/* NET-UX-007: six mechanically distinct, noncanonical Garden operation patterns.
 * No new NPC archetypes, combat rules, rewards, save fields, or balance constants.
 * Revision 1 formations are pinned here for already-issued clues and checkpoints.
 * New live templates use revision 2 encounter refs, including the scenario family.
 */
const NetworkEncounterData=(()=>{
 "use strict";
 const Network=typeof NetworkData!=="undefined"?NetworkData:require("./network-data.js");
 const legacy=[
  {id:"net-route-watch",formations:{
   quiet:[["npc-pass-guard","npc-trail-interceptor"]],
   cordon:[["npc-pass-guard"],["npc-trail-interceptor","npc-ridge-slinger"]]}},
  {id:"net-lost-cargo",formations:{
   quiet:[["npc-ridge-slinger","npc-field-medic"]],
   cordon:[["npc-ridge-slinger","npc-pass-guard"],["npc-field-medic"]]}},
  {id:"net-watch-trace",formations:{
   quiet:[["npc-route-signaller","npc-watch-captain"]],
   cordon:[["npc-route-signaller","npc-trail-interceptor"],["npc-watch-captain"]]}}
 ];
 const legacyFormations=Object.fromEntries(legacy.map(x=>[x.id,x.formations]));
 // Trial writing is a mission briefing, not new world canon. All six scenarios
 // are expressed solely through playable NPC roles and encounter wave order.
 const SCENARIOS=Object.freeze([
  Object.freeze({title:"Перехват связного",
   context:"Связной пытается вывести донесение из-под наблюдения.",
   tactic:"Сначала перехватите быстрый сигнал, затем разберитесь с прикрытием.",
   quiet:"Связной и перехватчик действуют вместе.",
   cordon:"Сначала связной, затем перехватчик под защитой стража.",
   success:"Донесение перехвачено; путь для дальнейшего поиска открыт.",
   formations:{quiet:[["npc-route-signaller","npc-trail-interceptor"]],
    cordon:[["npc-route-signaller"],["npc-trail-interceptor","npc-pass-guard"]]}}),
  Object.freeze({title:"Прикрытие лекаря",
   context:"Охрана удерживает позицию, пока лекарь возвращает бойцов в строй.",
   tactic:"Оставленный без внимания лекарь затягивает схватку.",
   quiet:"Лекарь под прикрытием стража.",
   cordon:"Сначала страж и лекарь, затем отдельный стрелок.",
   success:"Пункт поддержки отрезан от дозора.",
   formations:{quiet:[["npc-field-medic","npc-pass-guard"]],
    cordon:[["npc-pass-guard","npc-field-medic"],["npc-ridge-slinger"]]}}),
  Object.freeze({title:"Перекрёстный обстрел",
   context:"Стрелок держит проход, а быстрый боец вынуждает отряд менять цели.",
   tactic:"Приоритет между дальним давлением и стремительным нападением зависит от отряда.",
   quiet:"Стрелок и перехватчик атакуют одновременно.",
   cordon:"Сначала стрелок, затем перехватчик с командиром дозора.",
   success:"Опасный проход взят под контроль.",
   formations:{quiet:[["npc-ridge-slinger","npc-trail-interceptor"]],
    cordon:[["npc-ridge-slinger"],["npc-trail-interceptor","npc-watch-captain"]]}}),
  Object.freeze({title:"Плотный заслон",
   context:"Дозор выстроил оборону и не собирается отступать.",
   tactic:"Защита противника требует продуманного выбора цели и момента сильного удара.",
   quiet:"Командир дозора и страж держат позицию.",
   cordon:"Сначала страж, затем командир дозора и связной.",
   success:"Заслон разбит, проход свободен.",
   formations:{quiet:[["npc-watch-captain","npc-pass-guard"]],
    cordon:[["npc-pass-guard"],["npc-watch-captain","npc-route-signaller"]]}}),
  Object.freeze({title:"Ложный сигнал",
   context:"Противники передают сигналы, за которыми скрывается группа поддержки.",
   tactic:"Связной ускоряет давление, лекарь не даёт быстро закончить бой.",
   quiet:"Связной прикрывает лекаря.",
   cordon:"Сначала лекарь, затем связной со стрелком.",
   success:"Схема ложных сигналов раскрыта.",
   formations:{quiet:[["npc-route-signaller","npc-field-medic"]],
    cordon:[["npc-field-medic"],["npc-route-signaller","npc-ridge-slinger"]]}}),
  Object.freeze({title:"Преследование",
   context:"Перехватчик ведёт отряд под огонь; за ним идёт подкрепление.",
   tactic:"Остановите быстрого противника, не оставляя стрелку свободы действий.",
   quiet:"Перехватчик и стрелок сближаются сразу.",
   cordon:"Сначала перехватчик с лекарем, затем командир дозора.",
   success:"Преследователи оторваны от маршрута.",
   formations:{quiet:[["npc-trail-interceptor","npc-ridge-slinger"]],
    cordon:[["npc-trail-interceptor","npc-field-medic"],["npc-watch-captain"]]}})
 ]);
 const materials=["Fe","Le","Cl","Wo","Fa","Th","Gl"];
 const heroes=["ren","nada","liora","art","sava"];
 function scenarioIndex(template){
  const tier=template.levels[0]===1?0:template.levels[0]===20?1:2;
  return template.materialId!==null?
   (materials.indexOf(template.materialId)+tier)%SCENARIOS.length:
   (heroes.indexOf(template.heroId)+tier+2)%SCENARIOS.length;
 }
 // Previously-issued live clues keep their exact v1 encounterRef, revision,
 // formation and mastery key. No migration and no writes to saved data.
 const oldLive=Network.LIVE_CATALOG.templates.map(template=>Object.freeze({
  ...template,revision:1,encounterRef:"encounter-"+template.id
 }));
 const definitions=[
  ...Network.PROPOSAL_CATALOG.templates.map(template=>({template,
   source:legacyFormations[template.id]})),
  ...oldLive.map(template=>({template,
   source:legacyFormations[template.type==="recruit-intel"?"net-lost-cargo":"net-route-watch"]})),
  ...Network.LIVE_CATALOG.templates.map(template=>({template,
   source:SCENARIOS[scenarioIndex(template)].formations,
   scene:SCENARIOS[scenarioIndex(template)]}))
 ];
 const story={};
 const registry={};
 for(const {template,source,scene} of definitions){
  if(!source||registry[template.encounterRef])throw Error("NETUX007_DUPLICATE_ENCOUNTER");
  const formations={};
  for(const [approach,waves] of Object.entries(source))
   formations[approach]=Object.freeze(waves.map(wave=>Object.freeze(wave.slice())));
  registry[template.encounterRef]=Object.freeze({template,
   formations:Object.freeze(formations)});
  if(scene)story[template.encounterRef]=Object.freeze({
   title:scene.title,context:scene.context,tactic:scene.tactic,
   quiet:scene.quiet,cordon:scene.cordon,success:scene.success
  });
 }
 const REGISTRY=Object.freeze(registry);
 const STORIES=Object.freeze(story);
 function brief(encounterRef){
  return Object.prototype.hasOwnProperty.call(STORIES,encounterRef)?
   STORIES[encounterRef]:null;
 }
 return Object.freeze({REGISTRY,brief});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkEncounterData;
