#!/usr/bin/env python3
"""ENV022: bake colors from real Grab3D CC0 ready-made geological models.
No geometric landscape is generated: decimation retains downloaded triangles.
Only build-time numpy/trimesh/fast-simplification/Pillow required.
"""
from pathlib import Path
import sys
import numpy as np
import trimesh
from PIL import Image
import fast_simplification
from scipy.spatial import cKDTree

source=Path(sys.argv[1]);target=Path(sys.argv[2])
maxfaces=int(sys.argv[3])
scene=trimesh.load(source,force='scene',process=False)
parts=scene.dump(concatenate=False)
assert len(parts)==1,"Expected single authored terrain module"
mesh=parts[0]
v=np.array(mesh.vertices,dtype=np.float64)
f=np.array(mesh.faces,dtype=np.int32)
assert 5000<len(f)<60000, "Not a real production terrain mesh"
material=mesh.visual.material
texture=getattr(material,'baseColorTexture',None)
colors=np.tile(np.array([[170,157,137,255]],dtype=np.uint8),(len(v),1))
uv=np.asarray(mesh.visual.uv) if hasattr(mesh.visual,'uv') else None
if isinstance(texture,Image.Image) and uv is not None and len(uv)==len(v):
    tex=np.asarray(texture.convert('RGB'))
    h,w=tex.shape[:2]
    px=np.minimum(w-1,((uv[:,0]%1)*(w-1)).astype(np.int64))
    py=np.minimum(h-1,((1-uv[:,1]%1)*(h-1)).astype(np.int64))
    colors=np.column_stack([tex[py,px],np.full(len(v),255,dtype=np.uint8)])
    print('BAKED published texture',texture.size,flush=True)
else:
    print('NO IMAGE TEXTURE, source visual',type(material).__name__,flush=True)
# source is authoritative; only simplify triangles + transfer original colour
if len(f)>maxfaces:
    nv,nf=fast_simplification.simplify(v,f,target_count=maxfaces)
    nearest=cKDTree(v).query(nv,workers=2)[1]
    nc=colors[nearest]
else:
    nv,nf,nc=v,f,colors
out=trimesh.Trimesh(vertices=nv,faces=nf,vertex_colors=nc,process=False)
target.parent.mkdir(parents=True,exist_ok=True)
out.export(str(target),file_type="glb")
assert target.stat().st_size<850000, (target,target.stat().st_size)
assert 1000<len(out.faces)<=maxfaces+5
print("RESULT",source.name,target.name,"source",len(v),len(f),"optimized",len(out.vertices),len(out.faces),"bytes",target.stat().st_size,"bounds",out.bounds.tolist(),flush=True)
