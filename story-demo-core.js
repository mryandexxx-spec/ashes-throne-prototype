/* STORY-001: noncanonical, replayable script probe. No time placement or save keys. */
const StoryDemoCore=(()=>{
 "use strict";
 const beats=Object.freeze([
  Object.freeze({speaker:"Сады над пропастью",text:"Вдоль огромного ущелья тянется дорога среди домов и пустых скальных участков. У прохода остановлен обоз. Канат и люди с оружием перекрывают движение."}),
  Object.freeze({speaker:"Рен Терен",text:"«Вчера по обходу ещё можно было пройти. Сегодня с нижнего поворота камень сходит. Тележку туда не пускайте»."}),
  Object.freeze({speaker:"Старший охраны",text:"«Знак поставлен утром. Дальше нельзя. Для всех»."}),
  Object.freeze({speaker:"Нада",text:"«Написана дата составления распоряжения. Я спросила, когда вы его получили. И где лист, на который оно ссылается?»"}),
  Object.freeze({speaker:"Лиора Вель",text:"«Кто проверил обход? Мои люди туда не пойдут потому, что кто-то повесил табличку. Сначала — безопасность»."}),
  Object.freeze({speaker:"Связная",text:"«Вы всё-таки пришли. Им нужны мои дорожные записи. Я не отдам их под угрозой»."}),
  Object.freeze({speaker:"У перекрытого прохода",text:"Охранник хватает связную за сумку. Рен встаёт между ней и краем дороги. Лиора выводит людей за поворот. Нада остаётся со спорным распоряжением."})
 ]);
 function fresh(){return {phase:"intro",index:0,tone:null,evidence:null,won:null};}
 function view(s){
  if(!s)return null;
  if(s.phase==="intro")return {kind:"next",...beats[s.index]};
  if(s.phase==="tone")return {kind:"tone",speaker:"Командир",text:"Что скажем охране, прежде чем вмешаться?"};
  if(s.phase==="ready")return {kind:"fight",speaker:s.tone==="people"?"Рен Терен":"Нада",
   text:s.tone==="people"?
    "«Для начала посмотрите, куда они гонят людей». Охранники обнажают оружие. Спасатели уводят гражданских. Сражается только отряд организации.":
    "«Проверять бумаги можно потом. Сейчас они пытаются увезти женщину». Спасатели уводят гражданских. Сражается только отряд организации."};
  if(s.phase==="battle")return {kind:"battle",speaker:"Пробный бой",text:"Выбранные сотрудники организации участвуют в обычном пошаговом бою. Рен, Нада и Лиора ещё не входят в коллекцию."};
  if(s.phase==="defeat")return {kind:"defeat",speaker:"Попытка не удалась",text:"Охрана удержала проход. Это только сюжетная проба: наград и постоянных последствий нет. Можно повторить эпизод."};
  if(s.phase==="evidence")return {kind:"evidence",speaker:"Нада",text:"«Мы помогли людям, но распоряжение не проверено. Оригиналы записей принадлежат связной. Как передадим сведения дальше?»"};
  if(s.phase==="ending")return {kind:"ending",speaker:"Рен Терен",
   text:(s.evidence==="verify"?
    "Нада сверяет и удостоверяет копию; оригинал остаётся у связной. ":
    "Организация отправляет предупреждение с пометкой «не проверено»; оригинал остаётся у связной. ")+
    "«Провести ваших людей — возможно. Ходить за вас всегда — ещё не договорились». Связь восстановлена. Доверие — ещё нет."};
  return null;
 }
 function next(s){
  if(!s||s.phase!=="intro")return false;
  s.index++;
  if(s.index>=beats.length){s.phase="tone";s.index=beats.length-1;}
  return true;
 }
 function chooseTone(s,id){
  if(!s||s.phase!=="tone"||!["people","order"].includes(id))return false;
  s.tone=id;s.phase="ready";return true;
 }
 function startBattle(s){
  if(!s||s.phase!=="ready")return false;
  s.phase="battle";return true;
 }
 function cancelBattle(s){
  if(!s||s.phase!=="battle")return false;
  s.phase="ready";return true;
 }
 function finishBattle(s,won){
  if(!s||s.phase!=="battle"||typeof won!=="boolean")return false;
  s.won=won;s.phase=won?"evidence":"defeat";return true;
 }
 function chooseEvidence(s,id){
  if(!s||s.phase!=="evidence"||!["verify","warn"].includes(id))return false;
  s.evidence=id;s.phase="ending";return true;
 }
 return Object.freeze({fresh,view,next,chooseTone,startBattle,cancelBattle,finishBattle,chooseEvidence,beats});
})();
