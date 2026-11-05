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
  function nextActor(state) {
  const living = state.filter(f => f.hp > 0);
  if (!living.length) return null;
  let delta = Infinity;
  for (const f of living) delta = Math.min(delta, Math.max(0,(1000-f.meter)/f.speed));
  if (!Number.isFinite(delta)) throw Error("invalid time");
  for (const f of living) f.meter += f.speed * delta;
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
