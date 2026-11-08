/* Stats-001D0: opt-in, deterministic combat random stream.
   No gameplay rolls are performed until Stats-001D1/2 is approved. */
const BattleRng=(()=>{
 "use strict";
 const UINT32_MAX=0xffffffff, MODULUS=0x100000000;
 const MULTIPLIER=1664525, INCREMENT=1013904223;
 function validSeed(seed){
  return Number.isInteger(seed)&&seed>=0&&seed<=UINT32_MAX;
 }
 function validState(rng){
  return rng&&typeof rng==="object"&&
   validSeed(rng.seed)&&validSeed(rng.state)&&
   Number.isSafeInteger(rng.draws)&&rng.draws>=0;
 }
 function create(seed){
  if(!validSeed(seed))throw RangeError("Battle RNG requires a uint32 seed");
  return {seed,state:seed,draws:0};
 }
 function restore(snapshot){
  if(!validState(snapshot))throw RangeError("Invalid battle RNG snapshot");
  return {seed:snapshot.seed,state:snapshot.state,draws:snapshot.draws};
 }
 function snapshot(battle){
  if(!validState(battle?.rng))throw RangeError("Missing or invalid battle RNG");
  return restore(battle.rng);
 }
 function roll(battle,chance){
  // Validate all inputs before advancing the random sequence.
  if(!validState(battle?.rng))throw RangeError("Missing or invalid battle RNG");
  if(!Number.isFinite(chance)||chance<0||chance>100)
   throw RangeError("Chance must be a percentage in [0, 100]");
  if(battle.rng.draws===Number.MAX_SAFE_INTEGER)
   throw RangeError("Battle RNG draw counter overflow");
  const next=(Math.imul(battle.rng.state,MULTIPLIER)+INCREMENT)>>>0;
  const fraction=next/MODULUS;
  battle.rng.state=next;
  battle.rng.draws++;
  // Even 0% and 100% consume one draw. Do not change this in future combat.
  return Object.freeze({hit:fraction*100<chance,value:fraction,draw:battle.rng.draws});
 }
 return Object.freeze({create,restore,snapshot,roll});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=BattleRng;
