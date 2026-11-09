#!/usr/bin/env python3
"""ENV023: decimate a real complete CC0 two-bank gorge; no invented rock surfaces.
Input is first dequantized with glTF Transform at build-time; geometry and
image-based vertex colours remain derived from the publisher's GLB.
"""
import sys
from pathlib import Path
import numpy as np
import trimesh
from PIL import Image
from scipy.spatial import cKDTree
import fast_simplification

source=Path(sys.argv[1]);target=Path(sys.argv[2])
sc=trimesh.load(source,force="scene",process=False)
meshes=sc.dump(concatenate=False)
parts=[];sum_original=0
for k,m in enumerate(meshes):
    v=np.asarray(m.vertices,dtype=np.float64)
    f=np.asarray(m.faces,dtype=np.int32)
    if not len(f):continue
    sum_original+=len(f)
    uv=np.asarray(getattr(m.visual,"uv",[]))
    mat=getattr(m.visual,"material",None)
    texture=getattr(mat,"baseColorTexture",None)
    if isinstance(texture,Image.Image) and len(uv)==len(v):
        im=np.asarray(texture.convert("RGB"))
        h,w=im.shape[:2]
        x=np.minimum(w-1,((uv[:,0]%1)*(w-1)).astype(int))
        y=np.minimum(h-1,((1-uv[:,1]%1))*(h-1)).astype(int))
        rgb=im[y,x].astype(np.uint8)
    elif m.visual.kind=="vertex":
        rgb=np.asarray(m.visual.vertex_colors)[:,:3]
    else:
        factor=getattr(mat,"baseColorFactor",None)
        base=np.array(factor[:3])*255 if factor is not None else np.array([145,148,146])
        rgb=np.tile(base.astype(np.uint8),(len(v),1))
    colors=np.column_stack([rgb,np.full(len(rgb),255,dtype=np.uint8)])
    budget=max(90,int(len(f)*.29))
    if len(f)>budget+20:
        try:
            nv,nf=fast_simplification.simplify(v,f,target_count=budget)
            idx=cKDTree(v).query(nv,k=1,workers=2)[1]
            colors=colors[idx]
            v,f=nv,nf
        except Exception as error:
            print("Preserving original topology in component",k,str(error),flush=True)
    p=trimesh.Trimesh(vertices=v,faces=f,vertex_colors=colors,process=False)
    parts.append(p)
assert 10<len(parts)<=50
merged=trimesh.util.concatenate(parts)
nfaces=len(merged.faces)
print("SOURCE",len(meshes),"pieces",sum_original,"triangles",flush=True)
print("OPTIMIZED",nfaces,"triangles",len(merged.vertices),"verts","bounds",merged.bounds.tolist(),flush=True)
assert 12000<=nfaces<=35000
assert np.max(merged.bounds)<100 and np.min(merged.bounds)>-100,"metric geometry lost"
target.parent.mkdir(parents=True,exist_ok=True)
merged.export(str(target),file_type="glb")
size=target.stat().st_size
print("OUTPUT",str(target),size,"bytes",flush=True)
assert size<=2000000
# Summary of high up-facing triangles for later fighter-plane placement.
tc=np.asarray(merged.triangles_center)
fn=np.asarray(merged.face_normals)
top=tc[(fn[:,1]>.6)&(tc[:,1]>6)]
if len(top):
    for axis in [0,2]:
        hist,bins=np.histogram(top[:,axis],bins=12)
        print("UPWARD_TOP_AXIS",axis,"bins",np.round(bins,1).tolist(),"counts",hist.tolist(),flush=True)
