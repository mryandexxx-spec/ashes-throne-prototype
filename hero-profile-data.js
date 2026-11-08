/* REN-001: display-only profile metadata (not combat progression or canon expansion).
 * Tag IDs are stable identifiers independent of approved classes; future
 * origin/faction/affiliation tags can coexist without changing hero class.
 * The biography contains only facts from the approved 'Five Shadows' material.
 */
const HeroProfileData=(()=>{
 "use strict";
 const TAGS=Object.freeze({
  "gardens-over-abyss":Object.freeze({id:"gardens-over-abyss",label:"Сады над пропастью",kind:"origin"})
 });
 const PROFILES=Object.freeze({
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
