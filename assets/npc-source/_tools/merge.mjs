// ARENA-ART-004: one GLB per model = rigged mesh + clips from separate Meshy animation GLBs.
// Usage: node merge.mjs <modelDir> <out.glb> clip1.glb clip2.glb ...
// Channels are rebound to base nodes by node name; clip named after the Meshy action.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';

const [, , dir, outFile, ...clipFiles] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const base = await io.read(`${dir}/rigged.glb`);
const root = base.getRoot();
for (const a of root.listAnimations()) a.dispose(); // Meshy's 0.03s "clip0" bind-pose stub
const nodes = new Map(root.listNodes().map(n => [n.getName(), n]));
const buffer = root.listBuffers()[0];
const report = [];
for (const file of clipFiles) {
  const src = await io.read(file);
  for (const a of src.getRoot().listAnimations()) {
    const name = a.getName().split('|')[1] || a.getName();
    const anim = base.createAnimation(name);
    const map = new Map();
    let missing = 0;
    for (const ch of a.listChannels()) {
      const target = nodes.get(ch.getTargetNode()?.getName());
      if (!target) { missing++; continue; }
      const s = ch.getSampler();
      let ns = map.get(s);
      if (!ns) {
        const copy = acc => base.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buffer);
        ns = base.createAnimationSampler().setInput(copy(s.getInput())).setOutput(copy(s.getOutput())).setInterpolation(s.getInterpolation());
        anim.addSampler(ns); map.set(s, ns);
      }
      anim.addChannel(base.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(ns));
    }
    report.push(`${name}${missing ? ` (missing ${missing})` : ''}`);
  }
}
await base.transform(dedup(), prune());
await io.write(outFile, base);
console.log(dir.split('/').pop(), report.join(', '));
