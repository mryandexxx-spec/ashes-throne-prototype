#!/usr/bin/env python3
"""Pass015 independent geometry smoke: guard fighter zones and near/far meshes."""
import importlib.util,math,pathlib,sys,types
sys.modules["bpy"]=types.ModuleType("bpy")
m=types.ModuleType("mathutils");m.Vector=tuple;sys.modules["mathutils"]=m
path=pathlib.Path(__file__).resolve().parents[1]/"tools"/"env021-art-pass-015.py"
spec=importlib.util.spec_from_file_location("env021_015_smoke",path)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
mod.core.mesh=lambda name,verts,faces:(name,verts,faces)
for a in (-2.68,-1.9,0,1.9,2.68):
    left,right=mod.outline(a)
    assert left<-3.15 and right>3.15,(a,left,right)
    for s in (-3.08,-2.45,0,2.45,3.08):
        assert abs(mod.surface(s,a)+.04)<1e-8,(a,s,mod.surface(s,a))
for fn in (mod.near_mass,lambda:mod.previous.far_mass("A")):
    name,verts,faces=fn()
    assert len(verts)>3000 and len(faces)>3000,(name,len(verts),len(faces))
    assert all(len(p)==3 and all(math.isfinite(x) for x in p) for p in verts)
    assert all(len(face)==3 and all(0<=x<len(verts) for x in face) for face in faces)
    invalid=0
    for i,j,k in faces:
        a,b,c=verts[i],verts[j],verts[k]
        u=tuple(b[z]-a[z] for z in range(3))
        v=tuple(c[z]-a[z] for z in range(3))
        cr=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
        invalid+=sum(x*x for x in cr)<1e-12
    assert invalid<=max(12,len(faces)//250),(name,invalid)
    print("PASS015_GEOMETRY_OK",name,len(verts),len(faces),"degenerate",invalid)
print("PASS015_SAFE_CORRIDOR_AND_PRESERVED_FAR_OK")
