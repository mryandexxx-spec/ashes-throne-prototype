/* LORETRIALS001 — [ПРЕДЛОЖЕНИЕ] six distinct game-only encounters.
   Script text and original FS-05 tactical battle remain unchanged.
   No canonical conflict, currencies, energy use or global enemy modifications. */
const LoreCampaignTrials=(()=>{
 "use strict";
 const Act2=typeof LoreCampaignAct2!=="undefined"?LoreCampaignAct2:require("./lore-campaign-act2.js");
 const Data=typeof LoreCampaignData!=="undefined"?LoreCampaignData:require("./lore-campaign-data.js");
 const Scripts=typeof LoreCampaignScenes!=="undefined"?LoreCampaignScenes:require("./lore-campaign-scenes.js");
 const clone=x=>JSON.parse(JSON.stringify(x));
 const freeze=x=>{if(x&&typeof x==="object"&&!Object.isFrozen(x)){
   Object.values(x).forEach(freeze);Object.freeze(x);
  }return x;};
 const graph=clone(Act2.data.catalog()),pack=Act2.pack;
 const node=id=>graph.nodes.find(n=>n.id==="five-shadows:"+id);
 const set=(id,battleId,narrative,objective)=>{
  const n=node(id);
  if(!n||(!n.requiredBattleId&&id==="fs-05"))throw Error("LORE_TRIALS_BASE_CHANGED");
  if(battleId)n.requiredBattleId=battleId;
  if(narrative)n.requiredBattleNarrative=narrative;
  if(objective)n.requiredBattleObjective=objective;
 };
 const writing=(title,intro,victory,defeat)=>({title,intro,victory,defeat,lines:[]});
 // The protecting ally must stay alive until every enemy is defeated.
 set("fs-02",null,null,{kind:"protect-and-defeat",protectAllyId:"nada"});
 // FS-03 and FS-04 are explicitly abstract game challenges, not events in prose.
 set("fs-03","fs03-two-records",writing(
  "Два свидетельства",
  "Условное игровое испытание после сравнения списка в журнале и отдельного листа: отбейте две последовательные волны противников. Рен в сюжете уже ушёл в город; его участие в отряде здесь — игровая условность, а не новое событие рассказа.",
  "Обе волны побеждены. Нада продолжает проверку документов; никаких новых исторических фактов бой не доказывает.",
  "Одна из волн устояла. Перепройдите бой, не меняя собранных свидетельств."
 ),null);
 set("fs-04","fs04-stop-instigator",writing(
  "Остановить зачинщика",
  "Условное тактическое испытание о быстром распространении слухов. Отмеченного «Зачинщика» необходимо вывести из строя первым, до любого другого врага. Это абстрактный игровой бой: у ворот в литературной истории такого столкновения нет.",
  "Зачинщик остановлен первым, отряд справился с остальными. Сава продолжит проверять свидетельства, Лиора — искать пропавших.",
  "Порядок действий оказался неверным либо отряд проиграл. Можно повторить испытание без изменения слов Рена и Савы."
 ),{kind:"priority-first",priorityEnemyId:"shade"});
 // FS-05 preserves the previously accepted two-route escort and its hunter.
 if(node("fs-05")?.requiredBattleId!=="fs05-cover-evacuation"||
    node("fs-05")?.requiredBattleObjective?.allyActionsToHold!==12)
  throw Error("LORE_TRIALS_FS05_CHANGED");
 // FS-06 is terminal today, but the battle is still necessary to clear it.
 set("fs-06","fs06-keep-the-light",writing(
  "Удержать сигнал",
  "Игровая адаптация: защищайте Наду от противников, мешающих наблюдению, пока идут 8 действий союзников, либо одолейте всех раньше. Это условный бой, не нападение из литературной части 4. Видимость огня не раскрывает назначения древнего места.",
  "Наблюдение завершено, сигнал замечен. Истинный смысл света по-прежнему неизвестен.",
  "Наду вывели из строя либо отряд проиграл. Можно начать бой заново; исследование и выбранная перспектива сохраняются."
 ),{kind:"hold-or-defeat",protectAllyId:"nada",allyActionsToHold:8});
 const encounters={
  "five-shadows:fs-01":{
   briefTitle:"Чужой маршрут",brief:"Пробейте путь через двух противников. Рен и Нада обязательны; автобой доступен.",
   goalTitle:"ОСВОБОДИ ПОДХОД",goalText:"Победите двух противников, чтобы открыть следующий эпизод.",
   enemies:[{id:"ves",name:"Искатель дороги",hp:90,atk:18},
            {id:"shade",name:"Перехватчик",hp:78,atk:22}],waves:[]
  },
  "five-shadows:fs-02":{
   briefTitle:"Право на свидетельство",brief:"Нада должна выжить до победы над всеми тремя противниками. Победа с потерей Нады не засчитывается. Автобой доступен.",
   goalTitle:"СОХРАНИ НАДУ",goalText:"Защитите Наду и победите всех троих. Её падение — немедленное поражение.",
   enemies:[{id:"ves",name:"Удерживающий тропу",hp:85,atk:17},
            {id:"shade",name:"Преследователь свёртка",hp:90,atk:20,assaultFocus:true},
            {id:"ves-2",name:"Перехватчик",hp:80,atk:16}],waves:[]
  },
  "five-shadows:fs-03":{
   briefTitle:"Два свидетельства",brief:"Две последовательные волны. Между ними здоровье отряда не восстанавливается; выберите приоритетные цели. Автобой доступен.",
   goalTitle:"ПРОЙДИ ДВЕ ВОЛНЫ",goalText:"Победите две группы противников, сохраняя живых бойцов между волнами.",
   enemies:[{id:"ves",name:"Первая проверка",hp:75,atk:16},
            {id:"shade",name:"Первый заслон",hp:72,atk:19}],
   waves:[[{id:"ves-2",name:"Вторая проверка",hp:85,atk:18},
           {id:"shade-2",name:"Второй заслон",hp:78,atk:21}]]
  },
  "five-shadows:fs-04":{
   requiredHeroIds:["sava"], // Sava is present in the city as a witness and recorder.
   briefTitle:"Остановить зачинщика",brief:"Сава обязательна как участница городской проверки. Отмеченный «Зачинщик» должен выбыть первым, прежде остальных врагов. Одновременное поражение с другими целями не считается. Автобой доступен.",
   goalTitle:"СНАЧАЛА — ЗАЧИНЩИК",goalText:"Победите Зачинщика первым. Только после него — остальных.",
   enemies:[{id:"ves",name:"Заграждающий",hp:95,atk:16},
            {id:"shade",name:"Зачинщик",hp:115,atk:19},
            {id:"ves-2",name:"Прикрывающий",hp:85,atk:16}],waves:[]
  },
  "five-shadows:fs-05":{
   briefTitle:"Прикрыть отход",brief:"Сохрани Рена: его падение — поражение. Победи врагов или проведи 12 действий союзников. Преследователь целится в Рена — останови его. Рекомендуется отряд из 4–5 бойцов: вдвоём удержать отход очень трудно. Автобой доступен.",
   goalTitle:"ЗАЩИТИ РЕНА",goalText:"Победи врагов или дождись эвакуации. Преследователь атакует Рена!",
   enemies:null,waves:[]
  },
  "five-shadows:fs-06":{
   requiredHeroIds:["art"], // Art remains on site to supervise the lamp and safety.
   briefTitle:"Удержать сигнал",brief:"Арт обязателен: он отвечает за безопасный подход к лампе. Сохраните Наду. Победите врагов или проведите 8 действий союзников; один из противников охотится за Надой. Автобой доступен.",
   goalTitle:"ЗАЩИТИ НАДУ",goalText:"Держите оборону 8 действий или победите врагов. Нада должна выжить.",
   enemies:[{id:"ves",name:"Наблюдатель",hp:95,atk:17},
            {id:"shade",name:"Гаситель сигнала",hp:145,atk:28,assaultFocus:true},
            {id:"ves-2",name:"Помеха",hp:100,atk:16}],waves:[]
  }
 };
 if(graph.nodes.length!==6||
    graph.nodes.some(n=>!n.requiredBattleId||!encounters[n.id])||
    !Data.catalogIsValid(graph)||!Scripts.valid(pack,graph))
  throw Error("LORE_TRIALS_INVALID_GRAPH_OR_SCRIPT");
 freeze(graph);freeze(encounters);
 const data=Object.freeze({
  KINDS:Data.KINDS,catalog:()=>graph,
  getStory:(id,c=graph)=>Data.getStory(id,c),
  getNode:(id,c=graph)=>Data.getNode(id,c),
  nodesForStory:(id,c=graph)=>Data.nodesForStory(id,c),
  catalogIsValid:(c=graph)=>Data.catalogIsValid(c)
 });
 return Object.freeze({data,pack,encounter:id=>encounters[id]||null});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LoreCampaignTrials;
