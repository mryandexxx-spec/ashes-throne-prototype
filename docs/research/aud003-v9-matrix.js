/* Reproduce V9 held-out/stress results. Run node docs/research/aud003-v9-matrix.js from repository root. */
function research(L){
const rows=[];
const variants={base:{},weaker:{eatk:.78*.9,ehp:.9},stronger:{eatk:.78*1.1,ehp:1.1},faster:{espeed:1.1},slower:{espeed:.9},noMark:{noMark:true},noReply:{noReply:true},noTempo:{noTempo:true},pureSignal:{pureSignal:true},artShelter:{trust:"art_shelter"},artResponse:{trust:"art_response"},savaTempo:{trust:"sava_tempo"}};
for(let ti of [0,1,2])for(let [name,opt] of Object.entries(variants))for(let mode of name==="base"||name==="stronger"||name==="faster"?["assault","hold","intercept"]:["assault","hold"]){
let a=L.aggregate(L.teams[ti],mode,"rollout",opt,100,19000);
rows.push({team:ti+1,mode,variant:name,wins:a.wins,quality:a.quality,hp:a.hp,escort:a.escort,actions:a.actions,limits:a.limits,signal:a.stats.signal,reply:a.stats.reply,cover:a.stats.cover,interrupt:a.stats.interrupt});
}
const early=[];
for(let ti of [3,4,5,7,8])for(let mode of ["assault","intercept","hold"])for(let policy of ["basic","rollout"]){let opt=ti===3&&mode==="intercept"?{blocksNeeded:1,escapeThreshold:48}:{};let a=L.aggregate(L.teams[ti],mode,policy,opt,100,23000);early.push({team:ti+1,mode,policy,...a});}
let roster=["ren","art","nada","liora","sava","medic","ranger","breaker"], combos=[];
function choose(i,arr){if(arr.length===5){combos.push(arr);return}for(let j=i;j<roster.length;j++)choose(j+1,[...arr,roster[j]]);}choose(0,[]);
let matrix=combos.map(team=>({team,...L.aggregate(team,"assault","rollout",{},20,31000)}));
return {rows,early,matrix};
}
console.log(JSON.stringify(research(require('./aud003-combat-lab-v9.js')()),null,2));
