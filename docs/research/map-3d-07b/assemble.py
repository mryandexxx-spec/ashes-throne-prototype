"""07B authored layout, verified 0 A.D. assets. Blender 4.5, no hero in environment."""
import bpy, json, pathlib, sys, math, hashlib, urllib.request, shutil
from mathutils import Vector, Matrix
from PIL import Image,ImageDraw,ImageFilter,ImageEnhance

root=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
src=root/"preview/map-3d/level"
plan=json.loads(pathlib.Path(__file__).with_name("layout.json").read_text())
records={r["id"]:{**r,"sha256":r["files"][0]["sha256"],"bytes":r["files"][0]["bytes"]} for r in json.loads((src/"source-receipt.json").read_text())}
records.update({r["id"]:r for r in json.loads((src/"supplemental-receipt.json").read_text())})
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
cache=out.parent/"verified-sources";cache.mkdir(exist_ok=True)
def fetch(name,rec,suffix):
    p=cache/(name+suffix)
    if not p.exists():
        with urllib.request.urlopen(urllib.request.Request(rec["sourceURL"],headers={"User-Agent":"AshesThrone-07B/1"}),timeout=120) as response:
            p.write_bytes(response.read(int(rec["bytes"])+1))
    assert p.stat().st_size==rec["bytes"] and sha(p)==rec["sha256"],name
    return p
bpy.ops.wm.read_factory_settings(use_empty=True)
art=bpy.data.collections.new("AUTHORED art - CC BY-SA 3.0");bpy.context.scene.collection.children.link(art)
templates={};originals=[]
def bounds(entries):
    pts=[m@Vector(c) for o,m in entries for c in o.bound_box]
    return Vector(tuple(min(p[i] for p in pts) for i in range(3))),Vector(tuple(max(p[i] for p in pts) for i in range(3)))
for name in sorted({p[0] for p in plan["placements"]}|{"cliff","cliff2"}):
    p=fetch(name,records[name],".glb");before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(p));bpy.context.view_layer.update()
    imported=[o for o in bpy.data.objects if o not in before]
    entries=[(o,o.matrix_world.copy()) for o in imported if o.type=="MESH"]
    assert entries and all(o.data.materials for o,_ in entries),name
    templates[name]=entries;originals.extend(imported)
    for o in imported:
        for c in list(o.users_collection):c.objects.unlink(o)
def elevation(x):
    for (a,h),(b,k) in zip(plan["height"],plan["height"][1:]):
        if a<=x<=b:return h+(k-h)*(x-a)/(b-a)
    return plan["height"][0 if x<0 else -1][1]
def inside(x,y):
    poly=plan["terrain"];hit=False
    for (ax,ay),(bx,by) in zip(poly,poly[1:]+poly[:1]):
        if (ay>y)!=(by>y) and x<(bx-ax)*(y-ay)/(by-ay)+ax:hit=not hit
    return hit
pts={p[0]:p[1:] for p in plan["points"]}
def segdist(x,y,a,b):
    dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)))
    return math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)
def corridor(x,y):
    return any(math.hypot(x-a,y-b)<3.8 for a,b in pts.values()) or any(segdist(x,y,pts[a],pts[b])<2.1 for a,b in plan["edges"])
proof=[]
def place(name,asset,x,y,z,width=None,fit=None,yaw=0,top=False):
    entries=templates[asset];lo,hi=bounds(entries);d=hi-lo
    scale=[width/max(d.x,d.y)]*3 if width else [v/d[i] for i,v in enumerate(fit)]
    local=Matrix.Rotation(math.radians(yaw),4,"Z")@Matrix.Diagonal(Vector((*scale,1)))@Matrix.Translation(-(lo+hi)/2)
    entries=[(o,local@m) for o,m in entries];lo,hi=bounds(entries)
    move=Matrix.Translation(Vector((x-(lo.x+hi.x)/2,y-(lo.y+hi.y)/2,z-(hi.z if top else lo.z))))
    placed=[]
    for j,(o,m) in enumerate(entries):
        c=o.copy();c.parent=None;c.animation_data_clear();c.name=name+"_"+str(j);art.objects.link(c);c.matrix_world=move@m
        placed.append((c,c.matrix_world.copy()))
    lo,hi=bounds(placed);tris=0
    for o,_ in placed:o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
    proof.append({"name":name,"asset":asset,"sourceSHA256":records[asset]["sha256"],"bounds":[list(lo),list(hi)],"triangles":tris})
for i,(asset,x,y,w,yaw) in enumerate(plan["placements"]):
    place("set_%02d_%s"%(i,asset),asset,x,y,elevation(x)-.15,width=w,yaw=yaw)
