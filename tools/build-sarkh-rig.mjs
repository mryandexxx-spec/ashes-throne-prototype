// ARENA-ART-004E — sarkh (snake-bodied) enemy clips without Blender: plan §7, variant C.
// Takes the owner's Meshy SmartRig GLB (no clips) and a Meshy humanoid donor GLB (same clip set
// as every humanoid enemy) and writes a GLB with combat clips on the SmartRig bones:
//  - upper body: per-frame world-rotation delta of each donor bone, mapped by role
//    (spine, neck, head, clavicle, arm, forearm, hand); arm bones are first aligned to the donor's
//    bind direction, so the A-poses need not match. Leg channels are dropped.
//  - donor pelvis: the coil never turns or slides (it is the support); pelvis yaw becomes a twist
//    of the upright body (half below the waist), tilt bends the waist, and forward/side travel
//    becomes a lean of the lower body (clamped), because a snake leans out of its coil instead of stepping.
//  - tail: baked wave per clip, amplitude growing toward the tip, so the coil base stays put and
//    reads as support (PR #339), not as a human with a painted tail.
// Mapped bones are renamed to the donor names (Hips, Spine…, LeftHand, Head), tail bones to
// Tail_<chain>_<nn>, so measurement tools and Babylon read them by role.
// Deterministic: same inputs → same bytes. Not part of the game runtime or `npm test`.
//   node tools/build-sarkh-rig.mjs <rig.glb> <donor.glb> <out.glb> <01-MTJAAr|05-u89dFh>
// Called by tools/build-npc-models.mjs for the npc-sarkh-* entries.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

