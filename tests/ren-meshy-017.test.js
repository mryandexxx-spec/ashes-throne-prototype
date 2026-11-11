/* RENMESH017 — static integrity gate. Full WebGL visual acceptance remains separate. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const RenGlbRuntime=require("../ren-glb-runtime.js");
const asset=path.join(__dirname,"../assets/ren-meshy-mixamo-animated.glb");
test("Meshy GLB is present and contains skinned Mixamo animation clips",()=>{
 assert.equal(RenGlbRuntime.ASSET_URL,"assets/ren-meshy-mixamo-animated.glb");
 assert.ok(fs.existsSync(asset),"Upload the approved Meshy GLB to assets/ before merge");
 const bytes=fs.readFileSync(asset);
 assert.equal(bytes.toString("ascii",0,4),"glTF");
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const chunkSize=bytes.readUInt32LE(12);
 assert.equal(bytes.toString("ascii",16,20),"JSON");
 const data=JSON.parse(bytes.toString("utf8",20,20+chunkSize));
 assert.ok(data.skins?.length>=1,"GLB must contain a rig");
 assert.ok(data.skins[0].joints.length>=40,"Expected Mixamo humanoid rig");
 const names=new Set((data.animations||[]).map(a=>a.name));
 for(const name of ["Idle_4","Walking","Running","Double_Combo_Attack","Axe_Spin_Attack","Slap_Reaction","Dead","Victory_Cheer","Stand_and_Chat"])
  assert.ok(names.has(name),"Missing animation "+name);
 for(const slot of ["idle","basic","special","powerful","hit","death"])
  assert.ok(names.has(RenGlbRuntime.clipFor(slot)),"Missing mapped slot "+slot);
});