# Original authored cliff meshes form the foreground and rock mass. Support surface is editable blockout geometry.
for i,x in enumerate(range(-44,49,8)):
    ys=[y/4 for y in range(-65,65) if inside(min(47.9,x),y/4)]
    if not ys:continue
    a,b=min(ys),max(ys);asset="cliff" if i%2 else "cliff2"
    # Reuse the authored rock kit with irregular overlapping strata, not a row of pillars.
    phase=(i%4); frontH=[12,17,14,19][phase]
    place("front_rock_%02d"%i,asset,x,a-2.6,elevation(x)-.5,fit=[9,13,frontH],yaw=[72,95,115,82][phase],top=True)
    place("back_rock_%02d"%i,asset,x,b+4.4,elevation(x)-6.5,fit=[11,15,[13,19,15,22][phase]],yaw=[76,104,121,88][phase])
    place("deep_rock_%02d"%i,"cliff2" if i%2 else "cliff",x+1,a-8.5,elevation(x)-10,fit=[14,17,[19,25,22,28][phase]],yaw=[65,110,85,125][phase],top=True)
for o in originals:bpy.data.objects.remove(o,do_unlink=True)
# Use original licensed terrain texture, not invented primary art.
gr=json.loads((src/"ground-receipt.json").read_text());source_ground=fetch("ground",gr,".png")
# Hand-authored ground composition using the same licensed texture pixels.
# A light route surface, darker courtyards, planted central island; no painted fake buildings.
xmin,ymin,xmax,ymax=-48,-16,48,16
W,H=3072,1024
base=Image.open(source_ground).convert("RGB").resize((128,128))
surface=Image.new("RGB",(W,H))
for yy in range(0,H,128):
    for xx in range(0,W,128):surface.paste(base,(xx,yy))
def pixel(p):return (round((p[0]-xmin)/(xmax-xmin)*(W-1)),round((ymax-p[1])/(ymax-ymin)*(H-1)))
def tone(factors,sat):
    im=ImageEnhance.Color(surface).enhance(sat)
    return Image.merge("RGB",tuple(c.point(lambda v:min(255,round(v*f))) for c,f in zip(im.split(),factors)))
def polygon_mask(polys):
    mask=Image.new("L",(W,H));d=ImageDraw.Draw(mask)
    for poly in polys:d.polygon([pixel(p) for p in poly],fill=240)
    return mask.filter(ImageFilter.GaussianBlur(12))
ground_pixels=tone((.72,.73,.68),.67)
courts=[[(-41,-4),(-30,-4),(-29,4),(-41,4)],[(-29,-4),(-19,-4),(-19,4),(-29,4)],[(8,-4),(16,-4),(16,4),(8,4)],[(32,0),(44,-2),(46,5),(36,7)]]
ground_pixels=Image.composite(tone((.83,.82,.77),.48),ground_pixels,polygon_mask(courts))
gardens=[[(-11,-3),(-7,4),(4,4),(8,0),(5,-4),(-5,-4)],[(-31,-12),(-22,-12),(-21,-7),(-30,-6)],[(31,-7),(44,-7),(42,-2),(33,-2)]]
ground_pixels=Image.composite(tone((.53,.67,.48),.72),ground_pixels,polygon_mask(gardens))
mask=Image.new("L",(W,H));d=ImageDraw.Draw(mask)
for a,b in plan["edges"]:
    d.line([pixel(pts[a]),pixel(pts[b])],fill=255,width=92)
for x,y in pts.values():
    px,py=pixel((x,y));d.ellipse((px-76,py-76,px+76,py+76),fill=235)
ground_pixels=Image.composite(tone((.96,.94,.87),.38),ground_pixels,mask.filter(ImageFilter.GaussianBlur(14)))
ground_path=out/"ground-adapted.jpg";ground_pixels.save(ground_path,quality=91,subsampling=0)
img=bpy.data.images.load(str(ground_path))
mat=bpy.data.materials.new("Wildfire Games ground CC BY-SA");mat.use_nodes=True
nt=mat.node_tree;tex=nt.nodes.new("ShaderNodeTexImage");tex.image=img
bsdf=nt.nodes.get("Principled BSDF");nt.links.new(tex.outputs["Color"],bsdf.inputs["Base Color"]);bsdf.inputs["Roughness"].default_value=.94
# grid of authored contours, exact same triangulation used for visual surface and invisible proxy
step=.5;cells={(x,y) for x in range(-96,96) for y in range(-32,32) if all(inside((x+dx)*step,(y+dy)*step) for dx,dy in ((0,0),(1,0),(1,1),(0,1)))}
assert len(cells)>5000,len(cells)
vmap={};verts=[];faces=[]
def v(x,y):
    if (x,y) not in vmap:vmap[x,y]=len(verts);verts.append((x*step,y*step,elevation(x*step)))
    return vmap[x,y]
for x,y in sorted(cells):
    a,b,c,d=v(x,y),v(x+1,y),v(x+1,y+1),v(x,y+1);faces.extend([(a,b,c),(a,c,d)])
