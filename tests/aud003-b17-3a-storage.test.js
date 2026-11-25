"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const game=fs.readFileSync(path.join(__dirname,"..","game.js"),"utf8");
const adapter=game.match(/const COMBAT2_PILOT=[\s\S]*?function gameStorage\(\)\{[^}]+\}/)?.[0];
assert.ok(adapter);
function storage(){const entries=new Map();return {getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};}
test("actual pilot storage provider never reads or writes the normal profile",()=>{
 const live=storage(),pilot=storage(),key="ashes-throne.progress.v3";
 live.setItem(key,"live-profile");
 const load=search=>vm.runInNewContext(adapter+"\n({pilot:COMBAT2_PILOT,storage:gameStorage()})",{location:{search},window:{localStorage:live,sessionStorage:pilot}});
 for(const query of ["","?combat2Pilot=0","?combat2Pilot=10","?other=combat2Pilot=1"]){const r=load(query);assert.equal(r.pilot,false);assert.equal(r.storage,live);}
 const r=load("?combat2Pilot=1");assert.equal(r.pilot,true);assert.equal(r.storage,pilot);assert.equal(r.storage.getItem(key),null);
 r.storage.setItem(key,"experimental-profile");assert.equal(load("?combat2Pilot=1").storage.getItem(key),"experimental-profile");assert.equal(live.getItem(key),"live-profile");
 assert.throws(()=>vm.runInNewContext(adapter+"\ngameStorage()",{location:{search:"?combat2Pilot=1"},window:{localStorage:live,get sessionStorage(){throw Error("blocked");}}}),/blocked/);
 assert.equal(live.getItem(key),"live-profile");
});
test("production provider is the only direct game.js localStorage access",()=>{
 assert.equal((game.match(/window\.localStorage/g)||[]).length,1);
 assert.match(game,/storage:gameStorage\(\)/);
 assert.match(game,/COMBAT2_PILOT&&realHeroFight&&\(battleIsFirstPlay\|\|battleIsMainCampaign\)/);
});
