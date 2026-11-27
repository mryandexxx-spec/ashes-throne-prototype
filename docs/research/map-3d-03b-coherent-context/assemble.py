"""Compose coherent authored assets; one explicitly drawn flat support surface, not generated main art."""
import bpy,math,json,sys,pathlib,hashlib
from mathutils import Vector,Matrix
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
for o in originals:bpy.data.objects.remove(o,do_unlink=True)
# Flat walkable support: manually drawn perimeter, exact authored CC BY-SA ground texture.
# This is not a generated cliff or building; all visible structural art is original imported models.
verts=[(x,y,0) for x,y in plan["terrain"]]
mesh=bpy.data.meshes.new("Hand-drawn ledge support");mesh.from_pydata(verts,[],[list(range(len(verts)))]);mesh.update()
ground=bpy.data.objects.new("walkable_support",mesh);art.objects.link(ground)
uv=mesh.uv_layers.new(name="Ground UV")
for loop in mesh.loops:
    x,y,_=verts[loop.vertex_index];uv.data[loop.index].uv=(x/3.2,y/3.2)
gpath=root/"context/ground.png";gr=json.loads((root/"context/ground-receipt.json").read_text());assert hashlib.sha256(gpath.read_bytes()).hexdigest()==gr["sha256"]
img=bpy.data.images.load(str(gpath));mat=bpy.data.materials.new("Wildfire Games ground CC BY-SA");mat.use_nodes=True
nt=mat.node_tree;tex=nt.nodes.new("ShaderNodeTexImage");tex.image=img;tex.extension="REPEAT"
bsdf=nt.nodes.get("Principled BSDF");nt.links.new(tex.outputs["Color"],bsdf.inputs["Base Color"]);bsdf.inputs["Roughness"].default_value=.94
mesh.materials.append(mat)
bpy.context.view_layer.update();sc=bpy.context.scene
hx,hy=plan["hero"]["x"],plan["hero"]["y"]
hit,loc,normal,index,obj,matrix=sc.ray_cast(bpy.context.evaluated_depsgraph_get(),Vector((hx,hy,8)),Vector((0,0,-1)),distance=10)
assert hit and obj==ground,("Hero not on support",obj.name if hit else None)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/"pilot.blend"))
bpy.ops.export_scene.gltf(filepath=str(out/"pilot.glb"),export_format="GLB",export_copyright="Wildfire Games CC BY-SA 3.0; converted by CodePawl; research composition adapted by Ashes Throne")
meta={"scope":plan["scope"],"hero":[hx,loc.z,-hy],"camera":plan["camera"],"placements":proof,"trianglesWithInstances":sum(p["triangles"] for p in proof)+len(verts)-2,"glbBytes":(out/"pilot.glb").stat().st_size,"glbSHA256":hashlib.sha256((out/"pilot.glb").read_bytes()).hexdigest(),"ground":gr}
(out/"pilot.json").write_text(json.dumps(meta,indent=2))
for n in ["ATTRIBUTION.txt","LICENSE-upstream.txt","README-source.md","source-receipt.json","dataset-revision.json"]:
    (out/n).write_bytes((root/n).read_bytes())
for n in ["supplemental-receipt.json","ground-receipt.json"]:(out/n).write_bytes((root/"context"/n).read_bytes())
with (out/"ATTRIBUTION.txt").open("a") as f:f.write("\nGround texture source https://opengameart.org/node/38500 ; same CC BY-SA 3.0. All research environment adaptations are CC BY-SA 3.0; no Ren model included in the exported environment.\n")
sc.render.engine="CYCLES";sc.cycles.device="CPU";sc.cycles.samples=16;sc.cycles.use_denoising=True
sc.render.resolution_x=932;sc.render.resolution_y=430;sc.render.resolution_percentage=100
sc.world=bpy.data.worlds.new("Review sky");sc.world.use_nodes=True
sc.world.node_tree.nodes["Background"].inputs[0].default_value=(.42,.52,.65,1)
sc.world.node_tree.nodes["Background"].inputs[1].default_value=.65
bpy.ops.object.light_add(type="SUN");sun=bpy.context.object;sun.rotation_euler=Vector((.65,.4,-1)).to_track_quat("-Z","Y").to_euler();sun.data.energy=2.6;sun.data.angle=.13
cam=plan["camera"];a,b=cam["alpha"],cam["beta"];t=cam["target"];target=Vector((t[0],-t[2],t[1]))
bpy.ops.object.camera_add();camera=bpy.context.object;sc.camera=camera
camera.data.type="ORTHO";camera.data.ortho_scale=2*cam["halfHeight"]*932/430;camera.data.clip_end=160
camera.location=target+35*Vector((math.cos(a)*math.sin(b),-math.sin(a)*math.sin(b),math.cos(b)))
camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
sc.render.filepath=str(out/"blender-composition.png");bpy.ops.render.render(write_still=True)
print(json.dumps({k:v for k,v in meta.items() if k!="placements"}))
