/* AUD003-C2: isolated, noncanonical gameplay experiment. No production saves or rewards. */
const CommandLoopLab = (() => {
  "use strict";
  const tasks=Object.freeze({
    agreement:{name:"Обязательство Арта",detail:"Удержать проход 4 действия отряда (или победить). Рен должен выжить; Арт должен применить страховку к нему.",objective:{kind:"hold-or-defeat",protectAllyId:"ren",allyActionsToHold:4},proof:"cover",milestone:"agreement"},
    field:{name:"Полевое подтверждение",detail:"Победить всех противников и сохранить Рена. Здесь удержания недостаточно.",objective:{kind:"protect-and-defeat",protectAllyId:"ren"},milestone:"field"},
    joint:{name:"Согласованное действие",detail:"Первым победить связного (shade); применить страховку Арта к Рену и попасть особой атакой Рена по связному.",objective:{kind:"priority-first",priorityEnemyId:"shade"},proof:"joint",milestone:"joint"},
    standard:{name:"Операция: прямой штурм",detail:"Уничтожить всех противников. Доступна всегда.",objective:null},
    delegated:{name:"Операция: план Арта",detail:"Арт предлагает прикрыть отход: достаточно 4 действий при живом Рене или полной победы. Противники те же.",objective:{kind:"hold-or-defeat",protectAllyId:"ren",allyActionsToHold:4}}
  });
  function create(combat,abilities){
    if(!combat||!abilities)throw Error("Native CombatCore and AbilityData required");
    const earned=new Set();let active=null,battle=null,last=null,cover=false,strike=false,runNumber=0;
    const rank=()=>earned.has("agreement")?(earned.has("field")&&earned.has("joint")?3:2):1;
    const allowed=id=>Object.hasOwn(tasks,id)&&(
      id==="standard"||id==="agreement"||id==="delegated"&&rank()===3||
      ["field","joint"].includes(id)&&rank()>=2);
    const fighter=(id,name,side,hp,atk,speed,protection)=>({id,name,side,hp,atk,speed,physicalAttack:atk,magicAttack:atk,physicalDefense:0,magicDefense:0,protection,maxProtection:protection});
    function start(id){
      if(active||!allowed(id))return false;
      const t=tasks[id],operation=["standard","delegated"].includes(id);
      const fighters=[fighter("ren","Рен","ally",145,35,130,20),fighter("art","Арт","ally",180,30,110,24),
        fighter("ves","Страж","enemy",operation?155:80,18,90,0),fighter("shade",id==="joint"?"Связной":"Дозорный","enemy",operation?145:85,17,95,0)];
      battle=combat.createBattle(fighters,[],{combat2:true,...(t.objective?{tacticalObjective:{...t.objective}}:{})});
      active=id;cover=false;strike=false;last=null;runNumber++;
      combat.advanceToPlayerTurn(battle);
      return true;
    }
    function legal(abilityId,targetId){
      if(!active||!battle.active||!["basic","special","powerful"].includes(abilityId)||!combat.abilityReady(battle,abilityId))return false;
      const actor=battle.fighters[battle.currentActor],i=battle.fighters.findIndex(f=>f.id===targetId);
      if(i<0||battle.fighters[i].hp<=0)return false;
      const mode=abilities.get(actor,abilityId)?.target;
      if(["self","all-allies"].includes(mode))return i===battle.currentActor;
      if(["ally","enemy","all-enemies"].includes(mode)){
        if(mode==="ally"&&actor.id==="art"&&targetId===actor.id)return false;
        return battle.fighters[i].side===(mode==="ally"?"ally":"enemy");
      }
      return false;
    }
    function action(abilityId,targetId){
      if(!legal(abilityId,targetId))return false;
      const i=battle.fighters.findIndex(f=>f.id===targetId);
      if(!combat.performActorAbility(battle,abilityId,i))return false;
      const events=battle.events;
      if(events.some(e=>e.type==="ability"&&e.actorId==="art"&&e.abilityId==="special"&&e.targetId==="ren")&&
         events.some(e=>e.type==="effect"&&e.actorId==="art"&&e.targetId==="ren"&&e.effect==="guard"))cover=true;
      if(events.some(e=>e.type==="ability"&&e.actorId==="ren"&&e.abilityId==="special"&&e.targetId==="shade")&&
         events.some(e=>e.type==="damage"&&e.actorId==="ren"&&e.targetId==="shade"&&e.amount>0))strike=true;
      if(!battle.active){
        const t=tasks[active],success=battle.winner==="ally",proof=t.proof==="cover"?cover:t.proof==="joint"?cover&&strike:true;
        const gained=!!(success&&proof&&t.milestone&&!earned.has(t.milestone));
        if(gained)earned.add(t.milestone);
        last={task:active,winner:battle.winner,outcome:battle.tacticalOutcome??"defeat-all",proof,gained,actions:battle.allyActions,remainingEnemies:battle.fighters.filter(f=>f.side==="enemy"&&f.hp>0).length};
        active=null;
      }
      return true;
    }
    function abandon(){if(!active)return false;last={task:active,winner:null,outcome:"abandoned",proof:false,gained:false,actions:battle.allyActions,remainingEnemies:battle.fighters.filter(f=>f.side==="enemy"&&f.hp>0).length};active=null;battle=null;return true;}
    function view(){
      const actor=active?battle.fighters[battle.currentActor]:null;
      const fighters=battle?battle.fighters.map(f=>({id:f.id,name:f.name,side:f.side,hp:f.hp,maxHp:f.maxHp,protection:f.protection,guard:f.guardHits,maxProtection:f.maxProtection,meter:f.meter})):[],
        actions=actor?["basic","special","powerful"].flatMap(id=>{const a=abilities.get(actor,id);return a?[{id,name:a.name,targets:fighters.filter(f=>legal(id,f.id)).map(f=>f.id)}]:[]}):[];
      return {rank:rank(),earned:[...earned],active,runNumber,last:last?{...last}:null,cover,strike,actor:actor?.id??null,fighters,actions,turns:battle?.allyActions??0,events:(battle?.events??[]).slice(-30).map(e=>({...e})),
        tasks:Object.entries(tasks).map(([id,t])=>({id,name:t.name,detail:t.detail,allowed:allowed(id),done:!!t.milestone&&earned.has(t.milestone)}))};
    }
    return Object.freeze({start,action,abandon,view});
  }
  return Object.freeze({create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CommandLoopLab;
