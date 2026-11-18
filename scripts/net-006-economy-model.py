"""NET-006 research-only Monte Carlo. Does NOT import or modify game data/saves.

All rewards/catalog weights in this program are hypothetical and unapproved.
Run: python3 scripts/net-006-economy-model.py
"""
from __future__ import annotations

from random import Random
from statistics import mean, median

# Fe, Le, Cl, Wo, Fa, Th, Gl. From GEAR-ECON-005B, active five heroes.
TARGETS = (
    (125, 98, 132, 12, 82, 34, 6),       # complete G3
    (647, 908, 666, 57, 361, 79, 96),    # complete G8
    (1457, 2268, 1452, 137, 730, 159, 256),  # complete G13
)
FREE_FIRST_CLEARS = (9, 8, 15, 1, 6, 4, 1)
# Proposed ONLY, not configured by the live game.
MATERIALS_PER_CLUE = (12, 18, 24)
CURRENCY_PER_CLUE = (1000, 2000, 4000)
XP_PER_CLUE = (100, 150, 200)
MATERIAL_TEMPLATES = 7
NON_MATERIAL_TEMPLATES = 2  # hypothetical threat trace and ordinary hero
FOCUS_WEIGHT = 4
GUARANTEE_AFTER = 3
ARRIVALS_PER_DAY = 4
SEEDS = 1500


def run(seed: int):
    rng = Random(seed)
    owned = list(FREE_FIRST_CLEARS)
    cumulative_clues = 0
    cumulative_currency = 0
    cumulative_xp = 0
    checkpoints = []
    for stage, target in enumerate(TARGETS):
        order = None
        misses = 0
        while any(owned[i] < target[i] for i in range(MATERIAL_TEMPLATES)):
            deficit = [max(0, target[i] - owned[i]) for i in range(MATERIAL_TEMPLATES)]
            if order is None or deficit[order] == 0:
                # Simple sticky-target strategy, not an optimized player policy.
                order = max(range(MATERIAL_TEMPLATES), key=lambda i: deficit[i])
                misses = 0
            pool = list(range(MATERIAL_TEMPLATES + NON_MATERIAL_TEMPLATES))
            if misses + 1 >= GUARANTEE_AFTER:
                chosen = order
            else:
                weights = [FOCUS_WEIGHT if i == order else 1 for i in pool]
                chosen = rng.choices(pool, weights=weights, k=1)[0]
            misses = 0 if chosen == order else misses + 1
            if chosen < MATERIAL_TEMPLATES:
                owned[chosen] += MATERIALS_PER_CLUE[stage]
            cumulative_clues += 1
            cumulative_currency += CURRENCY_PER_CLUE[stage]
            cumulative_xp += XP_PER_CLUE[stage]
        checkpoints.append((cumulative_clues, cumulative_currency, cumulative_xp))
    return checkpoints


def percentile(values, q):
    xs = sorted(values)
    return xs[int(q * len(xs))]


def main():
    scenarios = [run(seed) for seed in range(SEEDS)]
    for i, label in enumerate(('G3', 'G8', 'G13')):
        clues = [s[i][0] for s in scenarios]
        days = [x / ARRIVALS_PER_DAY for x in clues]
        currency = [s[i][1] for s in scenarios]
        xp = [s[i][2] for s in scenarios]
        print(f'{label}: median clues={median(clues)}, median days={median(days):.1f}, '
              f'p10={percentile(days, .1):.1f}, p90={percentile(days, .9):.1f}, '
              f'median currency={median(currency)}, median xp={median(xp)}')
    p = FOCUS_WEIGHT / (FOCUS_WEIGHT + MATERIAL_TEMPLATES + NON_MATERIAL_TEMPLATES - 1)
    cycles = sum((1 - p) ** k for k in range(GUARANTEE_AFTER))
    print(f'probability before guarantee={p:.6f}; targeted fraction={1/cycles:.6f}')


if __name__ == '__main__':
    main()
