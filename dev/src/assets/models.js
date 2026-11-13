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
const LioraModelAssets=Object.freeze({
 id:"liora",url:"dev/assets/models/liora_vel_shield_aware_15clips.glb",filename:"liora_vel_shield_aware_15clips.glb",
 source:"dev/assets-src/characters/liora/",bytes:2850224,sha256:"a2cc310c71ae141d0197da73397d73251db93ae6b57288e2ab5b0eb7aebb46b8",
 clips:Object.freeze({idle:"Idle_02",basic:"Liora_Shield_Bash",special:"Liora_Shield_Block",powerful:"Squat_Stance",hit:"Hit_Reaction",death:"Liora_Shield_Death",run:"Running",walk:"Walking",alert:"Alert",breath:"Catching_Breath",push:"Step_Forward_and_Push",approach:"Walk_Fight_Forward"})
});
const LioraShieldAssets=Object.freeze({
 id:"liora-shield",url:"dev/assets/models/liora-shield-mobile.glb",filename:"liora-shield-mobile.glb",
 source:"dev/assets-src/characters/liora/",bytes:631488,sha256:"65676e1e43c1065aea4297a54eaa7e12dd7d644258f913bab8fa26f7505b7cce"
});
if(typeof module!=="undefined"&&module.exports)module.exports=NadaModelAssets;
