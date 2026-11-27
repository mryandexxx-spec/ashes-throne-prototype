"""Compose coherent authored assets; one explicitly drawn flat support surface, not generated main art."""
import bpy,math,json,sys,pathlib,hashlib
from PIL import Image,ImageDraw,ImageFilter,ImageEnhance,ImageOps
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
root=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
plan=json.loads(pathlib.Path(__file__).with_name("layout.json").read_text())
records={r["id"]:{"path":r["main"],"sha256":r["files"][0]["sha256"],"sourceURL":r["sourceURL"]} for r in json.loads((root/"source-receipt.json").read_text())}
records.update({r["id"]:r for r in json.loads((root/"context/supplemental-receipt.json").read_text())})
bpy.ops.wm.read_factory_settings(use_empty=True)
art=bpy.data.collections.new("AUTHORED 0 A.D. art CC BY-SA");bpy.context.scene.collection.children.link(art)
templates={};originals=[];proof=[]
def bounds(entries):
    pts=[matrix@Vector(c) for o,matrix in entries for c in o.bound_box]
    assert pts
    return Vector(tuple(min(p[i] for p in pts) for i in range(3))),Vector(tuple(max(p[i] for p in pts) for i in range(3)))
for name in sorted({p["asset"] for p in plan["placements"]}):
    rec=records[name];path=root/rec["path"]
    assert hashlib.sha256(path.read_bytes()).hexdigest()==rec["sha256"]
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path));bpy.context.view_layer.update()
    imported=[o for o in bpy.data.objects if o not in before]
    entries=[(o,o.matrix_world.copy()) for o in imported if o.type=="MESH"]
    assert entries and all(o.data.materials for o,_ in entries)
    templates[name]=entries;originals.extend(imported)
    for o in imported:
        for c in list(o.users_collection):c.objects.unlink(o)
for p in plan["placements"]:
    entries=templates[p["asset"]];lo,hi=bounds(entries);d=hi-lo
    assert min(d)>0
    scale=[p["width"]/max(d.x,d.y)]*3 if "width" in p else [v/d[i] for i,v in enumerate(p["fit"])]
    local=Matrix.Rotation(math.radians(p["yaw"]),4,"Z")@Matrix.Diagonal(Vector((*scale,1)))@Matrix.Translation(-(lo+hi)/2)
    entries=[(o,local@m) for o,m in entries];lo,hi=bounds(entries)
    move=Matrix.Translation(Vector((p["xy"][0]-(lo.x+hi.x)/2,p["xy"][1]-(lo.y+hi.y)/2,p["z"]-(hi.z if p["anchor"]=="top" else lo.z))))
    placed=[]
    for j,(o,m) in enumerate(entries):
        c=o.copy();c.parent=None;c.animation_data_clear();c.name=p["name"]+"_"+str(j);art.objects.link(c);c.matrix_world=move@m
        placed.append((c,c.matrix_world.copy()))
    lo,hi=bounds(placed);tris=0
    for o,_ in placed:o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
    proof.append({"name":p["name"],"asset":p["asset"],"sourceSHA256":records[p["asset"]]["sha256"],"sourceBounds":list(d),"bounds":[list(lo),list(hi)],"triangles":tris})
# Preserve source image detail and alpha. Recolor only saturated blue player-color
# pixels in the market atlas, never the neutral building texture or normals.
palette=[]
for image in bpy.data.images:
    if "iber_struct_player_28588" not in image.name:continue
    import array,colorsys
    pix=array.array("f",[0])*len(image.pixels);image.pixels.foreach_get(pix);count=0
    for i in range(0,len(pix),4):
        r,g,b=pix[i:i+3]
        if b>r*1.25 and b>g*1.15 and b-r>.12:
            h,s,v=colorsys.rgb_to_hsv(max(0,r),max(0,g),max(0,b))
            nr,ng,nb=colorsys.hsv_to_rgb(.087,min(.46,s*.7),v*.94)
            pix[i:i+3]=array.array("f",[nr,ng,nb]);count+=1
    if count:
        image.pixels.foreach_set(pix);image.update()
        # Save an explicit modified texture, so export cannot reuse the original packed image.
        ip=out/"market-cloth-adapted.png";image.filepath_raw=str(ip);image.file_format="PNG";image.save();image.pack()
        palette.append({"image":image.name,"recoloredPixels":count,"sha256":hashlib.sha256(ip.read_bytes()).hexdigest()})
(out/"palette-receipt.json").write_text(json.dumps(palette,indent=2))
for o in originals:bpy.data.objects.remove(o,do_unlink=True)
# Verify actual triangle contact along the front lip, before adding ground.
bpy.context.view_layer.update()
verts_check=[];faces_check=[]
for obj in art.objects:
    if not obj.name.startswith("front_cliff_"):continue
    ev=obj.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh()
    offset=len(verts_check);verts_check.extend([ev.matrix_world@v.co for v in m.vertices])
    faces_check.extend([[offset+i for i in poly.vertices] for poly in m.polygons]);ev.to_mesh_clear()
