/* Combat-002: speed-based manual basic attacks. No DOM or Babylon.js dependencies.
   Test speeds/attack numbers belong to the demo, not the final game balance. */
const CombatCore = (() => {
  "use strict";

  function createBattle(heroes) {
    const initiative = InitiativeModel.createInitiative(heroes);
    const fighters = heroes.map((hero, index) => ({
      ...hero,
      maxHp: hero.hp,
      meter: initiative[index].meter,
      index
    }));
    return {
      fighters,
      turn: 1,
      currentActor: -1,
      selectedEnemy: firstLivingEnemy(fighters),
      active: true,
      winner: null,
      message: "Отряд готов к бою"
    };
  }

  function livingEnemies(fighters) {
    return fighters.map((h, i) => ({ h, i })).filter(({ h }) => h.side === "enemy" && h.hp > 0);
  }

  function selectEnemy(fighters, index) {
    return Number.isInteger(index) && fighters[index] &&
      fighters[index].side === "enemy" && fighters[index].hp > 0 ? index : -1;
  }

  function firstLivingEnemy(fighters) {
    const enemies = livingEnemies(fighters);
    return enemies.length ? enemies[0].i : -1;
  }

  function firstLivingAlly(fighters) {
    return fighters.findIndex(h => h.side === "ally" && h.hp > 0);
  }

  function finishIfOver(battle) {
    if (firstLivingEnemy(battle.fighters) < 0) {
      battle.active = false;
      battle.winner = "ally";
      battle.currentActor = -1;
      battle.selectedEnemy = -1;
      battle.message = "Победа! Отряд одержал верх.";
      return true;
    }
    if (firstLivingAlly(battle.fighters) < 0) {
      battle.active = false;
      battle.winner = "enemy";
      battle.currentActor = -1;
      battle.selectedEnemy = -1;
      battle.message = "Поражение. Попробуй ещё раз.";
      return true;
    }
    return false;
  }

  // Advance game time to the next living actor; resolve AI actions until an ally is ready.
  // This is turn-based, not tied to frame rate or animation timing.
  function advanceToPlayerTurn(battle) {
    if (!battle.active || finishIfOver(battle)) return battle;
    for (let steps = 0; steps < 1000; steps++) {
      const ready = InitiativeModel.nextActor(battle.fighters);
      if (!ready) throw Error("No living actor available");
      const actorIndex = battle.fighters.findIndex(h => h.id === ready.id);
      const actor = battle.fighters[actorIndex];
      if (actor.side === "ally") {
        battle.currentActor = actorIndex;
        if (selectEnemy(battle.fighters, battle.selectedEnemy) < 0) {
          battle.selectedEnemy = firstLivingEnemy(battle.fighters);
        }
        return battle;
      }
      // A simple deterministic enemy AI for the first playable battle.
      const targetIndex = firstLivingAlly(battle.fighters);
      if (targetIndex < 0) {
        finishIfOver(battle);
        return battle;
      }
      const target = battle.fighters[targetIndex];
      target.hp = Math.max(0, target.hp - actor.atk);
      battle.message = actor.name + " атакует " + target.name +
        ": " + actor.atk + " урона.";
      InitiativeModel.finishTurn(battle.fighters, actor.id);
      battle.turn++;
      if (finishIfOver(battle)) return battle;
    }
    throw Error("Turn guard reached: check initiative and actors");
  }

  function chooseEnemy(battle, index) {
    if (!battle.active || selectEnemy(battle.fighters, index) < 0) return false;
    battle.selectedEnemy = index;
    return true;
  }

  // Player can act only with the actual ready ally and against a living enemy.
  function performPlayerAttack(battle) {
    if (!battle.active) return false;
    const actor = battle.fighters[battle.currentActor];
    if (!actor || actor.side !== "ally" || actor.hp <= 0 || actor.meter < 1000 - 1e-8) return false;
    const targetIndex = selectEnemy(battle.fighters, battle.selectedEnemy);
    if (targetIndex < 0) return false;
    const target = battle.fighters[targetIndex];
    target.hp = Math.max(0, target.hp - actor.atk);
    battle.message = actor.name + " наносит " + actor.atk + " урона: " +
      target.name + (target.hp === 0 ? " — повержен!" : ".");
    InitiativeModel.finishTurn(battle.fighters, actor.id);
    battle.turn++;
    battle.currentActor = -1;
    if (finishIfOver(battle)) return true;
    if (target.hp === 0) battle.selectedEnemy = firstLivingEnemy(battle.fighters);
    advanceToPlayerTurn(battle);
    return true;
  }

  return Object.freeze({
    createBattle, livingEnemies, selectEnemy, firstLivingEnemy,
    chooseEnemy, advanceToPlayerTurn, performPlayerAttack
  });
})();