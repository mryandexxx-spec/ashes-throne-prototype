/* NET-007: playable, temporary balance B for the Garden network.
 * Only this fixed, authored catalog can supply serial wallet reward sources. */
const NetworkLiveEconomy=(()=>{
 "use strict";
 const Data=typeof NetworkData!=="undefined"?NetworkData:require("./network-data.js");
 const TIERS=Object.freeze({
  early:Object.freeze({currency:1000,xp:110,materials:8,shards:6}),
  middle:Object.freeze({currency:1800,xp:175,materials:12,shards:6}),
  late:Object.freeze({currency:2700,xp:315,materials:18,shards:6})
 });
 const sources=Object.fromEntries(Data.LIVE_CATALOG.templates.map(t=>{
  const tier=t.id.split("-").at(-1);
  const values=TIERS[tier];
  if(!values)throw Error("NET007_UNKNOWN_REWARD_TIER");
  const mats=t.materialId?{[t.materialId]:values.materials}:{};
  const heroShards=t.heroId?{[t.heroId]:values.shards}:{};
  const source=Object.freeze({
   sourceId:t.rewardRef,kind:"serial",energyCost:0,
   reward:Object.freeze({currency:values.currency,accountXp:values.xp,
    materials:Object.freeze(mats),heroShards:Object.freeze(heroShards)})
  });
  return [t.rewardRef,source];
 }));
 const SOURCES=Object.freeze(sources);
 function source(ref){return SOURCES[ref]??null;}
 function preview(ref){
  const s=source(ref);
  return s?Object.freeze({...s.reward}):null;
 }
 return Object.freeze({TIERS,SOURCES,source,preview});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkLiveEconomy;
