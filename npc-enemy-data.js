/* NPCDATA001 — [PROPOSAL] ten non-recruitable PvE archetypes.
 * Lore and numeric balance remain provisional. This is a pure data factory:
 * no DOM, Babylon, loot, save, or mission changes. speciesId != factionId.
 */
const NpcEnemyData=(()=>{
 "use strict";
 const STAT_KEYS=Object.freeze(["hp","protection","physicalAttack","magicAttack",
  "physicalDefense","magicDefense","speed","critChance","critDamage","accuracy",
  "evasion","defensePenetration","debuffPotency","debuffResistance"]);
 const GEAR_SLOTS=Object.freeze(["weapon","body","head","hands","legs","accessory"]);
 const dmg=(id,name,multiplier=1,weakening=0,cooldown=0)=>Object.freeze({
  id,name,kind:"damage",target:"enemy",damageType:"physical",multiplier,weakening,cooldown});
 const heal=(id,name,amount,target="ally",cooldown=2)=>Object.freeze({
  id,name,kind:"heal",target,healAmount:amount,cooldown});
 const guard=(id,name,target,hits,cooldown=2,tauntTurns)=>Object.freeze({
  id,name,kind:"guard",target,guardHits:hits,cooldown,
  ...(tauntTurns?{tauntTurns}:{})});
 const pack=(basic,special,powerful)=>Object.freeze({basic,special,powerful});
 // Named gear is a visual inventory sketch, NOT an equipment economy/recipe.
 const def=(id,name,speciesId,originRegionId,classId,aiProfile,stats,growth,gear,abilities,passive)=>
  Object.freeze({archetypeId:id,name,speciesId,originRegionId,classId,aiProfile,
   combatRole:classId==="support"&&abilities.special.kind==="heal"?"healer":classId,
   stats:Object.freeze(Object.fromEntries(STAT_KEYS.map((key,i)=>[key,stats[i]]))),
   growth:Object.freeze({level:Object.freeze({hp:growth[0],protection:growth[1],physicalAttack:growth[2]}),
    star:Object.freeze({hp:growth[3],physicalAttack:growth[4]})}),
   equipment:Object.freeze(Object.fromEntries(GEAR_SLOTS.map((key,i)=>[key,gear[i]]))),
   abilities,passive:Object.freeze(passive)});
 const entries=[
  def("npc-pass-guard","Страж прохода","human","gardens-over-abyss","tank","guardian",
   [145,50,18,0,24,13,103,5,150,4,3,0,5,22],[2.9,.75,.30,13,2],
   ["Короткое копьё","Стёганый жилет","Простой шлем","Рабочие рукавицы","Цепкие ботинки","Лёгкий щит"],
   pack(dmg("basic","Удар древком"),guard("special","Закрыть проход","self",2,2,1),
    guard("powerful","Сомкнуть щиты","all-allies",1,4)),
   {name:"Упор",stat:"physicalDefense",amount:6}),
  def("npc-trail-interceptor","Перехватчик троп","human","gardens-over-abyss","melee","aggressive",
   [96,20,28,0,12,10,148,10,150,7,8,5,18,9],[1.9,.35,.54,9,3],
   ["Короткий нож","Дорожная куртка","Капюшон","Хватательные перчатки","Мягкие сапоги","Страховочная петля"],
   pack(dmg("basic","Быстрый выпад"),dmg("special","Сбить темп",.9,2,2),
    dmg("powerful","Перехватить инициативу",1.6,0,3)),
   {name:"Лёгкий шаг",stat:"evasion",amount:5}),
  def("npc-ridge-slinger","Пращник уступа","human","gardens-over-abyss","ranged","aggressive",
   [88,14,29,0,10,9,135,10,150,8,7,6,7,8],[1.7,.25,.60,8,3],
   ["Праща","Плотная безрукавка","Шапка","Накладки на пальцы","Лёгкие башмаки","Сумка с камнями"],
   pack(dmg("basic","Камень"),dmg("special","Точный бросок",1.3,0,2),
    dmg("powerful","Удар в открытый бок",1.8,0,3)),
   {name:"Глазомер",stat:"accuracy",amount:5}),
  def("npc-field-medic","Полевой перевязчик","human","gardens-over-abyss","support","support",
   [103,24,14,0,13,15,119,5,150,4,3,0,3,21],[2.1,.40,.25,10,1],
   ["Рабочий нож","Плотная туника","Платок","Перевязочные перчатки","Прочные ботинки","Шины и бинты"],
   pack(dmg("basic","Отбиться",.7),heal("special","Наложить повязку",36),
    heal("powerful","Помощь всей группе",20,"all-allies",4)),
   {name:"Собранность",stat:"debuffResistance",amount:5}),
  def("npc-route-signaller","Сигнальщик обхода","human","gardens-over-abyss","support","tactical",
   [105,28,18,0,15,13,130,5,150,6,5,0,17,16],[2,.45,.30,10,2],
   ["Короткий посох","Дождевой плащ","Шапка","Рукавицы","Обувь для уступов","Рожок и флажок"],
   pack(dmg("basic","Отогнать",.8),dmg("special","Указать угрозу",.75,2,2),
    guard("powerful","Перегруппироваться","ally",2,3)),
   {name:"Дозор",stat:"physicalDefense",amount:4}),
  def("npc-watch-captain","Старший дозора","human","gardens-over-abyss","tank","tactical",
   [178,64,26,0,26,17,114,8,150,6,4,3,10,19],[3.2,.95,.44,16,2],
   ["Дорожное копьё","Усиленный панцирь","Шлем","Плотные перчатки","Походные сапоги","Щиток и знак команды"],
   pack(dmg("basic","Оттеснить"),guard("special","Прикрыть товарища","ally",2,2),
    dmg("powerful","Жёсткий приказ",1.65,1,3)),
   {name:"Выучка",stat:"protection",amount:8}),
  def("npc-sarkh-convoy-guard","Сарх — защитник конвоя","sarkh","changing-rivers","tank","guardian",
   [148,48,21,0,22,12,112,5,150,5,3,1,6,16],[2.8,.7,.35,13,2],
   ["Короткое копьё","Гибкая нагрудная защита","Лёгкая повязка","Защитные рукавицы","Накладка на опорный корпус","Щит"],
   pack(dmg("basic","Теснить"),guard("special","Оберечь соседа","ally",2,2),
    guard("powerful","Удержать палубу","self",2,3,1)),
   {name:"Опора",stat:"physicalDefense",amount:5}),
  def("npc-sarkh-land-courier","Сарх — сухопутный курьер","sarkh","changing-rivers","ranged","aggressive",
   [98,19,28,0,11,11,146,9,150,9,9,5,15,11],[1.9,.3,.53,9,3],
   ["Компактная праща","Дорожный жилет","Капюшон","Наручи","Опорная ткань корпуса","Футляр сообщений"],
   pack(dmg("basic","Камень из пращи"),dmg("special","Сбить прицел",.85,2,2),
    dmg("powerful","Скорый выстрел",1.6,0,3)),
   {name:"Дорожная выучка",stat:"evasion",amount:4}),
  def("npc-laun-ford-guard","Лаун — дозорный переправы","laun","changing-rivers","tank","guardian",
   [138,45,24,0,23,14,116,5,150,5,4,2,6,19],[2.7,.7,.38,12,2],
   ["Древковое оружие","Стёганый плащ","Лёгкий шлем","Перчатки","Высокая обувь","Небольшой щит"],
   pack(dmg("basic","Отогнать древком"),guard("special","Встать заслоном","ally",2,2),
    guard("powerful","Закрыть переправу","all-allies",1,4)),
   {name:"Стойкость",stat:"debuffResistance",amount:5}),
  def("npc-laun-physician","Лаун — лекарь переправ","laun","changing-rivers","support","support",
   [112,34,13,0,14,18,126,5,150,4,4,0,3,22],[2.2,.5,.25,11,1],
   ["Защитный посох","Медицинский жилет","Платок","Перевязочные перчатки","Высокая обувь","Врачебный футляр"],
   pack(dmg("basic","Отступить с посохом",.6),heal("special","Остановить кровотечение",44),
    heal("powerful","Обойти раненых",24,"all-allies",4)),
   {name:"Осторожность",stat:"debuffResistance",amount:5})
 ];
 const catalog=Object.freeze(Object.fromEntries(entries.map(entry=>[entry.archetypeId,entry])));
 const all=()=>entries.slice();
 const get=id=>Object.prototype.hasOwnProperty.call(catalog,id)?catalog[id]:null;
 const validInt=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
 const statRound=n=>Math.max(0,Math.round(n));
 function spawn(id,options={}){
  const spec=get(id);
  if(!spec||!options||typeof options!=="object"||Array.isArray(options))return null;
  const {level=1,stars=1,gearTier=1,skillLevel=1,instanceId=id}=options;
  if(!validInt(level,1,85)||!validInt(stars,1,7)||!validInt(gearTier,1,13)||
     !validInt(skillLevel,1,6)||typeof instanceId!=="string"||
     !/^[a-z0-9][a-z0-9_.:-]{0,79}$/i.test(instanceId))return null;
  const stats={...spec.stats};
  for(const [key,value] of Object.entries(spec.growth.level))
   stats[key]=statRound(stats[key]+(level-1)*value);
  for(const [key,value] of Object.entries(spec.growth.star))
   stats[key]=statRound(stats[key]+(stars-1)*value);
  stats[spec.passive.stat]+=spec.passive.amount; // always-on flat personal bonus
  const abilities={};
  for(const key of ["basic","special","powerful"]){
   const base=spec.abilities[key];
   const copy={...base};
   if(key!=="basic"){
    // Test-only local NPC scaling, separate from player SkillCore.
    if(copy.kind==="damage")copy.multiplier=Math.round((copy.multiplier+(skillLevel-1)*.1)*100)/100;
    if(copy.kind==="heal")copy.healAmount=Math.round(copy.healAmount+(level-1)*.8+(skillLevel-1)*5);
   }
   abilities[key]=Object.freeze(copy);
  }
  abilities.passive=Object.freeze({id:"passive",name:spec.passive.name,
   kind:"stat",stat:spec.passive.stat,amount:spec.passive.amount});
  return {
   id:instanceId,archetypeId:id,side:"enemy",name:spec.name,
   speciesId:spec.speciesId,originRegionId:spec.originRegionId,factionId:null,
   classId:spec.classId,combatRole:spec.combatRole,role:spec.combatRole==="healer"?"Лекарь":spec.classId,
   aiProfile:spec.aiProfile,combatProfile:"stats002c",glyph:spec.combatRole==="healer"?"✚":"♟",
   level,stars,gearTier,skillLevels:{basic:skillLevel,special:skillLevel,powerful:skillLevel,passive:skillLevel},
   npcAbilities:Object.freeze(abilities),equipment:spec.equipment,
   ...stats,atk:stats.physicalAttack,
   maxProtection:stats.protection
  };
 }
 return Object.freeze({STAT_KEYS,GEAR_SLOTS,all,get,spawn});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NpcEnemyData;
