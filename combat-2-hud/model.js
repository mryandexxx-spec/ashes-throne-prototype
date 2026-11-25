/* B17.2 isolated native HUD. Controller never calculates damage or advances time itself. */
const Combat2HUD=(()=>{
"use strict";
const names={ren:"Рен",art:"Арт",nada:"Нада",liora:"Лиора",sava:"Сава"};
const tiers={early:{level:2,stars:1,skill:1,gear:1},mid:{level:15,stars:3,skill:6,gear:7},max:{level:85,stars:7,skill:6,gear:13}};
const presets={
 starter:{label:"Перехват · 2 героя",ids:["ren","art"],foes:["npc-trail-interceptor","npc-ridge-slinger"]},
 three:{label:"Наблюдение · 3 героя",ids:["ren","art","nada"],foes:["npc-trail-interceptor","npc-ridge-slinger","npc-pass-guard"]},
 full:{label:"Отряд · 5 героев",ids:["ren","art","nada","liora","sava"],foes:["npc-trail-interceptor","npc-ridge-slinger","npc-pass-guard","npc-field-medic","npc-watch-captain"]},
 waves:{label:"Две волны · 5 героев",ids:["ren","art","nada","liora","sava"],foes:["npc-trail-interceptor","npc-ridge-slinger","npc-pass-guard"],next:["npc-ridge-slinger","npc-trail-interceptor","npc-pass-guard","npc-field-medic"]},
 tempo:{label:"Совместный удар · 2 героя",ids:["sava","ren"],foes:["npc-pass-guard","npc-watch-captain"]}
};
function buildSetup({preset="full",tier="early",seed=7,hard=false,heroTiers={}}={}){
 const p=presets[preset],t=tiers[tier];
 if(!p||!t||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw Error("Неверные параметры");
 const ids=StarCore.PLAYABLE,roster=ids.map(id=>({id,side:"ally"}));
 const progress=ProgressV3Core.toRuntime(ProgressV3Core.fresh(roster,100),roster);
 if(!progress)throw Error("Не удалось собрать тестовый отряд");
 progress.currency=100000000;for(const id of GearData.MATERIALS)progress.materials[id]=1000000;
 const party=p.ids.map(id=>{
  const t=tiers[heroTiers[id]??tier];if(!t)throw Error("Неверный уровень героя");
  progress.heroStars[id].rank=t.stars;progress.levels[id]=t.level;
  for(let i=1;i<=t.gear;i++){for(const slot of GearData.SLOTS){const item=ProgressCore.itemOffer(progress,id,slot.id)[0];if(!item||!ProgressCore.equipItem(progress,id,item.id))throw Error("Снаряжение "+id);}
   if(i<t.gear&&!ProgressCore.promoteGear(progress,id))throw Error("Ранг "+id);}
  const gear=ProgressCore.gearBonuses(progress,id);
  return {...HeroStatsCombatBridge.apply({id,side:"ally",name:names[id],tags:["gardens-over-abyss"],skillLevels:{basic:t.skill,special:t.skill,powerful:t.skill,passive:t.skill}},{level:t.level,stars:t.stars,gearPercent:gear,gearStats:gear.stats},HeroStatsProfiles[id],HeroStatsCore),gearTier:t.gear};
 });
 // Reuse previously calibrated research pressure, not campaign balance.
 const scale=({early:p.ids.length<=3?1.512:1.242,mid:6.355,max:p.ids.length===3?16.5:19.8}[tier])*(hard?1:.78)*(preset==="waves"?.88:1);
 const foes=(list,w)=>list.map((id,i)=>{
  const n=NpcEnemyData.spawn(id,{instanceId:"w"+w+"-e"+i}),pool=scale*.75,attack=scale*({early:1.35,mid:1.45,max:2.65}[tier]);
  return {...n,hp:Math.max(1,Math.round(n.hp*pool)),protection:Math.round(n.protection*pool),maxProtection:Math.round(n.protection*pool),physicalAttack:Math.max(1,Math.round(n.physicalAttack*attack)),atk:Math.max(1,Math.round(n.physicalAttack*attack))};
 });
 return {lineup:[...party,...foes(p.foes,1)],waves:p.next?[foes(p.next,2)]:[],options:{combat2:true,rngSeed:seed,hitChecks:true,critChecks:true,penetrationChecks:true,statusChecks:true,leaderId:null}};
}
function makeBattle(opts){
 const setup=buildSetup(opts);
 const b=CombatCore.createBattle(setup.lineup,setup.waves,setup.options);
 CombatCore.advanceToPlayerTurn(b);return b;
}
function create(b){
 let enemy=null,ally=null,pending=null;
 const actor=()=>b.fighters[b.currentActor],find=id=>b.fighters.findIndex(f=>f.id===id),valid=(id,side)=>b.fighters.some(f=>f.id===id&&f.side===side&&f.hp>0);
 function sync(){if(!valid(enemy,"enemy"))enemy=b.fighters.find(f=>f.side==="enemy"&&f.hp>0)?.id??null;if(!valid(ally,"ally")||ally===actor()?.id)ally=null;}
 sync();
 function select(id){if(!b.active)return false;if(valid(id,"enemy"))enemy=id;else if(valid(id,"ally")&&id!==actor()?.id)ally=id;else return false;return true;}
 function cancel(){pending=null;ally=null;}
 function info(id){
  const a=actor(),d=a&&AbilityData.get(a,id);if(!b.active||!d)return {ready:false,reason:"Бой завершён"};
  const cd=id==="special"?a.specialCooldown:id==="powerful"?a.powerfulCooldown:0;
  const ready=CombatCore.abilityReady(b,id);
  return {d,cd,ready,reason:cd?"Перезарядка: "+cd:!ready?"Нет допустимого союзника":""};
 }
 function preview(){
  if(!pending)return {ok:false};
  const a=actor(),{d,ready}=info(pending);if(!ready||!d)return {ok:false,text:"Навык недоступен"};
  if(d.combat2Assist){if(!valid(enemy,"enemy")||!valid(ally,"ally")||ally===a.id)return {ok:false,text:"Выбери помощника из отряда"};return {ok:true,text:a.name+" + "+b.fighters[find(ally)].name+" → "+b.fighters[find(enemy)].name};}
  if(!valid(ally,"ally")||ally===a.id)return {ok:false,text:"Выбери другого союзника"};
  if(d.combat2Signal){const p=CombatCore.previewSignal(b,a,d.signalMeter+(a.combat2Boost??0),b.fighters[find(ally)]);return {ok:!!p&&p.gain>0,text:p?.gain>0?"Инициатива +"+Math.round(p.gain)+(p.cross?" · раньше ближайшего врага":""):"Инициатива уже готова",forecast:p};}
  return {ok:true,text:"Прикрыть: "+b.fighters[find(ally)].name};
 }
 function execute(id,target,helper){const ok=CombatCore.performActorAbility(b,id,target,helper);if(ok){cancel();sync();}return ok;}
 function skill(id){
  const {d,ready}=info(id);if(!ready||!d)return false;
  if(d.combat2Assist||d.target==="ally"){pending=id;ally=null;return true;}
  cancel();return execute(id,d.target==="self"||d.target==="all-allies"?b.currentActor:find(enemy));
 }
 function confirm(){if(!preview().ok)return false;const id=pending,d=info(id).d;return execute(id,d.combat2Assist?find(enemy):find(ally),d.combat2Assist?find(ally):undefined);}
 function auto(){if(!b.active)return false;cancel();const p=AutoDecision.chooseAction(b);const ok=CombatCore.performAutoAction(b,p);sync();return ok;}
 return {b,actor,select,skill,confirm,cancel,auto,info,preview,get enemy(){return enemy},get ally(){return ally},get pending(){return pending}};
}
function describe(a,d){
 if(!d)return "";
 if(d.combat2Assist)return "Удар "+Math.round(d.multiplier*100)+"% и помощь выбранного союзника: "+Math.round(d.combat2Assist*100)+"% его атаки, не больше атаки Савы до крита. Помощник не тратит ход.";
 if(d.combat2Signal)return "Передаёт "+d.signalMeter+" инициативы"+(a.combat2Boost?" + "+a.combat2Boost+" за совместный удар":"")+". Предел бонуса — 950; готовый ход не отнимается.";
 if(d.combat2Cover)return "Даёт заряд прикрытия (если его нет) и восстанавливает защиту другого союзника. Арт не теряет HP.";
 if(d.kind==="guard")return "Защита ×"+d.guardHits+(d.tauntTurns?"; провокация на "+d.tauntTurns+" собственных хода":"")+". Один заряд снижает входящий удар.";
 let s=d.target==="all-enemies"?"Удар по всем врагам: ":"Удар: ";s+=Math.round(d.multiplier*100)+"% атаки.";
 if(d.weakening)s+=" Ослабляет следующие атаки ×"+d.weakening+".";
 if(d.onHitStatus?.type==="read-move")s+=" Зацепки ×"+d.onHitStatus.stacks+" при попадании.";
 if(d.onHitStatus?.type==="slowed")s+=" Замедление "+d.onHitStatus.amount+"%.";
 if(d.disruptTurns)s+=" Срывает подготовленную атаку при попадании; враг сохраняет обычный ход.";
 if(a.id==="sava"&&d.id==="basic")s+=" Ближайшему неготовому союзнику +"+d.nextAllyMeter+" инициативы.";
 return s;
}
return Object.freeze({names,tiers,presets,buildSetup,makeBattle,create,describe});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=Combat2HUD;
