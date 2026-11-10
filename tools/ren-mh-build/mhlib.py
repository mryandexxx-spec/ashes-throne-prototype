# MakeHuman helpers: base mesh, targets, skeleton joints, weights (all assets CC0, read as data only)
import json, os
import numpy as np

MH = os.environ.get('MH_ASSET_DIR', os.path.join(os.path.dirname(__file__), 'makehuman'))
TG = os.environ.get('MH_TARGETS_DIR', os.path.join(MH, 'targets'))


def load_obj(path=os.path.join(MH, 'base.obj')):
    V, VT, F = [], [], []          # F: (group, [(vi, ti)...])
    g = None
    with open(path) as fh:
        for l in fh:
            if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
            elif l.startswith('vt '): VT.append([float(x) for x in l.split()[1:3]])
            elif l.startswith('g '): g = l.split()[1]
            elif l.startswith('f '):
                c = []
                for t in l.split()[1:]:
                    a = t.split('/'); c.append((int(a[0]) - 1, int(a[1]) - 1 if len(a) > 1 and a[1] else -1))
                F.append((g, c))
    return np.array(V, float), np.array(VT, float), F


def load_target(rel):
    p = os.path.join(TG, rel)
    if not p.endswith('.target'): p += '.target'
    idx, d = [], []
    with open(p) as fh:
        for l in fh:
            if not l.strip() or l[0] == '#': continue
            a = l.split(); idx.append(int(a[0])); d.append([float(x) for x in a[1:4]])
    return np.array(idx, int), np.array(d, float)


def apply_targets(V, spec):
    V = V.copy()
    for rel, w in spec:
        if abs(w) < 1e-6: continue
        i, d = load_target(rel)
        if not len(i): print('empty target', rel); continue
        V[i] += w * d
    return V


def macro_spec(gender=1.0, muscle=0.5, weight=0.5, height=0.5, proportions=0.5, race=None):
    """MakeHuman macro modifier weights for a young adult (age 25)."""
    race = race or {'caucasian': 1.0}
    gw = {'male': gender, 'female': 1 - gender}
    mw = {'minmuscle': max(0, (0.5 - muscle) * 2), 'averagemuscle': 1 - abs(muscle - 0.5) * 2, 'maxmuscle': max(0, (muscle - 0.5) * 2)}
    ww = {'minweight': max(0, (0.5 - weight) * 2), 'averageweight': 1 - abs(weight - 0.5) * 2, 'maxweight': max(0, (weight - 0.5) * 2)}
    spec = []
    for g, a in gw.items():
        if a <= 0: continue
        for r, rv in race.items(): spec.append((f'macrodetails/{r}-{g}-young', a * rv))
        for m, b in mw.items():
            if b <= 0: continue
            for wn, c in ww.items():
                if c <= 0: continue
                spec.append((f'macrodetails/universal-{g}-young-{m}-{wn}', a * b * c))
                if height != 0.5:
                    hn = 'maxheight' if height > 0.5 else 'minheight'
                    spec.append((f'macrodetails/height/{g}-young-{m}-{wn}-{hn}', a * b * c * abs(height - 0.5) * 2))
                if proportions > 0.5:
                    spec.append((f'macrodetails/proportions/{g}-young-{m}-{wn}-idealproportions', a * b * c * (proportions - 0.5) * 2))
    return spec


def skeleton():
    s = json.load(open(os.path.join(MH, 'default.mhskel')))
    return s['bones'], s['joints']


def joint_pos(V, joints, name):
    return V[joints[name]].mean(0)


def weights():
    return json.load(open(os.path.join(MH, 'default_weights.mhw')))['weights']
