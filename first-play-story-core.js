/* FIRSTPLAY002: story-only presentation. Actual outcome belongs to FirstPlayCore / CombatCore. */
const FirstPlayStoryCore=(()=>{
 "use strict";
 const KEY="ashes-throne.first-play-story.v1";
 // Canonical hero faces remain the exact Five Shadows UI portraits.
 // Civilians use close crops of the already-painted action frames: no new fake
 // portrait faces and no extra large image requests. These crops are replaceable.
 // Narrative figures inside a painted shot are anonymous unless stated otherwise.
 const CAST=Object.freeze({
  art:Object.freeze({name:"Арт",label:"АРТ",portrait:"assets/art-portrait-ui.webp?v=2"}),
  ren:Object.freeze({name:"Рен Терен",label:"РЕН ТЕРЕН",portrait:"assets/ren-portrait-ui.webp"}),
  master:Object.freeze({name:"Мастер участка",label:"МАСТЕР УЧАСТКА",portrait:"assets/cutscenes/first-report/v5/master-portrait.webp",portraitAvif:null,npc:true}),
  worker:Object.freeze({name:"Рабочий на переходе",label:"РАБОЧИЙ",portrait:"assets/cutscenes/first-report/v5/worker-portrait.webp",portraitAvif:null,npc:true})
 });
 // FIRSTPLAY007: character-led illustrated storyboard. Every new image is
 // replaceable independently; worldbuilding approval remains a separate gate.
 // Art/shot IDs are intentionally narrative, not universal UI component names.
 const ART=Object.freeze({
  warning:"assets/cutscenes/first-report/v5/warning.webp",
  conflict:"assets/cutscenes/first-report/v5/conflict.webp",
  artSupport:"assets/cutscenes/first-report/v5/art-support.webp",
  renRoute:"assets/cutscenes/first-report/v5/ren-route.webp",
  decision:"assets/cutscenes/first-report/v5/decision.webp",
  aftermath:"assets/cutscenes/first-report/v2/aftermath.webp"
 });
 const AVIF=Object.freeze({
  warning:null,conflict:null,artSupport:null,renRoute:null,decision:null,
  aftermath:"assets/cutscenes/first-report/v2/aftermath.avif"
 });
 const STORYBOARD=Object.freeze({
  warning:Object.freeze({focus:"workers",purpose:"Рабочие удерживают повреждённый переход"}),
  conflict:Object.freeze({focus:"master",purpose:"Мастер требует немедленно снять людей"}),
  artSupport:Object.freeze({focus:"art",purpose:"Арт показывает снятое крепление"}),
  renRoute:Object.freeze({focus:"ren",purpose:"Рен находит нижний путь"}),
  decision:Object.freeze({focus:"group",purpose:"Герои и рабочие присутствуют в точке выбора"})
 });
 // FIRSTPLAY008: action leads to an observation, a response and a new decision.
 // Local gameplay proposal; approved Five Shadows history is unchanged.
 const INTRO=Object.freeze([
  {art:"warning",shot:"workers",speakerId:"worker",speaker:"РАБОЧИЙ",cue:"Под настилом ревёт вода. Крайние доски трещат.",text:"Мастер! Край пошёл! Мы назад не пройдём!",detail:"Рабочие застряли на повреждённом пролёте."},
  {art:"conflict",shot:"workers",speakerId:"master",speaker:"МАСТЕР",text:"Я вас на осмотр звал. А тут уже разбирают крепления, пока мои люди на мосту.",detail:"Мастер вызвал помощь для осмотра, но демонтаж начался до вывода рабочих."},
  {art:"conflict",shot:"workers",speakerId:"worker",speaker:"РАБОЧИЙ",text:"Сборщик не остановился. У выхода его охранник — с оружием. Нас не выпускают.",detail:"Охранник склада перекрывает отход, пока сборщик снимает железо."},
  {art:"artSupport",shot:"supports",speakerId:"art",speaker:"АРТ",cue:"Арт поднимает вынутый штифт. В опоре пустое гнездо.",text:"На этот край не ступайте. Балка теперь на канате держится. Ещё рывок — сорвётся.",detail:"Снятый штифт подтверждает причину повреждения. Настил небезопасен."},
  {art:"renRoute",shot:"route",speakerId:"ren",speaker:"РЕН",cue:"Ниже пролёта видна узкая лестница.",text:"Под мостом ступени есть. До рабочих доберёмся снизу. Только у схода тот охранник.",detail:"Рен показывает обход. Проход к лестнице удерживают противники."},
  {art:"artSupport",shot:"supports",speakerId:"art",speaker:"АРТ",text:"Прежде чем вести туда людей, проверю нижнее крепление. Если и его сняли — назад.",detail:"Арт предлагает разведать нижнюю опору прежде, чем рисковать людьми."},
  {art:"renRoute",shot:"route",speakerId:"ren",speaker:"РЕН",text:"Пока мы проверяем, люди останутся там. Я могу отвлечь охранника и прикрыть спуск.",detail:"Рен предлагает удерживать проход, пока рабочие отходят."},
  {art:"decision",shot:"wide",speakerId:"master",speaker:"МАСТЕР",cue:"Рабочие ждут у стойки. Канат снова натягивается.",text:"Я удержу их на месте. Складские сами не уйдут. С чего начинаем?",detail:"Приказ определит подготовку отряда к столкновению у нижнего схода.",choice:true}
 ]);
 const RESPONSE=Object.freeze({
  survey:{art:"artSupport",shot:"supports",speakerId:"art",speaker:"АРТ",
   text:"Нижнюю лестницу проверил. Ступени держат. Проведу быстро, но охранник ещё у выхода.",
   detail:"Приказ выполнен: Арт получает +30 к скорости на предстоящий бой.",effect:"survey"},
  cover:{art:"renRoute",shot:"route",speakerId:"ren",speaker:"РЕН",
   text:"Встану у лестницы. Пока я держу проход, пусть выводят людей по одному. Не толпой.",
   detail:"Приказ выполнен: Рен получает +35 очков к запасу защиты (Protection) на предстоящий бой.",effect:"cover"}
 });
 const OUTRO=Object.freeze([
  {art:"aftermath",shot:"supports",speakerId:"art",speaker:"АРТ",
   text:"Рабочие на берегу. К переходу никого не подпускайте, пока не вернут крепления.",
   detail:"После реального исхода боя рабочих вывели на безопасный участок."},
  {art:"aftermath",shot:"wide",speakerId:"master",speaker:"МАСТЕР",
   cue:"Мастер расправляет помятый лист с отметками.",
   text:"Я их сам туда послал. Вот по этому листу. Здесь: «переход безопасен». А ниже — «снять крепления». Кто это подписал?",
   detail:"В одном документе пролёт отмечен безопасным и переданным под разборку."}
 ]);
 const OUTRO_BRANCH=Object.freeze({
  survey:Object.freeze({art:"aftermath",shot:"supports",speakerId:"art",speaker:"АРТ",
   text:"Все вышли по нижним ступеням. Теперь лестницу закрыть до ремонта.",
   detail:"Подход, который проверил Арт, помог вывести рабочих после столкновения."}),
  cover:Object.freeze({art:"aftermath",shot:"route",speakerId:"ren",speaker:"РЕН",
   text:"Все прошли. Я их от лестницы оттеснил. Никого больше туда не пускайте.",
   detail:"Пока Рен удерживал проход, рабочие успели отойти."})
 });
 const ORDER_LABELS=Object.freeze({survey:"Арт · скорость +30",cover:"Рен · запас защиты +35"});
 const fresh=()=>({version:1,part:"intro",step:0});
 function isValid(c){return !!c&&c.version===1&&["intro","outro"].includes(c.part)&&
  Number.isInteger(c.step)&&c.step>=0&&
  (c.part==="intro"?c.step<=INTRO.length:c.step<OUTRO.length);}
 function normalize(saved,phase){
  if(phase==="won")return saved?.part==="outro"&&isValid(saved)?
   {version:1,part:"outro",step:Math.min(saved.step,OUTRO.length-1)}:
   {version:1,part:"outro",step:0};
  if(phase==="ready")return {version:1,part:"intro",step:INTRO.length};
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
  if(phase==="won"){
   const step=Math.max(0,Math.min(OUTRO.length-1,cursor?.step||0));
   return step===0?(OUTRO_BRANCH[choice]||OUTRO[0]):OUTRO[step];
  }
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
 return Object.freeze({KEY,CAST,ART,AVIF,STORYBOARD,INTRO,RESPONSE,OUTRO,ORDER_LABELS,fresh,isValid,normalize,load,save,frame,advance,skipNarration});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=FirstPlayStoryCore;
