#!/usr/bin/env python3
"""ENV025 offline: 100% source-derived Poly Haven Coastal Cliff 04 mobile LOD.
No made-up terrain meshes: decimate real indexed photogrammetric triangles,
transfer source diffuse onto vertices, preserve original metric coordinates.
"""
import json,sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
import fast_simplification
import trimesh

root=Path(sys.argv[1]);output=Path(sys.argv[2])
g=json.loads((root/'coastal_cliff_04_1k.gltf').read_text())
blob=(root/'coastal_cliff_04.bin').read_bytes()
types={5126:('<f4',4),5125:('<u4',4),5123:('<u2',2)}
dims={'SCALAR':1,'VEC2':2,'VEC3':3}
def read(idx):
 a=g['accessors'][idx];v=g['bufferViews'][a['bufferView']]
 fmt,sz=types[a['componentType']];n=dims[a['type']]
 off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',n*sz)
 assert off+(a['count']-1)*stride+n*sz<=len(blob)
 return np.array(np.ndarray((a['count'],n),dtype=np.dtype(fmt),buffer=blob,offset=off,strides=(stride,sz)),copy=True)
positions=[];faces=[];uvs=[];shift=0
for mesh in g['meshes']:
 for p in mesh['primitives']:
  pos=read(p['attributes']['POSITION']).astype(np.float64)
  ix=read(p['indices']).reshape(-1,3).astype(np.int32)
  uv=read(p['attributes']['TEXCOORD_0']).astype(np.float64)
  assert len(pos)==len(uv)
  positions.append(pos);faces.append(ix+shift);uvs.append(uv);shift+=len(pos)
v=np.concatenate(positions);f=np.concatenate(faces);uv=np.concatenate(uvs)
print("ORIGINAL_CC0",len(v),"vertices",len(f),"faces","bounds",v.min(0),v.max(0),flush=True)
assert len(f)>1000000
target=int(sys.argv[3]) if len(sys.argv)>3 else 40000
newv,newf=fast_simplification.simplify(v,f,target_count=target)
assert 25000<=len(newf)<=50000
# Verify source shape retained: do not reframe, scale or invent vertices.
old_min=v.min(0);old_max=v.max(0)
new_min=newv.min(0);new_max=newv.max(0)
span=old_max-old_min
assert np.all(np.abs(old_min-new_min)<.035*np.maximum(span,1))
assert np.all(np.abs(old_max-new_max)<.035*np.maximum(span,1))
# Transfer original real photo pixels using nearest physical source vertex.
# This preserves scanned source colors for honest review, no art decoration.
nearest=cKDTree(v).query(newv,k=1,workers=2)[1]
newuv=uv[nearest]
jpg=root/'coastal_cliff_04_diff_1k.jpg'
texture=np.asarray(Image.open(jpg).convert('RGB'))
h,w=texture.shape[:2]
tx=np.minimum(w-1,((newuv[:,0]%1)*(w-1)).astype(np.int64))
ty=np.minimum(h-1,((1-newuv[:,1]%1)*(h-1)).astype(np.int64))
rgb=texture[ty,tx]
colors=np.column_stack([rgb,np.full(len(rgb),255,dtype=np.uint8)])
mesh=trimesh.Trimesh(vertices=newv,faces=newf,vertex_colors=colors,process=False)
output.parent.mkdir(parents=True,exist_ok=True)
mesh.export(str(output),file_type='glb')
print("MOBILE_SOURCE_DERIVED",output,output.stat().st_size,"bytes",len(mesh.vertices),"vertices",len(mesh.faces),"triangles",flush=True)
assert output.stat().st_size<2200000
# Check existence of the source-observed upper 12x8 m region around
# x=16..28, z=-10..-2; y around 8.33; this is coarse actual mesh support,
# not actual verified fighter contact.
fcent=np.asarray(mesh.triangles_center)
face_normals=np.asarray(mesh.face_normals)
check=(np.abs(face_normals[:,1])>.65)&(fcent[:,1]>7.4)&(fcent[:,0]>=16)&(fcent[:,0]<=28)&(fcent[:,2]>=-10)&(fcent[:,2]<=-2)
area=np.linalg.norm(np.cross(mesh.triangles[:,1]-mesh.triangles[:,0],mesh.triangles[:,2]-mesh.triangles[:,0]),axis=1)*.5
print("COMBAT_CROWN_REAL_SURFACE_AREA_M2",round(float(area[check].sum()),2),"face count",int(check.sum()),flush=True)
assert area[check].sum()>45,"Decimation destroyed wide natural combat shelf"
