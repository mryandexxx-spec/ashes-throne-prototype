/* REN-COMBAT-A [TEST FOUNDATION]. Declarative temporary statuses; no gameplay wiring.
 * Strength/duration are caller parameters, NOT approved hero balance.
 * Does not mutate base fighter speed/resistance or existing combat.effects. */
const CombatStatusCore=(()=>{
 "use strict";
 const KINDS=Object.freeze(["slowed","debuff-resistance-down","read-move"]);
 const TYPES=new Set(KINDS);
 const validFighter=f=>f&&typeof f==="object"&&!Array.isArray(f);
 const validStatus=f=>validFighter(f)&&validFighter(f.renStatuses);
 const num=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=100;
 function read(f,type){
  if(!TYPES.has(type)||!validStatus(f))return null;
  const entry=f.renStatuses[type];
  if(type==="read-move")return entry&&Number.isSafeInteger(entry.remaining)&&
    entry.remaining>0&&Number.isSafeInteger(entry.stacks)&&entry.stacks>=1&&entry.stacks<=4
     ?Object.freeze({remaining:entry.remaining,stacks:entry.stacks}):null;
  return entry&&Number.isSafeInteger(entry.remaining)&&entry.remaining>0&&num(entry.amount)
    ?Object.freeze({remaining:entry.remaining,amount:entry.amount}):null;
 }
 function apply(f,type,amount,turns){
  if(!validFighter(f)||!TYPES.has(type)||type==="read-move"||!num(amount)||
     !Number.isSafeInteger(turns)||turns<1) return false;
  if(f.renStatuses!==undefined&&!validStatus(f))return false;
  const old=read(f,type);
  // Non-stacking: stronger amount wins, duration refreshes without doubling.
  const next={amount:Math.max(amount,old?.amount??0),
    remaining:Math.max(turns,old?.remaining??0)};
  if(!f.renStatuses)f.renStatuses=Object.create(null);
  f.renStatuses[type]=next;
  return true;
 }
 // CHAR-002B: one observable, stacking tactical read, not a magical mark.
 function applyReadMove(f,stacks,turns){
  if(!validFighter(f)||!Number.isSafeInteger(stacks)||stacks<1||stacks>4||
     !Number.isSafeInteger(turns)||turns<1||
     (f.renStatuses!==undefined&&!validStatus(f)))return false;
  const old=read(f,"read-move");
  if(!f.renStatuses)f.renStatuses=Object.create(null);
  f.renStatuses["read-move"]={stacks:Math.min(4,(old?.stacks??0)+stacks),
   remaining:Math.max(turns,old?.remaining??0)};
  return true;
 }
 // Spend exactly 3 charges only when a prepared ability is actually disrupted.
 function spendReadMove(f,count){
  const old=read(f,"read-move");
  if(!old||!Number.isSafeInteger(count)||count<1||old.stacks<count)return false;
  const remaining=old.stacks-count;
  if(remaining===0)delete f.renStatuses["read-move"];
  else f.renStatuses["read-move"]={stacks:remaining,remaining:old.remaining};
  return true;
 }
 function tickOwnTurn(f){
  if(!validFighter(f)||f.renStatuses===undefined&&!validStatus(f))return false;
  if(!validStatus(f))return false;
  for(const type of KINDS){
   const s=read(f,type);
   if(!s)continue;
   if(s.remaining===1)delete f.renStatuses[type];
   else f.renStatuses[type]=type==="read-move"?
    {stacks:s.stacks,remaining:s.remaining-1}:
    {amount:s.amount,remaining:s.remaining-1};
  }
  return true;
 }
 function effectiveSpeed(f,baseSpeed){
  if(!Number.isFinite(baseSpeed))return baseSpeed;
  const slow=read(f,"slowed");
  return Math.max(1,baseSpeed*(1-(slow?.amount??0)/100));
 }
 function effectiveDebuffResistance(f,baseResistance){
  if(!Number.isFinite(baseResistance))return baseResistance;
  const down=read(f,"debuff-resistance-down");
  return Math.max(0,baseResistance-(down?.amount??0));
 }
 function clear(f){
  if(!validFighter(f))return false;
  if(f.renStatuses!==undefined&&!validStatus(f))return false;
  if(validStatus(f))for(const type of KINDS)delete f.renStatuses[type];
  return true;
 }
 return Object.freeze({KINDS,read,apply,applyReadMove,spendReadMove,tickOwnTurn,effectiveSpeed,effectiveDebuffResistance,clear});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatStatusCore;
