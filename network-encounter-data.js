/* NET-003 [ПРЕДЛОЖЕНИЕ]: noncanonical Garden encounter fixtures.
 * Only existing human NPC archetypes; no new species, factions, plot or drops.
 * Encounter refs are immutable versioned IDs: retain old entries for saved clues.
 * Not imported by index.html/game.js and not part of NetworkData.CATALOG.
 */
const NetworkEncounterData=(()=>{
 "use strict";
 const Network=typeof NetworkData!=="undefined"?NetworkData:require("./network-data.js");
 const templates=[...Network.PROPOSAL_CATALOG.templates,...Network.LIVE_CATALOG.templates];
 const byId=Object.fromEntries(templates.map(t=>[t.id,t]));
 const raw=[
  {id:"net-route-watch",formations:{
   quiet:[["npc-pass-guard","npc-trail-interceptor"]],
   cordon:[["npc-pass-guard"],["npc-trail-interceptor","npc-ridge-slinger"]]}},
  {id:"net-lost-cargo",formations:{
   quiet:[["npc-ridge-slinger","npc-field-medic"]],
   cordon:[["npc-ridge-slinger","npc-pass-guard"],["npc-field-medic"]]}},
  {id:"net-watch-trace",formations:{
   quiet:[["npc-route-signaller","npc-watch-captain"]],
   cordon:[["npc-route-signaller","npc-trail-interceptor"],["npc-watch-captain"]]}}
 ];
 const fixtures=Object.fromEntries(raw.map(x=>[x.id,x.formations]));
 const REGISTRY=Object.freeze(Object.fromEntries(templates.map(template=>{
  const fixtureId=fixtures[template.id]?template.id:
   template.type==="recruit-intel"?"net-lost-cargo":"net-route-watch";
  const source=fixtures[fixtureId];
  if(!source)throw Error("NET007_MISSING_FORMATION");
  const formations={};
  for(const [key,waves] of Object.entries(source))
   formations[key]=Object.freeze(waves.map(wave=>Object.freeze(wave.slice())));
  return [template.encounterRef,Object.freeze({template,formations:Object.freeze(formations)})];
 })));
 return Object.freeze({REGISTRY});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkEncounterData;
