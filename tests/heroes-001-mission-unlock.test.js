"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const scripts=["gear-data.js","progress-core.js","skill-core.js","star-core.js",
 "hero-collection-core.js","daily-core.js","login-core.js","progress-v3-core.js",
 "save-core.js","npc-enemy-data.js","npc-mission-pilot.js"];
const api=vm.runInNewContext(scripts.map(read).join("\n")+
 "\n({HeroCollectionCore,SaveCore,ProgressV3Core,StarCore,SkillCore,NpcMissionPilot})");
const {HeroCollectionCore:H,SaveCore,ProgressV3Core:V,StarCore,SkillCore,NpcMissionPilot}=api;
const playable=["ren","nada","liora","art","sava"];
const retired=["kael","lyra","darin","medic-demo","test-area-damage"];
const allies=playable.map(id=>({id,side:"ally"}));
const db=new Map(),get=()=>({getItem:key=>db.get(key)??null,setItem:(key,val)=>db.set(key,val)});

test("DEMOROSTER001: only five story heroes belong to playable progress",()=>{
 assert.deepEqual(Array.from(H.PLAYABLE),playable);
 assert.deepEqual(Array.from(H.START),["ren","art"]);
 assert.deepEqual(Array.from(StarCore.START),["ren","art"]);
 assert.ok(playable.every(id=>SkillCore.HERO_IDS.includes(id)));
 const fresh=SaveCore.load(allies,get);
 assert.equal(fresh.progress.saveVersion,3);
 assert.deepEqual(Array.from(fresh.progress.unlockedHeroes),["ren","art"]);
 assert.deepEqual(Array.from(Object.keys(fresh.progress.heroStars)).filter(id=>fresh.progress.heroStars[id].rank>0).sort(),["art","ren"]);
 assert.ok(playable.every(id=>H.owned(fresh.progress,id)===H.START.includes(id)));
 assert.ok(retired.every(id=>!H.owned(fresh.progress,id)));
 for(const mission of ["black-pass-ambush","demo-mission-2","demo-mission-3"]){
  assert.equal(H.reward(mission),null);
  assert.equal(H.grant(fresh.progress,mission),null);
 }
 assert.ok(retired.every(id=>H.unlockMission(id)===null));
 assert.equal(SaveCore.save(fresh.progress,get),true);
 assert.ok(SaveCore.load(allies,get).progress);
 assert.equal(NpcMissionPilot.spawn("demo-mission-2").length,2);
 const game=read("game.js"),top=game.slice(0,game.indexOf("// NPCDATA001:"));
 assert.ok(retired.every(id=>!top.includes('id:"'+id+'"')));
 assert.ok(playable.every(id=>top.includes('id:"'+id+'"')));
 assert.ok(read("index.html").includes('v'+JSON.parse(read("package.json")).version+' · '));
});

test("DEMOROSTER001: precise old ten-hero save is pruned with a backup, without losing real heroes",()=>{
 const store=get(),now=1700000000000;
 const fresh=V.fresh(allies,now);
 fresh.heroes.ren.level=1;
 // The historical save being migrated actually owned all five real heroes.
 fresh.unlockedHeroes=playable.slice();
 fresh.heroStars=StarCore.fromLegacy(playable);
 for(const id of retired){
  fresh.heroes[id]={classId:({kael:"tank",lyra:"ranged",darin:"melee","medic-demo":"support","test-area-damage":"mage"})[id],
   level:1,gear:{tier:1,installedByTier:{"1":Array(6).fill(null)}}};
  fresh.unlockedHeroes.push(id);
  fresh.heroStars[id]={rank:1,shards:0};
 }
 db.set(V.KEY,JSON.stringify(fresh));
 const loaded=V.stage(allies,get,now);
 assert.equal(loaded.status,"existing");
 assert.deepEqual(Array.from(Object.keys(loaded.profile.heroes)).sort(),playable.slice().sort());
 assert.deepEqual(Array.from(loaded.profile.unlockedHeroes).sort(),playable.slice().sort());
 assert.ok(db.has(V.KEY+".before-demo-roster-cleanup"));
 assert.equal(V.validateActive(JSON.parse(db.get(V.KEY)),allies)!==null,true);
 const again=V.stage(allies,get,now);
 assert.equal(again.status,"existing");
 assert.equal(V.toRuntime(again.profile,allies)!==null,true);
 const tampered=JSON.parse(db.get(V.KEY));
 tampered.heroes.kael={bad:true};
 db.set(V.KEY,JSON.stringify(tampered));
 assert.equal(V.stage(allies,get,now).status,"blocked","unknown actor must not silently appear");
});
