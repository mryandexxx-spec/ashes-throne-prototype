/* Combat-004B: shared battle presentation speed, separate from initiative and damage.
   Later animation drivers can read multiplier() or duration(baseMs). */
const BattleSpeed=(()=>{
 "use strict";
 const LEVELS=Object.freeze([1,2,4]);
 let current=1;
 function get(){return current;}
 function set(value){
  if(!LEVELS.includes(value))return false;
  current=value;
  return true;
 }
 function next(){
  current=LEVELS[(LEVELS.indexOf(current)+1)%LEVELS.length];
  return current;
 }
 function reset(){current=1;return current;}
 // Scales a presentation duration, not the combat simulation clock.
 function duration(baseMs){
  if(!Number.isFinite(baseMs)||baseMs<0)throw Error("Invalid battle presentation duration");
  return baseMs===0?0:Math.max(1,Math.round(baseMs/current));
 }
 // Standard playback-rate hook for future Babylon animation groups and effects.
 function multiplier(){return current;}
 return Object.freeze({levels:LEVELS,get,set,next,reset,duration,multiplier});
})();
