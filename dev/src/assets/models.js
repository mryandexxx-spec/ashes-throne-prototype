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
/* LIORA-SHIELD-006: one GLB — character + kite shield skinned to mixamorig:LeftForeArm.
 * The shield is the mesh "Liora_Shield" (own material "LioraShield"); hide that mesh to show her unarmed.
 * Built by tools/bake-liora-shield.mjs; calibration in dev/assets-src/characters/liora/shield_attachment.json. */
const LioraModelAssets=Object.freeze({
 id:"liora",url:"dev/assets/models/liora-mobile-animated.glb",filename:"liora-mobile-animated.glb",
 source:"dev/assets-src/characters/liora/",bytes:2117776,sha256:"6baf3cf93ca4e2e71be58b243616b6afdbd4cfdca81eb404ef6bd0dafae77a9c",
 shieldMesh:"Liora_Shield",shieldJoint:"mixamorig:LeftForeArm",
 clips:Object.freeze({idle:"Idle_02",basic:"Liora_Shield_Bash",special:"Liora_Shield_Block",powerful:"Squat_Stance",guard:"Liora_Shield_Block",ward:"Liora_Shield_Block",hit:"Hit_Reaction",death:"Liora_Shield_Death",run:"Running",walk:"Walking",alert:"Alert",breath:"Catching_Breath",push:"Step_Forward_and_Push",approach:"Walk_Fight_Forward"})
});
/* SAVA3D001: compact Mixamo GLB for Sava, same path convention as Nada/Liora. */
const SavaModelAssets=Object.freeze({
 id:"sava",
 url:"dev/assets/models/sava-mobile-animated.glb",
 filename:"sava-mobile-animated.glb",
 source:"dev/assets-src/characters/sava/",
 bytes:1498852,
 sha256:"f88842d6677b1383e5ac337b1d49704462033a3b6e35498f0ea124ee36d4560b",
 clips:Object.freeze({
  idle:"Idle",basic:"mage_soell_cast",special:"mage_soell_cast",
  powerful:"mage_soell_cast_4",guard:"Idle",ward:"Idle",
  hit:"Hit_Reaction_to_Waist",death:"dying_backwards",
  run:"Running",walk:"Walking"
 })
});
if(typeof module!=="undefined"&&module.exports)module.exports=NadaModelAssets;
