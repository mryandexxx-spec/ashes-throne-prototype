"""One controlled image-to-3D test: source and candidate rendered independently."""
import bpy, pathlib, sys, json, hashlib, math
from mathutils import Vector, Matrix
mode, source, out = sys.argv[1:4]
source=pathlib.Path(source); out=pathlib.Path(out);out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
if mode=="reference":
    rec=next(r for r in json.loads((source/"import-receipt.json").read_text()) if r["id"]=="modular_fort_01")
    path=source/"review/modular_fort_01.glb"
    assert hashlib.sha256(path.read_bytes()).hexdigest()==rec["glbSHA256"]
else:
    path=source
bpy.ops.import_scene.gltf(filepath=str(path))
bpy.context.view_layer.update()
objects=[o for o in bpy.context.scene.objects if o.type=="MESH"]
keep=[o for o in objects if o.name.startswith("modular_fort_01_wall_thin_gate_01")] if mode=="reference" else objects
assert keep
for o in keep:
    matrix=o.matrix_world.copy();o.parent=None;o.matrix_world=matrix
for o in list(bpy.data.objects):
    if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update()
def bounds():
    pts=[o.matrix_world@Vector(c) for o in keep for c in o.bound_box]
    return Vector(tuple(min(p[i] for p in pts) for i in range(3))),Vector(tuple(max(p[i] for p in pts) for i in range(3)))
lo,hi=bounds()
if mode=="reference" and hi.y-lo.y>hi.x-lo.x:
    for o in keep:o.matrix_world=Matrix.Rotation(math.pi/2,4,"Z")@o.matrix_world
    bpy.context.view_layer.update();lo,hi=bounds()
dim=hi-lo;span=max(dim);assert span>0
center=(lo+hi)/2
norm=Matrix.Scale(2/span,4)@Matrix.Translation(-center)
for o in keep:o.matrix_world=norm@o.matrix_world
bpy.context.view_layer.update()
lo,hi=bounds()
triangles=0
for o in keep:
    o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
    if mode!="reference" and len(o.data.color_attributes):
        mat=bpy.data.materials.new("Reconstructed vertex colors");mat.use_nodes=True
        nt=mat.node_tree;v=nt.nodes.new("ShaderNodeVertexColor");v.layer_name=o.data.color_attributes[0].name
        nt.links.new(v.outputs["Color"],nt.nodes.get("Principled BSDF").inputs["Base Color"])
        o.data.materials.clear();o.data.materials.append(mat)
sc=bpy.context.scene
sc.render.engine="CYCLES";sc.cycles.device="CPU";sc.cycles.samples=16;sc.cycles.use_denoising=True
sc.render.resolution_x=512;sc.render.resolution_y=512;sc.render.resolution_percentage=100
sc.render.image_settings.file_format="PNG";sc.render.image_settings.color_mode="RGBA";sc.render.film_transparent=True
sc.world=bpy.data.worlds.new("review");sc.world.use_nodes=True
sc.world.node_tree.nodes["Background"].inputs[0].default_value=(.5,.5,.5,1)
sc.world.node_tree.nodes["Background"].inputs[1].default_value=.8
bpy.ops.object.light_add(type="SUN");sun=bpy.context.object;sun.rotation_euler=Vector((.45,.65,-1)).to_track_quat("-Z","Y").to_euler();sun.data.energy=2.2
bpy.ops.object.camera_add();cam=bpy.context.object;sc.camera=cam;cam.data.type="ORTHO";cam.data.ortho_scale=2.7
for label,d in [("front",(0,-1,.12)),("oblique",(.65,-1,.45)),("side",(1,0,.12)),("rear",(0,1,.12)),("opposite",(-1,0,.12))]:
    cam.location=Vector(d).normalized()*5;cam.rotation_euler=(-cam.location).to_track_quat("-Z","Y").to_euler()
    sc.render.filepath=str(out/(mode+"-"+label+".png"));bpy.ops.render.render(write_still=True)
(out/(mode+".json")).write_text(json.dumps({"mode":mode,"sourceSHA256":hashlib.sha256(path.read_bytes()).hexdigest(),"originalDimensions":list(dim),"normalizedBounds":[list(lo),list(hi)],"triangles":triangles,"bytes":path.stat().st_size,"sourceObjects":[o.name for o in keep]},indent=2))
if mode=="reference":
    from PIL import Image
    image=Image.open(out/"reference-oblique.png").convert("RGBA")
    bg=Image.new("RGBA",image.size,(128,128,128,255));bg.alpha_composite(image)
    bg.convert("RGB").save(out/"input.png")
