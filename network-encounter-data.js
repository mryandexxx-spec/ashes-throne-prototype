/* NET-003 [ПРЕДЛОЖЕНИЕ]: noncanonical Garden encounter fixtures.
 * Only existing human NPC archetypes; no new species, factions, plot or drops.
 * Encounter refs are immutable versioned IDs: retain old entries for saved clues.
 * Not imported by index.html/game.js and not part of NetworkData.CATALOG.
 */
const NetworkEncounterData=(()=>{
 "use strict";
 const Network=typeof NetworkData!=="undefined"?NetworkData:require("./network-data.js");
 const templates=Network.PROPOSAL_CATALOG.templates;
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
 const REGISTRY=Object.freeze(Object.fromEntries(raw.map(entry=>{
  const template=byId[entry.id];
  if(!template)throw Error("NET003_MISSING_TEMPLATE");
  const formations={};
  for(const [key,waves] of Object.entries(entry.formations)){
   formations[key]=Object.freeze(waves.map(wave=>Object.freeze(wave.slice())));
  }
  const definition=Object.freeze({template,formations:Object.freeze(formations)});
  return [template.encounterRef,definition];
 })));
 return Object.freeze({REGISTRY});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkEncounterData;
