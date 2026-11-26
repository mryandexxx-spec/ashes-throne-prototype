/* C4/R review: proposed rules and diagnostic arithmetic. Not loaded by the game.
 * No engine imitation; scheduler tests use the actual InitiativeModel separately. */
"use strict";
const READY=1000,EPS=1e-8;
const alive=u=>!!u&&u.hp>0&&!u.sheltered;
const pending=u=>alive(u)&&Number.isFinite(u.speed)&&u.speed>0&&Number.isFinite(u.meter)&&u.meter>=0&&u.meter<READY-EPS;
const pair=(a,b)=>pending(a)&&pending(b)&&a.id!==b.id;
function synchronize(a,b){
 if(!pair(a,b))return null;
 const t=(2*READY-a.meter-b.meter)/(a.speed+b.speed),x=READY-a.speed*t,y=READY-b.speed*t;
 if(x<-EPS||y<-EPS||x>=READY-EPS||y>=READY-EPS||Math.abs(x-a.meter)<EPS)return null;
 return [{...a,meter:Math.max(0,x)},{...b,meter:Math.max(0,y)}];
}
function redirectProtection(donor,receiver,requested){
 if(!alive(donor)||!alive(receiver)||donor.id===receiver.id||
 ![donor.protection,receiver.protection,receiver.maxProtection,requested].every(Number.isSafeInteger)||
 donor.protection<0||receiver.protection<0||receiver.protection>receiver.maxProtection||requested<=0)return null;
 const amount=Math.min(donor.protection,receiver.maxProtection-receiver.protection,requested);
 return amount>0?{donor:{...donor,protection:donor.protection-amount},receiver:{...receiver,protection:receiver.protection+amount},amount}:null;
}
function reserve(b,kind,valid){
 if(!valid||!["team","ultimate"].includes(kind)||b.used!==false||b.selected!==kind)return b;
 return {...b,used:true,actions:b.actions+1};
}
function lethalTransfer(allyHp,artHp,loss){
 if(![allyHp,artHp,loss].every(Number.isSafeInteger)||allyHp<=0||artHp<=0||loss<allyHp)return null;
 const need=loss-allyHp+1;
 if(artHp<need)return {allyHp:0,artHp,transferred:0,success:false};
 return {allyHp:1,artHp:artHp-need,transferred:need,success:true};
}
function retreat(unit,activeOthers,hardObjective){
 if(!alive(unit)||activeOthers<1||hardObjective)return null;
 return {...unit,sheltered:true,singleTargetable:false,areaTargetable:true};
}
function returnAtReady(unit){
 if(!unit?.sheltered||unit.hp<=0||unit.meter<READY-EPS)return null;
 return {...unit,sheltered:false,singleTargetable:true,areaTargetable:true};
}
function rescue(unit,mode,active,failedObjective){
 if(!active||failedObjective||mode!=="recoverable-ko"||unit?.hp!==0||unit.outcome!=="recoverable-ko"||!Number.isSafeInteger(unit.maxHp)||unit.maxHp<=0)return null;
 return {...unit,hp:Math.max(1,Math.floor(unit.maxHp*.2)),meter:0,protection:0,outcome:"active",koRecorded:true};
}
// Selection from already validated, ranked native candidates. No synthetic
// weak action or target substitution is invented by the trust adapter.
function alternative(primary,candidates){
 if(!primary||!Array.isArray(candidates))return null;
 return candidates.find(p=>p.legal===true&&p.meaningful===true&&p.abilityId!==primary.abilityId)||null;
}
function relay(actor,partner,ability,used){
 if(used||!alive(actor)||actor.id===partner?.id||!pending(partner)||ability?.id!=="special"||
 ability.ready!==true||ability.legal!==true||ability.recursive||ability.extraAction)return null;
 return {actorId:actor.id,executorId:partner.id,abilityId:"special",turnCost:1,partnerMeter:partner.meter,spendPartnerCooldown:true};
}
function useGuardBypass(target){
 if(!alive(target)||!Number.isSafeInteger(target.guardHits)||target.guardHits<=0)return null;
 return {targetId:target.id,ignoreGuardThisHit:true,guardHitsAfter:target.guardHits};
}
module.exports={synchronize,redirectProtection,reserve,lethalTransfer,retreat,returnAtReady,rescue,alternative,relay,useGuardBypass};
