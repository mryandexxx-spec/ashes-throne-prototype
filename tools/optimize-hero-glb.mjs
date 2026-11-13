// RENOPT001 — reproducible mobile optimization of a hero GLB.
// Not part of the game runtime or `npm test`. Run manually:
//   npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 sharp
//   node tools/optimize-hero-glb.mjs input.glb output.glb
// Settings approved for Ren on 13.11.2026: base colour 2048 WebP q90, normal 1024 q95,
// metallic-roughness 1024 q92, lossless-tolerance animation resampling, KHR_mesh_quantization
// (decoded natively by Babylon.js, no extra decoder download). All animation clips are kept.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample, prune, dedup, quantize, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const [, , input, output] = process.argv;
if (!input || !output) throw new Error('usage: node tools/optimize-hero-glb.mjs input.glb output.glb');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
await doc.transform(
  prune(), resample(), dedup(), prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 90, slots: /^baseColor/ }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 95, slots: /^normal/ }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 92, slots: /^metallicRoughness/ }),
  quantize({ quantizePosition: 14, quantizeNormal: 16, quantizeTexcoord: 14, quantizeWeight: 8 }),
);
await io.write(output, doc);
