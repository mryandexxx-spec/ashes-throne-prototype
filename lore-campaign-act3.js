/* LOREACT3001 [ПРЕДЛОЖЕНИЕ]: game-only adaptation of approved literary
 * parts 5 (1.0), 6 (1.0), 7 (1.4). Not a retcon or new literary canon.
 * No new combats: the source conflicts are road safety, access and evidence.
 * Previously approved mandatory FS-01..FS-06 battles remain unchanged.
 */
const LoreCampaignAct3=(()=>{
 "use strict";
 const Prior=typeof LoreCampaignTrials!=="undefined"?
  LoreCampaignTrials:require("./lore-campaign-trials.js");
 const Data=typeof LoreCampaignData!=="undefined"?
  LoreCampaignData:require("./lore-campaign-data.js");
 const Scripts=typeof LoreCampaignScenes!=="undefined"?
  LoreCampaignScenes:require("./lore-campaign-scenes.js");
 const clone=x=>JSON.parse(JSON.stringify(x));
 const beat=(id,speakerId,text,nextBeatId=null,choiceIds=[],more={})=>
  ({id,speakerId,text,nextBeatId,choiceIds,skipSafe:false,effects:[],...more});
 const choice=(id,decisionId,label,nextBeatId)=>
  ({id,decisionId,label,nextBeatId,effects:[]});
 const inspect=(id,label,text)=>({id,label,text});
 const compare=(id,label,text,evidenceIds)=>({id,label,text,evidenceIds});
 const goal=(id,kind,hint,more)=>({id,kind,hint,required:true,...more});
 const scenes=[
  {
   id:"fs07-strangers-marks",nodeId:"five-shadows:fs-07",entryBeatId:"fs07-after-light",
   beats:[
    beat("fs07-after-light",null,
     "После опыта со светом Рен возвращается мыслями к нескольким дням перед ним. Тогда Керн пришёл на пастуший двор: ему принадлежал груз, потерянный на полке. Долг Рена оставался, как и желание Керна водить людей к Пяти теням за плату.",
     "fs07-map"),
    beat("fs07-map",null,
     "Керн принёс нарисованную по рыночным словам Рена схему. На ней короткая линия шла прямо через осыпь, а старый обход уходил в сторону. Важно понять не кто вправе рассказывать о дороге, а какую метку следующий путник примет за безопасную.",
     "fs07-compare",[],{
      inspections:[
       inspect("fs07-red-route","Красная стрелка на схеме",
        "Короткий путь пересекает сужающуюся осыпь. На месте позже появились красные полосы; их видимость не доказывает, что под камнем есть опора."),
       inspect("fs07-old-detour","Старый пастуший обход",
        "Путь длиннее, но пройден проводниками. После будущего обвала он останется единственным вариантом для обхода завала с поправкой на погоду."),
       inspect("fs07-stone","Плита у осыпи",
        "У старой трещины сыплется пыль после ударов штыря. Большой камень не становится надёжным креплением только потому, что не шевелился вчера.")
      ],requiredInspectionIds:["fs07-red-route","fs07-old-detour","fs07-stone"]
     }),
    beat("fs07-compare",null,
     "Нада различает две претензии: неверная метка опасна, но запретить другим знать дорогу Рен не может. Арт замечает трещину у штыря, Нада — сухую пыль, появившуюся после ударов. Сопоставьте указатель и опору, прежде чем решать, что проверять первым.",
     "fs07-priority",[],{
      comparisons:[
       compare("fs07-safe-route","Сопоставить маршрут и устойчивость",
        "Нанесённая краской стрелка обещает движение там, где плита треснула. Безопасный обход не исправит сам себя: неверное указание нужно убрать, а людей вывести из-под склона.",
        ["fs07-red-route","fs07-old-detour","fs07-stone"])
      ],requiredComparisonIds:["fs07-safe-route"]
     }),
    beat("fs07-priority",null,
     "Работник тянется к штырю, другой ещё держит молоток. Принятый исход происшествия изменить нельзя; выбрать можно, за чем следить в первую очередь при восстановлении последовательности действий.",
     null,["fs07-people-first","fs07-anchor-first"]),
    beat("fs07-people",null,
     "Рен смотрит на людей у края. Арт зовёт их назад по своим следам; Нада останавливает попытку забрать инструментальный мешок. Никто не остаётся на плите.",
     "fs07-fall"),
    beat("fs07-anchor",null,
     "В поле зрения остаются штырь, свежая пыль и натянутая верёвка. Привязать людей к отделяющейся плите было бы хуже, чем оставить инструменты. Арт отводит работников к широкому участку.",
     "fs07-fall"),
    beat("fs07-fall",null,
     "Плита уходит вниз вместе со штырём и мешком. Люди успевают отступить; завален нижний пастуший проход. Путь для грузов становится длиннее. Керн обещает оплатить расчистку, а Рен — показать его работникам обход. Долг за потерянный груз остаётся.",
     "fs07-end"),
    beat("fs07-end",null,
     "Вечером у лампы Рен всё ещё не знает, что именно увидели на другом берегу: белую ткань или лишь её край. Затем он и Нада отправятся обратно в город. Ни красная линия, ни дальний свет сами по себе не дают права объявить опасное место безопасным.",
     null)
   ],
   choices:[
    choice("fs07-people-first","fs07-priority","Сперва проследить, как вывели людей","fs07-people"),
    choice("fs07-anchor-first","fs07-priority","Сперва проверить, почему подвела опора","fs07-anchor")
   ],
   objectives:[
    goal("fs07-mark","inspect","Осмотреть красную стрелку",
     {evidenceIds:["fs07-red-route"]}),
    goal("fs07-detour","inspect","Проверить старый обход",
     {evidenceIds:["fs07-old-detour"]}),
    goal("fs07-stone","inspect","Проверить опору под штырь",{evidenceIds:["fs07-stone"]}),
    goal("fs07-compare","compare","Сопоставить обещанный маршрут с реальным камнем",
     {evidenceIds:["fs07-red-route","fs07-old-detour","fs07-stone"],comparisonId:"fs07-safe-route"}),
    goal("fs07-priority","choose","Выбрать порядок проверки опасного случая",
     {decisionId:"fs07-priority"}),
    goal("fs07-safety","view","Убедиться, что люди вышли из опасного места",
     {beatId:"fs07-fall"})
   ]
  },
  {
   id:"fs08-right-to-light",nodeId:"five-shadows:fs-08",entryBeatId:"fs08-request",
   beats:[
    beat("fs08-request","Лиора Вель",
     "На следующий день после опыта с лампой в школу пришёл человек с монетами: хотел купить место на рынке и смотреть на Пять теней без толпы.\n\n— Я не могу назначить, когда там снова зажгут огонь, — объяснила Лиора.\n\nОн спросил, сколько будет стоить место только на час. К вечеру по городу уже расклеивали объявления о продаже хорошего вида.",
     "fs08-return"),
    beat("fs08-return",null,
     "На пятый день после опыта Рен и Нада вернулись в город. Они рассказали о рухнувшей плите и закрытой дороге. Грузы пошли длинным обходом; школе не хватало исправных верёвок. Илар Вель предложил оградить повреждённую рыночную ступень и оплатить укрепление, но рабочие перекрыли и целую часть торгового прохода. Осмотрите объявления, ограждение и последствия задержки грузов.",
     "fs08-priority",[],{
      inspections:[
       inspect("fs08-promises","Объявления о «месте у света»",
        "Людям обещают лучший обзор с рынка за плату. Сигнал на другом берегу зажигают не по расписанию продавца; время и даже повторение опыта не гарантированы."),
       inspect("fs08-stakes","Стойки и проход для торговли",
        "Работники Илара оградили участок шире опасного места и перекрыли часть прохода между прилавками. Нужно проверить, где требуется безопасное ограничение, а где начинается платный контроль общего пространства."),
       inspect("fs08-supply","Задержка верхних грузов",
        "Из-за обвала товары и верёвки идут длинным обходом. Торговцы и школа уже несут издержки; новые ограждения не устраняют причину задержки.")
      ],requiredInspectionIds:["fs08-promises","fs08-stakes","fs08-supply"]
     }),
    beat("fs08-documents","Лиора Вель",
     "— Вы покажите, где именно край повреждён, — сказала Лиора. — Не всю площадь, саму ступень.\n\nУ неё перед глазами теперь три разных обстоятельства: риск для прохожих, перекрытый заработок торговцев и задержанные школьные снасти. Сопоставьте их, прежде чем решать, какое ограждение действительно необходимо.",
     "fs08-reopen",[],{
      comparisons:[
       compare("fs08-access","Отделить безопасность от продажи доступа",
        "Опасный участок можно оградить после осмотра, но свободная проходная часть рынка не становится частной собственностью. Плата за вид не подтверждает права обещать свет в определённое время.",
        ["fs08-promises","fs08-stakes","fs08-supply"])
      ],requiredComparisonIds:["fs08-access"]
     }),
    beat("fs08-priority","Лиора Вель",
     "Мара не может нормально торговать за стойками. Илар напоминает, что кто-то должен оплатить ремонт, иначе за новый несчастный случай спросят со школы. Все наблюдения уже собраны. Чьё утверждение проверить первым: торговцев о проходе или продавцов билетов о доступе к свету?",
     null,["fs08-pass-first","fs08-claims-first"]),
    beat("fs08-pass","Мара",
     "— Они мне оставили проход, — сказала Мара, показывая между стойками. — По одному человеку. С корзинами тоже по одному, что ли?\n\nМара показывает участок целой мостовой, который рабочие перекрыли вместе с опасной ступенью. Убрать лишние стойки можно, не открывая повреждённый край.",
     "fs08-documents"),
    beat("fs08-claims","Илар",
     "Илар говорит о расходах на укрепление и о людях, которым хочется увидеть Пять теней. Лиора спрашивает, кто обещал им следующий световой сигнал.\n\nОтвета нет: лампа на другом берегу не подчиняется продавцам билетов. Но проверка объявлений не отменяет работы на опасной ступени.",
     "fs08-documents"),
    beat("fs08-reopen","Лиора Вель",
     "Лиора велит переставить стойки к повреждённой кромке. Торговля возвращается на прежнее место. Илар не останавливает рабочих, но потом, уже без свидетелей, говорит, что не сможет оплатить школе новые снасти в следующем месяце.\n\n— Ты обещал верёвки ещё до этого рынка, — напоминает Лиора.\n\nИлар уходит. Лиоре придётся объяснять ученикам, почему занятия с нагрузкой откладываются. Для рынка решение было правильным; бесплатным оно не оказалось.",
     "fs08-school"),
    beat("fs08-school","Лиора Вель",
     "Вечером Лиора открывает школьную книгу расходов. Она находит распоряжение о возмещении Энтару и Роа затрат на наблюдение между берегами; под ним стоит имя Ортана. Подпись ещё предстоит сверить, а дата выплаты после основания школы не показывает, когда именно люди работали.\n\nНа семейном листе Илара были две суммы и дата по другому счёту лет. Нада не разрешила объявлять её более ранней без сверки. Лиора оставляет книгу открытой и идёт за Савой.",
     null)
   ],
   choices:[
    choice("fs08-pass-first","fs08-investigation","Сначала проверить, сколько рынка перекрыто","fs08-pass"),
    choice("fs08-claims-first","fs08-investigation","Сначала проверить, что обещали покупателям","fs08-claims")
   ],
   objectives:[
    goal("fs08-advert","inspect","Проверить обещания продавцов обзора",{evidenceIds:["fs08-promises"]}),
    goal("fs08-barriers","inspect","Проверить ограждение рынка",
     {evidenceIds:["fs08-stakes"]}),
    goal("fs08-supply","inspect","Проверить задержку грузов",
     {evidenceIds:["fs08-supply"]}),
    goal("fs08-access","compare","Сопоставить безопасность и право прохода",
     {evidenceIds:["fs08-promises","fs08-stakes","fs08-supply"],comparisonId:"fs08-access"}),
    goal("fs08-investigation","choose","Выбрать порядок проверки ограничений",
     {decisionId:"fs08-investigation"}),
    goal("fs08-record","view","Увидеть отдельную школьную запись о расходах",
     {beatId:"fs08-school"})
   ]
  },
  {
   id:"fs09-reverse-order",nodeId:"five-shadows:fs-09",entryBeatId:"fs09-rope",
   beats:[
    beat("fs09-rope",null,
     "Ала узнаёт школьную верёвку по синей нитке на конце. Мальчик несёт её к старой верхней улице за человеком, который продаёт вид на Пять теней. Верёвку оставили для учебных узлов, а не для страховки людей.",
     "fs09-path",[],{
      inspections:[
       inspect("fs09-training-rope","Верёвка с синей ниткой",
        "Арт отметил эту снасть как годную для упражнений, но негодную для подъёма человека. Правильный узел не превращает изношенный материал в страховочный."),
       inspect("fs09-rail","Отверстия старых перил",
        "На узком участке старой улицы остались отверстия без прежней опоры. Потянуть за верёвку, привязанную к такому месту, опасно; неизвестно, выдержит ли камень."),
       inspect("fs09-narrow","Проход возле заложенной двери",
        "Местами двоим не разойтись: стена с одной стороны, парапет и крыши ниже — с другой. Это опасный старый городской участок, а не переход через ущелье.")
      ],requiredInspectionIds:["fs09-training-rope","fs09-rail","fs09-narrow"]
     }),
    beat("fs09-path",null,
     "Ала поднимается к старой улице и видит людей на узком проходе. Проводник обещал обзор, но покупатели говорят уже о верхнем входе. Сначала необходимо проверить, выдержит ли опора, и понять, как вывести людей по одному.",
     "fs09-evac",[],{
      comparisons:[
       compare("fs09-route-safety","Проверить страховку и путь отхода",
        "Верёвка предназначена для упражнений, а крепление старых перил ненадёжно. Тесный участок нельзя проходить встречными группами; для выхода нужно сперва освободить лестницу и проходить по одному.",
        ["fs09-training-rope","fs09-rail","fs09-narrow"])
      ],requiredComparisonIds:["fs09-route-safety"]
     }),
    beat("fs09-evac",null,
     "Ала выводит людей обратно по одному и убирает верёвку. Никто не упал. Лиора, пришедшая позже, проверяет отверстия перил и спрашивает, кто первым вернулся. Этот вопрос неожиданно напоминает Рену о списках из Пяти теней.",
     "fs09-lists",[],{
      inspections:[
       inspect("fs09-journal","Порядок имён в журнале",
        "В журнале: Ортан, Энтар, Роа, Эла. Последовательность сама по себе не раскрывает, входили ли люди именно в таком порядке."),
       inspect("fs09-separate","Порядок имён на отдельном листе",
        "На отдельном листе: Эла, Ортан, Энтар, Роа. Эла перенесена в начало, но остальные трое сохранили прежний взаимный порядок."),
       inspect("fs09-school-record","Школьная запись о возмещении",
        "Лиора сообщает о распоряжении Ортана возместить Энтару и Роа затраты на наблюдение между берегами. Время работы и подлинность подписи ещё не установлены.")
      ],requiredInspectionIds:["fs09-journal","fs09-separate","fs09-school-record"]
     }),
    beat("fs09-lists",null,
     "Нада предлагает сравнить оба ряда имён, не объявляя отдельный лист расписанием выхода. Если бы четыре человека просто развернули очередь, изменился бы порядок всех четверых. Здесь этого не произошло.",
     "fs09-next",[],{
      comparisons:[
       compare("fs09-orders","Проверить гипотезу об обратной очереди",
        "Журнал: Ортан → Энтар → Роа → Эла. Лист: Эла → Ортан → Энтар → Роа. Это перенос одного имени, а не полный обратный порядок. Возможны разные объяснения, но доказанного пока нет.",
        ["fs09-journal","fs09-separate"]),
       compare("fs09-archive-check","Отделить школьную запись от догадки о выходе",
        "Запись подтверждает распоряжение о расходах, но не устанавливает, когда использовались стойки и кто в каком порядке покинул помещение. Нужны датировка, проверка подписи и маршрут.",
        ["fs09-school-record","fs09-journal","fs09-separate"])
      ],requiredComparisonIds:["fs09-orders","fs09-archive-check"]
     }),
    beat("fs09-next",null,
     "Участок улицы останется закрыт до проверки. Сава отметит ещё одну точку, откуда видны прорези, но видимость не доказывает передачу древних сигналов. На чём сосредоточить следующую проверку?",
     null,["fs09-safety-first","fs09-documents-first"]),
    beat("fs09-safety",null,
     "Первым делом Ала показывает Лиоре место, где нельзя разойтись. Рен просит позднее сравнить эту тесноту с проходом у Пяти теней. Пока путь повреждён, никто не обещает новую экспедицию.",
     "fs09-public"),
    beat("fs09-documents",null,
     "Сава отдельно записывает наблюдение за старой улицей и вопросы к двум спискам. Лиора не разрешает превращать бумажную гипотезу в указание идти через опасный проход.",
     "fs09-public"),
    beat("fs09-public",null,
     "Лиора снимает со школьной стены изображение Ортана, одиноко взбирающегося по лицевой скале. На новой доске написано: верхняя старая улица закрыта до осмотра; безопасного подъёма по лицевой стене к Пяти теням нет. Рен обещает показывать длинную дорогу только после проверки и расчистки.",
     "fs09-end"),
    beat("fs09-end",null,
     "Ала возвращается к Маре. Она знает цену хорошего узла на плохой опоре; о порядке имён в старом списке она по-прежнему ничего наверняка не утверждает. Историческая загадка остаётся открыта.",
     null)
   ],
   choices:[
    choice("fs09-safety-first","fs09-next-check","Сначала проверить старую улицу","fs09-safety"),
    choice("fs09-documents-first","fs09-next-check","Сначала проверить записи и даты","fs09-documents")
   ],
   objectives:[
    goal("fs09-rope","inspect","Проверить учебную верёвку",
     {evidenceIds:["fs09-training-rope"]}),
    goal("fs09-rail","inspect","Проверить место крепления",
     {evidenceIds:["fs09-rail"]}),
    goal("fs09-passage","inspect","Оценить тесный проход",{evidenceIds:["fs09-narrow"]}),
    goal("fs09-safe-compare","compare","Выбрать безопасный путь отхода",
     {evidenceIds:["fs09-training-rope","fs09-rail","fs09-narrow"],comparisonId:"fs09-route-safety"}),
    goal("fs09-journal","inspect","Проверить запись журнала",
     {evidenceIds:["fs09-journal"]}),
    goal("fs09-separate","inspect","Проверить отдельный лист",
     {evidenceIds:["fs09-separate"]}),
    goal("fs09-school","inspect","Проверить школьную запись",
     {evidenceIds:["fs09-school-record"]}),
    goal("fs09-order-compare","compare","Проверить перестановку имён, а не верить догадке",
     {evidenceIds:["fs09-journal","fs09-separate"],comparisonId:"fs09-orders"}),
    goal("fs09-record-compare","compare","Проверить пределы школьного свидетельства",
     {evidenceIds:["fs09-school-record","fs09-journal","fs09-separate"],comparisonId:"fs09-archive-check"}),
    goal("fs09-decision","choose","Определить следующую проверку",
     {decisionId:"fs09-next-check"})
   ]
  }
 ];
 const graph=clone(Prior.data.catalog()),pack=clone(Prior.pack);
 if(graph.nodes.length!==6||pack.scenes.length!==6||
    graph.nodes[5]?.id!=="five-shadows:fs-06"||
    graph.nodes[5].nextNodeIds.length)throw Error("LORE_ACT3_BASE_CHANGED");
 const story=graph.stories.find(x=>x.id==="five-shadows");
 if(!story||story.mapLayers.length!==2)throw Error("LORE_ACT3_STORY_CHANGED");
 const layer="city-route",chapter="five-shadows-act-3";
 story.chapters.push(chapter);
 story.mapLayers.push({id:layer,title:"Дорога и свидетельства"});
 graph.chapters.push({id:chapter,storyId:story.id,
  title:"Акт III · Цена пути",order:3,mapLayerId:layer});
 graph.nodes[5].nextNodeIds=["five-shadows:fs-07"];
 const metadata=[
  ["fs-07","Чужие метки","investigation","part-5","fs-06","fs-08",.16,.7],
  ["fs-08","Право на свет","task","part-6","fs-07","fs-09",.49,.43],
  ["fs-09","Обратный порядок","investigation","part-7","fs-08",null,.8,.32]
 ];
 for(const [suffix,title,kind,source,prev,next,x,y] of metadata){
  const id=story.id+":"+suffix;
  const sourceNode=graph.nodes[5];
  const n=clone(sourceNode);
  // FS-07..09 are not retroactively labelled as literal armed conflicts.
  // They retain the campaign's already-mandatory FS-01..06 encounters.
  delete n.requiredBattleId;
  delete n.requiredBattleNarrative;
  delete n.requiredBattleObjective;
  n.id=id;n.title=title;n.kind=kind;n.chapterId=chapter;n.mapLayerId=layer;
  n.marker={x,y};n.prerequisites=[story.id+":"+prev];
  n.nextNodeIds=next?[story.id+":"+next]:[];
  n.contentId=scenes.find(s=>s.nodeId===id)?.id||null;
  n.canonicalRef=source;n.canonClass="adaptation";
  graph.nodes.push(n);
 }
 pack.scenes.push(...scenes);
 if(graph.nodes.length!==9||pack.scenes.length!==9||
   !Data.catalogIsValid(graph)||!Scripts.valid(pack,graph))
  throw Error("LORE_ACT3_INVALID_GRAPH_OR_SCRIPT");
 const deepFreeze=x=>{if(x&&typeof x==="object"&&!Object.isFrozen(x)){
  Object.values(x).forEach(deepFreeze);Object.freeze(x);
 }return x;};
 deepFreeze(graph);deepFreeze(pack);
 const data=Object.freeze({KINDS:Data.KINDS,catalog:()=>graph,
  getStory:(id,c=graph)=>Data.getStory(id,c),
  getNode:(id,c=graph)=>Data.getNode(id,c),
  nodesForStory:(id,c=graph)=>Data.nodesForStory(id,c),
  catalogIsValid:(c=graph)=>Data.catalogIsValid(c)});
 return Object.freeze({data,pack,encounter:Prior.encounter});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignAct3;
