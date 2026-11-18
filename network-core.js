/* NET-001: isolated deterministic network state machine.
 * No DOM, wallet, energy, reward payout, battle effects or Date.now().
 * Tuning is injected and must be approved separately in NET-006.
 * Browser persistence MUST use the existing ProgressWriterCore ownership lock. */
const NetworkCore=(()=>{
 "use strict";
 const Data=typeof NetworkData!=="undefined"?NetworkData:require("./network-data.js");
 const Rng=typeof BattleRng!=="undefined"?BattleRng:require("./battle-rng.js");
 const KEY="ashes-throne.network.v1",VERSION=1;
 const UINT32_MAX=0xffffffff,MAX_ROWS=10000;
 const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 const plain=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
 const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
  Object.keys(x).every(k=>keys.includes(k));
 const int=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
 const id=x=>typeof x==="string"&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(x);
 const maybeId=x=>x===null||id(x);
 const unique=xs=>new Set(xs).size===xs.length;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const PHASES=Object.freeze(["brief","approach","battle","result"]);
 const CONFIG_KEYS=["id","capacity","intervalMs","guaranteeAfter","focusWeight","masteryScore"];
 const CLUE_KEYS=["id","issuedAt","templateId","templateRevision","regionId","type","level",
  "modifierId","materialId","heroId","threatTag","rewardRef","encounterRef",
  "preparationIds","approaches"];
 const STATE_KEYS=["version","config","revision","seed","clockAt","nextClueId",
  "nextCompletionId","board","order","active","mastery","influence","threatIntel","completed"];
 function validConfig(c){
  return exact(c,CONFIG_KEYS)&&id(c.id)&&int(c.capacity,1)&&c.capacity<=1000&&
   int(c.intervalMs,1)&&int(c.guaranteeAfter,1)&&c.guaranteeAfter<=1000&&
   int(c.focusWeight,1)&&c.focusWeight<=1000&&
   int(c.masteryScore)&&c.masteryScore<=100;
 }
 function validClue(c){
  return exact(c,CLUE_KEYS)&&int(c.id,1)&&int(c.issuedAt)&&id(c.templateId)&&
   int(c.templateRevision,1)&&id(c.regionId)&&Data.TYPES.includes(c.type)&&
   int(c.level,1)&&c.level<=1000&&maybeId(c.modifierId)&&
   maybeId(c.materialId)&&maybeId(c.heroId)&&maybeId(c.threatTag)&&
   id(c.rewardRef)&&id(c.encounterRef)&&
   Array.isArray(c.preparationIds)&&c.preparationIds.length>0&&
   c.preparationIds.length<=16&&c.preparationIds.every(id)&&unique(c.preparationIds)&&
   Array.isArray(c.approaches)&&c.approaches.length>0&&
   c.approaches.length<=16&&c.approaches.every(a=>
    exact(a,["id","waves"])&&id(a.id)&&int(a.waves,1)&&a.waves<=16)&&
   unique(c.approaches.map(a=>a.id));
 }
 function validOrder(o,c){
  return o===null||(exact(o,["kind","targetId","misses"])&&
   Data.ORDER_KINDS.includes(o.kind)&&id(o.targetId)&&
   int(o.misses)&&o.misses<c.guaranteeAfter);
 }
 function validActive(a){
  if(a===null)return true;
  if(!exact(a,["clue","phase","preparation","approach","wave","score"])||
   !validClue(a.clue)||!PHASES.includes(a.phase)||
   (a.preparation!==null&&!a.clue.preparationIds.includes(a.preparation))||
   (a.approach!==null&&!a.clue.approaches.some(x=>x.id===a.approach))||
   !int(a.wave)||(a.score!==null&&(!int(a.score)||a.score>100)))return false;
  if(a.phase==="brief")return a.preparation===null&&a.approach===null&&a.wave===0&&a.score===null;
  if(a.phase==="approach")return a.preparation!==null&&a.approach===null&&a.wave===0&&a.score===null;
  const waves=a.clue.approaches.find(x=>x.id===a.approach)?.waves;
  if(a.preparation===null||!waves)return false;
  if(a.phase==="battle")return a.wave<waves&&a.score===null;
  return a.wave===waves&&a.score!==null;
 }
 function validCompleted(e){
  return exact(e,["serial","clueId","templateId","level","regionId","score",
   "rewardRef","kind","status"])&&int(e.serial,1)&&int(e.clueId,1)&&
   id(e.templateId)&&int(e.level,1)&&e.level<=1000&&id(e.regionId)&&
   int(e.score)&&e.score<=100&&id(e.rewardRef)&&e.kind==="manual"&&e.status==="done";
 }
 function validMap(m,keys){
  return plain(m)&&Object.keys(m).length<=MAX_ROWS&&
   Object.keys(m).every(k=>keys.test(k)&&int(m[k]));
 }
 function validState(s){
  if(!exact(s,STATE_KEYS)||s.version!==VERSION||!validConfig(s.config)||
   !int(s.revision)||!int(s.seed)||s.seed>UINT32_MAX||!int(s.clockAt)||
   !int(s.nextClueId,1)||!int(s.nextCompletionId,1)||
   !Array.isArray(s.board)||s.board.length>s.config.capacity+(s.active===null?1:0)||
   !s.board.every(validClue)||!validOrder(s.order,s.config)||!validActive(s.active)||
   !validMap(s.mastery,/^[a-z0-9][a-z0-9._-]{0,79}\|[1-9][0-9]*$/)||
   !validMap(s.influence,/^[a-z0-9][a-z0-9._-]{0,79}$/)||
   !validMap(s.threatIntel,/^[a-z0-9][a-z0-9._-]{0,79}$/)||
   !Array.isArray(s.completed)||s.completed.length>MAX_ROWS||
   !s.completed.every(validCompleted)||s.nextCompletionId!==s.completed.length+1)
   return false;
  const clues=[...s.board,...(s.active?[s.active.clue]:[])];
  if(!unique(clues.map(x=>x.id))||clues.some(x=>x.id>=s.nextClueId))return false;
  if(s.completed.some((x,i)=>x.serial!==i+1||x.clueId>=s.nextClueId))return false;
  if(!unique([...clues.map(x=>x.id),...s.completed.map(x=>x.clueId)]))return false;
  if(s.order&&s.order.kind==="type"&&!Data.TYPES.includes(s.order.targetId))return false;
  return true;
 }
 function fresh(seed,now,config,catalog=Data.CATALOG){
  if(!int(seed)||seed>UINT32_MAX||!int(now)||!validConfig(config)||
   !Data.validateCatalog(catalog))return null;
  return {version:VERSION,config:clone(config),revision:0,seed,clockAt:now,
   nextClueId:1,nextCompletionId:1,board:[],order:null,active:null,
   mastery:{},influence:{},threatIntel:{},completed:[]};
 }
 // Fixed hash over serialization: stable regardless of reload or table ordering.
 function hash32(input){
  let h=2166136261;
  for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
 }
 function draw(seed,serial,salt,order,misses,unlocked,influence){
  const composed=JSON.stringify([seed,serial,salt,order,misses,
   unlocked.slice().sort(),Object.keys(influence).sort().map(k=>[k,influence[k]])]);
  const rng={rng:Rng.create(hash32(composed))};
  return Rng.roll(rng,100).value;
 }
 function chooseWeighted(rows,roll,weight){
  const total=rows.reduce((n,t)=>n+weight(t),0);
  if(!Number.isSafeInteger(total)||total<=0)return null;
  let mark=roll*total;
  for(const t of rows){mark-=weight(t);if(mark<0)return t;}
  return rows[rows.length-1];
 }
 function available(s,catalog,unlocked){
  return Data.eligibleTemplates(catalog,unlocked,s.influence);
 }
 function setOrder(s,order,catalog,unlocked){
  if(!validState(s)||!Data.validateCatalog(catalog))return null;
  if(order===null)return {...clone(s),order:null};
  if(!exact(order,["kind","targetId"])||!Data.ORDER_KINDS.includes(order.kind)||
   !id(order.targetId))return null;
  const pool=available(s,catalog,unlocked);
  if(!pool||!pool.some(t=>Data.matchesOrder(t,order)))return null;
  if(s.order?.kind===order.kind&&s.order.targetId===order.targetId)return clone(s);
  return {...clone(s),order:{...order,misses:0}};
 }
 function generate(s,pool,unlocked,issuedAt){
  const order=s.order;
  const matches=order?pool.filter(t=>Data.matchesOrder(t,order)):[];
  if(order&&!matches.length)return null; // no silent loss of guarantee
  const forced=order&&order.misses+1>=s.config.guaranteeAfter;
  const rows=forced?matches:pool;
  const weight=t=>t.weight*(order&&Data.matchesOrder(t,order)?s.config.focusWeight:1);
  const template=chooseWeighted(rows,draw(s.seed,s.nextClueId,"template",order,
   order?.misses??0,unlocked,s.influence),weight);
  if(!template)return null;
  const rollLevel=draw(s.seed,s.nextClueId,"level",order,
   order?.misses??0,unlocked,s.influence);
  const rollModifier=draw(s.seed,s.nextClueId,"modifier",order,
   order?.misses??0,unlocked,s.influence);
  const level=template.levels[Math.floor(rollLevel*template.levels.length)];
  const modifierId=template.modifierIds.length?
   template.modifierIds[Math.floor(rollModifier*template.modifierIds.length)]:null;
  const clue={id:s.nextClueId,issuedAt,templateId:template.id,
   templateRevision:template.revision,regionId:template.regionId,
   type:template.type,level,modifierId,materialId:template.materialId,
   heroId:template.heroId,threatTag:template.threatTag,
   rewardRef:template.rewardRef,encounterRef:template.encounterRef,
   preparationIds:template.preparationIds.slice(),
   approaches:template.approaches.map(a=>({...a}))};
  return {clue,hit:!!order&&Data.matchesOrder(template,order)};
 }
 function accrue(state,now,catalog,unlocked){
  if(!validState(state)||!int(now)||!Data.validateCatalog(catalog))return null;
  const next=clone(state);
  if(now<=next.clockAt)return next; // backwards clock cannot give additional clues
  if(next.board.length>=next.config.capacity){next.clockAt=now;return next;}
  const pool=available(next,catalog,unlocked);
  if(pool===null)return null;
  if(!pool.length)return next; // no playable content in NET-001's empty catalog
  if(next.order&&!pool.some(t=>Data.matchesOrder(t,next.order)))return null;
  const elapsed=now-next.clockAt;
  const ticks=Math.floor(elapsed/next.config.intervalMs);
  if(ticks<=0)return next;
  const amount=Math.min(ticks,next.config.capacity-next.board.length);
  if(next.nextClueId+amount>Number.MAX_SAFE_INTEGER)return null;
  for(let i=0;i<amount;i++){
   const eventAt=next.clockAt+(i+1)*next.config.intervalMs;
   const generated=generate(next,pool,unlocked,eventAt);
   if(!generated)return null;
   next.board.push(generated.clue);
   next.nextClueId++;
   if(next.order)next.order.misses=generated.hit?0:next.order.misses+1;
  }
  // Skip accrued time while full. No unbounded offline backlog or expiry.
  next.clockAt=next.board.length>=next.config.capacity?
   now:next.clockAt+ticks*next.config.intervalMs;
  return validState(next)?next:null;
 }
 function start(s,clueId){
  if(!validState(s)||s.active!==null||!int(clueId,1))return null;
  const i=s.board.findIndex(x=>x.id===clueId);
  if(i<0)return null;
  const next=clone(s),[clue]=next.board.splice(i,1);
  next.active={clue,phase:"brief",preparation:null,approach:null,wave:0,score:null};
  return validState(next)?next:null;
 }
 function prepare(s,choice){
  if(!validState(s)||s.active?.phase!=="brief"||
   !s.active.clue.preparationIds.includes(choice))return null;
  const next=clone(s);next.active.phase="approach";next.active.preparation=choice;
  return next;
 }
 function approach(s,choice){
  if(!validState(s)||s.active?.phase!=="approach"||
   !s.active.clue.approaches.some(x=>x.id===choice))return null;
  const next=clone(s);next.active.phase="battle";next.active.approach=choice;
  return next;
 }
 function battleOutcome(s,clueId,wave,win,score=null){
  if(!validState(s)||s.active?.phase!=="battle"||
   s.active.clue.id!==clueId||s.active.wave!==wave||typeof win!=="boolean")return null;
  if(!win)return restoreClue(s);
  const next=clone(s);
  const total=next.active.clue.approaches.find(a=>a.id===next.active.approach).waves;
  next.active.wave++;
  if(next.active.wave===total){
   if(!int(score)||score>100)return null;
   next.active.phase="result";next.active.score=score;
  }else if(score!==null)return null;
  return validState(next)?next:null;
 }
 // Abandonment and defeat both preserve the COMPLETE original clue.
 // A full board may overflow by exactly one when a running clue is returned.
 function restoreClue(s){
  if(!validState(s)||s.active===null)return null;
  const next=clone(s);
  next.board.push(next.active.clue);
  next.board.sort((a,b)=>a.id-b.id);
  next.active=null;
  return validState(next)?next:null;
 }
 function abandon(s){
  if(!validState(s)||s.active===null||s.active.phase==="result")return null;
  return restoreClue(s);
 }
 function finish(s){
  if(!validState(s)||s.active?.phase!=="result"||
   s.completed.length>=MAX_ROWS||s.nextCompletionId===Number.MAX_SAFE_INTEGER)return null;
  const next=clone(s),a=next.active,c=a.clue;
  next.completed.push({serial:next.nextCompletionId++,clueId:c.id,
   templateId:c.templateId,level:c.level,regionId:c.regionId,
   score:a.score,rewardRef:c.rewardRef,kind:"manual",status:"done"});
  const key=c.templateId+"|"+c.level;
  next.mastery[key]=Math.max(next.mastery[key]??0,a.score);
  const influence=next.influence[c.regionId]??0;
  if(influence===Number.MAX_SAFE_INTEGER)return null;
  next.influence[c.regionId]=influence+1;next.active=null;
  return validState(next)?next:null;
 }
 function isMastered(s,templateId,level){
  if(!validState(s)||!id(templateId)||!int(level,1))return false;
  return (s.mastery[templateId+"|"+level]??-1)>=s.config.masteryScore;
 }
 function load(storageProvider,{seed,now,config,catalog=Data.CATALOG}={}){
  const create=()=>fresh(seed,now,config,catalog);
  try{
   const store=storageProvider?.();
   if(!store)return {status:"blocked",blocked:true,reason:"storage-unavailable",state:null};
   const raw=store.getItem(KEY);
   if(raw===null){
    const state=create();
    return state?{status:"fresh",state,blocked:false}:
     {status:"blocked",blocked:true,reason:"invalid-new-profile-settings",state:null};
   }
   const parsed=JSON.parse(raw);
   if(!validState(parsed))return {status:"blocked",blocked:true,reason:"invalid-network-v1",state:null};
   if(config&&(!validConfig(config)||CONFIG_KEYS.some(key=>parsed.config[key]!==config[key])))
    return {status:"blocked",blocked:true,reason:"incompatible-configuration",state:null};
   return {status:"existing",state:clone(parsed),blocked:false};
  }catch(_){return {status:"blocked",blocked:true,reason:"read-or-parse-failed",state:null};}
 }
 function save(s,storageProvider,ownsLock){
  // Only the active wallet writer may mutate the network key. The caller
  // MUST acquire and retain ProgressWriterCore ownership before invoking.
  if(!validState(s)||typeof ownsLock!=="function")return {ok:false,blocked:true,reason:"invalid-or-no-lock"};
  try{
   if(ownsLock()!==true)return {ok:false,blocked:true,reason:"not-writer"};
   const store=storageProvider?.();
   if(!store)return {ok:false,blocked:true,reason:"storage-unavailable"};
   const current=store.getItem(KEY);
   if(current===null){
    if(s.revision!==0)return {ok:false,blocked:true,reason:"stale-revision"};
   }else{
    const prior=JSON.parse(current);
    if(!validState(prior))return {ok:false,blocked:true,reason:"invalid-stored-network"};
    if(prior.revision!==s.revision)return {ok:false,blocked:true,reason:"stale-revision"};
   }
   if(s.revision===Number.MAX_SAFE_INTEGER)return {ok:false,blocked:true,reason:"revision-exhausted"};
   const committed=clone(s);committed.revision++;
   const encoded=JSON.stringify(committed);
   if(ownsLock()!==true)return {ok:false,blocked:true,reason:"writer-lost"};
   store.setItem(KEY,encoded);
   if(store.getItem(KEY)!==encoded)return {ok:false,blocked:true,reason:"readback-mismatch"};
   return {ok:true,blocked:false,state:committed};
  }catch(_){return {ok:false,blocked:true,reason:"uncertain-storage-write"};}
 }
 return Object.freeze({KEY,VERSION,PHASES,validConfig,validClue,validState,
  fresh,setOrder,accrue,start,prepare,approach,battleOutcome,abandon,finish,
  isMastered,load,save});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkCore;
