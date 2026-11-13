// NADAOPT001 — one-off generator of comparison variants A–E (docs/NADA_GLB_OPTIMIZE_001.md). Not used by the game or npm test.
// Production file = tools/optimize-hero-glb.mjs (identical to variant B settings).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample, prune, dedup, quantize, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
const [, , src, outDir='.'] = process.argv; // original 3 096 808-byte Nada GLB (git show 7efefea:dev/assets/models/nada-mobile-animated.glb)
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const base=()=>[prune(),resample(),dedup(),prune(),quantize({quantizePosition:14,quantizeNormal:16,quantizeTexcoord:14,quantizeWeight:8})];
const V={
 A:[],
 B:[textureCompress({encoder:sharp,targetFormat:'webp',resize:[2048,2048],quality:90,slots:/^baseColor/})],
 C:[textureCompress({encoder:sharp,targetFormat:'webp',resize:[2048,2048],quality:80,slots:/^baseColor/})],
 D:[textureCompress({encoder:sharp,targetFormat:'webp',resize:[1536,1536],quality:90,slots:/^baseColor/})],
 E:[textureCompress({encoder:sharp,targetFormat:'webp',resize:[1024,1024],quality:90,slots:/^baseColor/})],
};
for(const [k,t] of Object.entries(V)){const d=await io.read(src);await d.transform(...base(),...t);await io.write(`${outDir}/${k}.glb`,d);}
