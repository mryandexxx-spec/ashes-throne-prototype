---
license: cc-by-sa-3.0
license_link: https://creativecommons.org/licenses/by-sa/3.0/
pretty_name: 0 A.D. Art GLB
tags:
- 3d
- glb
- gltf
- game-assets
- rts
- low-poly
- animation
- characters
- buildings
- threejs
- webgpu
configs:
- config_name: default
  data_files:
  - split: train
    path: data/train-*.parquet
---

# 0 A.D. Art as GLB

<video src="assets/preview.mp4" autoplay loop muted playsinline width="540"></video>

![All 1670 game-ready ancient world models](assets/banner.jpg)

Units, buildings, animals, trees and rocks from the open-source real-time strategy game 0 A.D., each actor resolved into one complete model with its props, textures and animation clips (walk, run, idle, attack, death and more).

> Art by Wildfire Games, CC BY-SA 3.0. If you share these files or anything made from them, credit Wildfire Games with a link to https://www.wildfiregames.com/ and to the licence, and release your changes under CC BY-SA 3.0. Some textures are derived from CGTextures materials, distributed as CC BY-SA under special permission from CGTextures.

1670 game-ready ancient world models from [0 A.D. art](https://gitea.wildfiregames.com/0ad/0ad) by Wildfire Games, 0.0 MB of source files packed into 1.53 GB of GLB (web tier). Credit: 0 A.D. art by Wildfire Games (https://www.wildfiregames.com/), licensed CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/).

Viewer: https://huggingface.co/spaces/codepawl/0ad-art-glb-viewer

## Files

| Folder | Size | What | For |
|---|---|---|---|
| `objects/` | 1.53 GB | meshopt geometry, WebP textures | three.js, Babylon.js, any glTF viewer with the meshopt decoder |
| `objects_ktx2/` | 1.87 GB | meshopt, KTX2 textures (ETC1S colour, UASTC normals), mipmaps | WebGPU and WebGL games: textures stay compressed on the GPU |
| `lods/` | 2.97 GB | three simplified levels aimed at 50, 20 and 6 % of the triangles; each stays within 1, 1.5 and 2 % of the model size from its source, so detailed models keep more | distance LOD, crowds, far props |
| `mobile/` | 1.12 GB | aimed at 25 % of the triangles (within 1.5 % of the model size), textures at most 512 px in KTX2 | phones and light laptops |
| `engine/` | 5.28 GB | no meshopt, no quantization | Blender and desktop engines that cannot decode meshopt |
| `collision/` | 4.7 MB | convex collision shapes, plain glTF | Rapier, Jolt, PhysX, Unity colliders |

`metadata.jsonl` has one line per item: title, kind, licence, authors, triangle count and the path and size of every tier. The Dataset Viewer and `load_dataset` read `data/*.parquet`: the same rows with the mesh (`Mesh`, decoded by trimesh) and the thumbnail (`Image`) embedded. Thumbnails are in `thumbs/`.

## For web games and WebGPU

Load the `objects_ktx2/` files for games: KTX2 textures stay block-compressed on the GPU (BC7 on desktop, ASTC or ETC2 on phones), so they take a fraction of the memory of decoded WebP. Switch to `lods/` by distance and to `mobile/` on phones. `collision/` holds convex shapes for physics.

Measured on 12 items spread over triangle count. Phone page: 390x844 at 3x, pixel ratio capped at 2, CPU throttled 4x, network at Chrome's Fast 4G (150 ms, 9 Mbit/s), so phone load includes the download. The GPU is a desktop RTX 3060 and is not throttled: frame time shows the CPU side only, a real phone GPU is slower. VRAM is geometry plus texture bytes on the GPU.

| Tier | File (median) | VRAM (median) | Triangles | Phone load (4G) | Frame time | WebGPU load (local) |
|---|---|---|---|---|---|---|
| web (12) | 0.5 MB | 5.4 MiB | 1,932 | 668 ms | 0.8 ms | 28 ms |
| ktx2 (12) | 0.7 MB | 1.4 MiB | 1,932 | 1046 ms | 0.9 ms | 25 ms |
| lod2 (12) | 0.3 MB | 2.0 MiB | 916 | 432 ms | 0.8 ms | 12 ms |
| mobile (12) | 0.4 MB | 0.9 MiB | 1,022 | 507 ms | 0.8 ms | 10 ms |

three.js WebGPU:

```js
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const renderer = new WebGPURenderer({ antialias: true });
await renderer.init(); // KTX2Loader needs to know which compressed formats this device takes
const ktx2 = new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/libs/basis/').detectSupport(renderer);
const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.loadAsync('https://huggingface.co/datasets/codepawl/0ad-art-glb/resolve/main/objects_ktx2/fauna-arctic-wolf/fauna-arctic-wolf.glb');
```

## Use it in Crucible

[Crucible](https://github.com/codepawl/crucible) loads these files as they are:

```bash
npm install @codepawlhq/crucible meshoptimizer
```

```js
import { CrucibleRenderer } from '@codepawlhq/crucible';
import { loadGltf } from '@codepawlhq/crucible/addons/gltf';
import { MeshoptDecoder } from 'meshoptimizer';

const asset = await loadGltf('https://huggingface.co/datasets/codepawl/0ad-art-glb/resolve/main/objects/fauna-arctic-wolf/fauna-arctic-wolf.glb', { decoders: { meshopt: MeshoptDecoder } });
const renderer = new CrucibleRenderer(document.querySelector('canvas'), asset.parts, { ground: true });
renderer.render({ eye: [1.5, 1.2, 2], target: [0, 0.5, 0] });
```

## Tested

Every file was loaded and drawn (drawn pixels counted) in each engine, three.js 0.187.0 and 67js 0.15.0, files from a local copy of this repository.

| Tier | three.js WebGL | three.js WebGPU | 67js |
|---|---|---|---|
| web | 1667/1667 | 1667/1667 | 1667/1667 |
| ktx2 | 1667/1667 | 1667/1667 | 1667/1667 |
| lod1 | 1667/1667 | 1667/1667 | 1667/1667 |
| lod2 | 1667/1667 | 1667/1667 | 1667/1667 |
| lod3 | 1667/1667 | 1667/1667 | 1667/1667 |
| mobile | 1667/1667 | 1667/1667 | 1667/1667 |
| engine | 1667/1667 | 1667/1667 | 1667/1667 |
| collision | 1667/1667 | 1667/1667 | 1667/1667 |

Blender 5.2 import: engine 1683/1683, objects 1683/1683, collision 1683/1683.

## Licence and credit

0 A.D. art by Wildfire Games (https://www.wildfiregames.com/), licensed CC BY-SA 3.0 (https://creativecommons.org/licenses/by-sa/3.0/). Licence: CC-BY-SA-3.0 (https://creativecommons.org/licenses/by-sa/3.0/).

Changes made: Actor XML resolved into one model per actor: the most frequent variant of each group, props attached to their prop points, textures applied (the player colour mask baked to the default blue player, cutout alpha for foliage), animation clips imported onto each skeleton and merged by name. Scale set to 0.4 m per game unit. Converted from Collada and DDS to GLB and PNG, then meshopt-compressed, LODs, a mobile tier, an uncompressed engine tier and convex collision hulls. The pack is released under the same CC BY-SA 3.0 licence.

Source: https://gitea.wildfiregames.com/0ad/0ad at commit `61a3b9507d974084e6badb88a0826bd89a6d5b8b`. Packed by [CodePawl](https://huggingface.co/codepawl).
