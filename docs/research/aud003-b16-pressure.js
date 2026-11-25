/* AUD003-B16.1: independent composition/pressure diagnostic. No production code changes. */
"use strict";
function experiment(engine, a, p, c) {
 if(a.baseCommit!==p.baseCommit||a.baseCommit!==c.baseCommit) throw Error("snapshot mismatch");
 function replace(s,from,to){if(s.split(from).length!==2)throw Error("anchor: "+from);return s.replace(from,to);}
 function load(src){const m={exports:{}};new Function("module",src)(m);return m.exports;}
 const old=load(engine);
 const E=load(replace(replace(engine,"leader=false}={})","leader=false,hpFactor=1,atkFactor=1}={})"),"f=scale*.75,offense=scale*","f=scale*.75*hpFactor,offense=scale*atkFactor*"));
 E.SQUADS["medic-art"]=["b14-striker","art","b14-medic","b14-breaker","sava"];
 E.SQUADS["medic-liora"]=["b14-striker","liora","b14-medic","b14-breaker","sava"];
 const input=E.loadSources(a.labSource,a.source,a.extra,p.parts),ctx=E.setup(input,"sava");
 const oldCtx=old.setup(old.loadSources(a.labSource,a.source,a.extra,p.parts),"sava");
 for(const tier of ["mid","max"])for(const scenario of ["duel","rush"]){
  const opts={tier,scenario,squad:"independent",scale:E.pressure(c.selected,tier,"independent",scenario),seed:391};
  if(JSON.stringify(old.run(oldCtx,opts))!==JSON.stringify(E.run(ctx,opts)))throw Error("unmodified control drift");
 }
 const factors={base:[1,1],hp80:[.8,1],atk80:[1,.8],both80:[.8,.8]};
 const seeds=Array.from({length:6},(_,i)=>Math.imul(i+173911,0x9e3779b1)>>>0);
 const cells=[];
 for(const tier of ["mid","max"])for(const scenario of ["duel","rush"])for(const squad of ["full","alternative","independent","medic-art","medic-liora"])for(const [factor,[hpFactor,atkFactor]] of Object.entries(factors)){
  const scale=E.pressure(c.selected,tier,squad,scenario);
  const opts={tier,scenario,squad,scale,hpFactor,atkFactor,order:"normal"};
  const rows=seeds.map(seed=>E.run(ctx,{...opts,seed}));
  cells.push({...opts,factor,...E.summarize(rows)});
 }
 return {baseCommit:a.baseCommit,variant:"sava",seeds,controlParity:4,battles:cells.reduce((n,x)=>n+x.n,0),cells};
}
module.exports={experiment};
if(typeof require!=="undefined"&&require.main===module){
 const fs=require("node:fs"),path=require("node:path"),dir=path.resolve(__dirname,"../../lab-combat-2");
 const read=n=>fs.readFileSync(path.join(dir,n),"utf8");
 const result=experiment(read("engine.js"),...["source-snapshot.json","parts-snapshot.json","calibration.json"].map(n=>JSON.parse(read(n))));
 console.log(JSON.stringify(result));
}