// ---- quaternion helpers, [x,y,z,w] ----
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qnorm = (q) => { const l = Math.hypot(...q) || 1; return q.map((v) => v / l); };
const qaxis = (ax, ang) => { const l = Math.hypot(...ax) || 1, s = Math.sin(ang / 2); return [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, Math.cos(ang / 2)]; };
const qrot = (q, v) => { const p = qmul(qmul(q, [v[0], v[1], v[2], 0]), qinv(q)); return [p[0], p[1], p[2]]; };
function qslerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map((v) => -v); d = -d; }
  if (d > 0.9995) return qnorm(a.map((v, i) => v + (b[i] - v) * t));
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((v, i) => wa * v + wb * b[i]);
}
const qfromto = (u, v) => { // shortest rotation taking direction u to v
  const a = u.map((x) => x / Math.hypot(...u)), b = v.map((x) => x / Math.hypot(...v));
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return qnorm([c[0], c[1], c[2], 1 + a[0] * b[0] + a[1] * b[1] + a[2] * b[2]]);
};
const yawOf = (q) => { // twist of q about world Y
  const t = qnorm([0, q[1], 0, q[3]]);
  return t;
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round = (v) => Math.round(v * 1e6) / 1e6; // stable bytes across platforms

// ---- rigs: SmartRig bone roles (plan §7, table «Иерархии SmartRig»). Forward is +Z, left is +X. ----
const ARM = (s, a, f, h) => ({ Shoulder: s, Arm: a, ForeArm: f, Hand: h });
const RIGS = {
  '01-MTJAAr': {
    root: 'Bone_000', lean: 'Bone_006', leanHeight: 0.9,
    spine: { Hips: 'Bone_005', Spine02: 'Bone_004', Spine01: 'Bone_003', Spine: 'Bone_002', neck: 'Bone_025', Head: 'Bone_024' },
    left: ARM('Bone_035', 'Bone_034', 'Bone_033', 'Bone_032'),
    right: ARM('Bone_030', 'Bone_029', 'Bone_028', 'Bone_027'),
    // The coil is a ring split into two halves (left and right of the body); they meet behind.
    tails: [
      ['Bone_014', 'Bone_013', 'Bone_012', 'Bone_011', 'Bone_010', 'Bone_009', 'Bone_008', 'Bone_007'],
      ['Bone_022', 'Bone_021', 'Bone_020', 'Bone_019', 'Bone_018', 'Bone_017', 'Bone_016', 'Bone_015'],
    ],
    ring: true,
  },
  '05-u89dFh': {
    root: 'Bone_000', lean: 'Bone_004', leanHeight: 0.9,
    // Bone_003 is a short SmartRig bone pointing back down to Bone_002 (both 0.83 m); left unmapped.
    spine: { Hips: 'Bone_002', Spine02: 'Bone_021', Spine: 'Bone_020', neck: 'Bone_026', Head: 'Bone_025' },
    left: ARM(null, 'Bone_030', 'Bone_029', 'Bone_028'),
    right: ARM(null, 'Bone_034', 'Bone_033', 'Bone_032'),
    // One open chain: from under the body around the back to the tip beside it.
    tails: [['Bone_019', 'Bone_018', 'Bone_017', 'Bone_016', 'Bone_015', 'Bone_014', 'Bone_013', 'Bone_012',
      'Bone_011', 'Bone_010', 'Bone_009', 'Bone_008', 'Bone_007', 'Bone_006', 'Bone_005']],
    ring: false,
  },
};

// Donor clips carried over; legs are dropped. Leg-heavy clips (walk/run, crouch) are not used.
const CLIPS = ['Combat_Stance', 'Thrust_Slash', 'Over_Shoulder_Throw', 'Block1', 'Charged_Spell_Cast', 'Hit_Reaction', 'dying_backwards'];

// Tail motion per clip, as fractions of the clip (measured moments, plan §4 / step 4).
// sway: in-plane wave (about world Y, keeps the coil on the ground); lift: tip off the ground.
// Each term: amplitude at the tip (rad) × envelope(time); idle is periodic over the clip.
const TAU = Math.PI * 2;
const bump = (f, c, w) => Math.exp(-(((f - c) / w) ** 2));
const TAIL = {
  Combat_Stance: (f, s) => ({ sway: 0.2 * Math.sin(TAU * (f * 2 - s)), lift: 0.08 * (0.5 - 0.5 * Math.cos(TAU * (f * 2 - s))) }),
  // Thrust: the tip lashes around the thrust (.25–.30), then settles.
  Thrust_Slash: (f, s) => ({ sway: (0.08 + 0.34 * bump(f, 0.3, 0.12)) * Math.sin(TAU * (f * 3 - s)), lift: 0.22 * bump(f, 0.3, 0.1) }),
  // Throw: wind-up coils the tip, release (.80) whips it.
  Over_Shoulder_Throw: (f, s) => ({ sway: (0.08 + 0.3 * bump(f, 0.8, 0.1)) * Math.sin(TAU * (f * 4 - s)) - 0.16 * bump(f, 0.55, 0.2), lift: 0.2 * bump(f, 0.8, 0.08) }),
  // Block: the coil draws in while the guard is up (.12–.42).
  Block1: (f, s) => ({ sway: -0.16 * bump(f, 0.35, 0.18) + 0.04 * Math.sin(TAU * (f * 2 - s)), lift: 0.04 * bump(f, 0.35, 0.18) }),
  Charged_Spell_Cast: (f, s) => ({ sway: 0.07 * Math.sin(TAU * (f * 2 - s)), lift: 0.12 * bump(f, 0.65, 0.15) }),
  // Hit: a damped jolt from the start of the clip.
  Hit_Reaction: (f, s) => ({ sway: 0.32 * Math.exp(-f * 4) * Math.sin(TAU * (f * 3 - s)), lift: 0.16 * Math.exp(-f * 5) }),
  // Death: tip rises as the body falls (.3–.55), then lies flat and still.
  dying_backwards: (f, s) => ({ sway: 0.14 * bump(f, 0.4, 0.15) * Math.sin(TAU * (f * 2 - s)), lift: 0.2 * bump(f, 0.42, 0.12) }),
};

function loadPose(root) {
  const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
  const world = (n) => { let q = [0, 0, 0, 1]; for (let p = n; p; p = p.getParentNode()) q = qmul(p.getRotation(), q); return qnorm(q); };
  return { byName, world };
}

function sampler(channel) {
  const s = channel.getSampler(), times = s.getInput().getArray(), vals = s.getOutput().getArray(), k = s.getOutput().getElementSize();
  return (t) => {
    let i = 0; while (i < times.length - 1 && times[i + 1] <= t) i++;
    const j = Math.min(i + 1, times.length - 1), span = times[j] - times[i], u = span > 0 ? clamp((t - times[i]) / span, 0, 1) : 0;
    const a = Array.from(vals.subarray(i * k, i * k + k)), b = Array.from(vals.subarray(j * k, j * k + k));
    return k === 4 ? qslerp(a, b, u) : a.map((v, n) => v + (b[n] - v) * u);
  };
}

export async function buildSarkhRig(rigPath, donorPath, outPath, rigKey) {
  const rig = RIGS[rigKey];
  if (!rig) throw new Error('unknown sarkh rig ' + rigKey);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(rigPath), donorDoc = await io.read(donorPath);
  const R = doc.getRoot(), D = donorDoc.getRoot();
  if (R.listAnimations().length) throw new Error('rig already has clips');
  const T = loadPose(R), S = loadPose(D);
  const tn = (name) => { const n = T.byName.get(name); if (!n) throw new Error('rig bone missing ' + name); return n; };
  const sn = (name) => { const n = S.byName.get(name); if (!n) throw new Error('donor bone missing ' + name); return n; };

  // Role map donor → target, in parent-first order.
  const pairs = Object.entries(rig.spine);
  for (const [side, arm] of [['Left', rig.left], ['Right', rig.right]])
    for (const part of ['Shoulder', 'Arm', 'ForeArm', 'Hand']) if (arm[part]) pairs.push([side + part, arm[part]]);
  // Arm alignment: rotate the target bone direction onto the donor bind direction (world).
  const armChild = { Shoulder: 'Arm', Arm: 'ForeArm', ForeArm: 'Hand' };
  const align = new Map();
  for (const [side, arm] of [['Left', rig.left], ['Right', rig.right]]) {
    for (const part of ['Shoulder', 'Arm', 'ForeArm']) {
      const child = armChild[part];
      if (!arm[part] || !arm[child]) continue;
      const dDir = sub(sn(side + child).getWorldTranslation(), sn(side + part).getWorldTranslation());
      const tDir = sub(tn(arm[child]).getWorldTranslation(), tn(arm[part]).getWorldTranslation());
      align.set(side + part, qfromto(tDir, dDir));
    }
    align.set(side + 'Hand', align.get(side + 'ForeArm')); // hand keeps its angle to the forearm
  }

  const tailBones = rig.tails.flat();
  const animated = [rig.root, rig.lean, ...pairs.map(([, t]) => t), ...tailBones];
  const animatedSet = new Set(animated);
  // Every joint is solved (unanimated ones keep their bind local rotation) so children of a
  // yawed or leaning parent follow it; tracks are written only for the animated set.
  const order = [...R.listSkins()[0].listJoints()];
  // depth sort so parents are solved before children
  const depth = (n) => { let d = 0; for (let p = n.getParentNode(); p; p = p.getParentNode()) d++; return d; };
  order.sort((a, b) => depth(a) - depth(b) || a.getName().localeCompare(b.getName()));
  const roleOf = new Map(pairs.map(([d, t]) => [t, d]));
  const bindLocal = new Map(order.map((n) => [n.getName(), n.getRotation()]));
  const bindWorldT = new Map(order.map((n) => [n.getName(), T.world(n)]));
  const bindWorldS = new Map(pairs.map(([d]) => [d, S.world(sn(d))]));
  // Tail: per-bone weight (0 at the base, 1 at the tip) and world axes in the bind pose.
  const tailInfo = new Map();
  rig.tails.forEach((chain, ci) => chain.forEach((name, i) => {
    const n = tn(name), u = i / (chain.length - 1);
    const next = chain[i + 1] ? tn(chain[i + 1]) : null, prev = chain[i - 1] ? tn(chain[i - 1]) : null;
    const dir = next ? sub(next.getWorldTranslation(), n.getWorldTranslation()) : sub(n.getWorldTranslation(), prev.getWorldTranslation());
    const side = [dir[2], 0, -dir[0]]; // horizontal, perpendicular to the segment: lift axis
    // Base third carries the body: almost still. Weight grows to 1 at the tip.
    const w = Math.max(0, (u - 0.3) / 0.7) ** 1.3 / chain.length * 4;
    // On the ring the two halves mirror each other so the tips stay together behind.
    tailInfo.set(name, { w, side, mirror: rig.ring && ci === 1 ? -1 : 1, phase: u * 0.9 });
  }));

  const donorHips = sn('Hips');
  const hipsBindPos = donorHips.getWorldTranslation();
  const donorScale = donorHips.getParentNode().getWorldMatrix()[0]; // Meshy humanoid: cm under 0.01
  const out = [];
  for (const clipName of CLIPS) {
    const anim = D.listAnimations().find((a) => a.getName() === clipName);
    if (!anim) throw new Error('donor clip missing ' + clipName);
    const rot = new Map(), hipsT = { f: null };
    let times = null;
    for (const ch of anim.listChannels()) {
      const n = ch.getTargetNode(), path = ch.getTargetPath();
      if (path === 'rotation') rot.set(n.getName(), sampler(ch));
      if (path === 'translation' && n === donorHips) hipsT.f = sampler(ch);
      const ts = ch.getSampler().getInput().getArray();
      if (!times || ts.length > times.length) times = Array.from(ts);
    }
    const len = times[times.length - 1];
    // donor world rotation of a role bone at time t
    const donorWorld = (name, t) => {
      let q = [0, 0, 0, 1];
      for (let p = sn(name); p; p = p.getParentNode()) q = qmul(rot.has(p.getName()) ? rot.get(p.getName())(t) : p.getRotation(), q);
      return qnorm(q);
    };
    const tracks = new Map(order.filter((n) => animatedSet.has(n.getName())).map((n) => [n.getName(), []]));
    for (const t of times) {
      const f = len > 0 ? t / len : 0;
      const dHips = qmul(donorWorld('Hips', t), qinv(bindWorldS.get('Hips')));
      // The coil stays put (support): pelvis yaw becomes a twist, half below the waist and the rest
      // through the mapped spine (whose world deltas already carry it).
      const halfYaw = qslerp([0, 0, 0, 1], yawOf(dHips), 0.5);
      // pelvis travel in metres becomes a lean of the lower body toward it
      const hp = hipsT.f ? hipsT.f(t) : donorHips.getTranslation();
      const d = sub(hp, donorHips.getTranslation()).map((v) => v * donorScale);
      const h = rig.leanHeight, maxLean = 0.4; // ~23°: a lunge, not a fall
      const leanW = qmul(qaxis([1, 0, 0], clamp(Math.atan2(d[2], h), -maxLean, maxLean)),
        qaxis([0, 0, 1], clamp(-Math.atan2(d[0], h), -maxLean, maxLean)));
      const tail = TAIL[clipName];
      const world = new Map();
      for (const n of order) {
        const name = n.getName(), parent = n.getParentNode();
        const pw = world.get(parent.getName()) || T.world(parent);
        let w;
        if (name === rig.root) w = bindWorldT.get(name);
        else if (name === rig.lean) w = qmul(leanW, qmul(halfYaw, bindWorldT.get(name)));
        else if (roleOf.has(name)) {
          const role = roleOf.get(name);
          const delta = qmul(donorWorld(role, t), qinv(bindWorldS.get(role)));
          w = qmul(leanW, qmul(delta, qmul(align.get(role) || [0, 0, 0, 1], bindWorldT.get(name))));
        } else if (!tailInfo.has(name)) {
          w = qmul(pw, bindLocal.get(name));
        } else {
          const info = tailInfo.get(name);
          const { sway, lift } = tail(f, info.phase);
          // axes rotate with the parent so the wave rides on the yawed coil
          const pRot = qmul(pw, qinv(T.world(parent)));
          const q = qmul(qaxis([0, 1, 0], sway * info.w * info.mirror), qaxis(qrot(pRot, info.side), lift * info.w));
          w = qmul(q, qmul(pw, bindLocal.get(name)));
        }
        world.set(name, qnorm(w));
        if (!tracks.has(name)) continue;
        const local = qnorm(qmul(qinv(pw), world.get(name)));
        // keep the hemisphere continuous so linear interpolation does not flip
        const tr = tracks.get(name), prev = tr[tr.length - 1];
        const fixed = prev && prev[0] * local[0] + prev[1] * local[1] + prev[2] * local[2] + prev[3] * local[3] < 0 ? local.map((v) => -v) : local;
        tr.push(fixed);
      }
    }
    out.push({ clipName, times, tracks });
  }

  // Write clips; rename role bones.
  const buffer = R.listBuffers()[0];
  for (const { clipName, times, tracks } of out) {
    const anim = doc.createAnimation(clipName);
    const input = doc.createAccessor().setType('SCALAR').setArray(new Float32Array(times.map(round))).setBuffer(buffer);
    for (const [name, qs] of tracks) {
      const output = doc.createAccessor().setType('VEC4').setArray(new Float32Array(qs.flat().map(round))).setBuffer(buffer);
      const s = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
      anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(tn(name)).setTargetPath('rotation').setSampler(s));
    }
  }
  for (const [role, name] of pairs) tn(name).setName(role);
  tn(rig.lean).setName('SnakeBody');
  rig.tails.forEach((chain, ci) => chain.forEach((name, i) => tn(name).setName(`Tail_${ci}_${String(i).padStart(2, '0')}`)));
  await io.write(outPath, doc);
  return { clips: out.map((c) => c.clipName), bones: order.length, tail: tailBones.length };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [rigPath, donorPath, outPath, key] = process.argv.slice(2);
  if (!key) throw new Error('usage: node tools/build-sarkh-rig.mjs <rig.glb> <donor.glb> <out.glb> <01-MTJAAr|05-u89dFh>');
  console.log(JSON.stringify(await buildSarkhRig(rigPath, donorPath, outPath, key)));
}
