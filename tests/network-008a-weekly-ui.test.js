"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
// No browser required: exercise the actual UI mount and new-profile notice.
test("NET-UX-001 first weekly open does not report already-claimed rewards",async()=>{
 const nodes=new Map();
 const root={addEventListener(){},querySelectorAll(){return []}};
 global.document={getElementById(id){
  if(id==="net008aThreat")return root;
  if(!nodes.has(id))nodes.set(id,{textContent:"",hidden:false,disabled:false,dataset:{},value:0});
  return nodes.get(id);
 }};
 global.WeeklyThreatCore={
  variant:()=>({title:"Пробная угроза",goal:"Победить"}),
  weekId:()=> "2026-11-16",
  TIERS:[{score:60,currency:0,xp:0,materials:{Fe:1}}]
 };
 let collected=0;
 const session={
  read:()=>({weekStart:Date.UTC(2026,10,16),attempts:0,bestScore:0,active:null}),
  pending:()=>[],isReady:()=>true,isBusy:()=>false,isClockBack:()=>false,
  open:async()=>({ok:true}),collect:async()=>{collected++;return {ok:true,count:0}}
 };
 const ui=require("../weekly-threat-ui.js");
 assert.equal(ui.mount({weekly:session,onOpenSquad:()=>{}}),true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(collected,0,"no unearned claims should be attempted on mount");
 const status=nodes.get("net008aStatus").textContent;
 assert.match(status,/лучший результат: нет/);
 assert.doesNotMatch(status,/Все доступные награды уже получены/);
 delete global.document;delete global.WeeklyThreatCore;
});
