"""ENV026: author ONE composition of genuine CC0 photogrammetry in Blender.

Inputs are already-source-proven Poly Haven Coastal Cliff 04 and 02 mobile GLBs
from prior research branches; NO new procedurally synthesized rock geometry.
Blender is a build tool (GitHub Actions), never a browser dependency.

World: the fixed Babylon alpha=-3pi/4 camera sees the near fighter crown,
a deliberate physically empty chasm on the RIGHT, and an independent
background bank. The near scan is EDITED in Blender; this is not a
grid tiler or runtime procedural heightfield.
"""
import bpy, math, sys, json
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parents[1]
inp=Path(sys.argv[sys.argv.index("--")+1])
out=root/"assets"/"env026"
out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

ALPHA=-3*math.pi/4
RIGHT=(-math.sin(ALPHA), math.cos(ALPHA))
AWAY=(-math.cos(ALPHA),-math.sin(ALPHA))
def world(side,away,y):
    return (RIGHT[0]*side+AWAY[0]*away,y,RIGHT[1]*side+AWAY[1]*away)
def blender_point(wx,wy,wz):
    return (wx,-wz,wy)
def source(v):
    # Blender's glTF importer converts GLB Y-up -> Blender Z-up.
    return v.x,v.z,-v.y
def near_xyz(v):
    sx,sy,sz=source(v)
    side=(sz+6.0)
    away=(sx-22.0)*.65
    x,y,z=world(side,away,sy-8.329)
    return (x-1.0,y,z+.5),side,away

def load(name,path):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    if len(objects)!=1:raise RuntimeError(f"{name} expected exactly one ready-made mesh, got {len(objects)}")
    obj=objects[0]
    bpy.context.view_layer.objects.active=obj
    obj.name=name
    return obj

def edit_rock(obj,label,positioner,clip=None):
    mesh=obj.data
    # all coordinates are source-author vertices, then purposefully positioned
    # into a common Blender authoring scene in world units.
    coords=[]
    for vert in mesh.vertices:
        xyz,side,away=positioner(obj.matrix_world @ vert.co)
        coords.append((blender_point(*xyz),side,away))
    # All placed coordinates are now authored world-space Blender vertices.
    obj.parent=None
    obj.matrix_world.identity()
    for vertex,(co,side,away) in zip(mesh.vertices,coords):
        vertex.co=co
    # Remove only source triangles whose authored placement would close the
    # visual gap. This *cuts existing source geometry*, not invents triangles.
    if clip:
        removed=[]
        for poly in mesh.polygons:
            mid_side=sum(coords[i][1] for i in poly.vertices)/len(poly.vertices)
            mid_away=sum(coords[i][2] for i in poly.vertices)/len(poly.vertices)
            if not clip(mid_side,mid_away):
                removed.append(poly.index)
        if removed:
            import bmesh
            bm=bmesh.new();bm.from_mesh(mesh)
            bm.faces.ensure_lookup_table()
            bm.faces.index_update()
            bmesh.ops.delete(bm,geom=[bm.faces[i] for i in removed],context='FACES')
            bm.to_mesh(mesh);bm.free()
        print("EDITED_SOURCE",label,"REMOVED_SOURCE_FACES",len(removed))
    mesh.update()
    for p in mesh.polygons:p.use_smooth=False
    obj.name=label
    # Material stays inherited from publisher vertex-photo colours.
    return obj

near=load("PolyHaven_04_unedited",inp/"CoastalCliff04Mobile.glb")
# Cut right overhang and excessive near-front giant wedges using carefully
# authored, intentionally *irregular* terrain boundary. Preserve full
# sampled 6-fighter contact patch, verified later in actual WebGL.
def keep_near(side,away):
    right_lip=6.15+.55*math.sin(away*.42)+.38*math.sin(away*.17+1.7)
    return -20.0<side<right_lip and -16.0<away<19.0
edit_rock(near,"A_near_integrated_shelf_and_cliff_root",near_xyz,keep_near)

# Opposite coast is another SOURCE SCAN, in ONE connected landscape file.
# Orient the long CoastalCliff04 scan so its leftward natural mass appears
# across OPEN AIR at side 15+, away 13+. All y-values derive from photo-scan,
# not an invented curtain.
far=load("PolyHaven_04_second_raw",inp/"CoastalCliff04Mobile.glb")
def far_xyz(v):
    sx,sy,sz=source(v)
    side=17.0+(sz+6.0)*.76
    away=22.0+(sx-22.0)*.72
    y=(sy-8.329)*1.45+1.25
    return world(side,away,y),side,away
