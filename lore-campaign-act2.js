/* LOREACT2001: [ПРЕДЛОЖЕНИЕ] game adaptation of approved parts 2–4.
   Not the literary canon; no new combat, rewards, energy or save format. */
const LoreCampaignAct2=(()=>{
 "use strict";
 const Pilot=typeof LoreCampaignPilot!=="undefined"?LoreCampaignPilot:require("./lore-campaign-pilot.js");
 const Data=typeof LoreCampaignData!=="undefined"?LoreCampaignData:require("./lore-campaign-data.js");
 const Scripts=typeof LoreCampaignScenes!=="undefined"?LoreCampaignScenes:require("./lore-campaign-scenes.js");
 const copy=x=>JSON.parse(JSON.stringify(x));
 const beat=(id,speakerId,text,nextBeatId=null,choiceIds=[],more={})=>
  ({id,speakerId,text,nextBeatId,choiceIds,skipSafe:false,effects:[],...more});
 const choice=(id,decisionId,label,nextBeatId)=>({id,decisionId,label,nextBeatId,effects:[]});
 const inspect=(id,label,text)=>({id,label,text});
 const compare=(id,label,text,evidenceIds)=>({id,label,text,evidenceIds});
 const goal=(id,kind,hint,more)=>({id,kind,hint,required:true,...more});
 const scenes=[
  {id:"fs04-the-returned",nodeId:"five-shadows:fs-04",entryBeatId:"fs04-gate",
   beats:[
    beat("fs04-gate",null,
     "Спустя три дня Рен вернулся на Косую Полку с копиями и схемой. Лиора у ворот занималась мальчиком на носилках. Рен хотел сперва поговорить с ней без свидетелей, но у скамьи остановились люди.",
     "fs04-liora"),
    beat("fs04-liora","Лиора Вель",
     "— Где Нада?\n\nРен объяснил, что она осталась с подлинником у пастухов. Лиора попросила помощников перенести мальчика в тень, и только потом повернулась к Рену.",
     "fs04-market"),
    beat("fs04-market",null,
     "Рен рассказал о верхнем обходе и назвал Элу Терен. Грузчик перестал двигать тележку. Кто-то сразу спросил, не его ли это родня. Сава подошла со счётной дощечкой; Лиора потребовала не путать услышанное с доказанным.",
     "fs04-docs"),
    beat("fs04-docs","Сава",
     "— Покажи, что привёз. А второй лист? Ты его тоже переписал?\n\nПроверьте два свидетельства, прежде чем решать, что можно утверждать публично.",
     "fs04-verify",[],{
      inspections:[
       inspect("fs04-copy","Копия журнала",
        "В копии Рена: Ортан Вель, Энтар, Роа, Эла Терен. На полях — слова о том, что Эла показала подход. Подлинник находится у Нады; почерк пока нельзя сравнить."),
       inspect("fs04-claim","Рассказ об отдельном листе",
        "Рен говорит, что на другом листе Эла стоит первой. Самого листа у него нет. Сава может записать его слова, но не сверить их с документом.")
      ],requiredInspectionIds:["fs04-copy","fs04-claim"]}),
    beat("fs04-verify",null,
     "У Савы в руках копия одного документа и пересказ другого. Это не одно и то же.",
     "fs04-focus",[],{
      comparisons:[compare("fs04-source-compare","Сопоставить источник и свидетельство",
       "Копия позволяет прочесть переписанные строки, но не установить подлинность почерка. Об ином порядке имён город пока знает только со слов Рена. Для проверки нужен сам лист.",
       ["fs04-copy","fs04-claim"])],
      requiredComparisonIds:["fs04-source-compare"]}),
    beat("fs04-focus",null,
     "У ворот уже обсуждают путь к Пяти теням. Сава дописывает показания, а Лиора узнаёт, что двое людей могли уйти искать вход с лицевой стороны. Что проверить первым?",
     null,["fs04-road-first","fs04-archive-first"]),
    beat("fs04-road","Лиора Вель",
     "— Ты объяснил им, что по лицевой стене не подняться?\n\nРен уверяет, что предупреждал. Лиора велит готовить верёвки и запас для тех, кто мог заблудиться на верхней дороге.",
     "fs04-assemble"),
    beat("fs04-archive","Сава",
     "— Я запишу отдельно, где подлинник и кто видел его после находки.\n\nРен отвечает, что хозяйка двора собиралась оформить опись. Лиора ждёт, пока Сава закончит, и собирает спасателей.",
     "fs04-assemble"),
    beat("fs04-assemble",null,
     "Для последнего поворота нужен проводник. Рену задают не вопрос о заслугах, а простой: сможет ли он показать безопасный путь и слушать распоряжения Лиоры?",
     "fs04-end"),
    beat("fs04-end","Рен Терен",
     "— Поворот покажу. Там осыпь, не надо через неё резать.\n\nОн убирает копии обратно в сумку. Нада пока не знает, как быстро её осторожные записи превратились на рынке в слухи.",
     null)
   ],
   choices:[
    choice("fs04-road-first","fs04-investigation-focus","Сначала проверить опасный маршрут","fs04-road"),
    choice("fs04-archive-first","fs04-investigation-focus","Сначала проверить происхождение документов","fs04-archive")
   ],
   objectives:[
    goal("fs04-city","view","Увидеть публичную реакцию",{beatId:"fs04-market"}),
    goal("fs04-copy","inspect","Осмотреть копию журнала",{evidenceIds:["fs04-copy"]}),
    goal("fs04-claim","inspect","Отделить устные слова от документа",{evidenceIds:["fs04-claim"]}),
    goal("fs04-compare","compare","Сопоставить два источника",{evidenceIds:["fs04-copy","fs04-claim"],comparisonId:"fs04-source-compare"}),
    goal("fs04-focus","choose","Выбрать порядок проверки",{decisionId:"fs04-investigation-focus"})
   ]
  },
  {id:"fs05-upper-door",nodeId:"five-shadows:fs-05",entryBeatId:"fs05-crossing",
   beats:[
    beat("fs05-crossing",null,
     "На третий день после ухода Рена Нада повезла журнал и отдельный лист в город. Перед переправой она встретила Рена, Лиору, Арта и Саву. Спасатели искали двух людей, рискнувших подняться по лицевой стене.",
     "fs05-inventory"),
    beat("fs05-inventory","Нада",
     "— Свидетели видели свёрток во дворе. Где он лежал до этого, знают только мы с Реном.\n\nОсмотрите две записи: о книге и о маршруте.",
     "fs05-admission",[],{
      inspections:[
       inspect("fs05-witnesses","Опись пастушьего двора",
        "Хозяйка и сосед подтвердили число листов, повреждения переплёта и наличие отдельного листа. Они не присутствовали при открытии тайника."),
       inspect("fs05-route","Знание последнего поворота",
        "Рен и Нада прошли опасный поворот лично. Лиора отвечает за группу, но ещё не видела этот участок. Их сведения нельзя заменять чужим рассказом о прямом подъёме.")
      ],requiredInspectionIds:["fs05-witnesses","fs05-route"]}),
    beat("fs05-admission","Нада",
     "— Рен, откуда ты знал, что на том листе Эла первая?\n\nОказывается, перед уходом Рен ночью достал бумагу из её сумки. Он не спрашивал разрешения. Нада просит Саву записать этот факт именно так, а не как согласованный осмотр.",
     "fs05-priority"),
    beat("fs05-priority",null,
     "Наде не нравится возвращаться с людьми, которые спорят о её работе. Но где-то у стены могут ждать помощи двое. С чего группа начнёт?",
     null,["fs05-road-focus","fs05-record-focus"]),
    beat("fs05-road","Лиора Вель",
     "— Сперва найдём людей. О книге договорим.\n\nРен показывает обход. На осыпи Лиора выбирает более широкий путь, и он уступает.",
     "fs05-arrive"),
    beat("fs05-record","Сава",
     "— Записываю, кто видел книгу, а кто только слышал о ней.\n\nНада проверяет формулировку. Лиора не ждёт спора до конца дня: группе ещё идти по опасной дороге.",
     "fs05-arrive"),
    beat("fs05-arrive",null,
     "За задним входом в Пять теней группа находит пустой тайник. Из прорези видно двоих на узком выступе лицевой стены: один всё ещё не выпускает мешок с чужим грузом.",
     "fs05-rescue"),
    beat("fs05-rescue",null,
     "Арт ставит страховку, Лиора руководит подъёмом. Рен обещает возместить стоимость груза, чтобы человек смог выпустить мешок. Мешок падает. Обоих вытаскивают живыми; долг Рена остаётся.",
     "fs05-custody"),
    beat("fs05-custody","Нада",
     "— Кто убрал книгу?\n\nВо время спасения помощник перенёс журнал и лист к ларю. Нада не давала согласия. Сава записала, что именно произошло.",
     "fs05-compare",[],{
      inspections:[
       inspect("fs05-sava-note","Запись Савы о переносе",
        "Помощник Лиоры перенёс журнал и отдельный лист во время спасения. Нада возражала. Запись не содержит её согласия передать документы школе."),
       inspect("fs05-liora-order","Распоряжение Лиоры",
        "Лиора намерена оставить свёрток под охраной до утра, ссылаясь на безопасность людей и имущества. Нада требует вернуть книгу и лист.")
      ],requiredInspectionIds:["fs05-sava-note","fs05-liora-order"]}),
    beat("fs05-compare",null,
     "Людей удалось спасти. Но это не отвечает на вопрос, кто вправе распоряжаться журналом.",
     "fs05-end",[],{
      comparisons:[compare("fs05-consent","Отделить заботу от согласия",
       "Сава зафиксировала перенос без разрешения Нады. Лиора объясняет, почему решила охранять документы. Мотив решения не заменяет согласие Нады на передачу документов.",
       ["fs05-sava-note","fs05-liora-order"])],
      requiredComparisonIds:["fs05-consent"]}),
    beat("fs05-end",null,
     "Лиора идёт проверить спасённых. Сава отдаёт Наде копию записи. Рен приносит воды и не предлагает забрать сумку. Наутро вопрос о книге всё ещё будет открытым.",
     null)
   ],
   choices:[
    choice("fs05-road-focus","fs05-priority","Сперва уточнить безопасный подход","fs05-road"),
    choice("fs05-record-focus","fs05-priority","Сперва записать показания","fs05-record")
   ],
   objectives:[
    goal("fs05-ledger","inspect","Проверить опись свёртка",{evidenceIds:["fs05-witnesses"]}),
    goal("fs05-route","inspect","Уточнить источник сведений о дороге",{evidenceIds:["fs05-route"]}),
    goal("fs05-confession","view","Услышать признание Рена",{beatId:"fs05-admission"}),
    goal("fs05-priority","choose","Выбрать первый практический шаг",{decisionId:"fs05-priority"}),
    goal("fs05-rescue","view","Убедиться, что спасение завершено",{beatId:"fs05-rescue"}),
    goal("fs05-sava","inspect","Проверить запись о журнале",{evidenceIds:["fs05-sava-note"]}),
    goal("fs05-consent","compare","Сопоставить действия и согласие",{evidenceIds:["fs05-sava-note","fs05-liora-order"],comparisonId:"fs05-consent"})
   ]
  },
  {id:"fs06-fire-in-fifth-shadow",nodeId:"five-shadows:fs-06",entryBeatId:"fs06-plan",
   beats:[
    beat("fs06-plan",null,
     "Изнутри пятой прорези Сава различила дома Косой Полки и белый навес над рынком. Она предложила поставить обычную лампу на внутренний уступ и проверить, увидят ли её в городе. Это ещё не опыт с древними механизмами.",
     "fs06-sava"),
    beat("fs06-sava","Сава",
     "— Там ведь видно рынок. Если поставить огонь здесь и попросить поднять ткань напротив...\n\nПрежде чем назначать вечер, нужно проверить три условия.",
     "fs06-compare",[],{
      inspections:[
       inspect("fs06-lamp","Место для лампы",
        "Лампа стоит на ровном уступе внутри помещения, вне обломков древних креплений. Арт отвечает за безопасность людей рядом с ней."),
       inspect("fs06-cloth","Полотно над городским рынком",
        "Мара выделяет место для белой ткани. Ала проверяет крепления шестов и оставляет проход для тележек свободным."),
       inspect("fs06-weather","Погода и время",
        "Путь между берегами занимает три дня. Опытом договорились заняться на шестой вечер. При тумане его отменят, чтобы отсутствие видимого огня не стало ложным выводом.")
      ],requiredInspectionIds:["fs06-lamp","fs06-cloth","fs06-weather"]}),
    beat("fs06-compare",null,
     "Ткань и огонь находятся на противоположных берегах. Без договорённого места, времени и хорошей видимости результат нельзя толковать даже как проверку сигнала.",
     "fs06-focus",[],{
      comparisons:[compare("fs06-pair","Сопоставить точки и условия наблюдения",
       "Лампа в пятой прорези, полотно на городской площадке. Их разделяет многодневная дорога. Нужны согласованное время, свободный обзор и право отменить опыт при тумане.",
       ["fs06-lamp","fs06-cloth","fs06-weather"])],
      requiredComparisonIds:["fs06-pair"]}),
    beat("fs06-focus",null,
     "Сава и Лиора возвращаются в город. Рен, Нада и Арт остаются у Пяти теней. Чью сторону посмотреть первой в назначенный вечер?",
     null,["fs06-city-first","fs06-room-first"]),
    beat("fs06-city","Сава",
     "— Ала, край полотна опять на дороге. Подвиньте шест.\n\nТуман понемногу рассеивается; у рынка ждут, пока на дальнем камне будут видны все пять полос.",
     "fs06-light"),
    beat("fs06-room",null,
     "Арт стоит рядом с лампой внутри пятой прорези и следит за безопасным подходом. Он не знает, поднята ли городская ткань. С противоположной стороны сигналы нельзя прочесть по одному движению тени.",
     "fs06-light"),
    beat("fs06-light",null,
     "На дальнем берегу появляется огонёк. Он исчезает, затем ненадолго загорается снова. Сава держит ткань, Ала натягивает верёвку. Люди возле рынка спорят, что именно они увидели: ответ, случайное движение лампы или открывшуюся древнюю дверь.",
     "fs06-liora"),
    beat("fs06-liora","Лиора Вель",
     "— Это свет, а не разрешение лезть на стену.\n\nОна велит опустить полотно, прежде чем толпа решит искать кратчайшую дорогу к прорези.",
     "fs06-end"),
    beat("fs06-end",null,
     "Под свёрнутой тканью Мара замечает раздавленный плод и зовёт Саву помогать с уборкой. Пять теней снова темны. Сава не знает, почему огонь погас, — спросить людей на той стороне можно будет только после долгой дороги.",
     null)
   ],
   choices:[
    choice("fs06-city-first","fs06-perspective","Начать с наблюдателей в городе","fs06-city"),
    choice("fs06-room-first","fs06-perspective","Начать с людей у лампы","fs06-room")
   ],
   objectives:[
    goal("fs06-lamp","inspect","Проверить установку лампы",{evidenceIds:["fs06-lamp"]}),
    goal("fs06-cloth","inspect","Проверить размещение полотна",{evidenceIds:["fs06-cloth"]}),
    goal("fs06-weather","inspect","Учесть погоду и время",{evidenceIds:["fs06-weather"]}),
    goal("fs06-pair","compare","Сопоставить обе точки наблюдения",{evidenceIds:["fs06-lamp","fs06-cloth","fs06-weather"],comparisonId:"fs06-pair"}),
    goal("fs06-perspective","choose","Выбрать первую перспективу",{decisionId:"fs06-perspective"}),
    goal("fs06-light","view","Увидеть свет без готового объяснения",{beatId:"fs06-light"})
   ]
  }
 ];
 const graph=copy(Pilot.data.catalog()),pack=copy(Pilot.pack);
 const story=graph.stories.find(x=>x.id==="five-shadows");
 const previous=graph.nodes.find(n=>n.id==="five-shadows:fs-03");
 if(!story||!previous||previous.nextNodeIds.length||graph.nodes.length!==3||pack.scenes.length!==3)
  throw Error("LORE_ACT2_BASE_CHANGED");
 const layer="city-response",chapter="five-shadows-act-2";
 story.chapters.push(chapter);
 story.mapLayers.push({id:layer,title:"Город и отклик"});
 graph.chapters.push({id:chapter,storyId:story.id,title:"Акт II · Город и ответ",order:2,mapLayerId:layer});
 previous.nextNodeIds=["five-shadows:fs-04"];
 const metadata=[
  ["fs-04","Тот, кто вернулся","scene","part-2","fs-03","fs-05",.16,.68],
  ["fs-05","Верхняя дверь","investigation","part-3","fs-04","fs-06",.49,.43],
  ["fs-06","Огонь в пятой тени","investigation","part-4","fs-05",null,.79,.31]
 ];
 for(const [suffix,title,kind,source,prev,next,x,y] of metadata){
  const node=copy(graph.nodes[2]);
  node.id=story.id+":"+suffix;node.title=title;node.kind=kind;
  node.chapterId=chapter;node.mapLayerId=layer;node.marker={x,y};
  node.prerequisites=[story.id+":"+prev];node.nextNodeIds=next?[story.id+":"+next]:[];
  node.contentId=scenes.find(x=>x.nodeId===node.id)?.id||null;
  node.canonicalRef=source;node.canonClass="adaptation";
  graph.nodes.push(node);
 }
 pack.scenes.push(...scenes);
 if(!Data.catalogIsValid(graph)||!Scripts.valid(pack,graph))
  throw Error("LORE_ACT2_INVALID_GRAPH_OR_SCRIPT");
 const freeze=x=>{if(x&&typeof x==="object"&&!Object.isFrozen(x)){
  Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
 freeze(graph);freeze(pack);
 const data=Object.freeze({KINDS:Data.KINDS,catalog:()=>graph,
  getStory:(id,c=graph)=>Data.getStory(id,c),
  getNode:(id,c=graph)=>Data.getNode(id,c),
  nodesForStory:(id,c=graph)=>Data.nodesForStory(id,c),
  catalogIsValid:(c=graph)=>Data.catalogIsValid(c)});
 return Object.freeze({data,pack});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignAct2;
