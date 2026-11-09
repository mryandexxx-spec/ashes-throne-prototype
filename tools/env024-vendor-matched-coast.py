#!/usr/bin/env python3
"""ENV024: turn actual CC0 Coastal kit modules into simple local GLB vertex colors.
No geometry synthesis, terrain noise, extra walls, or per-frame generation.
The input .glb was dequantized in CI. Each exported GLB retains the original
publisher triangles and nodal transforms.
"""
import sys
from pathlib import Path
import numpy as np
import trimesh
from PIL import Image

source=Path(sys.argv[1]);dest=Path(sys.argv[2])
scene=trimesh.load(source,force="scene",process=False)
parts=scene.dump(concatenate=False)
total=sum(len(m.faces) for m in parts)
assert 30<total<5000,(source,total)
clean=[]
for part in parts:
    if not len(part.faces): continue
    visual=part.visual
    rgb=None
    mat=getattr(visual,"material",None)
    im=getattr(mat,"baseColorTexture",None)
    uv=np.asarray(getattr(visual,"uv",[]))
    if isinstance(im,Image.Image) and len(uv)==len(part.vertices):
        tex=np.asarray(im.convert("RGB"))
        h,w=tex.shape[:2]
        x=np.minimum(w-1,((uv[:,0]%1)*(w-1)).astype(np.int64))
        y=np.minimum(h-1,((1-uv[:,1]%1)*(h-1)).astype(np.int64))
        rgb=tex[y,x]
    elif visual.kind=="vertex":
        rgb=np.asarray(visual.vertex_colors)[:,:3]
    elif getattr(mat,"baseColorFactor",None) is not None:
        rgb=np.tile((np.clip(mat.baseColorFactor[:3],0,1)*255).astype(np.uint8),(len(part.vertices),1))
    else:
        rgb=np.tile(np.array([135,137,130],dtype=np.uint8),(len(part.vertices),1))
    part.visual=trimesh.visual.ColorVisuals(mesh=part,vertex_colors=np.column_stack((rgb,np.full(len(rgb),255,dtype=np.uint8))))
    clean.append(part)
assert clean
merged=trimesh.util.concatenate(clean)
merged.visual=trimesh.visual.ColorVisuals(mesh=merged,vertex_colors=np.concatenate([np.asarray(m.visual.vertex_colors) for m in clean]))
dest.parent.mkdir(parents=True,exist_ok=True)
merged.export(dest,file_type="glb")
assert dest.stat().st_size<250000
print("AUTHENTIC_MODULE",source.name,"TRIANGLES",len(merged.faces),"VERTICES",len(merged.vertices),"BYTES",dest.stat().st_size,"BOUNDS",merged.bounds.tolist(),flush=True)
