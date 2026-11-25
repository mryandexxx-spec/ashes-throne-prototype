/* Research model checks, not runtime tests. Run node docs/research/aud003-v11-contract-tests.js */
function contractTests(L){
const names=[];function check(name,fn){fn();names.push(name)}function ok(x,msg){if(!x)throw Error(msg||"assertion")}function eq(a,b){if(a!==b)throw Error(`${a} != ${b}`)}function near(a,b){if(Math.abs(a-b)>1e-6)throw Error(`${a} != ${b}`)}function throws(fn){let e=false;try{fn()}catch(_){e=true}ok(e,"expected throw")}
const base=()=>L.fresh(["ren","art","nada"],"assault");
check("invalid action cannot mutate battle",()=>{let s=base();L.next(s);let before=JSON.stringify(s);throws(()=>L.act(s,{k:"hit",j:0,b:-1,v:1}));eq(JSON.stringify(s),before)});
check("wrong cooldown / multiplier rejected",()=>{let s=base();L.next(s);let o=L.enumerate(s).find(x=>x.j===2);ok(o);s.f[s.active].cd[2]=2;let before=JSON.stringify(s);throws(()=>L.act(s,o));eq(JSON.stringify(s),before);let p=L.enumerate(s)[0];throws(()=>L.act(s,{...p,v:999}));eq(JSON.stringify(s),before)});
check("dead target excluded from legal single strikes",()=>{let s=base();L.next(s);let dead=s.f[3];dead.hp=0;ok(!L.enumerate(s).some(o=>o.b===dead.i));});
check("mark remains on own attack and is consumed by a different attacker",()=>{let s=base(),target=s.f[3],ren=s.f[0],art=s.f[1];target.mark={owner:ren.i,expires:2};let hp=target.hp;L.damage(s,ren,target,10);near(target.hp,hp-10);ok(target.mark);L.damage(s,art,target,10);near(target.hp,hp-22.5);eq(target.mark,null)});
check("assist and counter cannot consume mark",()=>{let s=base(),b=s.f[3];b.mark={owner:1,expires:2};let hp=b.hp;L.damage(s,s.f[0],b,10,1,true);near(b.hp,hp-10);ok(b.mark)});
check("guard prevents only real damage and counter is bounded",()=>{let s=base(),a=s.f[3],b=s.f[0];b.guard={owner:1,amount:20,expires:2,time:14};a.guard={owner:4,amount:5,expires:2,time:14};let ha=a.hp,hb=b.hp;L.damage(s,a,b,30);near(b.hp,hb-10);near(a.hp,ha-(b.atk*.48-5));eq(s.stats.reply,1);eq(b.guard,null);eq(a.guard,null)});
check("dead protected hero cannot counter",()=>{let s=base(),a=s.f[3],b=s.f[0];b.hp=5;b.guard={owner:1,amount:1,expires:2,time:14};let ha=a.hp;L.damage(s,a,b,30);eq(b.hp,0);eq(a.hp,ha);eq(s.stats.reply,0)});
check("dead guard owner cannot trigger reply",()=>{let s=base(),a=s.f[3],b=s.f[0];s.f[1].hp=0;b.guard={owner:1,amount:20,expires:2,time:14};let ha=a.hp;L.damage(s,a,b,30);eq(a.hp,ha);eq(s.stats.reply,0)});
check("meter boost nonnegative and below cap",()=>{let s=base(),a=s.f[0],b=s.f[1];b.meter=900;L.tempo(s,a,b,250);eq(b.meter,950);b.meter=1000;L.tempo(s,a,b,250);eq(b.meter,1000);b.hp=0;L.tempo(s,a,b,250);eq(b.meter,1000)});
check("stationary escort cannot receive initiative",()=>{let s=L.fresh(["ren","art"],"hold"),b=s.f[s.escort];L.tempo(s,s.f[0],b,250);eq(b.meter,0);L.next(s);ok(s.active!==s.escort)});
check("deadline precedes action and requires living escort",()=>{let s=L.fresh(["ren","art"],"hold",{holdTime:1});L.next(s);eq(s.reason,"win");eq(s.actions,0);let z=L.fresh(["ren","art"],"hold",{holdTime:1});z.f[z.escort].hp=0;L.next(z);eq(z.reason,"loss")});
check("ordinary attacks cannot target escort, charge can",()=>{let s=L.fresh(["ren","art"],"hold");s.active=2;let o=L.enumerate(s);ok(o.some(x=>x.k==="charge"&&x.b===s.escort));ok(!o.some(x=>x.k!=="charge"&&x.b===s.escort))});
check("expired guard removed before next action",()=>{let s=base(),b=s.f[0];b.guard={owner:1,amount:20,expires:2,time:1};L.next(s);eq(b.guard,null)});
check("escape interrupted by actual cumulative damage, no second grant",()=>{let s=L.fresh(["ren","art"],"intercept",{blocksNeeded:1}),b=s.f[s.priority];b.charge={target:b.i,mult:0,escape:true,left:25};L.damage(s,s.f[0],b,10);eq(b.charge.left,15);eq(s.blocked,0);L.damage(s,s.f[1],b,15);eq(b.charge,null);eq(s.blocked,1);L.damage(s,s.f[0],b,10);eq(s.blocked,1);eq(L.finish(s),"win")});
check("escape resolves as failure when not stopped",()=>{let s=L.fresh(["ren","art"],"intercept"),b=s.f[s.priority];s.active=b.i;L.act(s,L.enumerate(s)[0]);ok(b.charge.escape);s.active=b.i;L.act(s,L.enumerate(s)[0]);eq(s.reason,"loss")});
check("charged strike cancels when target dies instead of hidden retarget",()=>{let s=base(),a=s.f[4],b=s.f[0];a.charge={target:b.i,mult:1.8};b.hp=0;s.active=a.i;let before=s.f[1].hp;L.act(s,L.enumerate(s)[0]);eq(a.charge,null);eq(s.f[1].hp,before)});
check("rollout never mutates live battle",()=>{let s=base();L.next(s);let before=JSON.stringify(s);let o=L.rollout(s);eq(JSON.stringify(s),before);ok(L.enumerate(s).some(x=>JSON.stringify(x)===JSON.stringify(o)))});
check("terminal command rejected",()=>{let s=base();s.reason="win";s.active=0;let before=JSON.stringify(s);throws(()=>L.act(s,{k:"hit",j:0,b:3,v:1}));eq(JSON.stringify(s),before)});
check("same seed and policy reproducible",()=>{let a=L.sim(L.teams[1],"assault","rollout",12345);let b=L.sim(L.teams[1],"assault","rollout",12345);eq(JSON.stringify(a),JSON.stringify(b));ok(!a.limit)});
return names;
}
console.log(JSON.stringify(contractTests(require('./aud003-combat-lab-v11.js')()),null,2));
