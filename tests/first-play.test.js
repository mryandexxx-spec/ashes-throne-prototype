const test=require("node:test");
const assert=require("node:assert/strict");
const Core=require("../first-play-core.js");
function storage(initial={}){
 const map=new Map(Object.entries(initial));
 return {get length(){return map.size;},key:i=>Array.from(map.keys())[i]??null,
  getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value)),
  removeItem:key=>map.delete(key),data:map};
}
test("new profile: choice, combat, persisted victory, completion",()=>{
 const store=storage(),provide=()=>store;
 let loaded=Core.load(provide);
 assert.equal(loaded.exists,false);
 assert.equal(loaded.state.phase,"briefing");
 assert.equal(Core.start(loaded.state),null);
 const chosen=Core.choose(loaded.state,"cover");
 assert.equal(chosen.choice,"cover");
 assert.equal(Core.save(chosen,provide),true);
 const started=Core.start(chosen);
 assert.equal(Core.save(started,provide),true);
 assert.equal(Core.load(provide).state.phase,"ready","interrupted battle retries");
 const won=Core.finish(started,true);
 assert.equal(won.phase,"won");
 assert.equal(Core.save(won,provide),true);
 assert.equal(Core.load(provide).state.phase,"won");
 assert.equal(Core.save(Core.complete(won),provide),true);
 assert.equal(Core.load(provide).state.phase,"done");
});
test("defeat retains the order without awarding success",()=>{
 const chosen=Core.choose(Core.fresh(),"survey");
 const failed=Core.finish(Core.start(chosen),false);
 assert.equal(failed.phase,"ready");
 assert.equal(failed.choice,"survey");
 assert.equal(Core.complete(failed),null);
});
test("skip is explicit and does not write a wallet",()=>{
 const store=storage({"unrelated.settings":"keep"});
 const result=Core.skip(Core.fresh());
 assert.equal(result.phase,"done");
 assert.equal(Core.save(result,()=>store),true);
 assert.equal(store.getItem("ashes-throne.progress.v3"),null);
 assert.equal(store.getItem("unrelated.settings"),"keep");
});
test("corrupted checkpoint is blocked, not overwritten",()=>{
 const store=storage({[Core.KEY]:'{"phase":"won"}'});
 const loaded=Core.load(()=>store);
 assert.equal(loaded.blocked,true);
 assert.equal(loaded.available,false);
 assert.equal(Core.save(loaded.state,()=>store),true,"save API remains pure; caller must respect blocked state");
});
test("reset removes all namespaced saves and preserves foreign localStorage",()=>{
 const store=storage({[Core.KEY]:"one","ashes-throne.progress.v3":"wallet",
  "ashes-throne.network.v1":"missions","theme":"dark"});
 assert.deepEqual(Core.resetGameStorage(()=>store),{ok:true,removed:3});
 assert.equal(Core.load(()=>store).state.phase,"briefing");
 assert.equal(store.getItem("theme"),"dark");
});
test("reset unavailable storage fails without a success claim",()=>{
 const result=Core.resetGameStorage(()=>{throw Error("storage blocked");});
 assert.equal(result.ok,false);
});