assert verts_check and faces_check
bvh=BVHTree.FromPolygons(verts_check,faces_check,all_triangles=False)
edge=plan["terrain"][:-2];gate=plan["edgeContact"];samples=[]
for i in range(round((gate["endX"]-gate["startX"])/gate["step"])+1):
    x=gate["startX"]+gate["step"]*i
    pair=next((a,b) for a,b in zip(edge,edge[1:]) if a[0]<=x<=b[0])
    a,b=pair;y=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])
    hit,normal,index,distance=bvh.ray_cast(Vector((x,y,2)),Vector((0,0,-1)),5)
    z=hit.z if hit is not None else None
    samples.append({"x":x,"y":y,"z":z,"pass":z is not None and gate["minZ"]<=z<=gate["maxZ"]})
passed=sum(s["pass"] for s in samples)
contact={"count":len(samples),"passed":passed,"fraction":passed/len(samples),"samples":samples,"scope":"front edge vertical proximity, not full terrain or structural simulation"}
(out/"edge-contact.json").write_text(json.dumps(contact,indent=2))
assert contact["fraction"]>=gate["requiredFraction"],f"Front edge unsupported: {passed}/{len(samples)}"
# Flat walkable support: manually drawn perimeter, exact authored CC BY-SA ground texture.
# This is not a generated cliff or building; all visible structural art is original imported models.
verts=[(x,y,0) for x,y in plan["terrain"]]
mesh=bpy.data.meshes.new("Hand-drawn ledge support");mesh.from_pydata(verts,[],[list(range(len(verts)))]);mesh.update()
ground=bpy.data.objects.new("walkable_support",mesh);art.objects.link(ground)
uv=mesh.uv_layers.new(name="Ground UV")
for loop in mesh.loops:
    x,y,_=verts[loop.vertex_index];xmin,ymin,xmax,ymax=plan["groundDesign"]["bounds"];uv.data[loop.index].uv=((x-xmin)/(xmax-xmin),(y-ymin)/(ymax-ymin))
gpath=root/"context/ground.png";gr=json.loads((root/"context/ground-receipt.json").read_text());assert hashlib.sha256(gpath.read_bytes()).hexdigest()==gr["sha256"]
# Art-directed surface edit of the licensed original texture, not invented main art.
# Preserve source pixels/detail; only tint patches and the two hand-authored paths.
base=Image.open(gpath).convert("RGB")
W,H=2048,896
xmin,ymin,xmax,ymax=plan["groundDesign"]["bounds"]
tile=base.resize((round(W*3.2/(xmax-xmin)),round(H*3.2/(ymax-ymin))),Image.Resampling.LANCZOS)
ground_pixels=Image.new("RGB",(W,H))
for yy in range(0,H,tile.height):
    for xx in range(0,W,tile.width):ground_pixels.paste(tile,(xx,yy))
def pixels(pt):
    return (round((pt[0]-xmin)/(xmax-xmin)*(W-1)),round((ymax-pt[1])/(ymax-ymin)*(H-1)))
def tint(rgb,factor,contrast=1):
    im=ImageEnhance.Color(ground_pixels).enhance(.8)
    im=ImageEnhance.Contrast(im).enhance(contrast)
    return Image.merge("RGB",tuple(c.point(lambda v:min(255,round(v*f))) for c,f in zip(im.split(),factor)))
outim=tint(ground_pixels,(.85,.85,.82))
for shape,factor in [(plan["groundDesign"]["courtyard"],(.94,.91,.85)),(plan["groundDesign"]["garden"],(.64,.76,.62))]:
    mask=Image.new("L",(W,H));ImageDraw.Draw(mask).polygon([pixels(v) for v in shape],fill=220)
    mask=mask.filter(ImageFilter.GaussianBlur(24))
    outim=Image.composite(tint(ground_pixels,factor,.91),outim,mask)
