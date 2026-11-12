/* NADA3D001 — static model manifest, Dune-style dev/src/assets/.
 * Classic script because the existing Ashes prototype is not an ES-module build.
 */
const NadaModelAssets=Object.freeze({
 id:"nada",
 url:"dev/assets/models/nada-mobile-animated.glb",
 filename:"nada-mobile-animated.glb",
 source:"dev/assets-src/characters/nada/",
 bytes:3096808,
 sha256:"1ecd7859754191e296c68171c03a2c180859db52957629905a90cd8d7a61e87d",
 clips:Object.freeze({
  idle:"Idle_11",basic:"Archery_Shot_3",special:"Archery_Shot_3",
  powerful:"mage_soell_cast",guard:"Idle_11",ward:"Hit_Reaction_1",
  hit:"Hit_Reaction_1",death:"Electrocuted_Fall",
  run:"Running",walk:"Walking"
 })
});
if(typeof module!=="undefined"&&module.exports)module.exports=NadaModelAssets;
