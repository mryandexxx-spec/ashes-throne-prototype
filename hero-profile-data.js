/* REN-001: display-only profile metadata (not combat progression or canon expansion).
 * Tag IDs are stable identifiers independent of approved classes; future
 * origin/faction/affiliation tags can coexist without changing hero class.
 * The biography contains only facts from the approved 'Five Shadows' material.
 */
const HeroProfileData=(()=>{
 "use strict";
 const TAGS=Object.freeze({
  "gardens-over-abyss":Object.freeze({id:"gardens-over-abyss",label:"Сады над пропастью",kind:"region"})
 });
 const PROFILES=Object.freeze({
  "ren":Object.freeze({
   id:"ren",name:"Рен Терен",tags:Object.freeze(["gardens-over-abyss"]),
   biography:[
    "Рен Терен вырос на Косой Полке в Садах над пропастью. Он опытный проводник верхних маршрутов: читает опасные участки дороги, замечает свежие осыпи и не ведёт спутников на ненужный риск ради короткого пути.",
    "Его знания и семейный опыт не всегда получают признание официальной спасательной школы семьи Вель. Рен болезненно воспринимает это пренебрежение и старается восстановить память об Эле Терен, связанной со старой экспедицией.",
    "В сложной дороге он практичен и способен на настоящую заботу, но бывает нетерпеливым и обидчивым. В истории «Пять теней» он сотрудничает с исследовательницей Надой: её внимательность к документам дополняет его знание местности, хотя они не всегда согласны друг с другом."
   ].join("\n\n"),
   note:"Биография основана на утверждённой литературе. Боевой баланс и место персонажа в игровой хронологии ещё не утверждены."
  }),
  // LIORAPLAY001: do not invent an unapproved biography or affiliation.
  "liora":Object.freeze({
   id:"liora",name:"Лиора Вель",tags:Object.freeze([]),
   biography:"Биография Лиоры Вель для игровой карточки ещё не утверждена. Игровые параметры и боевые действия демонстрационные.",
   note:"3D-модель с щитом, закреплённым на левом предплечье (LIORA-SHIELD-006). Класс, стартовое получение и способности — временный игровой пилот, не канон."
  }),
  // NADA-PLAYABLE-001: literature-grounded bio; gameplay role is an explicit pilot.
  // The recruitment timeline and class remain game proposals, not world canon.
  "nada":Object.freeze({
   id:"nada",name:"Нада",tags:Object.freeze(["gardens-over-abyss"]),
   biography:[
    "Нада исследует старые документы и свидетельства. Она тщательно различает подлинники и копии, сверяет даты и почерки, требует указывать источник выводов и не готова отдавать важные находки без фиксации их происхождения.",
    "Однажды её работу недооценили и не оплатили полностью. Поэтому она особенно настойчива, когда речь заходит о праве исследователя на собственные результаты и ответственности за сохранность свидетельств.",
    "В истории «Пять теней» Нада путешествует по опасным маршрутам вместе с проводником Реном. Они спорят о способах проверки и принимаемых рисках, но признают сильные стороны друг друга."
   ].join("\n\n"),
   note:"Визуальный образ утверждён. Игровые способности, поддержка и стартовое получение — тестовый игровой пилот, а не литературный канон."
  }),
  "trial-ren":Object.freeze({
   id:"trial-ren",name:"Рен Терен",tags:Object.freeze(["gardens-over-abyss"]),
   biography:[
    "Рен Терен вырос на Косой Полке в Садах над пропастью. Он опытный проводник верхних маршрутов: читает опасные участки дороги, замечает свежие осыпи и не ведёт спутников на ненужный риск ради короткого пути.",
    "Его знания и семейный опыт не всегда получают признание официальной спасательной школы семьи Вель. Рен болезненно воспринимает это пренебрежение и старается восстановить память об Эле Терен, связанной со старой экспедицией.",
    "В сложной дороге он практичен и способен на настоящую заботу, но бывает нетерпеливым и обидчивым. В истории «Пять теней» он сотрудничает с исследовательницей Надой: её внимательность к документам дополняет его знание местности, хотя они не всегда согласны друг с другом."
   ].join("\n\n"),
   note:"Основано на утверждённой литературе. Боевые навыки, служба в организации и хронология RPG не утверждены."
  })
 });
 function get(id){return typeof id==="string"&&Object.prototype.hasOwnProperty.call(PROFILES,id)?PROFILES[id]:null;}
 function tag(id){return typeof id==="string"&&Object.prototype.hasOwnProperty.call(TAGS,id)?TAGS[id]:null;}
 function tagLabels(ids){return Array.isArray(ids)?ids.map(id=>tag(id)?.label).filter(Boolean):[];}
 function hasTag(hero,id){return !!tag(id)&&Array.isArray(hero?.tags)&&hero.tags.includes(id);}
 return Object.freeze({TAGS,get,tag,tagLabels,hasTag});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=HeroProfileData;
