/* NADA3D001 — static model manifest, Dune-style dev/src/assets/.
 * Classic script because the existing Ashes prototype is not an ES-module build.
 */
const NadaModelAssets=Object.freeze({
 id:"nada",
 url:"dev/assets/models/nada-mobile-animated.glb",
 filename:"nada-mobile-animated.glb",
 source:"dev/assets-src/characters/nada/",
 bytes:1462284,
 sha256:"5bbd34c2db189d1831c213b02ac31f49342f8b7773cc283589ece8249a5a016d",
 clips:Object.freeze({
  idle:"Idle_11",basic:"Archery_Shot_3",special:"Archery_Shot_3",
  powerful:"mage_soell_cast",guard:"Idle_11",ward:"Hit_Reaction_1",
  hit:"Hit_Reaction_1",death:"Electrocuted_Fall",
  run:"Running",walk:"Walking"
 })
});
if(typeof module!=="undefined"&&module.exports)module.exports=NadaModelAssets;
