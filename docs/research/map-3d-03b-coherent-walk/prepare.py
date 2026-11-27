"""Reuse exact C3 art. Patch the proven stale atlas and derive conservative invisible walkable geometry."""
import bpy, hashlib, json, math, pathlib, struct, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
source=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
m=json.loads((source/"pilot.json").read_text())
raw=(source/"pilot.glb").read_bytes()
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(raw)==m["glbSHA256"]=="5d46bfd5be7ef80244bf0969b7f0c2ce2a88fed45c99778646bda821a94f0e94"
n,kind=struct.unpack_from("<II",raw,12);assert kind==0x4e4f534a
g=json.loads(raw[20:20+n]);size,kind=struct.unpack_from("<II",raw,20+n);assert kind==0x004e4942
bin=bytearray(raw[28+n:28+n+size])
atlas=(source/"market-cloth-adapted.png").read_bytes()
receipt=json.loads((source/"palette-receipt.json").read_text());assert len(receipt)==3 and all(r["sha256"]==sha(atlas) for r in receipt)
# Exactly two verified stale copies of the same original color atlas.
changed=[]
for image in g["images"]:
    if image.get("name") not in {"structural__iber_struct_player_49244","market-cloth-adapted"}:continue
    view=g["bufferViews"][image["bufferView"]];start=view.get("byteOffset",0)
    old=bytes(bin[start:start+view["byteLength"]]);assert sha(old).startswith("eb5d6270ce"),sha(old)
    changed.append({"name":image["name"],"oldSHA256":sha(old),"newSHA256":sha(atlas)})
    # Append rather than mutate other buffer data; keep geometry identical.
    bin.extend(b"\0"*((-len(bin))%4))
    off=len(bin);bin.extend(atlas);g["bufferViews"].append({"buffer":0,"byteOffset":off,"byteLength":len(atlas)})
    image["bufferView"]=len(g["bufferViews"])-1;image["mimeType"]="image/png"
assert len(changed)==2,changed
g["buffers"][0]["byteLength"]=len(bin)
bin.extend(b"\0"*((-len(bin))%4));js=json.dumps(g,separators=(",",":")).encode();js+=b" "*((-len(js))%4)
payload=struct.pack("<4sII",b"glTF",2,12+8+len(js)+8+len(bin))+struct.pack("<II",len(js),0x4e4f534a)+js+struct.pack("<II",len(bin),0x004e4942)+bin
(out/"level.glb").write_bytes(payload)
(out/"atlas-fix.json").write_text(json.dumps({"changes":changed,"glbSHA256":sha(payload),"sourceGLB":sha(raw)},indent=2))
# Raycast actual source GLB, excluding hero (not part of art). No new visible art.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(out/"level.glb"));bpy.context.view_layer.update()
ground=[o for o in bpy.context.scene.objects if o.type=="MESH" and o.name.startswith("walkable_support")]
assert len(ground)==1,[o.name for o in bpy.context.scene.objects]
deps=bpy.context.evaluated_depsgraph_get();bvh=BVHTree.FromObject(ground[0],deps)
# Use scene world ray cast to conservatively reject all overhead art, incl roofs.
scene=bpy.context.scene
step=.15
def free(x,y):
    hit,loc,normal,index,obj,matrix=scene.ray_cast(deps,Vector((x,y,9)),Vector((0,0,-1)),distance=10)
    return hit and obj==ground[0] and abs(loc.z)<.03
# Uniform grid with shared vertices. Boundary is a deliberate research walk zone,
# not the full map. Reject every cell with any blocked corner or center.
cells=set();cache={}
def sample(ix,iy):
    if (ix,iy) not in cache:cache[ix,iy]=free(ix*step/2,iy*step/2)
    return cache[ix,iy]
for ix in range(-60,67):
    for iy in range(-18,50):
        if all(sample(2*ix+dx,2*iy+dy) for dx,dy in ((0,0),(2,0),(0,2),(2,2),(1,1))):
            cells.add((ix,iy))
assert len(cells)>2500,len(cells)
positions=[];indices=[];vmap={}
def vert(x,y):
    if (x,y) not in vmap:
        vmap[x,y]=len(positions)//3;positions.extend([round(x*step,6),0,round(-y*step,6)])
    return vmap[x,y]
for x,y in sorted(cells):
    a,b,c,d=vert(x,y),vert(x+1,y),vert(x+1,y+1),vert(x,y+1)
    indices.extend([a,b,c,a,c,d])
def loc(p):return [p[0],0,-p[1]]
markers=[{"id":"spawn","role":"spawn","position":loc([-3.8,-1.55])},{"id":"direct","role":"point","position":loc([.2,-1.7])},{"id":"court","role":"point","position":loc([-2,6.6])},{"id":"exit","role":"exit","position":loc([5.3,-.9])}]
for r in markers:
    x,_,z=r["position"];assert free(x,-z),r
(out/"nav.json").write_text(json.dumps({"positions":positions,"indices":indices},separators=(",",":")))
(out/"level.json").write_text(json.dumps({"markers":markers,"scope":"C3 limited walk lab, not production","camera":{"alpha":1.20,"beta":.94,"zoom":5.5}},indent=2))
(out/"grid-receipt.json").write_text(json.dumps({"cellSize":step,"cells":len(cells),"samples":len(cache),"triangles":len(indices)//3,"scope":"Conservative invisible picking proxy based on actual art vertical clearance, limited walk zone; not exact physical collision."},indent=2))
for n in ["ATTRIBUTION.txt","LICENSE-upstream.txt","README-source.md","source-receipt.json","supplemental-receipt.json","ground-receipt.json","dataset-revision.json"]:
    (out/n).write_bytes((source/n).read_bytes())
with (out/"ATTRIBUTION.txt").open("a") as f:f.write("\nWalk lab: two stale atlas buffer views replaced with actual C3 adapted PNG. Environment art remains CC BY-SA 3.0.\n")
