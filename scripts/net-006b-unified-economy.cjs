/* NET-006B [ПРЕДЛОЖЕНИЕ]: offline research, no runtime imports or save writes.
 * Source: c65d43b (M1–M3, training curve, LC acts, calendar and dailies).
 * Network payouts/gates/behavior below are hypotheses, NOT approved.
 * node scripts/net-006b-unified-economy.cjs [--self-test]
 */
"use strict";
const mats=["Fe","Le","Cl","Wo","Fa","Th","Gl"];
const farms=[
 {id:"M1",energy:10,currency:850,xp:5,m:[2,3,4,1,2,2,0]},
 {id:"M2",energy:12,currency:1020,xp:5,m:[4,2,5,0,2,1,1]},
 {id:"M3",energy:16,currency:1360,xp:5,m:[3,3,6,0,2,1,0]}];
const first={currency:5330,xp:315,m:[9,8,15,1,6,4,1]}; // three free first clears include current farm grants
const costs={
 G3:{m:[125,98,132,12,82,34,6],ten:[215,189,292,28,151,82,12],gear:33750,level:15,skills:900},
 G8:{m:[647,908,666,57,361,79,96],ten:[1085,1614,1267,292,616,409,336],gear:215000,level:40,skills:3400},
 G13:{m:[1457,2268,1452,137,730,159,256],ten:[2435,3977,2716,722,1231,932,896],gear:552500,level:85,skills:7200}};
const acts=[
 [3,1500,180,[5,6,8,1,3,3,0]],[10,2000,230,[5,5,10,1,4,3,1]],
 [22,3000,280,[8,7,8,2,5,4,1]],[36,4000,350,[8,8,10,2,6,5,2]],
 [60,5000,460,[9,10,10,2,6,5,2]]];
const login=[[100,10,[1,0,0,0,0,0,0]],[150,10,[0,1,0,0,0,0,0]],
 [200,15,[0,0,2,0,0,0,0]],[250,15,[0,0,0,1,0,0,0]],
 [300,20,[0,0,0,0,2,0,0]],[350,20,[0,0,0,0,0,2,0]],
 [600,35,[0,0,0,0,0,0,1]]];
const daily=[[200,15,[2,0,0,0,0,0,0]],[200,15,[0,2,0,0,0,0,0]],
 [250,20,[0,0,3,0,0,0,0]],[200,15,[2,0,0,0,0,0,0]],
 [200,15,[0,2,0,0,0,0,0]]];
const net={
 off:null,
 E1:{quantity:[12,18,24],currency:[1000,2000,4000],xp:[100,150,200]},
 cautious:{quantity:[8,12,18],currency:[700,1300,2100],xp:[120,165,210]}};
const play={
 casual:{login:0.55,energy:0.45,clues:1,dailies:1},
 regular:{login:0.90,energy:0.75,clues:3,dailies:3},
 intensive:{login:1,energy:1,clues:4,dailies:4}};
