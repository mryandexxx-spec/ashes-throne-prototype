#!/usr/bin/env python3
"""Source-only ENV025 geometric eligibility screen, not an in-game asset.
Inspect real Poly Haven Coastal Cliff 04 GLTF vertices/triangles and estimate
walkable upper crown support. No generated rock, no game code modifications.
"""
import json,sys,struct
from pathlib import Path
import numpy as np

root=Path(sys.argv[1])
g=json.loads((root/'coastal_cliff_04_1k.gltf').read_text())
binary=(root/'coastal_cliff_04.bin').read_bytes()
print("PUBLISHER_GLTF_MESHES",[(m.get('name'),len(m['primitives'])) for m in g['meshes']],flush=True)
print("PUBLISHER_GLTF_NODES",[{k:n.get(k) for k in ['name','mesh','rotation','translation','scale','matrix'] if k in n} for n in g.get('nodes',[])],flush=True)
print("PUBLISHER_GLTF_EXTENSIONS",g.get('extensionsUsed',[]),flush=True)
types={5126:('<f4',4),5125:('<u4',4),5123:('<u2',2)}
dims={'SCALAR':1,'VEC2':2,'VEC3':3}
def read(idx):
 a=g['accessors'][idx];v=g['bufferViews'][a['bufferView']]
 fmt,size=types[a['componentType']];n=dims[a['type']]
 offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 stride=v.get('byteStride',n*size)
 assert offset+(a['count']-1)*stride+n*size<=len(binary)
 return np.array(np.ndarray((a['count'],n),dtype=np.dtype(fmt),buffer=binary,offset=offset,strides=(stride,size)),copy=True)
up_count=0;total=0
allbounds=[]
occupied=set();cell_heights={};area_cells=0
for mesh in g['meshes']:
 for pr in mesh['primitives']:
  if pr.get('mode',4)!=4:continue
  verts=read(pr['attributes']['POSITION']).astype(np.float32)
  idx=read(pr['indices']).reshape(-1,3).astype(np.int64)
  assert len(idx)>10000 and idx.max()<len(verts)
  bounds=np.stack([verts.min(axis=0),verts.max(axis=0)])
  allbounds.append(bounds)
  print("MESH_SOURCE_BOUND",bounds.round(2).tolist(),"TRIANGLES",len(idx),flush=True)
  total+=len(idx)
  # Compute top-facing triangles in chunks to avoid multi-million triangle
  # temporary arrays and allow sparse glTF accessors to be inspected.
  top=bounds[1,1];base=bounds[0,1];height=top-base
  grids={}
  for k in range(0,len(idx),180000):
   faces=verts[idx[k:k+180000]]
   ab=faces[:,1]-faces[:,0]
   ac=faces[:,2]-faces[:,0]
   normals=np.cross(ab,ac)
   norm=np.linalg.norm(normals,axis=1)
   ycos=np.divide(normals[:,1],np.maximum(norm,1.e-10))
   center=faces.mean(axis=1)
   # Includes flipped windings for diagnostic only; geometry might have
   # winding opposite to expected convention. Record sign distribution.
   chosen=(np.abs(ycos)>.7)&(center[:,1]>(top-max(2.2,.24*height)))
   c=center[chosen]
   up_count+=int(chosen.sum())
   if len(c):
    cells=np.floor(c[:,[0,2]]/2).astype(int)
    for pair,surface_y in zip(cells,c[:,1]):
     key=tuple(map(int,pair))
     occupied.add(key)
     cell_heights.setdefault(key,[]).append(float(surface_y))
  print("PLATEAU_HEIGHT",round(float(height),3),"top band > ",round(float(top-max(2.2,.24*height)),3),flush=True)
print("SOURCE_TOTAL_TRIANGLES",total,"TOP_FACING_TRIANGLES",up_count,flush=True)
print("UPPER_2M_GROUND_CELLS",len(occupied),"APPROX_AREA_UPPER_BOUND_SQM",len(occupied)*4,flush=True)
# 4x3 cells approx 8m x 6m rectangle; this detects a potential top region,
# NOT a verified level walkable battle area.
blocks=[]
for i,j in occupied:
 hits=sum((i+dx,j+dz) in occupied for dx in range(4) for dz in range(3))
 if hits>=11:blocks.append((i,j,hits))
print("POTENTIAL_8_BY_6_TOP_PATCHES",len(blocks),flush=True)
if blocks: print("EXAMPLE_PATCH_CELL",blocks[0],flush=True)
# A more selective check: each 2m cell must contain enough original actual
# high-facing surface samples, and a 8x6m region must keep upper heights close
# to level. This still does not assert walkability or fighter contact.
stable_cells={}
for key,hs in cell_heights.items():
 if len(hs)<35:continue
 q=np.quantile(hs,[.1,.5,.9])
 if q[2]-q[0]<=1.25:
  stable_cells[key]=float(q[1])
stable_patches=[]
for i,j in stable_cells:
 hs=[stable_cells.get((i+dx,j+dz)) for dx in range(4) for dz in range(3)]
 if all(h is not None for h in hs) and max(hs)-min(hs)<=1.2:
  stable_patches.append((i,j,round(max(hs)-min(hs),3),round(float(np.median(hs)),3)))
large_patches=[]
for i,j in stable_cells:
 hs=[stable_cells.get((i+dx,j+dz)) for dx in range(6) for dz in range(4)]
 if all(h is not None for h in hs) and max(hs)-min(hs)<=1.2:
  large_patches.append((i,j,round(max(hs)-min(hs),3),round(float(np.median(hs)),3)))
print("STABLE_2M_CELLS",len(stable_cells),"CANDIDATE_LEVEL_8X6_PATCHES",len(stable_patches),
 "CANDIDATE_LEVEL_12X8_PATCHES",len(large_patches),flush=True)
if large_patches:print("BEST_LEVEL_12X8_PATCH",min(large_patches,key=lambda q:q[2]),flush=True)
if stable_patches:print("BEST_LEVEL_PATCH",min(stable_patches,key=lambda q:q[2]),flush=True)
# A screen-composition decision still needs actual WebGL screenshot.
report={'mesh_count':len(g['meshes']),'triangles':total,'top_face_triangles':up_count,'top_cell_count':len(occupied),'potential_8x6_patches':len(blocks),'level_8x6_patches':len(stable_patches),'best_level_patch':min(stable_patches,key=lambda q:q[2]) if stable_patches else None,'level_12x8_patches':len(large_patches),'best_large_patch':min(large_patches,key=lambda q:q[2]) if large_patches else None,'bounds':[b.tolist() for b in allbounds]}
(root/'coastal-cliff-04-surface-report.json').write_text(json.dumps(report,indent=2))
