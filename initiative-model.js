/* Combat-001 sandbox model. Not loaded by index.html; no change to live battle.
   Pure rules: game-time advancement independent of FPS, threshold 1000. */
const InitiativeModel = (() => {
  "use strict";
  function createInitiative(fighters) {
  if (!Array.isArray(fighters) || fighters.length === 0) throw Error("fighters required");
  const ids = new Set();
  return fighters.map((f, index) => {
    if (!f || typeof f.id !== "string" || !f.id || ids.has(f.id)) throw Error("unique id required");
    ids.add(f.id);
    if (!Number.isFinite(f.speed) || f.speed <= 0) throw Error("positive speed required");
    if (!Number.isFinite(f.hp)) throw Error("finite hp required");
    return { id: f.id, speed: f.speed, hp: f.hp, meter: 0, index };
  });
}
  function nextActor(state, speedOf = f => f.speed) {
  const living = state.filter(f => f.hp > 0);
  if (!living.length) return null;
  // Optional effective speed is sampled at the beginning of this initiative
  // advance. The zero-argument path remains identical for legacy consumers.
  const speeds = living.map(f => speedOf(f));
  if (speeds.some(speed => !Number.isFinite(speed) || speed <= 0))
    throw Error("positive effective speed required");
  let delta = Infinity;
  for (let i=0;i<living.length;i++)
    delta = Math.min(delta, Math.max(0,(1000-living[i].meter)/speeds[i]));
  if (!Number.isFinite(delta)) throw Error("invalid time");
  for (let i=0;i<living.length;i++) living[i].meter += speeds[i] * delta;
  // Floating point tie tolerance; no arbitrary random order.
  const ready = living.filter(f => f.meter >= 1000 - 1e-8);
  ready.sort((a,b) => a.index - b.index);
  return ready.length ? { id: ready[0].id, delta } : null;
}
  function finishTurn(state, actorId) {
  const f=state.find(x=>x.id===actorId);
  if(!f||f.hp<=0||f.meter<1000-1e-8)throw Error("actor not ready");
  f.meter=Math.max(0,f.meter-1000);
}
  return Object.freeze({ createInitiative, nextActor, finishTurn });
})();
if (typeof module !== "undefined" && module.exports) module.exports = InitiativeModel;
