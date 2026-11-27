"""Research only: author/edit in Blender, export visual GLB + navigation + POI.
Coordinates: glTF/Babylon right-handed Y-up; Blender Z-up (x,-z,y).
No game canon, imported third-party assets, final art or balance."""
import bpy, json, math, sys, pathlib, hashlib, time
from mathutils import Vector
out=pathlib.Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True)
fixture=json.loads(pathlib.Path(sys.argv[2]).read_text())
def to_bl(p): return (p[0],-p[2],p[1])
def to_game(v): return [round(v.x,6),round(v.z,6),round(-v.y,6)]
def mesh_obj(name,verts,faces,collection):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj);return obj
def collection(name):
    c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);return c
def mat(name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.85
    return m
def marker(id,role,p,coll):
    o=bpy.data.objects.new(id,None);coll.objects.link(o);o.location=to_bl(p);o.empty_display_type='ARROWS';o.empty_display_size=.6;o['level_id']=id;o['role']=role;return o
def cube(name,center,size,material,coll):
    bpy.ops.mesh.primitive_cube_add(size=1,location=to_bl(center));o=bpy.context.object;o.name=name;o.dimensions=(size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for c in list(o.users_collection): c.objects.unlink(o)
    coll.objects.link(o);o.data.materials.append(material);return o
bpy.ops.wm.read_factory_settings(use_empty=True)
art=collection('ART');nav=collection('NAV');markers=collection('MARKERS')
bpy.context.scene.unit_settings.system='METRIC'
p=fixture['positions'];ix=fixture['indices'];verts=[to_bl(p[i:i+3]) for i in range(0,len(p),3)];faces=[ix[i:i+3] for i in range(0,len(ix),3)]
stone=mat('neutral sandstone',(.32,.23,.15));floor=mat('neutral path',(.46,.40,.30));green=mat('neutral moss',(.14,.28,.16))
surface=mesh_obj('walkable_visual',verts,faces,art);surface.data.materials.append(floor)
proxy=mesh_obj('NAV_floor',verts,faces,nav)
# Markers are authored empties. Visible landmarks are deliberately neutral blockout.
cube('north_landmark',[-3.4,.65,5.1],[.7,1.3,.7],stone,art)
cube('south_landmark',[3.4,.5,-5.1],[.8,1,.8],green,art)
cube('upper_landmark',[16.6,2.7,1.9],[.75,1.4,.75],stone,art)
marker('lab.spawn','spawn',[-6,0,0],markers)
marker('lab.branch.n','optional',[-4,0,4],markers)
marker('lab.branch.s','optional',[4,0,-4],markers)
marker('lab.exit','exit',[15,2,0],markers)
# Only exterior decoration in blockout, no collision assumptions for props.
# Save source with all collections, never overwrite a production asset.
def export_version(path):
    path.mkdir(exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in art.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path/'level.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
    deps=bpy.context.evaluated_depsgraph_get();positions=[];indices=[]
    for o in nav.objects:
        ev=o.evaluated_get(deps);m=ev.to_mesh();m.calc_loop_triangles();base=len(positions)//3
        for v in m.vertices: positions.extend(to_game(ev.matrix_world @ v.co))
        for t in m.loop_triangles: indices.extend(base+i for i in t.vertices)
        ev.to_mesh_clear()
    poi=[{'id':o['level_id'],'role':o['role'],'position':to_game(o.matrix_world.translation)} for o in sorted(markers.objects,key=lambda o:o.name)]
    (path/'nav.json').write_text(json.dumps({'positions':positions,'indices':indices},sort_keys=True))
    (path/'level.json').write_text(json.dumps({'schema':1,'coordinateSystem':'RH-Y-up-meters','art':'level.glb','nav':'nav.json','markers':poi},sort_keys=True,indent=2))
    bpy.ops.wm.save_as_mainfile(filepath=str(path/'source.blend'))
start=time.perf_counter();export_version(out/'base');elapsed=time.perf_counter()-start
# Reopen editable source, move existing marker; stable ID and untouched navigation.
bpy.ops.wm.open_mainfile(filepath=str(out/'base'/'source.blend'))
art=bpy.data.collections['ART'];nav=bpy.data.collections['NAV'];markers=bpy.data.collections['MARKERS']
bpy.data.objects['lab.branch.n'].location=to_bl([-3.5,0,4.2]);bpy.context.view_layer.update()
start=time.perf_counter();export_version(out/'revision');revision_seconds=time.perf_counter()-start
files={}
for f in sorted(out.rglob('*')):
    if f.is_file():files[str(f.relative_to(out))]={'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
(out/'receipt.json').write_text(json.dumps({'blender':bpy.app.version_string,'base_seconds':elapsed,'revision_seconds':revision_seconds,'files':files,'provenance':'Project-generated neutral blockout; no external assets; lab only'},indent=2))
print((out/'receipt.json').read_text())
