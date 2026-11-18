/* NET-003: pure, unwired clue -> single CombatCore wave adapter.
 * Every balance value and encounter in the proposal registry is [ПРЕДЛОЖЕНИЕ].
 * No writes, no payout, no DOM/Babylon, no new CombatCore rules.
 * NET-004 must save the NetworkCore checkpoint under ProgressWriterCore's lock.
 */
const NetworkEncounterAdapter=(()=>{
 "use strict";
 const Network=typeof NetworkCore!=="undefined"?NetworkCore:require("./network-core.js");
 const Data=typeof NetworkData!=="undefined"?NetworkData:require("./network-data.js");
 const Encounters=typeof NetworkEncounterData!=="undefined"?
  NetworkEncounterData:require("./network-encounter-data.js");
 const Npcs=typeof NpcEnemyData!=="undefined"?NpcEnemyData:require("./npc-enemy-data.js");
 const plain=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
 const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
  Object.keys(x).every(k=>keys.includes(k));
 const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const id=x=>typeof x==="string"&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(x);
 const maxNpcLevel=85;

 // Validate a whole authored encounter, including every approach and NPC.
 // A ref must never silently fall back to a different version/formation.
 function validDefinition(d,npc=Npcs){
  if(!exact(d,["template","formations"])||!npc||
   typeof npc.get!=="function"||typeof npc.spawn!=="function")return false;
  const t=d.template, f=d.formations;
  if(!plain(t)||!id(t.regionId)||!Data.validateCatalog({version:1,
   regions:[{id:t.regionId,name:"Encounter region",unlockRef:null}],
   templates:[t]})||t.levels.some(level=>level>maxNpcLevel)||
   !plain(f)||!equal(Object.keys(f).sort(),t.approaches.map(a=>a.id).sort()))return false;
  for(const a of t.approaches){
   const waves=f[a.id];
   if(!Array.isArray(waves)||waves.length!==a.waves)return false;
   for(const wave of waves){
    if(!Array.isArray(wave)||wave.length<1||wave.length>5)return false;
    for(const name of wave){
     const archetype=npc.get(name);
     if(!id(name)||!archetype||archetype.originRegionId!==t.regionId)
      return false;
    }
   }
  }
  return true;
 }
 function validRegistry(registry=Encounters.REGISTRY,npc=Npcs){
  return plain(registry)&&Object.keys(registry).length>0&&
   Object.entries(registry).every(([ref,d])=>
    id(ref)&&validDefinition(d,npc)&&ref===d.template.encounterRef);
 }
 function snapshotMatches(c,t){
  return c.templateId===t.id&&c.templateRevision===t.revision&&
   c.encounterRef===t.encounterRef&&c.regionId===t.regionId&&
   c.type===t.type&&t.levels.includes(c.level)&&
   c.rewardRef===t.rewardRef&&c.materialId===t.materialId&&
   c.heroId===t.heroId&&c.threatTag===t.threatTag&&
   (c.modifierId===null||t.modifierIds.includes(c.modifierId))&&
   equal(c.preparationIds,t.preparationIds)&&
   equal(c.approaches,t.approaches);
 }
 // Small stable hash; never consumes NetworkCore's draw sequence.
 function seedOf(parts){
  const s=JSON.stringify(parts);
  let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
 }
 function applyFixtureTuning(unit,modifier,preparation){
  // Strictly test-only +/-10% enemy stats; no new combat effect or resource.
  const next={...unit};
  if(modifier==="reinforced"){
   next.hp=Math.ceil(next.hp*1.1);
   next.protection=Math.ceil(next.protection*1.1);
   next.maxProtection=next.protection;
  }
  let attack=next.physicalAttack;
  if(modifier==="rushed")attack=Math.ceil(attack*1.1);
  if(preparation==="cover")attack=Math.max(1,Math.floor(attack*.9));
  next.physicalAttack=attack;next.atk=attack;
  return next;
 }
 // Called ONLY for a persisted battle phase; returns one battle per wave.
 // Future waves are intentionally not passed to CombatCore because NET-001
 // checkpoints each wave separately and cannot resume an internal wave queue.
 function plan(state,{registry=Encounters.REGISTRY,npc=Npcs}={}){
  if(!Network.validState(state)||state.active?.phase!=="battle"||
   !plain(registry)||!npc)return null;
  const a=state.active,c=a.clue;
  if(!own(registry,c.encounterRef))return null;
  const d=registry[c.encounterRef];
  if(!validDefinition(d,npc)||!snapshotMatches(c,d.template))return null;
  const wave=d.formations[a.approach]?.[a.wave];
  if(!wave)return null;
  const first=[];
  for(let slot=0;slot<wave.length;slot++){
   const archetypeId=wave[slot];
   const instanceId="npc-net-"+c.id+"-w"+(a.wave+1)+"-s"+(slot+1);
   const fighter=npc.spawn(archetypeId,{instanceId,level:c.level,
    stars:1,gearTier:1,skillLevel:1});
   if(!fighter||fighter.side!=="enemy"||fighter.archetypeId!==archetypeId)return null;
   first.push(applyFixtureTuning(fighter,c.modifierId,a.preparation));
  }
  const seed=seedOf([state.seed,c.id,c.issuedAt,c.encounterRef,
   c.templateRevision,c.modifierId,a.preparation,a.approach,a.wave]);
  const binding=Object.freeze({clueId:c.id,issuedAt:c.issuedAt,revision:state.revision,
   encounterRef:c.encounterRef,templateId:c.templateId,
   templateRevision:c.templateRevision,approach:a.approach,
   preparation:a.preparation,wave:a.wave,seed});
  return {binding,first,futureWaves:[],options:{rngSeed:seed},
   intel:Object.freeze({priorityEnemyId:a.preparation==="survey"?first[0].id:null}),
   totalNetworkWaves:d.formations[a.approach].length};
 }
 function startBattle(state,allies,{combat,registry=Encounters.REGISTRY,npc=Npcs,leaderId=null}={}){
  const p=plan(state,{registry,npc});
  if(!p||!combat||typeof combat.createBattle!=="function"||
   !Array.isArray(allies)||allies.length<1||allies.length>5||
   allies.some(f=>!plain(f)||f.side!=="ally"||typeof f.id!=="string"||
    !f.id.length||!(f.hp>0))||
   new Set(allies.map(f=>f.id)).size!==allies.length||
   allies.some(f=>p.first.some(enemy=>enemy.id===f.id)))return null;
  try{
   const battle=combat.createBattle([...allies,...p.first],[],{
    ...p.options,...(leaderId===null?{}:{leaderId})
   });
   battle.networkBinding=p.binding;
   return {plan:p,battle};
  }catch(_){return null;}
 }
 // No scoring rule is invented here. NET-004/006 must supply the verified
 // per-wave/final score; an intermediate wave cannot award completion.
 function complete(state,battle,score=null,{registry=Encounters.REGISTRY,npc=Npcs}={}){
  const p=plan(state,{registry,npc});
  if(!p||!plain(battle)||!equal(battle.networkBinding,p.binding)||
   battle.active!==false||!["ally","enemy"].includes(battle.winner)||
   battle.totalWaves!==1||battle.wave!==1||
   !Array.isArray(battle.pendingWaves)||battle.pendingWaves.length!==0||
   !Array.isArray(battle.fighters))return null;
  const foes=battle.fighters.filter(f=>f?.side==="enemy");
  const friends=battle.fighters.filter(f=>f?.side==="ally");
  if(friends.length<1||friends.length>5||
   friends.some(f=>typeof f.id!=="string")||
   new Set(battle.fighters.map(f=>f?.id)).size!==battle.fighters.length||
   !equal(foes.map(f=>[f.id,f.archetypeId]),
    p.first.map(f=>[f.id,f.archetypeId]))||
   battle.fighters.length!==foes.length+friends.length)return null;
  const win=battle.winner==="ally";
  if(win?foes.some(f=>!(f.hp<=0))||!friends.some(f=>f.hp>0):
   friends.some(f=>f.hp>0))return null;
  const last=state.active.wave===p.totalNetworkWaves-1;
  if(!win&&score!==null)return null;
  if(win&&(last?(!integer(score)||score>100):score!==null))return null;
  return Network.battleOutcome(state,p.binding.clueId,p.binding.wave,win,
   win&&last?score:null);
 }
 return Object.freeze({validDefinition,validRegistry,plan,startBattle,complete});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkEncounterAdapter;
