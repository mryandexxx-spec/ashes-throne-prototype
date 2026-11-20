// ARENA-ART-004B — optimise the enemy (NPC) GLBs and write the manifest dev/src/assets/npc-models.js.
// Not part of the game runtime or `npm test`. Run manually:
//   npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 sharp
//   node tools/build-npc-models.mjs <dir with NN-<code>.glb or NN-<code>/model.glb> [--base-color=2048|1024]
// Sources: branch assets/npc-meshy-source, assets/npc-source/NN-<code>/model.glb (rig + clips merged by _tools/merge.mjs).
// Optimisation is tools/optimize-hero-glb.mjs unchanged (hero settings); only the base colour size is a parameter.
// Model ↔ NPC binding and clip slots: docs/ARENA_ART_004_PLAN.md, sections 3–4 [УТВЕРЖДЕНО 20.11.2026].
// ARENA-ART-004E: the two sarkh (01, 05) are SmartRig models without clips. tools/build-sarkh-rig.mjs first
// carries the upper-body clips over from a humanoid donor by bone role and bakes the tail wave, then the
// result goes through the same optimiser. Snakes do not walk: run/walk point at the stance.
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { buildSarkhRig } from './build-sarkh-rig.mjs';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const srcDir = args.find((a) => !a.startsWith('--'));
const baseColorArg = args.find((a) => a.startsWith('--base-color=')) || '--base-color=2048';
const baseColor = Number(baseColorArg.split('=')[1]);
if (!srcDir) throw new Error('usage: node tools/build-npc-models.mjs <source dir> [--base-color=2048|1024]');

const STANCE = 'Combat_Stance', SLASH = 'Thrust_Slash', THROW = 'Over_Shoulder_Throw', BLOCK = 'Block1',
  CAST = 'Charged_Spell_Cast', HIT = 'Hit_Reaction', DEATH = 'dying_backwards', COMBO = 'Triple_Combo_Attack',
  CHARGE_THROW = 'Crouch_Charge_and_Throw', RUN = 'running', WALK = 'walking_man';
const slots = (basic, special, powerful, guard) =>
  ({ idle: STANCE, basic, special, powerful, guard, ward: BLOCK, hit: HIT, death: DEATH, run: RUN, walk: WALK });
// Heal / defence play `guard` on the caster and `ward` on the target (battle-animation.js), so such slots repeat guard.
const tank = (powerful = BLOCK) => slots(SLASH, BLOCK, powerful, BLOCK);
const support = () => slots(SLASH, CAST, CAST, CAST); // healers' special is a heal; signaller's «Указать угрозу» is a gesture
const sarkh = (...a) => ({ ...slots(...a), run: STANCE, walk: STANCE });
const NPCS = [
  { archetypeId: 'npc-pass-guard', source: '10-F3228H', clips: tank() },
  { archetypeId: 'npc-trail-interceptor', source: '06-KEqUK9', clips: slots(SLASH, SLASH, COMBO, BLOCK) },
  { archetypeId: 'npc-ridge-slinger', source: '03-uxxjpS', clips: slots(THROW, THROW, CHARGE_THROW, BLOCK) },
  { archetypeId: 'npc-field-medic', source: '07-cwNdYM', clips: support() },
  { archetypeId: 'npc-route-signaller', source: '04-SaeT23', clips: support() },
  { archetypeId: 'npc-watch-captain', source: '02-jVfhQh', clips: tank(COMBO) },
  { archetypeId: 'npc-laun-ford-guard', source: '08-bj9ujd', clips: tank() },
  { archetypeId: 'npc-laun-physician', source: '09-8zzEJb', clips: support() },
  // Sarkh: donor 02-jVfhQh (any humanoid works, the Meshy clip set and timing are the same on all 8 rigs).
  // Courier's «Скорый выстрел» reuses the throw: Crouch_Charge_and_Throw is a crouch a snake cannot do.
  { archetypeId: 'npc-sarkh-convoy-guard', source: '01-MTJAAr', donor: '02-jVfhQh', clips: sarkh(SLASH, BLOCK, BLOCK, BLOCK) },
  { archetypeId: 'npc-sarkh-land-courier', source: '05-u89dFh', donor: '02-jVfhQh', clips: sarkh(THROW, THROW, THROW, BLOCK) },
];

function glbJson(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}

const sourceGlb = (code) => {
  const found = [join(srcDir, `${code}.glb`), join(srcDir, code, 'model.glb')].find(existsSync);
  if (!found) throw new Error(`source missing for ${code}`);
  return found;
};
const entries = [];
for (const npc of NPCS) {
  let input = sourceGlb(npc.source);
  if (npc.donor) {
    const rigged = join(tmpdir(), `sarkh-${npc.source}.glb`);
    await buildSarkhRig(input, sourceGlb(npc.donor), rigged, npc.source);
    input = rigged;
  }
  const file = `${npc.archetypeId}.glb`;
  const out = join(root, 'dev/assets/models', file);
  execFileSync(process.execPath, [join(root, 'tools/optimize-hero-glb.mjs'), input, out, `--base-color=${baseColor}`], { stdio: 'ignore' });
  const buf = readFileSync(out);
  const json = glbJson(buf);
  const names = new Set((json.animations || []).map((a) => a.name));
  for (const clip of new Set(Object.values(npc.clips))) if (!names.has(clip)) throw new Error(`${file}: clip ${clip} missing`);
  if ((json.skins || []).length !== 1) throw new Error(`${file}: expected one skin`);
  entries.push({ ...npc, file, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') });
  console.log(`${file.padEnd(28)} ${String(buf.length).padStart(8)} B  ${names.size} clips`);
}

const q = JSON.stringify;
const body = entries.map((e) => ` ${q(e.archetypeId)}:Object.freeze({\n  id:${q(e.archetypeId)},url:${q('dev/assets/models/' + e.file)},filename:${q(e.file)},\n` +
  `  source:${q('assets/npc-source/' + e.source + '/model.glb')},${e.donor ? `clipDonor:${q('assets/npc-source/' + e.donor + '/model.glb')},` : ''}bytes:${e.bytes},sha256:${q(e.sha256)},\n` +
  `  clips:Object.freeze(${q(e.clips).replace(/"([a-z]+)":/g, '$1:')})\n })`).join(',\n');
writeFileSync(join(root, 'dev/src/assets/npc-models.js'),
`/* ARENA-ART-004B — static enemy model manifest, same shape as NadaModelAssets (dev/src/assets/models.js).
 * GENERATED by tools/build-npc-models.mjs --base-color=${baseColor}; do not edit by hand.
 * Keyed by archetypeId from npc-enemy-data.js. Binding and clip slots: docs/ARENA_ART_004_PLAN.md §3–4.
 * Sarkh (npc-sarkh-*, ARENA-ART-004E): SmartRig + clips carried over from clipDonor by tools/build-sarkh-rig.mjs.
 * Classic script because the prototype is not an ES-module build. */
const NpcModelAssets=Object.freeze({
 baseColorSize:${baseColor},
 models:Object.freeze({
${body.replace(/^/gm, ' ')}
 })
});
if(typeof module!=="undefined"&&module.exports)module.exports=NpcModelAssets;
`);
console.log(`manifest: dev/src/assets/npc-models.js (${entries.length} models, base colour ${baseColor})`);
