/* MAP-3D-06B: explicit durable diagnostic slot, not the live profile.
 * Delegate to the same Storage API and the existing origin-wide writer.
 * No fallback to unprefixed localStorage or sessionStorage. */
const Map3DProfile=(()=>{
 const PREFIX="ashes-throne.map3d-pilot.";
 function storage(backing=window.localStorage,writer=ProgressWriterCore){
  const key=k=>PREFIX+String(k);
  return Object.freeze({
   getItem:k=>backing.getItem(key(k)),
   setItem(k,v){if(!writer.isOwner())throw Error("MAP3D_WRITER_REQUIRED");backing.setItem(key(k),v);},
   removeItem(k){if(!writer.isOwner())throw Error("MAP3D_WRITER_REQUIRED");backing.removeItem(key(k));}
  });
 }
 return Object.freeze({PREFIX,storage});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=Map3DProfile;
