/* Gear-003B1: deterministic test-only G1–G3 equipment catalog.
   Item names, recipes and currency prices are NOT production economy. */
const GearData=(()=>{
 "use strict";
 const SLOTS=Object.freeze([
  ["weapon","Оружие",0,.03],["torso","Корпус",.03,0],
  ["head","Голова",.02,0],["hands","Руки",0,.02],
  ["feet","Ноги",.01,0],["utility","Снаряжение",0,.01]
 ].map(([id,label,hp,atk])=>Object.freeze({id,label,hp,atk})));
 const CLASS_IDS=Object.freeze(["melee","ranged","mage","support","tank"]);
 const MATERIALS=Object.freeze(["Fe","Le","Cl","Wo","Fa","Th","Gl"]);
 const FLOOR=Object.freeze({Fe:20,Le:30,Cl:30,Wo:10,Fa:15,Th:20,Gl:0});
 // Test refills follow highest unlocked G, never erase existing resources.
 const G2_FLOOR=Object.freeze({Fe:24,Le:32,Cl:67,Wo:10,Fa:24,Th:20,Gl:2});
 const G3_FLOOR=Object.freeze({Fe:50,Le:32,Cl:66,Wo:10,Fa:32,Th:20,Gl:4});
 const MATERIAL_LABELS=Object.freeze({
  Fe:"Железо",Le:"Кожа",Cl:"Ткань",Wo:"Древесина",
  Fa:"Крепёж",Th:"Прочная нить",Gl:"Стекло"
 });
 // Future 14-stat vocabulary only. This is NOT a combat formula; G1 currently
 // applies temporary HP/ATK bonuses and does not modify any other stat.
 const FUTURE_STAT_KEYS=Object.freeze([
  "hp","protection","physicalAttack","magicAttack","physicalDefense",
  "magicDefense","speed","critChance","critDamage","accuracy",
  "evasion","defensePenetration","debuffPotency","debuffResistance"
 ]);
 // Stats-001A: approved names and meanings, no unapproved combat formulas.
 // The prototype has actual HP and speed; its general ATK is not yet split
 // into physicalAttack / magicAttack. Unknown stats must never be invented.
 const STAT_LABELS=Object.freeze({
  hp:"Здоровье (HP)",protection:"Защита (Protection)",
  physicalAttack:"Физическая атака",magicAttack:"Магическая атака",
  physicalDefense:"Физическая оборона",magicDefense:"Магическая оборона",
  speed:"Скорость",critChance:"Шанс критического удара",
  critDamage:"Критический урон",accuracy:"Точность",evasion:"Уклонение",
  defensePenetration:"Пробивание обороны",
  debuffPotency:"Эффективность ослаблений",
  debuffResistance:"Сопротивление ослаблениям"
 });
 function statOverview(hero){
  return FUTURE_STAT_KEYS.map(id=>{
   const supported=(id==="hp"||id==="speed")&&Number.isFinite(hero?.[id]);
   return Object.freeze({id,label:STAT_LABELS[id],
    value:supported?hero[id]:null,
    active:supported});
  });
 }

 // Test-only composite recipes. Produced inline; no inventory for intermediate parts.
 const COMPOSITES=Object.freeze({
  U:Object.freeze({Fe:2,Fa:1}),
  P:Object.freeze({Cl:2,Le:1})
 });
 const specs=[
  ["g1-blade","Короткий клинок","weapon","melee,tank",{Fe:2,Wo:1,Fa:1}],
  ["g1-bow","Лёгкий лук","weapon","ranged",{Wo:2,Th:2}],
  ["g1-wand","Фокусирующий жезл","weapon","mage,support",{Wo:1,Cl:1,Th:1}],
  ["g1-vest","Усиленный жилет","torso","melee,tank",{U:1,Le:2}],
  ["g1-jacket","Дорожная куртка","torso","ranged,mage,support",{P:1,Le:1}],
  ["g1-helm","Защитный шлем","head","melee,tank",{U:1,Le:1}],
  ["g1-hood","Походный капюшон","head","ranged,mage,support",{Cl:2,Th:1}],
  ["g1-gaunt","Боевые перчатки","hands","melee,ranged,tank",{Le:2,Th:1}],
  ["g1-workglove","Рабочие перчатки","hands","mage,support",{Cl:1,Le:1,Th:1}],
  ["g1-bootheavy","Укреплённые сапоги","feet","melee,support,tank",{U:1,Le:2,Th:1}],
  ["g1-bootlight","Лёгкие сапоги","feet","melee,ranged,mage,support",{Le:1,Cl:2,Th:1}],
  ["g1-belt","Походный пояс","utility","melee,ranged,mage,support,tank",{Cl:1,Fa:1}],
  // Gear-003G approved v0.4 recipe test data for G2 ONLY.
  ["g2-blade","Закалённый клинок","weapon","melee,tank",{U:1,Fe:1,Wo:1}],
  ["g2-bow","Составной лук","weapon","ranged",{Wo:2,Th:2,P:1}],
  ["g2-wand","Жезл с линзой","weapon","mage,support",{Wo:1,Gl:1,P:1}],
  ["g2-vest","Бронированный жилет","torso","melee,tank",{U:1,P:1,Le:1}],
  ["g2-jacket","Уплотнённая куртка","torso","ranged,mage,support",{P:1,Cl:2,Fa:1}],
  ["g2-helm","Шлем с подкладкой","head","melee,tank",{U:1,P:1}],
  ["g2-hood","Плотный капюшон","head","ranged,mage,support",{P:1,Cl:1,Th:1}],
  ["g2-gaunt","Перчатки с накладками","hands","melee,ranged,tank",{U:1,Le:1,Th:1}],
  ["g2-workglove","Уплотнённые перчатки","hands","mage,support",{P:1,Cl:1,Th:1}],
  ["g2-bootheavy","Сапоги с усиленной подошвой","feet","melee,support,tank",{U:1,P:1,Le:1}],
  ["g2-bootlight","Утеплённые походные сапоги","feet","melee,ranged,mage,support",{P:1,Cl:2,Th:1}],
  ["g2-belt","Пояс с подсумками","utility","melee,ranged,mage,support,tank",{P:1,Fa:2}],
  // Gear-003G: optimized v0.5 test recipes, G3 only.
  ["g3-blade","Усиленный клинок","weapon","melee,tank",{U:2,Fe:1}],
  ["g3-bow","Усиленный составной лук","weapon","ranged",{P:1,Wo:2,Th:2,Fa:1}],
  ["g3-wand","Точный фокусирующий жезл","weapon","mage,support",{P:1,Gl:2,Wo:1}],
  ["g3-vest","Пластинчатый жилет","torso","melee,tank",{U:1,P:1,Fe:1,Le:1}],
  ["g3-jacket","Защитная дорожная куртка","torso","ranged,mage,support",{U:1,P:1,Cl:1,Fa:1}],
  ["g3-helm","Усиленный шлем","head","melee,tank",{U:2,Le:1}],
  ["g3-hood","Защитный капюшон","head","ranged,mage,support",{P:1,Cl:2,Th:2}],
  ["g3-gaunt","Усиленные боевые перчатки","hands","melee,ranged,tank",{U:1,P:1,Th:1}],
  ["g3-workglove","Мастерские перчатки","hands","mage,support",{P:1,Cl:2,Th:2}],
  ["g3-bootheavy","Сапоги с жёстким каркасом","feet","melee,support,tank",{U:1,P:1,Le:2}],
  ["g3-bootlight","Усиленные походные сапоги","feet","melee,ranged,mage,support",{P:1,Cl:2,Le:1,Th:1}],
  ["g3-belt","Усиленный походный пояс","utility","melee,ranged,mage,support,tank",{U:1,Cl:1,Fa:1}]
 ];
 function flatten(recipe){
  const out=Object.fromEntries(MATERIALS.map(id=>[id,0]));
  for(const [code,count] of Object.entries(recipe)){
   if(!Number.isSafeInteger(count)||count<1)throw Error("Invalid ingredient");
   const sub=COMPOSITES[code];
   if(sub){for(const [id,n] of Object.entries(sub))out[id]+=count*n;}
   else if(MATERIALS.includes(code))out[code]+=count;
   else throw Error("Unknown ingredient "+code);
  }
  return Object.freeze(Object.fromEntries(MATERIALS.filter(id=>out[id]>0).map(id=>[id,out[id]])));
 }
 const byId=Object.create(null);
 const ITEMS=Object.freeze(specs.map(([id,name,slotId,classes,recipe])=>{
  const slot=SLOTS.find(x=>x.id===slotId);
  if(!slot||Object.hasOwn?.(byId,id)||byId[id])throw Error("Duplicate or invalid gear item");
  const slotIndex=SLOTS.findIndex(x=>x.id===slotId),tier=Number(id.slice(1,2));
  if(![1,2,3].includes(tier))throw Error("Unsupported test tier");
  const total=tier*1000;
  const item=Object.freeze({
   id,name,slotId,tier,allowedClasses:Object.freeze(classes.split(",")),
   recipe:Object.freeze({...recipe}),ingredients:flatten(recipe),
   currency:Math.floor(total/6)+(slotIndex<total%6?1:0),
   bonuses:Object.freeze({hp:slot.hp,atk:slot.atk,speed:0})
  });
  byId[id]=item;return item;
 }));
 const BASE_FEET=Object.freeze({melee:"g1-bootlight",support:"g1-bootheavy"});
 const get=id=>typeof id==="string"&&Object.prototype.hasOwnProperty.call(byId,id)?byId[id]:null;
 function offered(classId,slotId,tier=1){
  if(!CLASS_IDS.includes(classId)||!SLOTS.some(x=>x.id===slotId)||![1,2,3].includes(tier))return [];
  // Gear-003F: do not offer same-stat alternatives as a false choice.
  return ITEMS.filter(item=>item.tier===tier&&item.slotId===slotId&&item.allowedClasses.includes(classId)&&
   (slotId!=="feet"||item.id===(BASE_FEET[classId]||(classId==="tank"?"g1-bootheavy":"g1-bootlight")).replace("g1-","g"+tier+"-")));
 }
 function missing(item,materials){
  if(!item||!materials)return null;
  return Object.fromEntries(Object.entries(item.ingredients).filter(([id,n])=>
   !Number.isSafeInteger(materials[id])||materials[id]<n).map(([id,n])=>[id,Math.max(0,n-(materials[id]||0))]));
 }
 return Object.freeze({SLOTS,CLASS_IDS,MATERIALS,MATERIAL_LABELS,FUTURE_STAT_KEYS,STAT_LABELS,statOverview,FLOOR,G2_FLOOR,G3_FLOOR,COMPOSITES,ITEMS,get,offered,missing,flatten});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=GearData;
