#!/usr/bin/env python3
"""Read-only raw geometry gates for independent ENV021 Blockout014 A/B."""
import importlib.util
import math
import pathlib
import sys
import types

sys.modules["bpy"]=types.ModuleType("bpy")
mathutils=types.ModuleType("mathutils")
mathutils.Vector=tuple
sys.modules["mathutils"]=mathutils
path=pathlib.Path(__file__).resolve().parents[1]/"tools"/"env021-blockout-014.py"
spec=importlib.util.spec_from_file_location("env021_blockout",path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
mod.core.mesh=lambda name,verts,faces:(name,verts,faces)

def check_mesh(method,label):
    name,points,faces=method()
    assert len(points)>2500 and len(faces)>3000,(label,len(points),len(faces))
    assert all(len(p)==3 and all(math.isfinite(x) for x in p) for p in points)
    assert all(len(f)==3 and all(0<=j<len(points) for j in f) for f in faces)
    deg=0
    for i,j,k in faces:
        p,q,r=points[i],points[j],points[k]
        u=[q[n]-p[n] for n in range(3)]
        v=[r[n]-p[n] for n in range(3)]
        cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        deg+=(sum(x*x for x in cross)<1e-12)
    assert deg<=max(6,len(faces)//400),(label,"degenerate",deg,len(faces))
    print("BLOCKOUT14_GEOMETRY_OK",label,name,len(points),len(faces),"degenerate",deg)

for option in "AB":
    for a in (-2.65,-1.9,-.8,0,.8,1.9,2.65):
        left,right=mod.outline(a,option)
        assert left < -3.15 and right > 3.15, (option,a,left,right)
        for s in (-3.05,-2.45,-1.0,0,1.0,2.45,3.05):
            assert abs(mod.height(s,a,option)+.04)<1e-9,(option,a,s,mod.height(s,a,option))
    check_mesh(lambda:mod.near_mass(option),option+" near")
    check_mesh(lambda:mod.far_mass(option),option+" opposite")
print("BLOCKOUT14_BOTH_OPTIONS_FIGHTER_CLEARANCE_OK")