mask=Image.new("L",(W,H));draw=ImageDraw.Draw(mask)
for route in plan["routes"]:
    pts=[pixels(v) for v in route["points"]]
    width=round(1.7*W/(xmax-xmin))
    draw.line(pts,fill=235,width=width,joint="curve")
    for x,y in pts:draw.ellipse((x-width//2,y-width//2,x+width//2,y+width//2),fill=235)
mask=mask.filter(ImageFilter.GaussianBlur(17))
outim=Image.composite(tint(ground_pixels,(1.02,1.0,.95),.83),outim,mask)
ground_adapted=out/"ground-adapted.jpg";outim.save(ground_adapted,quality=91,subsampling=0)
img=bpy.data.images.load(str(ground_adapted));mat=bpy.data.materials.new("Wildfire Games ground CC BY-SA");mat.use_nodes=True
nt=mat.node_tree;tex=nt.nodes.new("ShaderNodeTexImage");tex.image=img;tex.extension="REPEAT"
bsdf=nt.nodes.get("Principled BSDF");nt.links.new(tex.outputs["Color"],bsdf.inputs["Base Color"]);bsdf.inputs["Roughness"].default_value=.94
mesh.materials.append(mat)
bpy.context.view_layer.update();sc=bpy.context.scene
hx,hy=plan["hero"]["x"],plan["hero"]["y"]
hit,loc,normal,index,obj,matrix=sc.ray_cast(bpy.context.evaluated_depsgraph_get(),Vector((hx,hy,8)),Vector((0,0,-1)),distance=10)
assert hit and obj==ground,("Hero not on support",obj.name if hit else None)
# Actual vertical clearance over both authored route corridors, conservatively
# including roofs and props (not a navmesh or evidence of traversability).
routeproof=[]
deps=bpy.context.evaluated_depsgraph_get()
for route in plan["routes"]:
    samples=[];pts=route["points"]
    for a,b in zip(pts,pts[1:]):
        dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
        n=max(1,math.ceil(length/.25))
        for i in range(n+1):
            t=i/n;x=a[0]+t*dx;y=a[1]+t*dy
            for offset in (-plan["pathRadius"],0,plan["pathRadius"]):
                px=x-dy/length*offset;py=y+dx/length*offset
                hit,loc,normal,index,obj,matrix=sc.ray_cast(deps,Vector((px,py,8)),Vector((0,0,-1)),distance=10)
                samples.append({"xy":[px,py],"object":obj.name if hit else None,"pass":hit and obj==ground})
    routeproof.append({"id":route["id"],"count":len(samples),"passed":sum(x["pass"] for x in samples),"blocked":[x for x in samples if not x["pass"]]})
(out/"route-clearance.json").write_text(json.dumps(routeproof,indent=2))
assert all(r["count"]==r["passed"] for r in routeproof), "One or more proposed route corridors obstructed"
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/"pilot.blend"))
bpy.ops.export_scene.gltf(filepath=str(out/"pilot.glb"),export_format="GLB",export_copyright="Wildfire Games CC BY-SA 3.0; converted by CodePawl; research composition adapted by Ashes Throne")
meta={"scope":plan["scope"],"hero":[hx,loc.z,-hy],"camera":plan["camera"],"placements":proof,"trianglesWithInstances":sum(p["triangles"] for p in proof)+len(verts)-2,"glbBytes":(out/"pilot.glb").stat().st_size,"glbSHA256":hashlib.sha256((out/"pilot.glb").read_bytes()).hexdigest(),"ground":{**gr,"adaptationSHA256":hashlib.sha256(ground_adapted.read_bytes()).hexdigest()},"routes":routeproof,"edgeContact":{"count":contact["count"],"passed":contact["passed"],"fraction":contact["fraction"]}}
(out/"pilot.json").write_text(json.dumps(meta,indent=2))
for n in ["ATTRIBUTION.txt","LICENSE-upstream.txt","README-source.md","source-receipt.json","dataset-revision.json"]:
    (out/n).write_bytes((root/n).read_bytes())
for n in ["supplemental-receipt.json","ground-receipt.json"]:(out/n).write_bytes((root/"context"/n).read_bytes())
with (out/"ATTRIBUTION.txt").open("a") as f:f.write("\nGround texture source https://opengameart.org/node/38500 ; same CC BY-SA 3.0. Ground adapted via tint and authored route masks, see ground-adapted.jpg and layout.json. All research environment adaptations are CC BY-SA 3.0; no Ren model included in the exported environment.\n")
sc.render.engine="CYCLES";sc.cycles.device="CPU";sc.cycles.samples=16;sc.cycles.use_denoising=True
sc.render.resolution_x=932;sc.render.resolution_y=430;sc.render.resolution_percentage=100
sc.world=bpy.data.worlds.new("Review sky");sc.world.use_nodes=True
sc.world.node_tree.nodes["Background"].inputs[0].default_value=(.42,.52,.65,1)
sc.world.node_tree.nodes["Background"].inputs[1].default_value=.65
bpy.ops.object.light_add(type="SUN");sun=bpy.context.object;sun.rotation_euler=Vector((-.9,.5,-.7)).to_track_quat("-Z","Y").to_euler();sun.data.energy=3.0;sun.data.angle=.13
cam=plan["camera"];a,b=cam["alpha"],cam["beta"];t=cam["target"];target=Vector((t[0],-t[2],t[1]))
bpy.ops.object.camera_add();camera=bpy.context.object;sc.camera=camera
camera.data.type="ORTHO";camera.data.ortho_scale=2*cam["halfHeight"]*932/430;camera.data.clip_end=160
camera.location=target+35*Vector((math.cos(a)*math.sin(b),-math.sin(a)*math.sin(b),math.cos(b)))
camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
sc.render.filepath=str(out/"blender-composition.png");bpy.ops.render.render(write_still=True)
print(json.dumps({k:v for k,v in meta.items() if k!="placements"}))
