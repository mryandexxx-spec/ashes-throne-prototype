/* C4/R1 native comparison controller, no profile, rewards, or alternate combat engine. */
const TrustR1Lab=(()=>{
 "use strict";
 const SCENARIOS=Object.freeze({
  guard:{name:"Защищённый дозор",label:"Прикрытие и лечение",image:"ren-route",description:"Страж прохода и полевой перевязчик. Пробейте оборону, не позволяя противникам восстановиться.",enemies:["npc-pass-guard","npc-field-medic"]},
  escort:{name:"Опасный переход",label:"Защита проводника",image:"art-support",description:"Пращник, перехватчик и старший дозора угрожают проводнику. Рен должен остаться в строю.",enemies:["npc-ridge-slinger","npc-trail-interceptor","npc-watch-captain"],objective:{kind:"protect-and-defeat",protectAllyId:"ren"}},
  ordinary:{name:"Открытое столкновение",label:"Контрольный бой",image:"conflict",description:"Два бойца без навыков прикрытия. Оцените, когда исходные способности полезнее новых.",enemies:["npc-trail-interceptor","npc-sarkh-land-courier"]},
  waves:{name:"Два рубежа",label:"Последовательные волны",image:"ren-route",description:"Сначала дозор, затем подвижная группа. Здоровье и перезарядка сохраняются между волнами.",enemies:["npc-pass-guard","npc-route-signaller"],waves:[["npc-ridge-slinger","npc-field-medic"]]}
 });
 const ID={ren:"ren-bypass",art:"art-intercept"};
 const NAME={"ren-bypass":"Обход прикрытия","art-intercept":"Перехват"};
 const hero=(id,hp,atk,speed,protection,def)=>({id,name:id==="art"?"Арт":"Рен",side:"ally",hp,atk,speed,physicalAttack:atk,magicAttack:0,physicalDefense:def,magicDefense:def,protection,maxProtection:protection,accuracy:10,evasion:5,critChance:5,critDamage:150,defensePenetration:0,debuffPotency:10,debuffResistance:10,skillLevels:{basic:2,special:2,powerful:2,passive:1}});
 function create(combat,abilities,npcs){
  let b=null,scenario="guard",enabled=true,last=null,history=[],opportunities={ren:0,art:0},uses={ren:0,art:0},resolved=0,records=[];
  function spawn(ids,wave){return ids.map((id,i)=>npcs.spawn(id,{instanceId:"w"+wave+"-"+i,level:1,skillLevel:1}))}
  function collect(){history=b.events.slice(-50).map(e=>({...e}));resolved+=history.filter(e=>e.type==="trust-intercept-resolved").length;
   if(!b.active){last={winner:b.winner,actions:b.allyActions,remaining:b.fighters.filter(f=>f.side==="ally").reduce((s,f)=>s+f.hp,0),uses:{...uses},opportunities:{...opportunities},resolved,outcome:b.tacticalOutcome??"defeat-all"};records.push({scenario,enabled,...last});}
   else {const actor=b.fighters[b.currentActor];if(actor&&ID[actor.id]&&b.fighters.some((f,i)=>combat.personalPreview(b,ID[actor.id],i)))opportunities[actor.id]++;}
  }
  function start(id,withTrust){if(b?.active||!Object.hasOwn(SCENARIOS,id)||typeof withTrust!=="boolean")return false;scenario=id;enabled=withTrust;last=null;history=[];opportunities={ren:0,art:0};uses={ren:0,art:0};resolved=0;
   const t=SCENARIOS[id],heroes=[hero("ren",145,45,140,22,20),hero("art",195,34,115,35,32)];
   b=combat.createBattle([...heroes,...spawn(t.enemies,1)],(t.waves??[]).map((w,i)=>spawn(w,i+2)),{combat2:true,...(enabled?{trustPersonal:["ren-bypass","art-intercept"]}:{}),...(t.objective?{tacticalObjective:t.objective}:{})});combat.advanceToPlayerTurn(b);collect();return true;}
  function legal(id,index){if(!b?.active)return false;const actor=b.fighters[b.currentActor],target=b.fighters[index];if(!target||target.hp<=0)return false;
   if(Object.values(ID).includes(id))return !!combat.personalPreview(b,id,index);
   if(!["basic","special","powerful"].includes(id)||!combat.abilityReady(b,id))return false;
   const mode=abilities.get(actor,id)?.target;
   return mode==="ally"?target.side==="ally"&&target.id!==actor.id:mode==="enemy"?target.side==="enemy":false;
  }
  function action(id,targetId){const i=b?.fighters.findIndex(f=>f.id===targetId)??-1;if(!legal(id,i))return false;const actor=b.fighters[b.currentActor];if(!combat.performActorAbility(b,id,i))return false;if(ID[actor.id]===id)uses[actor.id]++;collect();return true;}
  function abandon(){if(!b?.active)return false;b.active=false;last={winner:null,outcome:"abandoned",actions:b.allyActions,remaining:b.fighters.filter(f=>f.side==="ally").reduce((s,f)=>s+f.hp,0),uses:{...uses},opportunities:{...opportunities},resolved};return true;}
  function view(){const actor=b?.active?b.fighters[b.currentActor]:null;const fighters=(b?.fighters??[]).map(f=>({id:f.id,name:f.name,archetypeId:f.archetypeId,side:f.side,hp:f.hp,maxHp:f.maxHp,protection:f.protection,maxProtection:f.maxProtection,guard:f.guardHits,meter:f.meter,prepared:f.combat2Prepared??null}));
   const actions=actor?["basic","special","powerful",...(enabled&&ID[actor.id]?[ID[actor.id]]:[])].map(id=>({id,name:NAME[id]??abilities.get(actor,id)?.name,targets:fighters.filter((f,i)=>legal(id,i)).map(f=>f.id),cooldown:id===ID[actor.id]?b.trustPersonalCooldown[id]:id==="special"?actor.specialCooldown:id==="powerful"?actor.powerfulCooldown:0})):[];
   return {scenario,enabled,active:!!b?.active,last:last?{...last}:null,records:records.slice(),actor:actor?.id??null,fighters,actions,events:history,turns:b?.allyActions??0,wave:b?.wave??1,totalWaves:b?.totalWaves??1,intercept:b?.trustIntercept?{...b.trustIntercept}:null,uses:{...uses},resolved,opportunities:{...opportunities}};}
  return Object.freeze({start,action,abandon,view});
 }
 return Object.freeze({create,SCENARIOS});
})();