# a modest continuous support skirt below the authored cliff meshes hides blockout sky gaps
for x,y in sorted(cells):
    for dx,dy,p,q in [(0,-1,(x,y),(x+1,y)),(1,0,(x+1,y),(x+1,y+1)),(0,1,(x+1,y+1),(x,y+1)),(-1,0,(x,y+1),(x,y))]:
        if (x+dx,y+dy) in cells:continue
        a,b=v(*p),v(*q);c=len(verts);verts.append((verts[b][0],verts[b][1],verts[b][2]-4));d=len(verts);verts.append((verts[a][0],verts[a][1],verts[a][2]-4));faces.extend([(a,d,c),(a,c,b)])
mesh=bpy.data.meshes.new("Hand-authored terrace support");mesh.from_pydata(verts,[],faces);mesh.update()
ground=bpy.data.objects.new("walkable_support_07B",mesh);art.objects.link(ground);mesh.materials.append(mat)
uv=mesh.uv_layers.new(name="Ground UV")
for loop in mesh.loops:
    x,y,z=verts[loop.vertex_index];uv.data[loop.index].uv=((x-xmin)/(xmax-xmin),(y-ymin)/(ymax-ymin))
# Preserve exposed rock texture on the nonwalkable support skirt instead of sand walls.
rock_material=next((o.data.materials[0] for o in art.objects if o.name.startswith("front_rock_") and o.data.materials),None)
if rock_material:
    mesh.materials.append(rock_material)
    for poly in mesh.polygons:
        if abs(poly.normal.z)<.5:
            poly.material_index=1
            for li in poly.loop_indices:
                x,y,z=verts[mesh.loops[li].vertex_index]
                uv.data[li].uv=((x+y)/5,z/5)
# Raycast actual art clearance on independent proxy; never infer walkability from all art geometry.
bpy.context.view_layer.update();scene=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get();cacheclear={}
def free(x,y):
    if (x,y) not in cacheclear:
        xx,yy=x*step/2,y*step/2
        hit,loc,normal,index,obj,matrix=scene.ray_cast(deps,Vector((xx,yy,40)),Vector((0,0,-1)),distance=50)
        cacheclear[x,y]=corridor(xx,yy) and hit and obj==ground and abs(loc.z-elevation(xx))<.035
    return cacheclear[x,y]
navcells={(x,y) for x,y in cells if all(free(2*x+dx,2*y+dy) for dx,dy in ((0,0),(2,0),(2,2),(0,2),(1,1)))}
positions=[];indices=[];nv={}
def nvert(x,y):
    if (x,y) not in nv:nv[x,y]=len(positions)//3;positions.extend([x*step,elevation(x*step),-y*step])
    return nv[x,y]
for x,y in sorted(navcells):
    a,b,c,d=nvert(x,y),nvert(x+1,y),nvert(x+1,y+1),nvert(x,y+1);indices.extend([a,b,c,a,c,d])
assert len(navcells)>1000,len(navcells)
markers=[]
for name,x,y in plan["points"]:
    assert free(round(2*x/step),round(2*y/step)),("Marker blocked",name)
    markers.append({"id":name,"role":"spawn" if name=="spawn" else "exit" if name=="exit" else "point","position":[x,elevation(x),-y]})
(out/"nav.json").write_text(json.dumps({"positions":positions,"indices":indices},separators=(",",":")))
(out/"level.json").write_text(json.dumps({"markers":markers,"edges":plan["edges"],"scope":plan["scope"],"camera":{"alpha":1.2,"beta":.94,"zoom":7.5}},indent=2))
# Asset reuse, shared materials, and bounded image sizes for the first mobile blockout.
for im in bpy.data.images:
    if im==img:continue # authored 3k x 1k terrain atlas, reviewed separately
    if im.size[0]>1024 or im.size[1]>1024:
        k=1024/max(im.size);im.scale(max(1,round(im.size[0]*k)),max(1,round(im.size[1]*k)))
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/"level.blend"))
bpy.ops.export_scene.gltf(filepath=str(out/"level.glb"),export_format="GLB",export_copyright="Wildfire Games CC BY-SA 3.0; converted by CodePawl; layout adaptation Ashes Throne")
for n in ["ATTRIBUTION.txt","LICENSE-upstream.txt","README-source.md","source-receipt.json","supplemental-receipt.json","ground-receipt.json","dataset-revision.json"]:
    shutil.copyfile(src/n,out/n)
with (out/"ATTRIBUTION.txt").open("a") as f:f.write("\n07B: authored arrangement, terrain support, source mesh placement and texture size cap; all adapted environment art CC BY-SA 3.0. Editable level.blend supplied in CI evidence; layout and assembly source in docs/research/map-3d-07b. Ren is separate.\n")
(out/"assembly-receipt.json").write_text(json.dumps({"placements":proof,"cells":len(cells),"navCells":len(navcells),"artBytes":(out/"level.glb").stat().st_size,"artSHA256":sha(out/"level.glb"),"scope":plan["scope"]},indent=2))
