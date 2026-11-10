#!/usr/bin/env python3
"""Blender-free structural smoke check for ENV021 sculpt12.

Checks authored mesh shape, not GLB export, WebGL, watertightness or art.
"""
import importlib.util
import math
import pathlib
import sys
import types

sys.modules["bpy"] = types.ModuleType("bpy")
mathutils = types.ModuleType("mathutils")
mathutils.Vector = tuple
sys.modules["mathutils"] = mathutils

path = pathlib.Path(__file__).resolve().parents[1] / "tools" / "env021-art-pass-011.py"
spec = importlib.util.spec_from_file_location("env021_sculpt12", path)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

# Replace Blender mesh creation with raw vertices/faces returned for checking.
mod.core.mesh = lambda name, vertices, faces: (name, vertices, faces)
mod.core.lip = mod.lip
mod.core.left_edge = mod.left_edge
mod.core.surface = mod.surface
mod.core.opposite_bank = mod.opposite_bank
mod.near_land = mod.core.near_land
for a in (-1.9, 0.0, 1.9):
    assert mod.left_edge(a) < -3.1
    assert mod.lip(a) > 3.1
    for s in (-2.45, 2.45):
        assert abs(mod.surface(s, a)) < 0.30, (s, a, mod.surface(s, a))

for method in (mod.near_land, mod.opposite_bank):
    name, points, faces = method()
    assert len(points) > 2000 and len(faces) > 2000, (name, len(points), len(faces))
    assert all(len(p) == 3 and all(math.isfinite(q) for q in p) for p in points), name
    assert all(len(f) == 3 and all(0 <= i < len(points) for i in f) for f in faces), name
    degenerates = 0
    for ia, ib, ic in faces:
        a, b, c = points[ia], points[ib], points[ic]
        u = tuple(b[k] - a[k] for k in range(3))
        v = tuple(c[k] - a[k] for k in range(3))
        cross = (
            u[1]*v[2]-u[2]*v[1],
            u[2]*v[0]-u[0]*v[2],
            u[0]*v[1]-u[1]*v[0],
        )
        if sum(q*q for q in cross) < 1e-12:
            degenerates += 1
    assert degenerates <= max(4, len(faces)//1000), (name, degenerates)
    print(f"SCULPT12_STRUCTURE_OK {name}: vertices={len(points)}, triangles={len(faces)}, degenerates={degenerates}")
print("SCULPT12_FIGHTER_CLEARANCE_OK")
