/* AUD003-C3 proposal only. Executable progression model, NOT loaded by game.
 * Stages and proof labels are fixtures, not authorized production receipts. */
"use strict";
const HEROES=Object.freeze(["ren","art","nada","liora","sava"]);
const GATES=Object.freeze(["arrival","field","network","responsibility","capstone"]);
const catalog=Object.freeze(Object.fromEntries(Object.entries({
 ren:["safe-route","route-adaptation","escort-choice","route-delegation","accept-correction","route-finale"],
 art:["cover-promise","sustain-defense","safe-extraction","extraction-lead","repair-agreement","defense-finale"],
 nada:["verify-report","source-check","intel-intercept","investigation-lead","disclose-uncertainty","evidence-finale"],
 liora:["protect-people","triage-choice","community-defense","relief-lead","public-accountability","relief-finale"],
 sava:["test-observation","signal-test","coordination","signal-lead","revise-hypothesis","coordination-finale"]
}).map(([hero,ids])=>[hero,Object.freeze(ids.map((id,i)=>Object.freeze({id,slot:i,rank:[1,2,2,3,3,4][i],gate:[0,1,2,3,3,4][i],mode:["personal","campaign","operation","network","personal","capstone"][i],routes:Object.freeze([id+":primary",id+":alternate"])})))])));
const isHero=h=>HEROES.includes(h);
const rank=s=>!s.joined?0:!s.earned[0]?1:!(s.earned[1]&&s.earned[2])?2:!(s.earned[3]&&s.earned[4])?3:!s.earned[5]?4:5;
function initial(hero){if(!isHero(hero))throw Error("unknown hero");return {hero,joined:false,joinSeq:0,rankSeq:0,earned:Array(6).fill(null)};}
function join(s,seq){return !s.joined&&Number.isSafeInteger(seq)&&seq>0?{...s,joined:true,joinSeq:seq,rankSeq:seq}:s;}
function eligible(s,stage){return Number.isInteger(stage)&&stage>=0&&stage<GATES.length?catalog[s.hero].filter(m=>m.rank===rank(s)&&stage>=m.gate&&!s.earned[m.slot]):[];}
function apply(s,stage,p){
 if(!p||!s.joined||p.hero!==s.hero||p.success!==true||p.contribution!==true||p.accepted!==true||!Number.isSafeInteger(p.startSeq)||!Number.isSafeInteger(p.endSeq)||p.startSeq<=s.rankSeq||p.endSeq<p.startSeq||typeof p.occurrence!=="string"||!p.occurrence||s.earned.some(e=>e?.occurrence===p.occurrence))return s;
 const m=eligible(s,stage).find(x=>x.id===p.milestone&&x.mode===p.mode&&x.routes.includes(p.route));
 if(!m)return s;
 const earned=s.earned.slice();earned[m.slot]={occurrence:p.occurrence,endSeq:p.endSeq,route:p.route};
 const next={...s,earned};if(rank(next)>rank(s))next.rankSeq=Math.max(...earned.filter(Boolean).map(e=>e.endSeq),s.rankSeq);return next;
}
module.exports=Object.freeze({HEROES,GATES,catalog,initial,join,rank,eligible,apply});