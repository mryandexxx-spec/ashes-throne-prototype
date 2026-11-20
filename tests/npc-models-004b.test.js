// ARENA-ART-004B: enemy GLBs on disk match dev/src/assets/npc-models.js and carry every slotted clip.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.join(__dirname,"..");
const NpcModelAssets=require("../dev/src/assets/npc-models.js");
const NpcEnemyData=require("../npc-enemy-data.js");

const SLOTS=["idle","basic","special","powerful","guard","ward","hit","death","run","walk"];
const HUMANOIDS=["npc-pass-guard","npc-trail-interceptor","npc-ridge-slinger","npc-field-medic",
 "npc-route-signaller","npc-watch-captain","npc-laun-ford-guard","npc-laun-physician"];
// ARENA-ART-004E: SmartRig snakes with clips carried over from a humanoid (tools/build-sarkh-rig.mjs).
const SARKH=["npc-sarkh-convoy-guard","npc-sarkh-land-courier"];
const ALL=[...HUMANOIDS,...SARKH];

function glbJson(buf){
 assert.equal(buf.readUInt32LE(0),0x46546c67,"GLB magic");
 assert.equal(buf.readUInt32LE(8),buf.length,"GLB length header");
 const len=buf.readUInt32LE(12);
 assert.equal(buf.readUInt32LE(16),0x4e4f534a,"first chunk is JSON");
 return JSON.parse(buf.subarray(20,20+len).toString("utf8"));
}

test("manifest covers the 8 humanoids and the 2 sarkh",()=>{
 assert.deepEqual(Object.keys(NpcModelAssets.models).sort(),[...ALL].sort());
 assert.ok([1024,2048].includes(NpcModelAssets.baseColorSize));
 for(const id of ALL)assert.ok(NpcEnemyData.get(id),`${id} exists in npc-enemy-data.js`);
});

for(const id of ALL){
 test(`${id}: file, size, sha256, skin, clips and texture match the manifest`,()=>{
  const m=NpcModelAssets.models[id];
  assert.equal(m.id,id);
  assert.equal(m.url,`dev/assets/models/${id}.glb`);
  const buf=fs.readFileSync(path.join(root,m.url));
  assert.equal(buf.length,m.bytes);
  assert.equal(crypto.createHash("sha256").update(buf).digest("hex"),m.sha256);
  assert.ok(buf.length<1.5*1024*1024,"audit budget ~1.5 MB per model");
  const json=glbJson(buf);
  assert.equal((json.skins||[]).length,1);
  assert.deepEqual(Object.keys(m.clips),SLOTS);
  const names=new Set((json.animations||[]).map(a=>a.name));
  for(const slot of SLOTS)assert.ok(names.has(m.clips[slot]),`${slot} → ${m.clips[slot]}`);
  assert.deepEqual(json.extensionsRequired?.slice().sort(),["EXT_texture_webp","KHR_mesh_quantization"]);
  assert.equal(json.images.length,1);
  assert.equal(json.images[0].mimeType,"image/webp");
 });
}
