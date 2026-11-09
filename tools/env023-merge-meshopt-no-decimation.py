#!/usr/bin/env python3
"""Diagnostic: preserve the actual meshoptimizer result, copy original texture
colour onto vertices, and merge scene nodes. NO second geometry decimation.
"""
import sys
from pathlib import Path
import trimesh
import numpy as np
from PIL import Image
source,target=Path(sys.argv[1]),Path(sys.argv[2])
scene=trimesh.load(source,force="scene",process=False)
parts=[]
for m in scene.dump(concatenate=False):
    if len(m.faces)==0:continue
    uv=np.asarray(getattr(m.visual,"uv",[]))
    material=getattr(m.visual,"material",None)
    im=getattr(material,"baseColorTexture",None)
    if isinstance(im,Image.Image) and len(uv)==len(m.vertices):
        rgb=np.array(im.convert("RGB"))
        h,w=rgb.shape[:2]
        x=np.minimum(w-1,((uv[:,0]%1)*(w-1)).astype(int))
        y=np.minimum(h-1,((1-uv[:,1]%1)*(h-1)).astype(int))
        colors=rgb[y,x]
    elif m.visual.kind=="vertex":
        colors=np.asarray(m.visual.vertex_colors)[:,:3]
    else:
        colors=np.tile(np.array([[152,153,152]],dtype=np.uint8),(len(m.vertices),1))
    m.visual=trimesh.visual.ColorVisuals(mesh=m,vertex_colors=np.c_[colors,np.full(len(m.vertices),255,dtype=np.uint8)])
    parts.append(m)
assert len(parts)>10
merged=trimesh.util.concatenate(parts)
merged.visual=trimesh.visual.ColorVisuals(mesh=merged,vertex_colors=np.concatenate([np.asarray(m.visual.vertex_colors) for m in parts]))
n=len(merged.faces)
assert 10000<n<=90000,("unexpected triangle count",n)
assert np.max(merged.bounds)<100 and np.min(merged.bounds)>-100
target.parent.mkdir(parents=True,exist_ok=True)
merged.export(str(target),file_type="glb")
print("MESHOPT RESULT",n,"triangles",len(merged.vertices),"vertices",target.stat().st_size,"bytes",flush=True)