const plus=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,n)=>a.map(v=>v*n);
const moneyForLevel=n=>{let x=0;for(let i=1;i<n;i++)x+=Math.round(35+3*i+.65*i*i);return x;};
const xpForLevel=n=>{let x=0;for(let i=1;i<n;i++)x+=Math.round(40+7*i+.28*i*i);return x;};
const account=xp=>{let n=1;while(n<85&&xp>=xpForLevel(n+1))n++;return n;};
const accountCap=n=>n<=4?[0,3,8,12,14][n]:n<=15?15:Math.min(85,n);
function stages(heroes){
 const def=(name,g,count)=>({name,materials:count===10?costs[g].ten.slice():mul(costs[g].m,count/5),
   currency:costs[g].gear*count/5+moneyForLevel(costs[g].level)*count+
    (count===10&&g==="G13"?63000:costs[g].skills*count),level:costs[g].level});
 const a=[def("5G3","G3",5),def("5G8","G8",5)];
 if(heroes===10){
  a.push(def("10G8","G8",10));
  const g13=def("5G13","G13",5);
  a.push({name:"5G13+5G8",materials:plus(g13.materials,a[2].materials.map((n,i)=>n-a[1].materials[i])),
    currency:a[1].currency+g13.currency,level:85});
  a.push(def("10G13","G13",10));
 }else a.push(def("5G13","G13",5));
 return a;
}
function prng(seed){let s=seed>>>0;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
function award(s,x){
 s.currency+=x.currency;s.xp+=x.xp;s.materials=plus(s.materials,x.m);
}
const gaps=(s,t)=>t.materials.map((v,i)=>Math.max(0,v-s.materials[i]));
const efficiencies=[4/12,3/10,6/16,1/10,2/10,2/10,1/12];
const focus=(s,t)=>{const g=gaps(s,t).map((v,i)=>v/efficiencies[i]);return g.indexOf(Math.max(...g));};
function farmChoice(s,t,random){
 const g=gaps(s,t);
 const weighted=farms.map(f=>f.m.reduce((a,v,i)=>
  a+Math.min(g[i],v)/efficiencies[i],0)/f.energy);
 const m=Math.max(...weighted);
 return m===0?farms[Math.floor(random()*3)]:farms[weighted.indexOf(m)];
}
function reached(s,t){return s.currency>=t.currency&&accountCap(account(s.xp))>=t.level&&
 t.materials.every((n,i)=>s.materials[i]>=n);}
function simulate({seed=1,activity="regular",economy="cautious",heroes=5,farmRate=1,withActs=true}={}){
 const r=prng(seed),p=play[activity],n=net[economy],goals=stages(heroes);
 if(!p||!(economy in net)||![5,10].includes(heroes))throw Error("Invalid scenario");
 const s={currency:first.currency,xp:first.xp,materials:first.m.slice(),energy:240,
  board:0,misses:0,clues:0,repeats:0,logins:0,actsClaimed:new Set()};
 const firstReached={},materialReached={},coinsReached={},levelReached={},snapshots={};
 for(let day=1;day<=180;day++){
  s.energy=Math.min(240,s.energy+(day===1?0:240));
  if(n)s.board=Math.min(16,s.board+4); // P1 four arrivals/day, no expiry
  if(r()<p.login){
   if(day>1&&(day-1)%30===0)s.logins=0; // approximate month boundary
   const l=login[s.logins%7];award(s,{currency:l[0],xp:l[1],m:l[2]});s.logins++;
   for(let i=0;i<p.dailies;i++){
    const d=daily[i];award(s,{currency:d[0],xp:d[1],m:d[2]});
   }
   if(withActs)acts.forEach((a,i)=>{if(day>=a[0]&&!s.actsClaimed.has(i)){
    award(s,{currency:a[1],xp:a[2],m:a[3]});s.actsClaimed.add(i);
   }});
   if(n){
    for(let k=0;k<Math.min(p.clues,s.board);k++){
     const g=goals.find(t=>gaps(s,t).some(v=>v>0))||goals[goals.length-1];
     const wanted=focus(s,g);
     // Proposal-only proxy: seven materials + two non-material types,
     // order x4, at most 3 arrivals until a matching targeted clue.
     const other=Math.floor(r()*8);
     const picked=s.misses===2?wanted:r()<1/3?wanted:other>=wanted?other+1:other;
     s.misses=picked===wanted?0:s.misses+1;
     s.board--;s.clues++;
     // Hypothetical content gates, NOT game code.
     const lv=account(s.xp),band=lv>=45?2:lv>=20?1:0;
     award(s,{currency:n.currency[band],xp:n.xp[band],
      m:mats.map((_,i)=>picked===i?n.quantity[band]:0)});
    }
   }
   let budget=Math.min(s.energy,Math.floor(240*p.energy*farmRate));
   for(let i=0;i<30;i++){
    const goal=goals.find(t=>gaps(s,t).some(v=>v>0))||goals[goals.length-1];
    const f=farmChoice(s,goal,r);if(f.energy>budget)break;
    budget-=f.energy;s.energy-=f.energy;s.repeats++;
    award(s,{currency:f.currency,xp:f.xp,m:f.m});
   }
  }
  for(const g of goals){
   if(firstReached[g.name]===undefined&&reached(s,g))firstReached[g.name]=day;
   if(materialReached[g.name]===undefined&&g.materials.every((n,i)=>s.materials[i]>=n))
    materialReached[g.name]=day;
   if(coinsReached[g.name]===undefined&&s.currency>=g.currency)coinsReached[g.name]=day;
   if(levelReached[g.name]===undefined&&accountCap(account(s.xp))>=g.level)
    levelReached[g.name]=day;
  }
  if([7,30,90,180].includes(day)){
   const coverage=goals.map(g=>Math.round(100*g.materials.reduce((a,v,i)=>
    a+Math.min(v,s.materials[i]),0)/g.materials.reduce((a,b)=>a+b,0)));
   snapshots[day]={currency:s.currency,accountLevel:account(s.xp),xp:s.xp,
    repeats:s.repeats,clues:s.clues,board:s.board,coverage};
  }
 }
 return {firstReached,materialReached,coinsReached,levelReached,snapshots};
}
function pct(a,q){a.sort((x,y)=>x-y);const t=(a.length-1)*q,k=Math.floor(t);
 return a[k]+(a[Math.ceil(t)]-a[k])*(t-k);}
function ensemble(options,seeds=120){
 const rows=Array.from({length:seeds},(_,i)=>simulate({...options,seed:i+1}));
 const milestones=stages(options.heroes||5);
 return {scenario:options,reach:Object.fromEntries(milestones.map(g=>{
  const t=rows.map(s=>s.firstReached[g.name]||181);
  const med=key=>Math.round(pct(rows.map(s=>s[key][g.name]||181),.5));
  return [g.name,{p10:Math.round(pct(t.slice(),.1)),median:Math.round(pct(t.slice(),.5)),
   p90:Math.round(pct(t.slice(),.9)),success:t.filter(x=>x<=180).length+"/"+seeds,
   materialsDay:med("materialReached"),coinsDay:med("coinsReached"),
   accountGateDay:med("levelReached")}];
 })),days:Object.fromEntries([7,30,90,180].map(d=>{
  const list=rows.map(x=>x.snapshots[d]);
  return [d,{accountLevel:Math.round(pct(list.map(x=>x.accountLevel),.5)),
   currency:Math.round(pct(list.map(x=>x.currency),.5)),
   repeats:Math.round(pct(list.map(x=>x.repeats),.5)),
   clues:Math.round(pct(list.map(x=>x.clues),.5)),
   coverage:milestones.map((_,i)=>Math.round(pct(list.map(x=>x.coverage[i]),.5)))}];
 }))};
}
function selfTest(){
 const requireFact=(ok,label)=>{if(!ok)throw Error("Self-test failed "+label);};
 requireFact(farms.every(f=>f.currency/f.energy===85),"85 currency/energy");
 requireFact(first.currency===5330&&first.xp===315,"first-clear total grants");
 requireFact(moneyForLevel(85)===144378,"L85 cost");
 requireFact(accountCap(5)===15,"account level 5 hero cap");
 requireFact(xpForLevel(85)===84661,"Account L85");
 requireFact(costs.G13.gear===552500,"G13 five heroes");
 requireFact(costs.G13.ten[6]===896,"ten real roster G13 Gl");
 requireFact(stages(10).slice(-1)[0].currency===2611780,"ten roster actual G13 skill count");
 requireFact(acts.reduce((n,a)=>n+a[1],0)===15500,"LC currency");
 requireFact(acts.reduce((n,a)=>n+a[2],0)===1500,"LC XP");
 requireFact(login.reduce((n,a)=>n+a[0],0)===1950,"login");
 requireFact(daily.reduce((n,a)=>n+a[0],0)===1050,"daily");
 requireFact(JSON.stringify(simulate({seed:7}))===JSON.stringify(simulate({seed:7})),
  "seed repeatability");
 return "13/13 self-checks passed; research only";
}
function report(){
 selfTest();
 const cases=[
  {activity:"regular",economy:"off",heroes:5},
  {activity:"regular",economy:"E1",heroes:5},
  {activity:"regular",economy:"cautious",heroes:5},
  {activity:"regular",economy:"cautious",heroes:10},
  {activity:"casual",economy:"cautious",heroes:5},
  {activity:"intensive",economy:"cautious",heroes:5},
  {activity:"intensive",economy:"E1",heroes:5},
  {activity:"regular",economy:"cautious",heroes:5,farmRate:0.5}
 ];
 return cases.map(c=>ensemble(c));
}
if(typeof module!=="undefined")module.exports={mats,farms,first,costs,acts,login,daily,net,play,
 moneyForLevel,xpForLevel,account,stages,simulate,ensemble,selfTest,report};
if(typeof process!=="undefined"&&process.argv&&
 process.argv[1]&&process.argv[1].endsWith("net-006b-unified-economy.cjs")){
 if(process.argv.includes("--self-test"))console.log(selfTest());
 else console.log(JSON.stringify(report(),null,2));
}
