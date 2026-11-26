/* R2/D1: actual native encounter + atomic v3 first outcome. Not wired to UI yet. */
const ArtAdventureCore=(()=>{
"use strict";
const SOURCE="art-cover-promise",OCCURRENCE="once",HOLD=8,LEVEL=7;
const EARNED=Object.freeze(["guardian-2","command-2"]);
const ABILITIES=Object.freeze({"guardian-2":"art-intercept","command-2":"art-reserve"});
const IDS=Object.freeze(["ren","art"]);
const NPC=Object.freeze(["npc-trail-interceptor","npc-ridge-slinger"]);
const failure=code=>({ok:false,code});
const objective=route=>route==="direct"?{kind:"protect-and-defeat",protectAllyId:"ren"}:route==="hold"?{kind:"hold-or-defeat",protectAllyId:"ren",allyActionsToHold:HOLD}:null;
function view(p){
 const row=p?.artPath,complete=row?.phase==="complete";
 return {arc:complete?row.route:null,earned:complete?EARNED.slice():[],selected:complete?row.selected:null,outcome:complete?row.outcome:null};
}
function loadout(p,party){
 const selected=view(p).selected;
 return selected&&Array.isArray(party)&&party.some(f=>f.id==="art"&&f.side==="ally"&&f.hp>0)?{treeR1:true,trustPersonal:[ABILITIES[selected]]}:{};
}
function terminal(b,route){
 const goal=objective(route);
 if(!goal||b?.active!==false||b.winner!=="ally"||!Array.isArray(b.fighters)||
    !Number.isSafeInteger(b.allyActions)||b.allyActions<1||
    Object.keys(b.tacticalObjective||{}).length!==Object.keys(goal).length||
    !Object.keys(goal).every(k=>b.tacticalObjective[k]===goal[k]))return null;
 const allies=b.fighters.filter(f=>f.side==="ally"),enemies=b.fighters.filter(f=>f.side==="enemy");
 if(allies.length!==2||!IDS.every(id=>allies.filter(f=>f.id===id&&Number.isFinite(f.hp)&&f.hp>0).length===1)||
    enemies.length!==2||enemies.some(f=>!Number.isFinite(f.hp)||f.hp<0))return null;
 const defeated=enemies.every(f=>f.hp===0);
 if(route==="direct"&&(b.tacticalOutcome!=="protected-victory"||!defeated))return null;
 if(route==="hold"&&(b.allyActions>HOLD||
    !(b.tacticalOutcome==="held"&&b.allyActions===HOLD||b.tacticalOutcome==="defeated-attackers"&&defeated)))return null;
 return {outcome:defeated?"recovered":"left",actions:b.allyActions};
}
function create({heroes,storageProvider,onUnknown=()=>{}}){
 let active=null,blocked=false;
 const lock=()=>typeof window==="undefined"||typeof ProgressWriterCore!=="undefined"&&ProgressWriterCore.canPersist();
 function read(){
  try{const raw=storageProvider().getItem(ProgressV3Core.KEY);return raw===null?null:ProgressV3Core.toRuntime(JSON.parse(raw),heroes);}catch(_){return null;}
 }
 function ready(p){
  return !!p&&IDS.every(id=>HeroCollectionCore.owned(p,id))&&MainCampaignCore.statusFor(MainCampaignCore.II_ID,storageProvider,p)==="claimed";
 }
 function save(p){
  if(!lock()||blocked)return failure("WRITER_REQUIRED");
  if(!ProgressV3Core.persist(p,storageProvider)){blocked=true;onUnknown();return failure("SAVE_OUTCOME_UNKNOWN");}
  return {ok:true,progress:p};
 }
 function fighter(p,id){
  const h=heroes.find(x=>x.id===id&&x.side==="ally"),gear=ProgressCore.gearBonuses(p,id);
  const stats=HeroStatsCombatBridge.apply(h,{level:ProgressCore.levelOf(p,id),stars:StarCore.rankOf(p,id),gearPercent:gear,gearStats:gear.stats},HeroStatsProfiles[id],HeroStatsCore);
  return {...stats,skillLevels:Object.fromEntries(SkillCore.UPGRADABLE_IDS.map(k=>[k,SkillCore.level(p,id,k)]))};
 }
 function start(route,seed){
  if(blocked||!lock())return failure("WRITER_REQUIRED");
  if(active)return failure("ATTEMPT_ACTIVE");
  const goal=objective(route);
  if(!goal||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)return failure("INVALID_ROUTE");
  const p=read();
  if(!ready(p)||p.artPath?.phase==="complete")return failure("ADVENTURE_LOCKED");
  const accepted={version:1,sourceId:SOURCE,occurrenceId:OCCURRENCE,route,acceptedRevision:p.saveRevision,phase:"pending"};
  let battle;
  try{
   battle=CombatCore.createBattle([...IDS.map(id=>fighter(p,id)),...NPC.map((id,i)=>NpcEnemyData.spawn(id,{instanceId:"art-arc-"+i,level:LEVEL,skillLevel:1}))],[],{combat2:true,treeR1:true,hitChecks:true,critChecks:true,rngSeed:seed,leaderId:null,tacticalObjective:goal});
  }catch(_){return failure("BATTLE_SETUP_FAILED");}
  p.artPath=accepted;
  const saved=save(p);if(!saved.ok)return saved;
  // Only after verified persistence does the caller receive the actual battle.
  active={battle,accepted:JSON.stringify(accepted)};
  return {...saved,battle};
 }
 function complete(battle){
  if(blocked||!lock())return failure("WRITER_REQUIRED");
  if(!active||active.battle!==battle)return failure("UNKNOWN_ATTEMPT");
  const p=read();
  if(!ready(p)||p.artPath?.phase!=="pending"||JSON.stringify(p.artPath)!==active.accepted||
     p.saveRevision<=p.artPath.acceptedRevision)return failure("STALE_ATTEMPT");
  const result=terminal(battle,p.artPath.route);
  if(!result)return failure("OBJECTIVE_NOT_MET");
  p.artPath={...p.artPath,phase:"complete",...result,selected:null};
  const saved=save(p);if(saved.ok)active=null;
  return saved;
 }
 function abandon(battle){
  if(!active||active.battle!==battle)return false;
  active=null;return true; // pending is inert after reload/abandon; a new start replaces it.
 }
 function equip(id){
  if(blocked||!lock()||active)return failure("WRITER_REQUIRED");
  if(id!==null&&!EARNED.includes(id))return failure("INVALID_SELECTION");
  const p=read();
  if(!ready(p)||p.artPath?.phase!=="complete")return failure("ADVENTURE_LOCKED");
  if(p.artPath.selected===id)return {ok:true,progress:p};
  p.artPath={...p.artPath,selected:id};
  return save(p);
 }
 return Object.freeze({start,complete,abandon,equip,read,ready,active:()=>!!active,blocked:()=>blocked});
}
return Object.freeze({SOURCE,OCCURRENCE,HOLD,LEVEL,EARNED,objective,view,loadout,terminal,create});
})();
