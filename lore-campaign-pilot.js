/* LOREPLAY001 — [ПРЕДЛОЖЕНИЕ]. Owner-authorized public TEST gameplay adaptation.
   Based on private LC-004/005/006 pilot (PR #63–65), NOT accepted literary canon.
   No rewards, energy costs, global squad changes or worldbuilding modifications. */
const LoreCampaignPilot=(()=>{
 "use strict";
 const Data=typeof LoreCampaignData!=="undefined"?LoreCampaignData:require("./lore-campaign-data.js");
 const Scripts=typeof LoreCampaignScenes!=="undefined"?LoreCampaignScenes:require("./lore-campaign-scenes.js");
 const draft=(()=>{
 "use strict";
 const beat=(id,speakerId,text,nextBeatId=null,choiceIds=[],opts={})=>({
  id,speakerId,text,nextBeatId,choiceIds,skipSafe:!!opts.skipSafe,effects:[],
  ...(opts.inspections?{inspections:opts.inspections}:{}),
  ...(opts.comparisons?{comparisons:opts.comparisons}:{}),
  ...(opts.requiredInspectionIds?{requiredInspectionIds:opts.requiredInspectionIds}:{}),
  ...(opts.requiredComparisonIds?{requiredComparisonIds:opts.requiredComparisonIds}:{})
 });
 const option=(id,decisionId,label,nextBeatId)=>({id,decisionId,label,nextBeatId,effects:[]});
 const inspection=(id,label,text)=>({id,label,text});
 const comparison=(id,label,text,evidenceIds)=>({id,label,text,evidenceIds});
 const objective=(id,kind,hint,required,other)=>({id,kind,hint,required,...other});
 const scenes=[
  {
   id:"fs01-other-side",nodeId:"five-shadows:fs-01",entryBeatId:"fs01-road",
   beats:[
    beat("fs01-road",null,
     "Третий день пути. За обратным склоном Пять теней исчезли из виду. Рен снова поправляет тяжёлую сумку: далеко внизу слышно ущелье, но отсюда не видно ни города, ни белой стены.",
     "fs01-question",[],{skipSafe:true}),
    beat("fs01-question","Рен Терен",
     "— Всё. Потеряли.\n\nРен поправляет сумку и оглядывается на пустую тропу.",
     "fs01-nada-answer",[],{skipSafe:false}),
    beat("fs01-nada-answer","Нада",
     "— Она за горой. Нам нужен обратный склон.\n\nНада не оборачивается. Перед последним подъёмом можно уточнить путь или ещё раз свериться с записью.",
     null,["fs01-ask-route","fs01-ask-note"]),
    beat("fs01-route","Рен Терен",
     "— А я думал, раз мы перешли ущелье, дальше пойдём прямо.",
     "fs01-nada-route",[],{skipSafe:true}),
    beat("fs01-nada-route","Нада",
     "— Напрямик здесь только птицам.\n\nСтарая переправа осталась выше по течению. Возле города берега расходятся гораздо шире. Рен ведёт по обходной тропе, проверяя ненадёжный камень.",
     "fs01-yard",[],{skipSafe:true}),
    beat("fs01-note","Нада",
     "— На листе написано про верхний вход и три скола у площадки. Я хочу узнать, существуют ли они. Больше ничего обещать не могу.\n\nБумага на сгибах стала мягкой. Рен убирает её, чтобы не порвать в дороге.",
     "fs01-yard",[],{skipSafe:true}),
    beat("fs01-yard",null,
     "Тропа приводит к небольшому двору под скалой. У стены чернеет низкий проход, чуть выше видны следы на камне. Нада разворачивает изношенную подсказку. Проверьте оба признака, прежде чем идти дальше.",
     "fs01-match",[],{
      inspections:[
       inspection("fs01-written","Старая подсказка","На истёртой копии: «Выше трёх сколов. Проход без двери». Источник записи ещё требует проверки."),
       inspection("fs01-marks","Три следа на камне","У края площадки три насечки: две забиты землёй, третья отчётлива. Похожие следы не доказывают, кто их сделал.")
      ],
      requiredInspectionIds:["fs01-written","fs01-marks"]
     }),
    beat("fs01-match","Нада",
     "Три насечки действительно оказались выше низкого прохода. Но это ещё не доказательство истории, которую записал неизвестный человек.",
     "fs01-room",[],{
      comparisons:[comparison("fs01-signs","Сопоставить подсказку и признаки",
       "В записи два ориентира — три скола и проход без двери. В действительности рядом видны и насечки, и низкое отверстие. Совпадение достаточно, чтобы проверить проход; происхождение подсказки ещё неизвестно.",
       ["fs01-written","fs01-marks"])],
      requiredComparisonIds:["fs01-signs"]
     }),
    beat("fs01-room",null,
     "Рен первым проходит под низкой перемычкой с фонарём. За поворотом грубая поздняя кладка упирается в гладкую светлую поверхность. Дальше открывается длинное помещение, пересечённое пятью полосами дневного света.",
     "fs01-opening",[],{skipSafe:true}),
    beat("fs01-opening","Рен Терен",
     "— Подойди.\n\nЗа узкой прорезью видны Сады над пропастью: Косая Полка, знакомые дворы, обрывы между жилыми участками. Отсюда город кажется чужим. С городской стороны к этим отверстиям нельзя просто подняться.",
     "fs01-end",[],{skipSafe:true}),
    beat("fs01-end",null,
     "Вдоль стены лежат тяжёлые оси и обломки креплений, назначение которых пока неясно. В дальнем конце Рен замечает каменную полку и щель с мусором. У Нады остаётся вторая строка старой подсказки.",
     null,[],{skipSafe:false})
   ],
   choices:[
    option("fs01-ask-route","fs01-first-focus","Уточнить у Рена дорогу","fs01-route"),
    option("fs01-ask-note","fs01-first-focus","Перечитать подсказку с Надой","fs01-note")
   ],
   objectives:[
    objective("fs01-read","view","Добраться до верхнего подхода",true,{beatId:"fs01-yard"}),
    objective("fs01-paper","inspect","Прочитать запись о входе",true,{evidenceIds:["fs01-written"]}),
    objective("fs01-stone","inspect","Проверить сколы на камне",true,{evidenceIds:["fs01-marks"]}),
    objective("fs01-match","compare","Сопоставить два ориентира",true,{evidenceIds:["fs01-written","fs01-marks"],comparisonId:"fs01-signs"}),
    objective("fs01-focus","choose","Определить порядок исследования",true,{decisionId:"fs01-first-focus"})
   ]
  },
  {
   id:"fs02-under-stone",nodeId:"five-shadows:fs-02",entryBeatId:"fs02-wall",
   beats:[
    beat("fs02-wall",null,
     "В длинном помещении у каменной полки Рен показывает узкую щель, набитую мусором. Нада достаёт старый лист и читает вторую строку: «Не внутри стен. За камнем, где ждут спуска». Где искать дальше?",
     null,["fs02-check-shelf","fs02-check-meaning"]),
    beat("fs02-shelf","Рен Терен",
     "— Тут, похоже, что-то прятали.",
     "fs02-nada-shelf",[],{skipSafe:true}),
    beat("fs02-nada-shelf","Нада",
     "— Рен, там один мусор. Мы даже запись не дочитали.\n\nОна заглядывает под полку. Это помещение плохо подходит к словам о месте, где ждут спуска.",
     "fs02-platform",[],{skipSafe:true}),
    beat("fs02-meaning","Нада",
     "— «Где ждут спуска». Из этого помещения никто никуда не спускается.\n\nВнимание возвращается к площадке над входом. Оттуда и в самом деле можно ждать тех, кто поднимается с верхней дороги.",
     "fs02-platform",[],{skipSafe:true}),
    beat("fs02-platform",null,
     "Рен первым поднимается на ровную площадку. Внизу начинается короткий спуск ко входу. У выступа лежит камень, чуть отступающий от скалы. Прежде чем трогать плиту, осмотрите место.",
     "fs02-lift",[],{
      inspections:[
       inspection("fs02-drop","Место ожидания спуска","С площадки виден подход к верхней дороге. У стены начинается короткий спуск ко входу в помещение."),
       inspection("fs02-slab","Плита под каменной крошкой","Между камнем и скалой узкая щель; глубже ровная плита. Земля скрывает большую часть края. Тонкая линия выглядит слишком ровной для обычного раскола.")
      ],requiredInspectionIds:["fs02-drop","fs02-slab"]
     }),
    beat("fs02-lift",null,
     "Рен убирает мелкие камни и осторожно проверяет край своим инструментом. Плита сначала не поддаётся, потом сдвигается на несколько пальцев. За ней тёмное углубление — в нём лежит свёрток.",
     "fs02-bundle",[],{skipSafe:true}),
    beat("fs02-bundle","Нада",
     "— Не на камне. Унесём под навес.\n\nНа сухом плаще Нада осторожно снимает истлевшую обёртку. Внутри оказывается тонкий переплёт и отдельный лист. Оба предмета нужно осмотреть без спешки.",
     "fs02-reading",[],{
      inspections:[
       inspection("fs02-binding","Переплёт","Корешок жёсткий, кожа потемнела, но страницы целы. На первой странице непривычно написана дата; дальше перечислены вещи и участники."),
       inspection("fs02-loose","Отдельный лист","Краткие пометки на отдельной бумаге. Она найдена вместе с журналом, но это другой документ; пока не следует делать вывод об общем авторе.")
      ],requiredInspectionIds:["fs02-binding","fs02-loose"]
     }),
    beat("fs02-reading","Нада",
     "— Ортан Вель. Энтар. Роа...\n\nРен подаётся вперёд и видит последнюю строку. Он хватает Наду за запястье. Нада просит отпустить руку — и он сразу разжимает пальцы.",
     "fs02-ren-ela",[],{skipSafe:false}),
    beat("fs02-ren-ela","Рен Терен",
     "— Прости. Это... Эла Терен?",
     "fs02-nada-ela",[],{skipSafe:false}),
    beat("fs02-nada-ela","Нада",
     "— Да.\n\nРен снова смотрит на страницу, уже не заглядывая через её плечо.",
     "fs02-note",[],{skipSafe:false}),
    beat("fs02-note",null,
     "Нада поворачивает следующую страницу. На полях другим почерком сделана короткая пометка. Рассмотрите её, прежде чем спорить о книге Ортана.",
     "fs02-argue",[],{
      inspections:[
       inspection("fs02-ela","Пометка на полях","На странице о верхнем подходе значится: «Эла показала подход». В официальной книге Ортана Веля он описал одиночное восхождение по лицевой стене.")
      ],requiredInspectionIds:["fs02-ela"]
     }),
    beat("fs02-argue","Рен Терен",
     "— А в книге Ортана Веля он пришёл один. Взобрался по лицевой стене. Нашёл вход. Всем всё показал.",
     "fs02-nada-argue",[],{skipSafe:false}),
    beat("fs02-nada-argue","Нада",
     "— Я хочу сравнить почерк и дату с другими записями. Посмотреть, когда именно это писали.\n\nОна осторожно придерживает переплёт.",
     "fs02-return",[],{skipSafe:false}),
    beat("fs02-return",null,
     "Они возвращаются к пастушьему двору под вечер. Нада оставляет единственный оригинал для осмотра при свидетелях, готовит копии, а Рен берёт две страницы и схему для города. Утром он уходит по дороге к верхней переправе; Нада остаётся работать с журналом.",
     null,[],{skipSafe:false})
   ],
   choices:[
    option("fs02-check-shelf","fs02-search","Сначала проверить полку в помещении","fs02-shelf"),
    option("fs02-check-meaning","fs02-search","Уточнить, где ждут спуска","fs02-meaning")
   ],
   objectives:[
    objective("fs02-search-choice","choose","Определить, где искать",true,{decisionId:"fs02-search"}),
    objective("fs02-platform","view","Выйти на площадку",true,{beatId:"fs02-platform"}),
    objective("fs02-slab","inspect","Осмотреть край плиты",true,{evidenceIds:["fs02-slab"]}),
    objective("fs02-binding","inspect","Сохранить описание журнала",true,{evidenceIds:["fs02-binding"]}),
    objective("fs02-loose","inspect","Заметить отдельный лист",true,{evidenceIds:["fs02-loose"]}),
    objective("fs02-ela","inspect","Увидеть пометку об Эле",true,{evidenceIds:["fs02-ela"]})
   ]
  },
  {
   id:"fs03-ela-name",nodeId:"five-shadows:fs-03",entryBeatId:"fs03-alone",
   beats:[
    beat("fs03-alone",null,
     "Утром Рен уходит в город с копиями и схемой. Нада возвращается под навес пастушьего двора. После дороги ей наконец удаётся разложить рядом журнал и лист, найденный в одном свёртке.",
     "fs03-order",[],{skipSafe:true}),
    beat("fs03-order",null,
     "Оба документа уже были у неё в руках. Теперь их можно читать без спешки и сравнить не только имена, но и их порядок. С какого материала начать?",
     null,["fs03-journal-first","fs03-loose-first"]),
    beat("fs03-journal-path",null,
     "Нада сначала разворачивает журнал на странице с перечнем участников. Прежде чем искать объяснения, она проверяет написанное. Отдельный лист ждёт рядом на сухом столе.",
     "fs03-compare-desk",[],{skipSafe:true}),
    beat("fs03-loose-path",null,
     "Нада сначала подносит отдельный лист ближе к свету. Четыре имени узнаваемы, но начало списка заставляет её положить рядом журнал.",
     "fs03-compare-desk",[],{skipSafe:true}),
    beat("fs03-compare-desk",null,
     "Проверьте порядок в обоих документах самостоятельно. Одних воспоминаний о вчерашнем разговоре недостаточно.",
     "fs03-result",[],{
      inspections:[
       inspection("fs03-journal-list","Список в журнале","Перечень участников на странице журнала: Ортан Вель, Энтар, Роа, Эла Терен."),
       inspection("fs03-loose-list","Список на отдельном листе","Те же четыре имени, но начинается список с Элы Терен. Дальше идут Ортан Вель, Энтар и Роа.")
      ],
      requiredInspectionIds:["fs03-journal-list","fs03-loose-list"]
     }),
    beat("fs03-result",null,
     "Сопоставьте два списка. Имена не исчезли и не прибавились — изменился порядок. Причину по одним этим листам установить нельзя.",
     "fs03-note-choice",[],{
      comparisons:[
       comparison("fs03-order-compare","Сверить порядок четырёх имён",
        "Журнал: Ортан → Энтар → Роа → Эла. Отдельный лист: Эла → Ортан → Энтар → Роа. Это наблюдаемое расхождение двух записей, а не доказательство того, зачем составили второй список.",
        ["fs03-journal-list","fs03-loose-list"])
      ],requiredComparisonIds:["fs03-order-compare"]
     }),
    beat("fs03-note-choice",null,
     "Нада не знает, почему списки разошлись. Но теперь у неё есть точный вопрос для дальнейшей проверки. Что она отметит первым в рабочей тетради?",
     null,["fs03-mark-order","fs03-mark-origin"]),
    beat("fs03-order-focus",null,
     "В запись идёт различие в последовательности имён. Нада отмечает оба документа раздельно — иначе позже кто-нибудь перескажет её вывод как одно общее свидетельство.",
     "fs03-end",[],{skipSafe:false}),
    beat("fs03-origin-focus",null,
     "Нада отмечает, что документы найденные вместе, но записи сделаны не одинаково. Она возвращается к спискам и подчёркивает место расхождения: Эла на отдельном листе стоит первой.",
     "fs03-end",[],{skipSafe:false}),
    beat("fs03-end",null,
     "Двор за стеной уже проснулся. Рен теперь идёт к городу; Нада остаётся с оригиналом и ещё не отвеченным вопросом. Четыре имени на двух листах — один из них начинается с Элы.",
     null,[],{skipSafe:false})
   ],
   choices:[
    option("fs03-journal-first","fs03-reading-order","Сначала открыть журнал","fs03-journal-path"),
    option("fs03-loose-first","fs03-reading-order","Сначала читать отдельный лист","fs03-loose-path"),
    option("fs03-mark-order","fs03-note-focus","Зафиксировать разницу в порядке","fs03-order-focus"),
    option("fs03-mark-origin","fs03-note-focus","Отметить происхождение двух записей","fs03-origin-focus")
   ],
   objectives:[
    objective("fs03-reading-order","choose","Выбрать порядок сверки",true,{decisionId:"fs03-reading-order"}),
    objective("fs03-journal","inspect","Прочитать имена в журнале",true,{evidenceIds:["fs03-journal-list"]}),
    objective("fs03-loose","inspect","Прочитать имена на листе",true,{evidenceIds:["fs03-loose-list"]}),
    objective("fs03-compare","compare","Явно сопоставить порядок имён",true,{
      evidenceIds:["fs03-journal-list","fs03-loose-list"],comparisonId:"fs03-order-compare"
    }),
    objective("fs03-focus","choose","Определить, что занести в запись",true,{decisionId:"fs03-note-focus"})
   ]
  }
 ];
 return Object.freeze({scenes});
})();
 const scenes=JSON.parse(JSON.stringify(draft.scenes));
 if(scenes.length!==3)throw Error("LORE_PILOT_SCENES_MISMATCH");
 const fs01=scenes.find(s=>s.nodeId==="five-shadows:fs-01");
 const firstEnd=fs01?.beats.find(b=>b.id==="fs01-end");
 if(!firstEnd?.text?.includes("каменную полку"))throw Error("LORE_PILOT_FS01_CHANGED");
 firstEnd.text+=" Со стороны входа донёсся скрип шагов по щебёнке. Рен поднял голову, но за поворотом никого не было видно.";
 const fs02=scenes.find(s=>s.nodeId==="five-shadows:fs-02");
 const oldReturn=fs02?.beats.find(b=>b.id==="fs02-return");
 if(!oldReturn?.text?.includes("Утром он уходит"))throw Error("LORE_PILOT_FS02_CHANGED");
 oldReturn.text="Нада закрыла журнал и отдельный лист, не выпуская свёрток из рук, пока Рен убирал фонарь. Возвращаться к пастушьим дворам предстояло по проверенной дороге, ещё несколько часов. Нада попросила Рена идти впереди — на осыпи нельзя было одновременно смотреть под ноги и удерживать старую бумагу. Ниже, у поворота, слышались чужие голоса. Рен остановился ещё до выхода на открытый участок.";
 const proposedGates={
 "five-shadows:fs-01":{
  battleId:"fs01-approach-combat",
  title:"Чужой маршрут",
  intro:"У выхода зазвенел чужой фонарь. Двое путников с верёвкой и мятым рисунком дороги встали между Реном, Надой и безопасным спуском. Первый попросил карту и потянулся к её сумке; второй не освобождал проход.",
  lines:[
   {speakerId:"Рен Терен",text:"— Пойди своей дорогой. Мы никого не звали."},
   {speakerId:"Нада",text:"— Вы карту просили. Сумку я не предлагала."}
  ],
  victory:"Люди с фонарём отошли к тропе. Рен посмотрел им вслед, но не бросился догонять. Нада проверила ремни сумки. Они были не первыми, кто искал дорогу, и не знали, вернутся ли эти двое. Впереди оставались каменная полка и вторая строка подсказки.",
  defeat:"Соперники пока удерживают узкий выход. Пройти к дальней площадке не удалось. Сохранённая история не меняется; можно повторить бой."
 },
 "five-shadows:fs-02":{
  battleId:"fs02-evidence-combat",
  title:"Право на свидетельство",
  intro:"На обратном спуске ждали трое. Один держал тот же мятый рисунок дороги. Они заметили свёрток под плащом Нады, но не могли знать, что внутри. Старший потребовал передать находку. Уход к пастушьим дворам оставался за ними.",
  lines:[
   {speakerId:"Нада",text:"— Не трогайте. Это не ваше."},
   {speakerId:"Рен Терен",text:"— Нада, к стене. Там места больше."}
  ],
  victory:"Преследователи отступили, а бумаги остались у Нады. Под вечер Рен и Нада добрались до пастушьего двора. Нада попросила хозяйку и соседа засвидетельствовать состояние оригинала, приготовила копии. Утром Рен ушёл в город с двумя страницами и схемой; Нада осталась с журналом.",
  defeat:"Подлинник пока не удалось донести к свидетелям. Уход вниз закрыт, пока соперники удерживают тропу. Следующий эпизод не откроется без победы."
 }
};
 const graph=JSON.parse(JSON.stringify(Data.catalog()));
 for(const scene of scenes){
  const node=graph.nodes.find(n=>n.id===scene.nodeId);
  if(!node||node.contentId!==null)throw Error("LORE_PILOT_GRAPH_CHANGED");
  node.contentId=scene.id;
  const fight=proposedGates[scene.nodeId];
  if(fight){
   node.requiredBattleId=fight.battleId;
   node.requiredBattleNarrative={title:fight.title,intro:fight.intro,lines:fight.lines,
    victory:fight.victory,defeat:fight.defeat};
  }
 }
 const pack={scenes};
 if(!Data.catalogIsValid(graph)||!Scripts.valid(pack,graph))
  throw Error("LORE_PILOT_INVALID_GRAPH_OR_SCRIPT");
 const freeze=v=>{if(v&&typeof v==="object"&&!Object.isFrozen(v)){
  for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;};
 freeze(graph);freeze(pack);
 const data=Object.freeze({KINDS:Data.KINDS,catalog:()=>graph,
  getStory:(id,c=graph)=>Data.getStory(id,c),
  getNode:(id,c=graph)=>Data.getNode(id,c),
  nodesForStory:(id,c=graph)=>Data.nodesForStory(id,c),
  catalogIsValid:(c=graph)=>Data.catalogIsValid(c)});
 return Object.freeze({data,pack});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignPilot;
