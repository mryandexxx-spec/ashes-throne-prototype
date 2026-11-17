/* LC-008B: one active wallet-writing game session per origin/storage bucket.
   Web Locks (not localStorage revision) provides cross-tab exclusion.
   This intentionally blocks a second live session instead of trying a fake CAS. */
const ProgressWriterCore=(()=>{
 "use strict";
 const NAME="ashes-throne.progress.v3.writer";
 let owner=false,closed=false,releaseHold=null,pending=null,queued=Promise.resolve(),busy=false;
 const result=(ok,code)=>Object.freeze(ok?{ok:true}:{ok:false,code});
 function isOwner(){return owner&&!closed;}
 function canPersist(){return isOwner()&&!busy;}
 function release(){
  closed=true;owner=false;
  if(releaseHold){const end=releaseHold;releaseHold=null;end();}
 }
 function acquire(manager=typeof navigator!=="undefined"?navigator.locks:null){
  if(isOwner())return Promise.resolve(result(true));
  if(pending)return pending;
  if(closed)return Promise.resolve(result(false,"SESSION_CLOSED"));
  if(!manager||typeof manager.request!=="function")
   return Promise.resolve(result(false,"WEB_LOCKS_UNAVAILABLE"));
  let finish;
  const ready=new Promise(resolve=>{finish=resolve;});
  pending=ready;
  let resolved=false;
  const done=value=>{
   if(resolved)return;
   resolved=true;pending=null;finish(value);
  };
  try{
   Promise.resolve(manager.request(NAME,{mode:"exclusive",ifAvailable:true},async lock=>{
    if(!lock){done(result(false,"WALLET_OPEN_IN_ANOTHER_TAB"));return;}
    if(closed){done(result(false,"SESSION_CLOSED"));return;}
    owner=true;
    try{
     await new Promise(resolve=>{
      releaseHold=resolve;
      done(result(true));
     });
    }finally{
     owner=false;releaseHold=null;
    }
   })).catch(()=>{
    release();
    done(result(false,"WEB_LOCKS_FAILED"));
   });
  }catch(_){release();done(result(false,"WEB_LOCKS_FAILED"));}
  return ready;
 }
 // Reward claims are asynchronous. Serialize them WITHIN the active tab too;
 // sync ProgressV3Core.persist rejects while an exclusive claim is active.
 function exclusive(callback){
  if(typeof callback!=="function")return Promise.reject(Error("INVALID_TRANSACTION"));
  const work=queued.then(async()=>{
   if(!isOwner())throw Error("WALLET_LOCK_REQUIRED");
   busy=true;
   try{return await callback();}
   finally{busy=false;}
  });
  queued=work.catch(()=>{});
  return work;
 }
 return Object.freeze({NAME,acquire,release,isOwner,canPersist,exclusive});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ProgressWriterCore;
