/* Run node docs/research/aud003-v11-matrix.js */
function run(L){
const roster=["ren","art","nada","liora","sava","medic","ranger","breaker"],combs=[];function choose(i,arr){if(arr.length===5){combs.push(arr);return}for(let j=i;j<roster.length;j++)choose(j+1,[...arr,roster[j]]);}choose(0,[]);
const fast=combs.map(team=>({team,...L.aggregate(team,"assault","rollout",{espeed:1.1},30,51000)}));
const profiles={mixed:{},fastMixed:{espeed:1.1},rush:{enemyTeam:["raider","raider","raider","charger","guard"]},sustain:{enemyTeam:["guard","guard","healer","healer","charger"]},telegraph:{enemyTeam:["charger","charger","charger","guard","healer"]}};
const rows=[];for(let ti of [0,1,2,6])for(let [profile,opt] of Object.entries(profiles))for(let policy of ["greedy","rollout"]){let a=L.aggregate(L.teams[ti],"assault",policy,opt,100,53000);rows.push({team:ti+1,profile,policy,wins:a.wins,quality:a.quality,hp:a.hp,actions:a.actions,limits:a.limits,cover:a.stats.cover,interrupt:a.stats.interrupt});}
return {fast,rows};}
console.log(JSON.stringify(run(require('./aud003-combat-lab-v11.js')()),null,2));
