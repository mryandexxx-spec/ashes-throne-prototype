/* C4/TREE: isolated playable profile, real progression and native combat.
 * One durable snapshot, no production wallet or trust rank switch. */
const TrustTree=(()=>{
 "use strict";
 const KEY="ashes-throne.lab.trust-tree.v1",HEROES=["ren","art","nada","liora","sava"].map(id=>({id,side:"ally"}));
 const GATES=Object.freeze({2:[3,1,1,2],3:[25,3,4,3],4:[55,5,8,5],5:[75,6,11,6]});
 const TREE=Object.freeze([
 {id:"guardian-2",branch:"guardian",rank:2,name:"Перехват",desc:"Принять следующую прямую атаку вместо выбранного союзника.",ability:"art-intercept",trial:"escort"},
 {id:"command-2",branch:"command",rank:2,name:"Переброска резерва",desc:"Передать собственную Protection союзнику до заполнения его запаса. Не создаёт защиту.",ability:"art-reserve",trial:"priority"},
 {id:"guardian-3",branch:"guardian",rank:3,name:"Взаимная страховка",desc:"Взаимная защита с другим бойцом; требует отдельной механики.",parent:"guardian-2"},
 {id:"command-3",branch:"command",rank:3,name:"Смена рубежа",desc:"Передача ответственности за удерживаемую позицию.",parent:"command-2"},
 {id:"guardian-4",branch:"guardian",rank:4,name:"Командир прикрытия",desc:"Операции удержания и спасения.",parent:"guardian-3"},
 {id:"command-4",branch:"command",rank:4,name:"Начальник резерва",desc:"Запасные маршруты и подмена групп.",parent:"command-3"},
 {id:"guardian-5",branch:"guardian",rank:5,name:"Последний рубеж",desc:"Спасти союзника ценой собственного здоровья.",parent:"guardian-4"},
 {id:"command-5",branch:"command",rank:5,name:"План эвакуации",desc:"Особый многоэтапный операционный исход.",parent:"command-4"}
 ].map(Object.freeze));
 const MISSIONS=Object.freeze({
  training:{name:"Учебный дозор",description:"Победите дозорного. Первая победа даёт 240 кромов на развитие Арта.",enemies:["npc-trail-interceptor"],reward:240},
  escort:{name:"Личное обязательство",description:"Сохраните Рена и Арта. Арт должен прикрыть Рена обычной особой способностью, а Рен — выдержать последующую атаку. Новая способность ещё недоступна.",enemies:["npc-ridge-slinger","npc-trail-interceptor"],objective:{kind:"protect-and-defeat",protectAllyId:"ren"},node:"guardian-2"},
  priority:{name:"Приказ на перехват",description:"Сначала обезвредьте связного. Арт должен лично нанести ему урон; оба героя должны выжить.",enemies:["npc-route-signaller","npc-pass-guard"],objective:{kind:"priority-first",priorityEnemyId:"e0"},node:"command-2"},
  practice:{name:"Полевое применение",description:"Используйте выбранную уже освоенную личную способность. Победа не выдаёт повторных наград.",enemies:["npc-trail-interceptor","npc-ridge-slinger"]}
 });
 const clone=x=>JSON.parse(JSON.stringify(x)),node=id=>TREE.find(n=>n.id===id);
 const runtime=s=>ProgressV3Core.toRuntime(s.profile,HEROES);
 function requirements(s,n){
  const p=runtime(s),g=GATES[n.rank];
  const values=[ProgressCore.levelOf(p,"art"),StarCore.rankOf(p,"art"),ProgressCore.gearState(p,"art").tier,SkillCore.level(p,"art","special")];
  return [{label:"Уровень",value:values[0],need:g[0]},{label:"Звёзды",value:values[1],need:g[1]},{label:"Экипировка G",value:values[2],need:g[2]},{label:"Особый навык",value:values[3],need:g[3]}].map(r=>({...r,ok:r.value>=r.need}));
 }
 function valid(s){
  if(!s||s.version!==1||!Number.isSafeInteger(s.revision)||s.revision<0||!Array.isArray(s.earned)||new Set(s.earned).size!==s.earned.length||
     s.earned.some(id=>!node(id)?.trial)||typeof s.trained!=="boolean"||s.selected!==null&&!s.earned.includes(s.selected)||
     !ProgressV3Core.validateActive(s.profile,HEROES))return false;
  if(s.earned.length&&(!s.trained||s.earned.some(id=>!requirements(s,node(id)).every(r=>r.ok))))return false;
  return s.earned.length===0?s.selected===null:s.selected!==null;
 }
 function fresh(){return {version:1,revision:0,profile:ProgressV3Core.fresh(HEROES,0),trained:false,earned:[],selected:null}}
 function create(storage,combat,abilities,npcs){
  let raw=null,state=null,blocked="",battle=null,mission=null,last=null,events=[],proof={cover:false,hit:false,command:false},pending=null;
  try{raw=storage.getItem(KEY);state=raw===null?fresh():JSON.parse(raw);if(!valid(state))throw Error("invalid profile");}catch(e){blocked="Сохранение недоступно или повреждено. Данные не перезаписаны.";state=fresh()}
  function commit(candidate){
   candidate.revision=state.revision+1;
   if(!valid(candidate))return false;
   try{if(storage.getItem(KEY)!==raw){blocked="Профиль изменён в другой вкладке. Перезагрузите страницу.";return false}
    const next=JSON.stringify(candidate);storage.setItem(KEY,next);raw=next;state=candidate;blocked="";return true;
   }catch(e){blocked="Не удалось сохранить. Прогресс не начислен. Повторите запись.";return false}
  }
  function change(fn){
   if(battle?.active||pending||blocked)return false;
   const next=clone(state),p=runtime(next);if(!fn(p,next))return false;
   next.profile=ProgressV3Core.fromRuntime(p);return commit(next)
  }
  function upgrade(id){return change(p=>id==="level"&&ProgressCore.levelOf(p,"art")<3?!!ProgressCore.upgradeMany(p,"art",1):id==="special"&&SkillCore.level(p,"art","special")<2?!!SkillCore.upgrade(p,"art","special"):false)}
  function equip(id){return change((p,s)=>s.earned.includes(id)&&(s.selected=id,true))}
  function entry(id){
   const m=MISSIONS[id];if(!m)return {ok:false,reason:"Неизвестное испытание"};
   if(blocked||pending)return {ok:false,reason:blocked||"Сначала сохраните результат"};
   if(m.node){const n=node(m.node),missing=requirements(state,n).filter(r=>!r.ok);
    if(!state.trained)return {ok:false,reason:"Пройдите учебный дозор"};
    if(missing.length)return {ok:false,reason:missing.map(r=>r.label+" "+r.value+"/"+r.need).join(" · ")};
    if(state.earned.includes(n.id))return {ok:false,reason:"Испытание пройдено"};
   }
   if(id==="practice"&&!state.selected)return {ok:false,reason:"Освойте хотя бы один узел"};
   return {ok:true,reason:""};
  }
  function fighter(p,id){const gear=ProgressCore.gearBonuses(p,id);return HeroStatsCombatBridge.apply({id,name:id==="art"?"Арт":"Рен",side:"ally",skillLevels:Object.fromEntries(["basic","special","powerful","passive"].map(k=>[k,SkillCore.level(p,id,k)]))},{level:ProgressCore.levelOf(p,id),stars:StarCore.rankOf(p,id),gearPercent:{hp:gear.hp,atk:gear.atk},gearStats:gear.stats??{}},HeroStatsProfiles[id],HeroStatsCore)}
  function start(id){
   if(battle?.active||!entry(id).ok)return false;
   const m=MISSIONS[id],p=runtime(state),selected=state.selected&&node(state.selected);
   const ids=id==="practice"&&selected?[selected.ability]:[];
   // Qualification uses the original kit only. No ability before its proof.
   battle=combat.createBattle([fighter(p,"ren"),fighter(p,"art"),...m.enemies.map((x,i)=>npcs.spawn(x,{instanceId:"e"+i,level:1,skillLevel:1}))],[],{combat2:true,...(ids.length?{trustPersonal:ids}:{}),...(m.objective?{tacticalObjective:m.objective}:{})});
   mission=id;last=null;proof={cover:false,hit:false,command:false};events=[];combat.advanceToPlayerTurn(battle);collect();return true;
  }
  function collect(){
   events=battle.events.slice(-50).map(e=>({...e}));
   for(const e of battle.events){
    if(e.type==="effect"&&e.actorId==="art"&&e.targetId==="ren"&&e.effect==="guard")proof.cover=true;
    if(proof.cover&&e.type==="damage"&&e.targetId==="ren"&&e.amount>0)proof.hit=true;
    if(e.type==="damage"&&e.actorId==="art"&&e.targetId==="e0"&&e.amount>0)proof.command=true;
   }
   if(battle.active)return;
   const m=MISSIONS[mission],win=battle.winner==="ally",both=battle.fighters.filter(f=>f.side==="ally").every(f=>f.hp>0);
   const eligible=win&&both&&(mission==="escort"?proof.cover&&proof.hit:mission==="priority"?proof.command:true);
   last={winner:battle.winner,actions:battle.allyActions,eligible,earned:null,reward:0,saved:true};
   if(!eligible)return;
   const next=clone(state),p=runtime(next);
   if(mission==="training"&&!state.trained){next.trained=true;p.currency+=m.reward;last.reward=m.reward;}
   else if(m.node&&!state.earned.includes(m.node)&&entry(mission).ok){next.earned.push(m.node);next.selected=m.node;last.earned=m.node;}
   else return;
   next.profile=ProgressV3Core.fromRuntime(p);
   if(!commit(next)){pending=next;last.saved=false;}
  }
  function retry(){if(!pending)return false;if(!commit(pending))return false;pending=null;last.saved=true;return true}
  function abandon(){if(!battle?.active)return false;battle.active=false;last={winner:null,eligible:false,saved:true,actions:battle.allyActions,earned:null,reward:0};return true}
  function legal(id,i){if(!battle?.active)return false;const actor=battle.fighters[battle.currentActor],target=battle.fighters[i];if(!target||target.hp<=0)return false;
   if(id.startsWith("art-"))return !!combat.personalPreview(battle,id,i);
   if(!["basic","special","powerful"].includes(id)||!combat.abilityReady(battle,id))return false;
   const mode=abilities.get(actor,id)?.target;return mode==="ally"?target.side==="ally"&&target.id!==actor.id:mode==="enemy"?target.side==="enemy":false;
  }
  function action(id,target){const i=battle?.fighters.findIndex(f=>f.id===target)??-1;if(!legal(id,i))return false;if(!combat.performActorAbility(battle,id,i))return false;collect();return true}
  function view(){
   const p=runtime(state),actor=battle?.active?battle.fighters[battle.currentActor]:null;
   const fighters=(battle?.fighters??[]).map(f=>({id:f.id,name:f.name,archetypeId:f.archetypeId,side:f.side,hp:f.hp,maxHp:f.maxHp,protection:f.protection,maxProtection:f.maxProtection,guard:f.guardHits,meter:f.meter,prepared:f.combat2Prepared??null}));
   const actions=actor?["basic","special","powerful",...(battle.trustPersonal??[]).filter(id=>actor.id==="art")].map(id=>({id,name:id==="art-intercept"?"Перехват":id==="art-reserve"?"Переброска резерва":abilities.get(actor,id)?.name,targets:fighters.filter((f,i)=>legal(id,i)).map(f=>f.id),cooldown:id.startsWith("art-")?battle.trustPersonalCooldown[id]:id==="special"?actor.specialCooldown:id==="powerful"?actor.powerfulCooldown:0})):[];
   return {active:!!battle?.active,mission,last:last&&{...last},events:events.map(e=>({...e})),fighters,actions,actor:actor?.id??null,turns:battle?.allyActions??0,wave:battle?.wave??1,totalWaves:battle?.totalWaves??1,intercept:battle?.trustIntercept?{...battle.trustIntercept}:null,proof:{...proof},blocked,pending:!!pending,rank:state.earned.length?2:1,trained:state.trained,selected:state.selected,earned:state.earned.slice(),currency:p.currency,level:ProgressCore.levelOf(p,"art"),stars:StarCore.rankOf(p,"art"),gear:ProgressCore.gearState(p,"art").tier,skill:SkillCore.level(p,"art","special"),levelCost:ProgressCore.upgradeCost(p,"art"),skillCost:SkillCore.cost(p,"art","special")?.currency??null,canLevel:!blocked&&!pending&&ProgressCore.canUpgrade(p,"art")&&ProgressCore.levelOf(p,"art")<3,canSkill:!blocked&&!pending&&SkillCore.level(p,"art","special")<2&&!SkillCore.blocked(p,"art","special"),nodes:TREE.map(n=>({...n,requirements:requirements(state,n),earned:state.earned.includes(n.id),available:!!n.trial&&entry(n.trial).ok,reason:n.trial?entry(n.trial).reason:"Следующий этап разработки"}))};
  }
  return Object.freeze({view,start,action,abandon,upgrade,equip,retry,entry});
 }
 return Object.freeze({KEY,TREE,MISSIONS,create});
})();
