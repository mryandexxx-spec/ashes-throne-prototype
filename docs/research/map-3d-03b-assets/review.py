"""Import source glTF, preserve source dimensions; export GLB and render actual imported art."""
import bpy, math, sys, json, pathlib, hashlib
from mathutils import Vector
root=pathlib.Path(sys.argv[1]).resolve()
out=root/"review"; out.mkdir(exist_ok=True)
rows=json.loads((root/"source-receipt.json").read_text())
results=[]
for row in rows:
    if row["state"]!="SOURCE_VERIFIED": continue
    item={"id":row["id"],"state":"FAILED"}
    results.append(item)
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(root/row["main"]))
        meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
        assert meshes
        points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
        lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
        hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
        center=(lo+hi)/2
        span=max(hi-lo)
        assert math.isfinite(span) and span>0
        tris=0
        for o in meshes:
            o.data.calc_loop_triangles()
            tris+=len(o.data.loop_triangles)
        images=[{"name":i.name,"size":list(i.size)} for i in bpy.data.images if i.source in {"FILE","GENERATED"} and i.size[0]>0]
        assert images and bpy.data.materials, "missing material images"
        target=out/(row["id"]+".glb")
        bpy.ops.export_scene.gltf(filepath=str(target),export_format="GLB")
        assert target.read_bytes()[:4]==b"glTF"
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=str(out/(row["id"]+".blend")))
        item.update(triangles=tris,dimensions=list(hi-lo),meshes=[{"name":o.name,"triangles":len(o.data.loop_triangles)} for o in meshes],materials=len(bpy.data.materials),images=images,glbBytes=target.stat().st_size,glbSHA256=hashlib.sha256(target.read_bytes()).hexdigest())
        sc=bpy.context.scene
        sc.render.engine="CYCLES"
        sc.cycles.device="CPU"
        sc.cycles.samples=12
        sc.cycles.use_denoising=True
        sc.render.resolution_x=800; sc.render.resolution_y=600; sc.render.resolution_percentage=100
        sc.render.image_settings.file_format="PNG"
        sc.world=bpy.data.worlds.new("Neutral review world")
        sc.world.use_nodes=True
        sc.world.node_tree.nodes["Background"].inputs[0].default_value=(.24,.27,.31,1)
        sc.world.node_tree.nodes["Background"].inputs[1].default_value=.6
        bpy.ops.object.light_add(type="SUN",location=center+Vector((span,-span,span)))
        sun=bpy.context.object; sun.rotation_euler=Vector((-1,1,-1.5)).to_track_quat("-Z","Y").to_euler()
        sun.data.energy=2.2
        bpy.ops.object.camera_add()
        camera=bpy.context.object; sc.camera=camera
        camera.data.type="ORTHO"; camera.data.ortho_scale=span*1.65
        camera.data.clip_end=span*20+100
        for n,d in enumerate([(1,-1,.85),(-1,1,.65)]):
            camera.location=center+Vector(d).normalized()*span*3
            camera.rotation_euler=(center-camera.location).to_track_quat("-Z","Y").to_euler()
            sc.render.filepath=str(out/(row["id"]+"-"+str(n)+".png"))
            bpy.ops.render.render(write_still=True)
        item["state"]="IMPORTED_AND_RENDERED"
    except Exception as exc:
        item["error"]=repr(exc)
        print(row["id"],repr(exc),flush=True)
    (root/"import-receipt.json").write_text(json.dumps(results,indent=2))
if len(results)!=len(rows) or any(r["state"]!="IMPORTED_AND_RENDERED" for r in results):
    sys.exit("Incomplete intake/import, inspect receipts")
