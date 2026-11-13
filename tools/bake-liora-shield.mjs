// LIORA-SHIELD-006 — reproducible build of dev/assets/models/liora-mobile-animated.glb.
// Not part of the game runtime or `npm test`. Run manually:
//   npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 sharp gl-matrix
//   node tools/bake-liora-shield.mjs <liora_vel_shield_aware_15clips.glb> <liora-shield-mobile.glb> <out.glb>
// Inputs are the two GLBs that were in dev/assets/models/ until this stage (see git history, main 9e72e44).
//
// What it does, in order:
//  1. Shield base colour 2048 -> 1024 WebP q90 (the prop is ~1/3 of the character height).
//  2. Shield vertices are moved into Liora's skin bind space with the matrix from
//     dev/assets-src/characters/liora/shield_attachment.json and skinned 100% to mixamorig:LeftForeArm
//     (JOINTS_0/WEIGHTS_0), as a second node "Liora_Shield" sharing the same skin. The shield then
//     follows every clip rigidly, like a strapped kite shield, with no runtime attachment code.
//  3. Channels that are constant and identical in all 15 clips (127 of 192 node/path pairs: bone
//     translations, scales and some finger rotations) are baked into the node rest transform and removed.
//     Babylon leaves untargeted nodes at their node transform, so playback is unchanged.
//  4. prune / resample / dedup, KHR_mesh_quantization (same settings as RENOPT001 / NADAOPT001),
//     rotation sampler outputs as normalized int16 (core glTF 2.0; Babylon converts on load).
// Textures of the character are not re-encoded (already WebP 2048 q92).
import { NodeIO, Accessor } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition, resample, prune, dedup, quantize, textureCompress } from '@gltf-transform/functions';
import { mat4, vec3, mat3 } from 'gl-matrix';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const [, , lioraIn, shieldIn, out] = process.argv;
if (!lioraIn || !shieldIn || !out) throw new Error('usage: node tools/bake-liora-shield.mjs liora.glb shield.glb out.glb');
const here = path.dirname(fileURLToPath(import.meta.url));
const attachment = JSON.parse(fs.readFileSync(path.join(here, '../dev/assets-src/characters/liora/shield_attachment.json'), 'utf8'));
const M = mat4.clone(attachment.bakeMatrix_gltfColumnMajor);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const liora = await io.read(lioraIn);
const shieldDoc = await io.read(shieldIn);
await shieldDoc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 90 }));
mergeDocuments(liora, shieldDoc);
const root = liora.getRoot();
const skin = root.listSkins()[0];
const joints = skin.listJoints();
const jointIndex = joints.findIndex((n) => n.getName() === attachment.joint);
if (jointIndex < 0) throw new Error('joint not found: ' + attachment.joint);

