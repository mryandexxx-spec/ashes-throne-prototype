/* C4/TREE: isolated playable profile, real progression and native combat.
 * One durable snapshot, no production wallet or trust rank switch. */
const TreeR1=(()=>{
 "use strict";
 const KEY="ashes-throne.lab.tree-r1.v1",HEROES=["ren","art","nada","liora","sava"].map(id=>({id,side:"ally"}));
 const GATES=Object.freeze({2:[3,1,1,2],3:[25,3,4,3],4:[55,5,8,5],5:[75,6,11,6]});
 const TREE=Object.freeze([
 {id:"guardian-2",branch:"guardian",rank:2,name:"Перехват",desc:"Одна одиночная атака по союзнику направляется в Арта. Арт получает прикрытие ×1.",ability:"art-intercept"},
 {id:"command-2",branch:"command",rank:2,name:"Переброска резерва",desc:"Перенести существующую защиту Арта союзнику и дать прикрытие ×1. Без создания Protection.",ability:"art-reserve"}
 ].map(Object.freeze));
 const MISSIONS=Object.freeze({
 campaign:{name:"Кампания · Внешний дозор",description:"Открыть маршрут группы. Первая победа даёт действующую награду кампании.",enemies:["npc-trail-interceptor"],rewardId:"black-pass-ambush"},
 campaign2:{name:"Кампания · Дорога к переправе",description:"Пройти второй участок и получить ресурсы на развитие других героев.",enemies:["npc-pass-guard","npc-route-signaller"],rewardId:"demo-mission-2"},
 escort:{name:"Личная арка · Прямой путь",description:"Идти напрямую: устранить дозор, сохранить Рена и Арта. Договорённость — Арт прикрывает отход Рена, а не сражается за двоих.",enemies:["npc-ridge-slinger","npc-trail-interceptor"],objective:{kind:"protect-and-defeat",protectAllyId:"ren"},arc:true},
 detour:{name:"Личная арка · Безопасный обход",description:"Выбрать обход: выиграть шесть действий для отхода либо победить, не теряя ни одного героя. Прикрытие Арта должно уменьшить урон.",enemies:["npc-trail-interceptor","npc-ridge-slinger"],objective:{kind:"hold-or-defeat",protectAllyId:"ren",allyActionsToHold:6},arc:true},
 operation1:{name:"Операция · Сопровождение",description:"Сохранить Рена против угрозы одиночного удара.",enemies:["npc-watch-captain","npc-ridge-slinger","npc-trail-interceptor"],objective:{kind:"protect-and-defeat",protectAllyId:"ren"},operation:true,level:4,seed:11},
 operation2:{name:"Операция · Две волны",description:"Сохранить силы отряда до второй волны.",enemies:["npc-trail-interceptor","npc-route-signaller"],waves:[["npc-ridge-slinger","npc-pass-guard"]],operation:true,level:4,seed:29},
 operation3:{name:"Операция · Вражеское прикрытие",description:"Сломать связку защитника, лекаря и связного; темп атаки важнее лишнего прикрытия.",enemies:["npc-pass-guard","npc-field-medic","npc-route-signaller"],operation:true,level:4,seed:53}
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
     s.earned.some(id=>!node(id))||typeof s.trained!=="boolean"||s.selected!==null&&!s.earned.includes(s.selected)||
     ![null,"escort","detour"].includes(s.arc)||!Array.isArray(s.results)||s.results.length>9||s.results.some(x=>!x||!MISSIONS[x.mission]?.operation||x.build!==null&&!node(x.build)||!["ally","enemy"].includes(x.winner)||typeof x.stamp!=="string"||x.seed!==MISSIONS[x.mission].seed||!["actions","renHp","artHp","artProtection","allyHp","prevented","redirected","redirectedHp","redirectedProtection","transferred"].every(k=>Number.isSafeInteger(x[k])&&x[k]>=0))||
     !ProgressV3Core.validateActive(s.profile,HEROES))return false;
  if(s.earned.length&&(!s.trained||s.earned.some(id=>!requirements(s,node(id)).every(r=>r.ok))))return false;
  const p=runtime(s);if(s.trained!==p.claimedMissions.includes("black-pass-ambush")||s.trained!==HeroCollectionCore.owned(p,"nada"))return false;
  return s.arc===null?s.earned.length===0&&s.selected===null&&s.arcProof===null&&!s.results.length:s.earned.length===2&&s.trained&&s.arcProof?.mission===s.arc&&["guardReduction","actions","renHp","artHp"].every(k=>Number.isSafeInteger(s.arcProof[k])&&s.arcProof[k]>0);
 }
 function fresh(){return {version:1,revision:0,profile:ProgressV3Core.fresh(HEROES,0),trained:false,earned:[],selected:null,arc:null,arcProof:null,results:[]}}
 function create(storage,combat,abilities,npcs){
  let raw=null,state=null,blocked="",battle=null,mission=null,last=null,events=[],proof={cover:false,hit:false,guardProof:0,prevented:0,redirected:0,redirectedHp:0,redirectedProtection:0,transferred:0},pending=null;
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
  function upgrade(id,hero="art"){return change(p=>["art","ren","nada"].includes(hero)&&(id==="level"&&ProgressCore.levelOf(p,hero)<3?!!ProgressCore.upgradeMany(p,hero,1):id==="special"&&SkillCore.level(p,hero,"special")<2?!!SkillCore.upgrade(p,hero,"special"):false))}
  function equip(id){return change((p,s)=>(id===null||s.earned.includes(id))&&(s.selected=id,true))}
  function entry(id){
   const m=MISSIONS[id];if(!m)return {ok:false,reason:"Неизвестное испытание"};
   if(blocked||pending)return {ok:false,reason:blocked||"Сначала сохраните результат"};
   if(id==="campaign2"&&!state.trained)return {ok:false,reason:"Сначала первый участок кампании"};
   if(m.arc){
    if(!state.trained)return {ok:false,reason:"Сначала кампания"};
    if(state.arc)return {ok:false,reason:"Личная арка завершена"};
    const missing=requirements(state,TREE[0]).filter(r=>!r.ok);
    if(missing.length)return {ok:false,reason:missing.map(r=>r.label+" "+r.value+"/"+r.need).join(" · ")};
   }
   if(m.operation&&!state.arc)return {ok:false,reason:"Завершите личную арку"};
   return {ok:true,reason:""};
  }
  function fighter(p,id){const gear=ProgressCore.gearBonuses(p,id);return HeroStatsCombatBridge.apply({id,name:({art:"Арт",ren:"Рен",nada:"Нада"})[id],side:"ally",skillLevels:Object.fromEntries(["basic","special","powerful","passive"].map(k=>[k,SkillCore.level(p,id,k)]))},{level:ProgressCore.levelOf(p,id),stars:StarCore.rankOf(p,id),gearPercent:{hp:gear.hp,atk:gear.atk},gearStats:gear.stats??{}},HeroStatsProfiles[id],HeroStatsCore)}
  function start(id){
   if(battle?.active||!entry(id).ok)return false;
   const m=MISSIONS[id],p=runtime(state),selected=state.selected&&node(state.selected);
   const ids=m.operation&&selected?[selected.ability]:[];
   // Qualification uses the original kit only. No ability before its proof.
   const spawn=(list,w)=>list.map((x,i)=>npcs.spawn(x,{instanceId:"w"+w+"-"+i,level:m.level??1,skillLevel:1}));
   const squad=(m.arc?["ren","art"]:["ren","art","nada"]).filter(id=>HeroCollectionCore.owned(p,id));
   battle=combat.createBattle([...squad.map(x=>fighter(p,x)),...spawn(m.enemies,1)],(m.waves??[]).map((w,i)=>spawn(w,i+2)),{combat2:true,treeR1:true,...(m.operation?{hitChecks:true,critChecks:true,rngSeed:m.seed}:{}),...(ids.length?{trustPersonal:ids}:{}),...(m.objective?{tacticalObjective:m.objective}:{})});
   mission=id;last=null;proof={cover:false,hit:false,guardProof:0,prevented:0,redirected:0,redirectedHp:0,redirectedProtection:0,transferred:0};events=[];combat.advanceToPlayerTurn(battle);collect();return true;
  }
  function collect(){
   events=battle.events.slice(-50).map(e=>({...e}));
   for(const e of battle.events){
    if(e.type==="effect"&&e.actorId==="art"&&e.targetId==="ren"&&e.effect==="guard")proof.cover=true;
    if(e.type==="tree-r1-guard"){proof.prevented+=e.amount;if(e.targetId==="ren"&&e.sourceId==="art"&&e.amount>0){proof.hit=true;proof.cover=false;proof.guardProof+=e.amount;}}
    if(e.type==="combat2-cover"&&e.actorId==="art")proof.prevented+=e.amount;
    if(e.type==="trust-intercept-resolved")proof.redirected++;
    if(e.type==="tree-r1-redirect-damage"){proof.redirectedHp+=e.hpDamage;proof.redirectedProtection+=e.protectionDamage;}
    if(e.type==="trust-reserve-transferred")proof.transferred+=e.amount;
   }
   if(battle.active)return;
   const m=MISSIONS[mission],win=battle.winner==="ally",all=battle.fighters.filter(f=>f.side==="ally"),both=all.every(f=>f.hp>0);
   const eligible=win&&(!m.arc||both&&proof.guardProof>0);
   last={winner:battle.winner,actions:battle.allyActions,eligible,earned:null,reward:0,saved:true,...proof,renHp:all.find(f=>f.id==="ren")?.hp??0,artHp:all.find(f=>f.id==="art")?.hp??0,artProtection:all.find(f=>f.id==="art")?.protection??0,allyHp:all.reduce((a,f)=>a+f.hp,0)};
   const next=clone(state),p=runtime(next);
   if(m.operation){next.results=next.results.filter(r=>r.mission!==mission||r.build!==state.selected);next.results.push({mission,build:state.selected,winner:last.winner,actions:last.actions,renHp:last.renHp,artHp:last.artHp,artProtection:last.artProtection,allyHp:last.allyHp,prevented:last.prevented,redirected:last.redirected,redirectedHp:last.redirectedHp,redirectedProtection:last.redirectedProtection,transferred:last.transferred,seed:m.seed,stamp:["ren","art","nada"].filter(id=>HeroCollectionCore.owned(p,id)).map(id=>id+":"+ProgressCore.levelOf(p,id)+"/"+StarCore.rankOf(p,id)+"/"+ProgressCore.gearState(p,id).tier+"/"+SkillCore.level(p,id,"special")).join(" · ")});}
   else if(!eligible)return;
   else if(m.rewardId){const award=ProgressCore.claimFirstClear(p,m.rewardId,battle);if(!award)return;last.reward=award.currency;if(mission==="campaign"){next.trained=true;StarCore.directGrant(p,"nada");}}
   else if(m.arc&&!state.arc&&entry(mission).ok){next.arc=mission;next.arcProof={mission,guardReduction:proof.guardProof,actions:battle.allyActions,renHp:last.renHp,artHp:last.artHp};next.earned=TREE.map(n=>n.id);next.selected=null;last.earned="both";}
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
   const actions=actor?["basic","special","powerful",...(battle.trustPersonal??[]).filter(id=>actor.id==="art")].map(id=>({id,name:id==="art-intercept"?"Перехват":id==="art-reserve"?"Переброска резерва":abilities.get(actor,id)?.name,targets:fighters.filter((f,i)=>legal(id,i)).map(f=>f.id),previews:Object.fromEntries(fighters.map((f,i)=>[f.id,id.startsWith("art-")?combat.personalPreview(battle,id,i):null]).filter(x=>x[1])),cooldown:id.startsWith("art-")?battle.trustPersonalCooldown[id]:id==="special"?actor.specialCooldown:id==="powerful"?actor.powerfulCooldown:0})):[];
   return {active:!!battle?.active,mission,last:last&&{...last},events:events.map(e=>({...e})),fighters,actions,actor:actor?.id??null,turns:battle?.allyActions??0,wave:battle?.wave??1,totalWaves:battle?.totalWaves??1,intercept:battle?.trustIntercept?{...battle.trustIntercept}:null,proof:{...proof},blocked,pending:!!pending,rank:state.arc?2:1,arc:state.arc,results:clone(state.results),trained:state.trained,selected:state.selected,earned:state.earned.slice(),currency:p.currency,level:ProgressCore.levelOf(p,"art"),stars:StarCore.rankOf(p,"art"),gear:ProgressCore.gearState(p,"art").tier,skill:SkillCore.level(p,"art","special"),levelCost:ProgressCore.upgradeCost(p,"art"),skillCost:SkillCore.cost(p,"art","special")?.currency??null,canLevel:!blocked&&!pending&&ProgressCore.canUpgrade(p,"art")&&ProgressCore.levelOf(p,"art")<3,canSkill:!blocked&&!pending&&SkillCore.level(p,"art","special")<2&&!SkillCore.blocked(p,"art","special"),heroes:["art","ren","nada"].filter(id=>HeroCollectionCore.owned(p,id)).map(id=>({id,level:ProgressCore.levelOf(p,id),skill:SkillCore.level(p,id,"special"),levelCost:ProgressCore.upgradeCost(p,id),skillCost:SkillCore.cost(p,id,"special")?.currency??null,canLevel:!blocked&&!pending&&ProgressCore.levelOf(p,id)<3&&ProgressCore.canUpgrade(p,id),canSkill:!blocked&&!pending&&SkillCore.level(p,id,"special")<2&&!SkillCore.blocked(p,id,"special")})),missions:Object.entries(MISSIONS).map(([id,m])=>({id,...m,...entry(id),claimed:m.rewardId?p.claimedMissions.includes(m.rewardId):false})),nodes:TREE.map(n=>({...n,requirements:requirements(state,n),earned:state.earned.includes(n.id)}))};
  }
  return Object.freeze({view,start,action,abandon,upgrade,equip,retry,entry});
 }
 return Object.freeze({KEY,TREE,MISSIONS,create});
})();
