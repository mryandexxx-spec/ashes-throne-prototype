/* Combat-005: presentation-only animation catalog.
   Every fighter can override a slot independently. Missing slots use templates.
   Future model/AnimationGroup adapters may read asset/clip IDs from resolved entries. */
const AnimationProfiles=(()=>{
 "use strict";
 const SLOTS=Object.freeze(["idle","basic","special","powerful","passive","leader","guard","ward","hit","death"]);
 const templates=Object.freeze({
  idle:Object.freeze({kind:"idle",durationMs:1200,amplitude:.055}),
  basic:Object.freeze({kind:"lunge",durationMs:200,amplitude:.55}),
  special:Object.freeze({kind:"lunge",durationMs:200,amplitude:.7}),
  powerful:Object.freeze({kind:"lunge",durationMs:420,amplitude:.85}),
  passive:Object.freeze({kind:"ward",durationMs:280,amplitude:.22}),
  leader:Object.freeze({kind:"ward",durationMs:360,amplitude:.3}),
  guard:Object.freeze({kind:"guard",durationMs:190,amplitude:.32}),
  ward:Object.freeze({kind:"ward",durationMs:140,amplitude:.25}),
  hit:Object.freeze({kind:"hit",durationMs:120,amplitude:.18}),
  death:Object.freeze({kind:"death",durationMs:400,amplitude:.85})
 });
 const overrides=new Map();
 function register(heroId,slots){
  if(typeof heroId!=="string"||!heroId.trim()||!slots||typeof slots!=="object"||Array.isArray(slots))
   throw Error("Invalid character animation profile");
  const resolved={};
  for(const [slot,definition] of Object.entries(slots)){
   if(!SLOTS.includes(slot)||!definition||typeof definition!=="object"||
      !Number.isFinite(definition.durationMs)||definition.durationMs<=0||
      typeof definition.kind!=="string"||
      !["idle","lunge","guard","ward","hit","death"].includes(definition.kind)||
      !Number.isFinite(definition.amplitude)||definition.amplitude<0||
      ((definition.assetId!==undefined||definition.clipName!==undefined)&&
       (typeof definition.assetId!=="string"||!definition.assetId.trim()||
        typeof definition.clipName!=="string"||!definition.clipName.trim())))
    throw Error("Invalid animation slot: "+slot);
   resolved[slot]=Object.freeze({...definition});
  }
  overrides.set(heroId,Object.freeze(resolved));
 }
 function resolve(heroId,slot){
  if(!SLOTS.includes(slot))return null;
  const custom=overrides.get(heroId)?.[slot];
  return custom||templates[slot];
 }
 function isCustom(heroId,slot){return !!overrides.get(heroId)?.[slot];}
 return Object.freeze({slots:SLOTS,register,resolve,isCustom});
})();
