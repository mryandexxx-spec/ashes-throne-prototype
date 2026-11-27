const test=require("node:test"),assert=require("node:assert/strict"),P=require("../map-3d-profile.js");
test("06B durable diagnostic profile isolates every key and requires writer",()=>{
 const values=new Map([["ashes-throne.progress.v3","LIVE"]]);let owner=false;
 const backing={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};
 const writer={isOwner:()=>owner},a=P.storage(backing,writer);
 assert.equal(a.getItem("ashes-throne.progress.v3"),null);assert.throws(()=>a.setItem("ashes-throne.progress.v3","PILOT"));
 owner=true;a.setItem("ashes-throne.progress.v3","PILOT");a.setItem("checkpoint","R");
 const b=P.storage(backing,writer);assert.equal(b.getItem("checkpoint"),"R");assert.equal(b.getItem("ashes-throne.progress.v3"),"PILOT");assert.equal(backing.getItem("ashes-throne.progress.v3"),"LIVE");
 owner=false;assert.throws(()=>b.removeItem("checkpoint"));assert.equal(b.getItem("checkpoint"),"R");owner=true;b.removeItem("checkpoint");assert.equal(a.getItem("checkpoint"),null);assert.equal(backing.getItem("ashes-throne.progress.v3"),"LIVE");
});
