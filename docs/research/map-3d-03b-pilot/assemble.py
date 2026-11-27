"""Asset-only composition: transform existing verified GLB mesh instances. No generated visible mesh."""
import bpy, json, math, sys, pathlib, hashlib
from mathutils import Vector, Matrix
kit=pathlib.Path(sys.argv[1]).resolve();out=pathlib.Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
plan=json.loads(pathlib.Path(__file__).with_name("layout.json").read_text())
receipts={x["id"]:x for x in json.loads((kit/"import-receipt.json").read_text())}
bpy.ops.wm.read_factory_settings(use_empty=True)
templates={}; all_templates=[]; proof=[]
def bounds(entries):
    pts=[matrix@Vector(c) for o,matrix in entries for c in o.bound_box]
    assert pts
    return Vector(tuple(min(p[i] for p in pts) for i in range(3))),Vector(tuple(max(p[i] for p in pts) for i in range(3)))
for asset in sorted({p["asset"] for p in plan["placements"]}):
    r=receipts[asset];path=kit/"review"/(asset+".glb")
    assert r["state"]=="IMPORTED_AND_RENDERED"
    assert hashlib.sha256(path.read_bytes()).hexdigest()==r["glbSHA256"]
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    imported=[o for o in bpy.data.objects if o not in before]
    entries=[(o,o.matrix_world.copy()) for o in imported if o.type=="MESH"]
    assert entries and all(o.data.materials for o,_ in entries)
    templates[asset]=entries
    all_templates.extend(imported)
    for o in imported:
        for collection in list(o.users_collection):
            collection.objects.unlink(o)
art=bpy.data.collections.new("ART - verified authored models");bpy.context.scene.collection.children.link(art)
for p in plan["placements"]:
    selected=[(o,m) for o,m in templates[p["asset"]] if o.name.startswith(p["prefix"])]
    assert selected, (p["prefix"],[o.name for o,_ in templates[p["asset"]]])
    lo,hi=bounds(selected);center=(lo+hi)/2
    rotation=Matrix.Rotation(math.radians(p["yaw"]),4,"Z")
    scaling=Matrix.Diagonal(Vector((*p["scale"],1.0)))
    local=rotation@scaling@Matrix.Translation(-center)
    transformed=[(o,local@m) for o,m in selected]
    lo,hi=bounds(transformed)
    move=Matrix.Translation(Vector((p["xy"][0]-(lo.x+hi.x)/2,p["xy"][1]-(lo.y+hi.y)/2,p["z"]-(hi.z if p["anchor"]=="top" else lo.z))))
    placed=[]
    for j,(o,m) in enumerate(transformed):
        c=o.copy();c.parent=None;c.animation_data_clear();c.name=p["name"]+"_"+str(j);art.objects.link(c);c.matrix_world=move@m
        placed.append((c,c.matrix_world.copy()))
    lo,hi=bounds(placed)
    triangles=0
    for o,_ in placed:
        o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
    proof.append({"name":p["name"],"sourceAsset":p["asset"],"sourceSHA256":receipts[p["asset"]]["glbSHA256"],"sourceObjects":[o.name for o,_ in selected],"bounds":[list(lo),list(hi)],"triangles":triangles})
for o in all_templates:
    bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update()
sc=bpy.context.scene
# Ground the actual Ren preview position using actual deck triangles. A miss is a hard failure.
hx,hy=plan["hero"]["x"],plan["hero"]["y"]
hit,loc,normal,index,obj,matrix=sc.ray_cast(bpy.context.evaluated_depsgraph_get(),Vector((hx,hy,2)),Vector((0,0,-1)),distance=4)
assert hit and obj.name.startswith(("front_terrace","rear_terrace")), ("Hero not on authored terrace",obj.name if hit else None)
assert normal.z>.7 and abs(loc.z)<.65, (list(loc),list(normal))
hero=[hx,loc.z,-hy]
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(out/"pilot.blend"))
bpy.ops.export_scene.gltf(filepath=str(out/"pilot.glb"),export_format="GLB")
assert (out/"pilot.glb").read_bytes()[:4]==b"glTF"
meta={"scope":plan["scope"],"hero":hero,"camera":plan["camera"],"placements":proof,"trianglesWithInstances":sum(p["triangles"] for p in proof),"glbBytes":(out/"pilot.glb").stat().st_size,"glbSHA256":hashlib.sha256((out/"pilot.glb").read_bytes()).hexdigest(),"kitRun":plan["kitRun"],"kitArtifact":plan["kitArtifact"]}
(out/"pilot.json").write_text(json.dumps(meta,indent=2))
# Orthographic frame from same direction/pitch as browser. Scene art is unchanged by studio light.
sc.render.engine="CYCLES";sc.cycles.device="CPU";sc.cycles.samples=12;sc.cycles.use_denoising=True
sc.render.resolution_x=932;sc.render.resolution_y=430;sc.render.resolution_percentage=100
sc.world=bpy.data.worlds.new("Review sky");sc.world.use_nodes=True
sc.world.node_tree.nodes["Background"].inputs[0].default_value=(.42,.52,.65,1)
sc.world.node_tree.nodes["Background"].inputs[1].default_value=.55
bpy.ops.object.light_add(type="SUN");sun=bpy.context.object;sun.rotation_euler=Vector((.45,.65,-1)).to_track_quat("-Z","Y").to_euler();sun.data.energy=2.8;sun.data.angle=.13
cam=plan["camera"];a,b=cam["alpha"],cam["beta"];t=cam["target"];target=Vector((t[0],-t[2],t[1]))
bpy.ops.object.camera_add();camera=bpy.context.object;sc.camera=camera
camera.data.type="ORTHO";camera.data.ortho_scale=2*cam["halfHeight"]*932/430;camera.data.clip_end=160
camera.location=target+35*Vector((math.cos(a)*math.sin(b),-math.sin(a)*math.sin(b),math.cos(b)))
camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
sc.render.filepath=str(out/"blender-composition.png");bpy.ops.render.render(write_still=True)
print(json.dumps({k:v for k,v in meta.items() if k!="placements"}))
