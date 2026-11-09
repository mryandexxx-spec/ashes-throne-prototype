#!/usr/bin/env python3
"""Convert the genuine Poly Haven coastal_cliff_02 glTF mesh to a compact
vertex-coloured CC0 GLB using mesh simplification. Run only in CI; game runtime
does not need numpy, scipy, trimesh, Pillow or the original high-res source.
"""
import json
from pathlib import Path
import sys
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
import trimesh
import fast_simplification

base = Path(sys.argv[1])
out = Path(sys.argv[2])
g = json.loads((base / "coastal_cliff_02_1k.gltf").read_text())
binary = (base / "coastal_cliff_02.bin").read_bytes()
sizes = {5121: ("u1",1), 5123:("<u2",2),5125:("<u4",4),5126:("<f4",4)}
components = {"SCALAR":1,"VEC2":2,"VEC3":3,"VEC4":4}

def read(index):
    a = g["accessors"][index]
    v = g["bufferViews"][a["bufferView"]]
    ty, size = sizes[a["componentType"]]
    n = components[a["type"]]
    stride = v.get("byteStride", n * size)
    offset = v.get("byteOffset",0) + a.get("byteOffset",0)
    assert offset>=0 and stride>=n*size and offset+(a["count"]-1)*stride+n*size<=len(binary)
    x = np.ndarray((a["count"],n),dtype=np.dtype(ty),buffer=binary,offset=offset,strides=(stride,size))
    return np.array(x,copy=True)

verts, faces, uvs = [], [], []
base_offset = 0
for mesh in g["meshes"]:
    for prim in mesh["primitives"]:
        if prim.get("mode",4)!=4:continue
        p = read(prim["attributes"]["POSITION"]).astype(np.float64)
        idx = read(prim["indices"]).reshape(-1,3).astype(np.int64)
        uv = read(prim["attributes"]["TEXCOORD_0"]).astype(np.float64) if "TEXCOORD_0" in prim["attributes"] else np.zeros((len(p),2))
        assert idx.max()<len(p)
        verts.append(p)
        faces.append(idx+base_offset)
        uvs.append(uv)
        base_offset+=len(p)
assert verts,"No GLB triangle primitives"
v=np.concatenate(verts)
f=np.concatenate(faces)
uv=np.concatenate(uvs)
assert len(f)>10000, "Expected photogrammetry mesh, not a generated block"
print("Original:",len(v),"vertices",len(f),"triangles, bounding",v.min(0),v.max(0),flush=True)

# Decimate real surface geometry, not a new procedural substitute.
target=11000
newv,newf=fast_simplification.simplify(v.astype(np.float64),f.astype(np.int32),target_count=target)
assert len(newf)<=13000 and len(newf)>=5000
# UV for each decimated vertex: nearest source point. This lightweight transfer
# retains colour variation without bundling multi-MB PBR maps on mobile.
dist,near=cKDTree(v).query(newv,k=1,workers=2)
newuv=uv[near]
im=np.asarray(Image.open(base / "coastal_cliff_02_diff_1k.jpg").convert("RGB"))
h,w=im.shape[:2]
ix=np.minimum(w-1,((newuv[:,0]%1)*(w-1)).astype(np.int64))
iy=np.minimum(h-1,((1-(newuv[:,1]%1))*(h-1)).astype(np.int64))
rgb=im[iy,ix]
# Keep original scan aspect and shape. A predictable 12-unit maximum dimension
# lets game artists place the cliff without huge raw source coordinates.
minimum=newv.min(axis=0);maximum=newv.max(axis=0)
width=maximum-minimum
scale=12.0/max(width)
newv=(newv-np.array([(minimum[0]+maximum[0])/2,minimum[1],(minimum[2]+maximum[2])/2]))*scale
colors=np.c_[rgb,np.full(len(rgb),255,dtype=np.uint8)].astype(np.uint8)
rock=trimesh.Trimesh(vertices=newv,faces=newf,vertex_colors=colors,process=False)
out.parent.mkdir(parents=True,exist_ok=True)
rock.export(str(out),file_type="glb")
print("Output:",out.stat().st_size,"bytes",len(rock.vertices),"vertices",len(rock.faces),"triangles, geometry extent",newv.ptp(axis=0) if hasattr(newv,'ptp') else np.ptp(newv,axis=0),flush=True)
assert out.stat().st_size<1400000
