/* FIRSTPLAY002: story-only presentation. Actual outcome belongs to FirstPlayCore / CombatCore. */
const FirstPlayStoryCore=(()=>{
 "use strict";
 const KEY="ashes-throne.first-play-story.v1";
 // Replace images by changing these four paths only; all text stays accessible DOM.
 // Canonical in-game portraits: identical assets to Five Shadows scene UI.
 // Do not repaint the heroes inside scene backgrounds.
 const CAST=Object.freeze({
  art:Object.freeze({name:"Арт",label:"АРТ",portrait:"assets/art-portrait-ui.webp?v=2"}),
  ren:Object.freeze({name:"Рен Терен",label:"РЕН ТЕРЕН",portrait:"assets/ren-portrait-ui.webp"}),
  master:Object.freeze({name:"Мастер участка",label:"МАСТЕР УЧАСТКА",portrait:null}),
  worker:Object.freeze({name:"Рабочий на переходе",label:"РАБОЧИЙ",portrait:null})
 });
 // Single coherent environment matte painting, no invented hero faces.
 // Asset paths can be replaced independently of the combat and dialogue.
 const ART=Object.freeze({
  warning:"assets/cutscenes/first-report/v3/bridge-approach.webp",
  conflict:"assets/cutscenes/first-report/v3/bridge-approach.webp",
  decision:"assets/cutscenes/first-report/v3/bridge-approach.webp",
  aftermath:"assets/cutscenes/first-report/v3/bridge-approach.webp"
 });
 const AVIF=Object.freeze({
  warning:"assets/cutscenes/first-report/v3/bridge-approach.avif",
  conflict:"assets/cutscenes/first-report/v3/bridge-approach.avif",
  decision:"assets/cutscenes/first-report/v3/bridge-approach.avif",
  aftermath:"assets/cutscenes/first-report/v3/bridge-approach.avif"
 });
 const INTRO=Object.freeze([
  {art:"warning",speakerId:"worker",speaker:"РАБОЧИЙ",text:"Не тяни! Держи за стойку!",detail:"На переходе срывается крепление. Двое ремонтников остаются над пропастью."},
  {art:"conflict",speakerId:"master",speaker:"МАСТЕР",text:"Брось груз! Людей сорвёшь!",detail:"Вооружённые сборщики продолжают выносить разобранные крепления."},
  {art:"warning",speakerId:"art",speaker:"АРТ",text:"Не на настил. С этого края крепление сняли.",detail:"Арт проверяет опору и останавливает Рена."},
  {art:"warning",speakerId:"ren",speaker:"РЕН",text:"Снизу пройти можно. Я видел ступени.",detail:"Рен ищет другой путь к рабочим."},
  {art:"decision",speakerId:"master",speaker:"МАСТЕР",text:"Мы вас на проверку звали. Теперь людей надо снимать.",detail:"Решение командира: как подготовить помощь?",choice:true}
 ]);
 const RESPONSE=Object.freeze({
  survey:{art:"decision",speakerId:"art",speaker:"АРТ",text:"Под нижним краем. Я посмотрел — пока держит.",detail:"Осмотр подходов: Арт действует быстрее в бою. +30 к скорости."},
  cover:{art:"decision",speakerId:"ren",speaker:"РЕН",text:"Хорошо. Только отпустишь по моему знаку.",detail:"Прикрытие отхода: Рен получает +35 защиты."}
 });
 const OUTRO=Object.freeze([
  {art:"aftermath",speakerId:"art",speaker:"АРТ",text:"Эту сторону закрываем. Ни сверху, ни снизу не пускать.",detail:"После победы рабочие возвращаются на безопасный участок."},
  {art:"aftermath",speakerId:"master",speaker:"МАСТЕР",text:"Я их сюда сам направил. По этому списку.",detail:"Переход одновременно помечен безопасным и переданным под разборку."}
 ]);
 const fresh=()=>({version:1,part:"intro",step:0});
 function isValid(c){return !!c&&c.version===1&&["intro","outro"].includes(c.part)&&
  Number.isInteger(c.step)&&c.step>=0&&c.step<=5;}
 function normalize(saved,phase){
  if(phase==="won")return saved?.part==="outro"&&isValid(saved)?
   {version:1,part:"outro",step:Math.min(saved.step,OUTRO.length-1)}:
   {version:1,part:"outro",step:0};
  if(phase==="ready")return {version:1,part:"intro",step:5};
  if(phase==="briefing")return saved?.part==="intro"&&isValid(saved)?
   {version:1,part:"intro",step:Math.min(saved.step,INTRO.length-1)}:fresh();
  return fresh();
 }
 function load(storageProvider,phase){
  try{
   const raw=storageProvider().getItem(KEY);
   const stored=raw===null?null:JSON.parse(raw);
   return normalize(isValid(stored)?stored:null,phase);
  }catch(_){return normalize(null,phase);}
 }
 function save(cursor,storageProvider){
  if(!isValid(cursor))return false;
  try{storageProvider().setItem(KEY,JSON.stringify(cursor));return true;}catch(_){return false;}
 }
 function frame(phase,choice,cursor){
  if(phase==="won")return OUTRO[Math.max(0,Math.min(OUTRO.length-1,cursor?.step||0))];
  if(phase==="ready")return RESPONSE[choice]||INTRO[INTRO.length-1];
  return INTRO[Math.max(0,Math.min(INTRO.length-1,cursor?.step||0))];
 }
 function advance(phase,cursor){
  if(phase==="won"&&cursor?.part==="outro"&&cursor.step<OUTRO.length-1)
   return {...cursor,step:cursor.step+1};
  if(phase==="briefing"&&cursor?.part==="intro"&&cursor.step<INTRO.length-1)
   return {...cursor,step:cursor.step+1};
  return null;
 }
 function skipNarration(phase,choice,cursor){
  if(phase==="briefing")return {action:"decision",cursor:{version:1,part:"intro",step:INTRO.length-1}};
  if(phase==="ready"&&choice)return {action:"battle"};
  if(phase==="won")return {action:"finish"};
  return {action:"none"};
 }
 return Object.freeze({KEY,CAST,ART,AVIF,INTRO,RESPONSE,OUTRO,fresh,isValid,normalize,load,save,frame,advance,skipNarration});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=FirstPlayStoryCore;