// --- 2. shield as rigid skinned node
const shieldMesh = root.listMeshes().find((m) => {
  const p = m.listPrimitives()[0];
  return p && !p.getAttribute('JOINTS_0');
});
if (!shieldMesh) throw new Error('shield mesh not found after merge');
const prim = shieldMesh.listPrimitives()[0];
const pos = prim.getAttribute('POSITION'), nrm = prim.getAttribute('NORMAL');
const n = pos.getCount();
const P = new Float32Array(n * 3), N = new Float32Array(n * 3);
const nm = mat3.create(); mat3.normalFromMat4(nm, M);
const v = vec3.create(), w = vec3.create();
for (let i = 0; i < n; i++) {
  pos.getElement(i, v); vec3.transformMat4(w, v, M); P.set(w, i * 3);
  nrm.getElement(i, v); vec3.transformMat3(w, v, nm); vec3.normalize(w, w); N.set(w, i * 3);
}
pos.setArray(P); nrm.setArray(N);
if (mat4.determinant(M) < 0) {
  const idx = prim.getIndices(); const a = idx.getArray().slice();
  for (let t = 0; t < a.length; t += 3) { const tmp = a[t + 1]; a[t + 1] = a[t + 2]; a[t + 2] = tmp; }
  idx.setArray(a);
}
const buffer = root.listBuffers()[0];
const J = new Uint8Array(n * 4), W = new Float32Array(n * 4);
for (let i = 0; i < n; i++) { J[i * 4] = jointIndex; W[i * 4] = 1; }
prim.setAttribute('JOINTS_0', liora.createAccessor('shield_joints').setType(Accessor.Type.VEC4).setArray(J).setBuffer(buffer));
prim.setAttribute('WEIGHTS_0', liora.createAccessor('shield_weights').setType(Accessor.Type.VEC4).setArray(W).setBuffer(buffer));
prim.getMaterial().setName('LioraShield');
shieldMesh.setName('liora_shield');
const charNode = root.listNodes().find((nd) => nd.getMesh() && nd.getSkin());
const shieldNode = liora.createNode('Liora_Shield').setMesh(shieldMesh).setSkin(skin);
(charNode.getParentNode() || root.listScenes()[0]).addChild(shieldNode);
for (const sc of root.listScenes().slice(1)) { for (const c of sc.listChildren()) c.dispose(); sc.dispose(); }
for (const nd of root.listNodes()) {
  if (!nd.getMesh() && nd.listChildren().length === 0 && !joints.includes(nd) && nd !== shieldNode) nd.dispose();
}

// --- 4a. geometry / animation cleanup
await liora.transform(
  unpartition(), prune(), resample(), dedup(), prune(),
  quantize({ quantizePosition: 14, quantizeNormal: 16, quantizeTexcoord: 14, quantizeWeight: 8, quantizationVolume: 'scene' }),
);

// --- 3. constant channels shared by every clip -> node rest TRS
{
  const anims = root.listAnimations(); const byKey = new Map();
  for (const a of anims) for (const ch of a.listChannels()) {
    const k = ch.getTargetNode().getName() + '|' + ch.getTargetPath();
    const o = ch.getSampler().getOutput(); const cnt = o.getCount(), el = o.getElementSize(), arr = o.getArray();
    let constant = true;
    for (let i = 1; i < cnt && constant; i++) for (let c = 0; c < el; c++) if (Math.abs(arr[i * el + c] - arr[c]) > 1e-6) { constant = false; break; }
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push({ ch, constant, value: Array.from(arr.slice(0, el)) });
  }
  let removed = 0;
  for (const list of byKey.values()) {
    if (list.length !== anims.length || !list.every((x) => x.constant)) continue;
    const v0 = list[0].value;
    if (!list.every((x) => x.value.every((c, i) => Math.abs(c - v0[i]) < 1e-6))) continue;
    const node = list[0].ch.getTargetNode(), p = list[0].ch.getTargetPath();
    if (p === 'translation') node.setTranslation(v0); else if (p === 'rotation') node.setRotation(v0); else if (p === 'scale') node.setScale(v0); else continue;
    for (const x of list) { const s = x.ch.getSampler(); x.ch.dispose(); s.dispose(); removed++; }
  }
  console.log('constant channels baked into node TRS:', removed);
  await liora.transform(prune());
}

// --- 4b. rotation outputs as normalized int16
const done = new Set();
for (const a of root.listAnimations()) for (const ch of a.listChannels()) {
  if (ch.getTargetPath() !== 'rotation') continue;
  const o = ch.getSampler().getOutput(); if (done.has(o)) continue; done.add(o);
  const f = o.getArray(); const q = new Int16Array(f.length);
  for (let i = 0; i < f.length; i += 4) {
    const l = Math.hypot(f[i], f[i + 1], f[i + 2], f[i + 3]) || 1;
    for (let c = 0; c < 4; c++) q[i + c] = Math.round(f[i + c] / l * 32767);
  }
  o.setArray(q).setNormalized(true);
}
await io.write(out, liora);
console.log('joint', jointIndex, 'bytes', fs.statSync(out).size);
