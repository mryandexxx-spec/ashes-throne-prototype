/* TECH-004A: dependency-free rules for the CURRENT demo fight.
   This is NOT the final speed-based, manual-ability combat system. */
const CombatCore = (() => {
  "use strict";
  function createBattle(heroes) {
    return heroes.map(hero => ({ ...hero, maxHp: hero.hp }));
  }
  function livingEnemies(fighters) {
    return fighters.map((h, i) => ({ h, i })).filter(({h}) => h.side === "enemy" && h.hp > 0);
  }
  function selectEnemy(fighters, index) {
    return Number.isInteger(index) && fighters[index] &&
      fighters[index].side === "enemy" && fighters[index].hp > 0 ? index : -1;
  }
  function firstLivingEnemy(fighters) {
    const enemies = livingEnemies(fighters);
    return enemies.length ? enemies[0].i : -1;
  }
  function performAttack(fighters, selectedEnemy) {
    // Rules mutate only the supplied demo battle state; never touch DOM or Babylon.
    let targetIndex = selectEnemy(fighters, selectedEnemy);
    if (targetIndex < 0) targetIndex = firstLivingEnemy(fighters);
    const target = fighters[targetIndex];
    const attacker = fighters.find(h => h.side === "ally" && h.hp > 0);
    if (!target || !attacker) return null;

    target.hp = Math.max(0, target.hp - attacker.atk);
    let message = `${attacker.name} наносит ${attacker.atk} урона: ${target.name}`;
    if (target.hp <= 0) {
      message += " — повержен!";
      if (livingEnemies(fighters).length === 0) {
        return { selectedEnemy: -1, active: false, message: "Победа! Отряд одержал верх.", turnDelta: 0 };
      }
      targetIndex = firstLivingEnemy(fighters);
    }

    // Preserve the prototype's legacy single counterattack for this stage only.
    const enemy = fighters.find(h => h.side === "enemy" && h.hp > 0);
    const ally = fighters.find(h => h.side === "ally" && h.hp > 0);
    if (enemy && ally) {
      ally.hp = Math.max(0, ally.hp - enemy.atk);
      message += ` · Ответный удар: ${ally.name} получает ${enemy.atk}`;
    }
    const defeat = !fighters.some(h => h.side === "ally" && h.hp > 0);
    return {
      selectedEnemy: defeat ? -1 : targetIndex,
      active: !defeat,
      message: defeat ? "Поражение. Попробуй ещё раз." : message,
      turnDelta: 1
    };
  }
  return Object.freeze({ createBattle, livingEnemies, selectEnemy, firstLivingEnemy, performAttack });
})();
