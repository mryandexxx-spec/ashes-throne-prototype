/* AUD003-C4/R: executable design examples only, not a second combat engine.
 * Values, rules and context are provisional. No profile, storage, browser or game imports. */
"use strict";
const GATES=Object.freeze([
 null,{level:1,stars:1,gear:1,skill:1},{level:3,stars:1,gear:1,skill:2},
 {level:25,stars:3,gear:4,skill:3},{level:55,stars:5,gear:8,skill:5},
 {level:75,stars:6,gear:11,skill:6}].map(x=>x&&Object.freeze(x)));
const KEY_SKILL=Object.freeze({ren:"special",art:"special",nada:"special",liora:"powerful",sava:"special"});
const ACTIONS=Object.freeze({
 ren:{personal:"bypass-screen",team:"guide-partner",ultimate:"break-formation"},
 art:{personal:"full-intercept",team:"reciprocal-cover",ultimate:"last-line"},
 nada:{personal:"force-fallback",team:"decoy-agreement",ultimate:"break-command"},
 liora:{personal:"shelter",team:"handoff-objective",ultimate:"recover-ko"},
 sava:{personal:"swap-readiness",team:"delegate-action",ultimate:"synchronize"}
});
function qualify(hero,p,r){
 if(!Object.hasOwn(KEY_SKILL,hero)||!Number.isInteger(r)||r<1||r>5||!p||p.owned!==true)return false;
 const t=GATES[r];return ["level","stars","gear"].every(k=>Number.isSafeInteger(p[k])&&p[k]>=t[k])&&
  Number.isSafeInteger(p.skills?.[KEY_SKILL[hero]])&&p.skills[KEY_SKILL[hero]]>=t.skill;
}
function rankAfter(hero,earnedRank,p,storyRank,contextRank){
 if(!Number.isInteger(earnedRank)||earnedRank<0||earnedRank>5||!Number.isInteger(storyRank)||!Number.isInteger(contextRank))throw Error("invalid rank");
 let r=earnedRank;while(r<5&&r<storyRank&&r<contextRank&&qualify(hero,p,r+1))r++;return r;
}
// A separate action ID, with an ordinary turn consumed. Context-specific checks
// precede mutation. Profile authentication and full engine validation are NOT modeled.
function screenedTargets(enemies,links,bypass=false){
 const living=new Set(enemies.filter(x=>x.hp>0).map(x=>x.id));
 return [...living].filter(id=>bypass||!links.some(l=>l.target===id&&living.has(l.protector)));
}
function intercept({targetId,artId,protectedId,artHp,armed,area,redirectable,rootRedirected}){
 if(armed&&targetId===protectedId&&targetId!==artId&&artHp>0&&!area&&redirectable&&!rootRedirected)
  return {targetId:artId,armed:false,rootRedirected:true};
 return {targetId,armed,rootRedirected};
}
function fallback(plan){
 if(!plan||!plan.committed||!plan.alternate||plan.used||plan.primary===plan.alternate)return null;
 return {...plan,selected:plan.alternate,used:true,enemyTurns:1};
}
function shelter(unit,isObjective){
 if(!unit||unit.hp<=0||unit.sheltered||isObjective)return null;
 return {...unit,sheltered:true,skipNext:true,targetable:false};
}
function releaseShelter(unit){
 if(!unit?.sheltered||!unit.skipNext)return null;
 return {...unit,sheltered:false,skipNext:false,targetable:true,actionsGranted:0};
}
function nextTime(u){return (1000-u.meter)/u.speed;}
function swap(a,b){
 if(!a||!b||a.id===b.id||![a,b].every(u=>u.hp>0&&!u.sheltered&&Number.isFinite(u.speed)&&u.speed>0&&Number.isFinite(u.meter)&&u.meter>=0&&u.meter<1000))return null;
 const aa={...a,meter:b.meter},bb={...b,meter:a.meter};
 if((nextTime(a)-nextTime(b))*(nextTime(aa)-nextTime(bb))>=0)return null;
 return [aa,bb];
}
// HP loss only: already resolved armor/protection damage must not be re-mitigated.
function lastLine(allyHp,artHp,damage){
 if(![allyHp,artHp,damage].every(Number.isSafeInteger)||allyHp<=0||artHp<=0||damage<allyHp)return null;
 const need=damage-allyHp+1,paid=Math.min(need,artHp);
 return {allyHp:Math.max(0,allyHp-damage+paid),artHp:artHp-paid,transferred:paid};
}
function recover(unit){
 if(!unit||unit.hp!==0||unit.outcome!=="recoverable-ko"||!Number.isSafeInteger(unit.maxHp)||unit.maxHp<1)return null;
 return {...unit,hp:Math.max(1,Math.floor(unit.maxHp*.2)),protection:0,meter:0,outcome:"active",failedProofStillFailed:true};
}
function spend(b,kind,valid){
 if(!valid||!["team","ultimate"].includes(kind)||b[kind]!==false)return b;
 return {...b,[kind]:true,actions:b.actions+1};
}
module.exports={GATES,KEY_SKILL,ACTIONS,qualify,rankAfter,screenedTargets,intercept,fallback,shelter,releaseShelter,swap,lastLine,recover,spend};
