/* NET-001: data contract only. No live content, balance, rewards or UI.
 * All numerical tuning and regional narrative content remain [ПРЕДЛОЖЕНИЕ].
 * NET-003 supplies encounter-backed templates; NET-006 approves values. */
const NetworkData=(()=>{
 "use strict";
 const TYPES=Object.freeze(["supply","trophies","recruit-intel","threat-trace"]);
 const ORDER_KINDS=Object.freeze(["type","region","material","hero"]);
 const id=x=>typeof x==="string"&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(x);
 const plain=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
 const exact=(x,keys)=>plain(x)&&Object.keys(x).length===keys.length&&
  Object.keys(x).every(k=>keys.includes(k));
 const integer=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
 const unique=items=>new Set(items).size===items.length;
 const optionalId=x=>x===null||id(x);
 function validRegion(r){
  return exact(r,["id","name","unlockRef"])&&id(r.id)&&
   typeof r.name==="string"&&r.name.trim().length>0&&r.name.length<=120&&
   optionalId(r.unlockRef);
 }
 function validApproach(a){
  return exact(a,["id","waves"])&&id(a.id)&&integer(a.waves,1)&&a.waves<=16;
 }
 function validTemplate(t,regions){
  const keys=["id","revision","regionId","type","weight","minInfluence","levels",
   "preparationIds","approaches","modifierIds","materialId","heroId",
   "threatTag","rewardRef","encounterRef"];
  return exact(t,keys)&&id(t.id)&&integer(t.revision,1)&&
   regions.includes(t.regionId)&&TYPES.includes(t.type)&&integer(t.weight,1)&&
   integer(t.minInfluence)&&Array.isArray(t.levels)&&t.levels.length>0&&
   t.levels.length<=32&&t.levels.every(n=>integer(n,1)&&n<=1000)&&
   unique(t.levels)&&Array.isArray(t.preparationIds)&&
   t.preparationIds.length>0&&t.preparationIds.length<=16&&
   t.preparationIds.every(id)&&unique(t.preparationIds)&&
   Array.isArray(t.approaches)&&t.approaches.length>0&&
   t.approaches.length<=16&&t.approaches.every(validApproach)&&
   unique(t.approaches.map(a=>a.id))&&Array.isArray(t.modifierIds)&&
   t.modifierIds.length<=32&&t.modifierIds.every(id)&&unique(t.modifierIds)&&
   optionalId(t.materialId)&&optionalId(t.heroId)&&optionalId(t.threatTag)&&
   id(t.rewardRef)&&id(t.encounterRef)&&
   (t.type!=="recruit-intel"||t.heroId!==null)&&
   (t.type!=="threat-trace"||t.threatTag!==null);
 }
 function validateCatalog(c){
  if(!exact(c,["version","regions","templates"])||c.version!==1||
   !Array.isArray(c.regions)||!Array.isArray(c.templates)||
   c.regions.length>100||c.templates.length>2000||
   !c.regions.every(validRegion)||!unique(c.regions.map(r=>r.id)))return false;
  const regions=c.regions.map(r=>r.id);
  return c.templates.every(t=>validTemplate(t,regions))&&
   unique(c.templates.map(t=>t.id));
 }
 function buildCatalog(input){
  if(!validateCatalog(input))return null;
  const value=JSON.parse(JSON.stringify(input));
  for(const r of value.regions)Object.freeze(r);
  for(const t of value.templates){
   Object.freeze(t.levels);Object.freeze(t.preparationIds);Object.freeze(t.modifierIds);
   t.approaches.forEach(Object.freeze);Object.freeze(t.approaches);Object.freeze(t);
  }
  Object.freeze(value.regions);Object.freeze(value.templates);
  return Object.freeze(value);
 }
 function matchesOrder(t,order){
  if(!t||!order||!ORDER_KINDS.includes(order.kind))return false;
  if(order.kind==="type")return t.type===order.targetId;
  if(order.kind==="region")return t.regionId===order.targetId;
  if(order.kind==="material")return t.materialId===order.targetId;
  return t.heroId===order.targetId;
 }
 function eligibleTemplates(c,unlockedRegions,influence={}){
  if(!validateCatalog(c)||!Array.isArray(unlockedRegions)||
   !unlockedRegions.every(id)||!unique(unlockedRegions))return null;
  const regionIds=new Set(c.regions.map(r=>r.id));
  if(unlockedRegions.some(x=>!regionIds.has(x)))return null;
  if(!plain(influence)||Object.values(influence).some(v=>!integer(v)))return null;
  return c.templates.filter(t=>unlockedRegions.includes(t.regionId)&&
   (influence[t.regionId]??0)>=t.minInfluence).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 }
 // NET-003 [ПРЕДЛОЖЕНИЕ]: isolated, noncanonical encounter fixtures.
 // Not referenced by the runtime CATALOG; not approved for payouts or release.
 // All levels, weights, approaches and modifiers are testing-only assumptions.
 const draft=(id,type,encounterRef,extra={})=>({
  id,revision:1,regionId:"gardens-over-abyss",type,weight:1,minInfluence:0,
  levels:[1,2],preparationIds:["survey","cover"],
  approaches:[{id:"quiet",waves:1},{id:"cordon",waves:2}],
  modifierIds:["reinforced","rushed"],
  materialId:null,heroId:null,threatTag:null,
  rewardRef:"net-proposal-no-payout-"+id,
  encounterRef,...extra
 });
 const PROPOSAL_CATALOG=buildCatalog({version:1,regions:[
  {id:"gardens-over-abyss",name:"Сады над пропастью",unlockRef:null}
 ],templates:[
  draft("net-route-watch","supply","net-gardens-route-v1"),
  draft("net-lost-cargo","trophies","net-gardens-cargo-v1"),
  draft("net-watch-trace","threat-trace","net-gardens-watch-v1",
   {threatTag:"net-proposal-trace"})
 ]});
 // [ПРЕДЛОЖЕНИЕ]: the first region identifier follows NETWORK-001.
 // Its narrative content and playable templates belong to NET-003 / canon review.
 const CATALOG=buildCatalog({version:1,regions:[
  {id:"gardens-over-abyss",name:"Сады над пропастью",unlockRef:null}
 ],templates:[]});
 // NET-007: all content reuses existing Garden encounters, NPCs and roster IDs.
 // Economic tiers are a trial balance, not new world canon.
 const materialIds=["Fe","Le","Cl","Wo","Fa","Th","Gl"];
 const heroIds=["ren","nada","liora","art","sava"];
 const tiers=[
  {id:"early",level:1,influence:0},
  {id:"middle",level:20,influence:50},
  {id:"late",level:45,influence:150}
 ];
 const liveTemplates=[];
 for(const tier of tiers){
  for(const materialId of materialIds){
   const ref="net07-s-"+materialId.toLowerCase()+"-"+tier.id;
   liveTemplates.push({
    id:ref,revision:1,regionId:"gardens-over-abyss",type:"supply",
    weight:1,minInfluence:tier.influence,levels:[tier.level],
    preparationIds:["survey","cover"],approaches:[
     {id:"quiet",waves:1},{id:"cordon",waves:2}],
    modifierIds:[],materialId,heroId:null,
    threatTag:null,rewardRef:"reward-"+ref,encounterRef:"encounter-"+ref
   });
  }
  for(const heroId of heroIds){
   const ref="net07-r-"+heroId+"-"+tier.id;
   liveTemplates.push({
    id:ref,revision:1,regionId:"gardens-over-abyss",type:"recruit-intel",
    weight:1,minInfluence:tier.influence,levels:[tier.level],
    preparationIds:["survey","cover"],approaches:[
     {id:"quiet",waves:1},{id:"cordon",waves:2}],
    modifierIds:[],materialId:null,heroId,
    threatTag:null,rewardRef:"reward-"+ref,encounterRef:"encounter-"+ref
   });
  }
 }
 const LIVE_CATALOG=buildCatalog({version:1,regions:[
  {id:"gardens-over-abyss",name:"Сады над пропастью",unlockRef:null}
 ],templates:liveTemplates});
 return Object.freeze({TYPES,ORDER_KINDS,CATALOG,LIVE_CATALOG,validateCatalog,buildCatalog,
  matchesOrder,eligibleTemplates,PROPOSAL_CATALOG});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkData;