def keep_far(side,away):
    return 13.6<side<33.0 and 10.0<away<55.0
edit_rock(far,"B_far_opposite_bank_with_actual_thickness",far_xyz,keep_far)

# Third-party external original photographic slab adds a landward buttress;
# it is genuine Coastal Cliff 02 (not random stone instances).
rootrock=load("PolyHaven_02_root_raw",inp/"PolyCliff01.glb")
# Source model 02 was offline scaled to 12m width, 0..3m height. We use it
# as low, wide *landward* bedrock on the LEFT, physically overlapping shelf.
def root_xyz(v):
    sx,sy,sz=source(v)
    side=-11.0+sx*.90
    away=2.0+sz*1.25
    y=-5.3+sy*1.50
    return world(side,away,y),side,away
edit_rock(rootrock,"C_joined_left_buttress",root_xyz)

# Capture one editable scene file and export one static authored GLB,
# with three genuine mesh subparts and photo colours.
# All publisher scans carry baked real photo vertex colours from their
# original CC0 textures. Standardize one material and one attribute name so
# Blender's GLB exporter emits a SINGLE drawable primitive, not 3 materials.
shared=bpy.data.materials.new("ENV026_CC0_source_photography")
shared.use_nodes=True
nodes=shared.node_tree.nodes
links=shared.node_tree.links
bsdf=nodes.get("Principled BSDF")
if not bsdf:raise RuntimeError("Blender Principled BSDF missing")
vertex_color=nodes.new('ShaderNodeVertexColor')
vertex_color.layer_name="COLOR_0"
links.new(vertex_color.outputs["Color"],bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value=.96
for obj in [near,far,rootrock]:
    layers=obj.data.vertex_colors
    print("ORIGINAL_SOURCE_VERTEX_LAYERS",obj.name,[l.name for l in layers],flush=True)
    if not len(layers):raise RuntimeError("Original CC0 mesh has no baked photo vertex colours: "+obj.name)
    layers.active.name="COLOR_0"
    obj.data.materials.clear()
    obj.data.materials.append(shared)
    obj.select_set(False)

# Add a genuinely matched fixed-angle authoring camera. This helper is
# excluded from GLB export and never changes the game's own camera.
def camera(distance,name):
    alpha,beta=ALPHA,.96
    x=distance*math.cos(alpha)*math.sin(beta)
    y=distance*math.cos(beta)+.9
    z=distance*math.sin(alpha)*math.sin(beta)
    cam_data=bpy.data.cameras.new(name)
    cam=bpy.data.objects.new(name,cam_data);bpy.context.collection.objects.link(cam)
    cam.location=blender_point(x,y,z)
    target=Vector(blender_point(0,.9,0))
    direction=target-cam.location
    cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
    cam_data.type='PERSP';cam_data.sensor_fit='VERTICAL'
    cam_data.lens=cam_data.sensor_height/(2*math.tan(.8/2))
    cam_data.clip_end=250
    return cam
camera(12,"REFERENCE_FIXED_844x303_RADIUS12")
camera(19,"REFERENCE_FIXED_844x303_RADIUS19")
bpy.context.scene.camera=bpy.data.objects["REFERENCE_FIXED_844x303_RADIUS12"]
bpy.context.scene.render.resolution_x=844
bpy.context.scene.render.resolution_y=303
bpy.context.scene.render.resolution_percentage=100
bpy.context.scene.render.image_settings.file_format='PNG'
bpy.context.scene.world.color=(.5,.6,.64)
bpy.ops.wm.save_as_mainfile(filepath=str(out/"ENV026_authored_gorge.blend"))

# Export one combined, static draw-call mesh; the editable .blend keeps three
# independently adjustable sources saved above for future art revisions.
bpy.ops.object.select_all(action='DESELECT')
for obj in [near,far,rootrock]:obj.select_set(True)
bpy.context.view_layer.objects.active=near
bpy.ops.object.join()
bpy.context.view_layer.objects.active.name="ENV026_composite_genuine_CC0_rock"
bpy.ops.export_scene.gltf(filepath=str(out/"ENV026_authored_gorge.glb"),export_format='GLB',use_selection=True,export_yup=True,export_materials='EXPORT')
print("ENV026_AUTHORED_EXPORT",str(out/"ENV026_authored_gorge.glb"),(out/"ENV026_authored_gorge.glb").stat().st_size,flush=True)
print("ENV026_SOURCE_PARTS",[(o.name,len(o.data.polygons)) for o in [near,far,rootrock]],flush=True)
