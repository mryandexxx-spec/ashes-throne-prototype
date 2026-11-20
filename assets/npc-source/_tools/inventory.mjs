// ARENA-ART-004 step 1: GLB inventory. Usage: node inventory.mjs <file.glb>... > out.json
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const out = [];
for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  let tris = 0;
  for (const mesh of root.listMeshes())
    for (const p of mesh.listPrimitives()) {
      const idx = p.getIndices();
      const n = idx ? idx.getCount() : p.getAttribute('POSITION').getCount();
      if (p.getMode() === 4) tris += n / 3;
    }
  const textures = [];
  for (const t of root.listTextures()) {
    const img = t.getImage();
    let dim = '?';
    try { const m = await sharp(Buffer.from(img)).metadata(); dim = `${m.width}x${m.height}`; } catch {}
    const slots = root.listMaterials().flatMap(m => [
      m.getBaseColorTexture() === t && 'color', m.getNormalTexture() === t && 'normal',
      m.getMetallicRoughnessTexture() === t && 'MR', m.getOcclusionTexture() === t && 'AO',
      m.getEmissiveTexture() === t && 'emissive']).filter(Boolean);
    textures.push({ slots: [...new Set(slots)].join('+') || '-', mime: t.getMimeType(), dim, kb: Math.round(img.byteLength / 1024) });
  }
  const skins = root.listSkins();
  const bones = Math.max(0, ...skins.map(s => s.listJoints().length));
  const boneNames = skins[0]?.listJoints().map(j => j.getName()) || [];
  const clips = root.listAnimations().map(a => {
    let max = 0, keys = 0;
    for (const s of a.listSamplers()) { const i = s.getInput(); keys += i.getCount(); max = Math.max(max, i.getMax([0])[0]); }
    return { name: a.getName(), sec: +max.toFixed(2), keys };
  });
  const scene = root.getDefaultScene() || root.listScenes()[0];
  const b = getBounds(scene);
  const size = b.max.map((v, i) => +(v - b.min[i]).toFixed(3));
  // Forward axis: world position of toe vs foot at bind pose (toe points forward).
  const byName = n => root.listNodes().find(x => new RegExp(n, 'i').test(x.getName()));
  let forward = 'n/a';
  const foot = byName('LeftFoot$'), toe = byName('LeftToe(Base)?$');
  if (foot && toe) {
    const f = foot.getWorldTranslation(), t = toe.getWorldTranslation();
    const d = [t[0] - f[0], t[2] - f[2]];
    forward = Math.abs(d[0]) > Math.abs(d[1]) ? (d[0] > 0 ? '+X' : '-X') : (d[1] > 0 ? '+Z' : '-Z');
  }
  const rootNodes = scene.listChildren().map(n => ({ name: n.getName(), s: n.getScale().map(v => +v.toFixed(3)), r: n.getRotation().map(v => +v.toFixed(3)) }));
  out.push({
    model: path.basename(path.dirname(file)), file: path.basename(file),
    mb: +(fs.statSync(file).size / 1048576).toFixed(2), tris: Math.round(tris),
    meshes: root.listMeshes().length, materials: root.listMaterials().length,
    textures, bones, rigPrefix: boneNames[0]?.split(':')[0] || '-', boneSample: boneNames.slice(0, 3),
    clips, sizeM: size, minY: +b.min[1].toFixed(3), forward, rootNodes,
    extensions: root.listExtensionsUsed().map(e => e.extensionName),
  });
}
console.log(JSON.stringify(out, null, 1));
