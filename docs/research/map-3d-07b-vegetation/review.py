"""Review real ready-made foliage. Preserve source textures; no synthetic plant geometry.
Candidate simplification is a comparison, not automatic artistic acceptance.
"""
import bpy, math, sys, json, pathlib, hashlib, struct
from mathutils import Vector
root=pathlib.Path(sys.argv[1]).resolve();out=root/'review';out.mkdir(exist_ok=True)
rows=json.loads((root/'source-receipt.json').read_text());results=[]
def tri(o):
    o.data.calc_loop_triangles();return len(o.data.loop_triangles)
def export(path):
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_copyright='Poly Haven CC0-1.0; see source receipt')
    b=path.read_bytes();n,k=struct.unpack_from('<II',b,12);assert k==0x4e4f534a
    j=json.loads(b[20:20+n]);assert j.get('images') and j.get('meshes')
    return {'bytes':len(b),'triangles':sum(j['accessors'][p['indices']]['count']//3 if 'indices' in p else j['accessors'][p['attributes']['POSITION']]['count']//3 for node in j['nodes'] if 'mesh' in node for p in j['meshes'][node['mesh']]['primitives']),'sha256':hashlib.sha256(b).hexdigest(),'images':len(j['images']),'alphaModes':[m.get('alphaMode','OPAQUE') for m in j.get('materials',[])]}
for row in rows:
    item={'id':row['id'],'state':'FAILED','role':row['role']};results.append(item)
    try:
        assert row['state']=='SOURCE_VERIFIED',row.get('error')
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(root/row['main']));bpy.context.view_layer.update()
        meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert meshes
        pts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
        lo=Vector(tuple(min(p[i] for p in pts) for i in range(3)));hi=Vector(tuple(max(p[i] for p in pts) for i in range(3)));center=(lo+hi)/2;span=max(hi-lo);assert span>0
        count=sum(tri(o) for o in meshes);item.update(originalTriangles=count,dimensions=list(hi-lo),sourceMeshes=len(meshes))
        assert count>0 and count<=500000,'source too heavy for this pilot'
        assert any(i.size[0]>0 for i in bpy.data.images),'no textures'
        scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=True
        scene.render.resolution_x=720;scene.render.resolution_y=480;scene.render.resolution_percentage=100
        scene.world=bpy.data.worlds.new('Review sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.37,.42,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
        bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.rotation_euler=Vector((-.5,.7,-1)).to_track_quat('-Z','Y').to_euler();sun.data.energy=2.1
        bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=span*1.6;camera.data.clip_end=span*20+20
        def render(stage):
            for i,d in enumerate([(1,-1,.75),(-1,1,.65)]):
                camera.location=center+Vector(d).normalized()*span*3;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(row['id']+'-'+stage+'-'+str(i)+'.png'));bpy.ops.render.render(write_still=True)
        render('source')
        # Preserve UVs and materials. Never blindly reduce a leaf-card asset:
        # only compare the candidate; original is retained for rejection/fallback.
        ratio=min(1.,row['targetTriangles']/count)
        if ratio<1:
            for o in meshes:
                if tri(o)<=12:continue
                bpy.context.view_layer.objects.active=o;o.select_set(True)
                m=o.modifiers.new('Candidate simplification','DECIMATE');m.decimate_type='COLLAPSE';m.ratio=max(.02,ratio);m.use_collapse_triangulate=True
                bpy.ops.object.modifier_apply(modifier=m.name);o.select_set(False)
        render('candidate')
        for o in [camera,sun]:bpy.data.objects.remove(o,do_unlink=True)
        p=out/(row['id']+'.glb');metrics=export(p);item.update(candidate=metrics,targetTriangles=row['targetTriangles'])
        item['state']='RENDERED_CANDIDATE' if metrics['triangles']<=row['targetTriangles']*1.15 and metrics['bytes']<=5*1024*1024 else 'OVER_BUDGET'
    except Exception as exc:
        item['error']=repr(exc);print(row['id'],repr(exc),flush=True)
    (out/'results.json').write_text(json.dumps(results,indent=2))
assert any(r['state']=='RENDERED_CANDIDATE' for r in results),'No usable budget candidate; inspect evidence'
