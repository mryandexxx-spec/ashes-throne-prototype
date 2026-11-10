"""ENV021 first contiguous geological clay sculpt (WORK IN PROGRESS).
This is a Blender-authored *initial mass*, not a final art piece.
The CC0 coastal cliff scan is fused as real surface-relief source, not placed
as three free-standing decorative scans. The final sculpt and surface baking
still require artist critique from real game camera screenshots.
"""
import math

import bpy
from mathutils import Vector


ALPHA = -3.0 * math.pi / 4.0


def point(side, away, y):
    # Babylon world x/y/z -> Blender x/y/z, with the same fixed camera yaw.
    rx, rz = -math.sin(ALPHA), math.cos(ALPHA)
    ax, az = -math.cos(ALPHA), -math.sin(ALPHA)
    return (rx * side + ax * away, rz * side + az * away, y)


def build_landmass():
    """Manifold single rocky foundation, full top + receding gorge face."""
    nside, naway = 33, 39
    verts, faces = [], []

    def add(coord):
        verts.append(coord)
        return len(verts) - 1

    def rim(a):
        return 9.9 + .65 * math.sin(a * .17 + .4) + .33 * math.sin(a * .47)

    away_values = [-19.0 + i * 1.15 for i in range(naway)]
    top, bottom = [], []
    for a in away_values:
        row, low_row = [], []
        for i in range(nside):
            t = i / (nside - 1)
            s = -28.0 * (1 - t) + rim(a) * t
            ground = -0.04
            # Preserve fighter shelf at 0, weaken toward natural landward terrain.
            if s < -11:
                ground -= min(2.3, (-11 - s) * .11)
            if abs(a) > 9:
                ground -= min(1.4, (abs(a) - 9) * .11)
            # Broad asymmetrical weathering. No spiky sinusoidal terrace strips.
            ground += .09 * math.sin(.31 * s + .19 * a) * min(1.0, abs(s) / 10)
            row.append(add(point(s, a, ground)))
            low_row.append(add(point(s if i < nside-1 else rim(a)+3.6, a, -34.0)))
        top.append(row)
        bottom.append(low_row)

    def quad(a,b,c,d):
        faces.append((a,b,c))
        faces.append((a,c,d))

    for j in range(naway-1):
        for i in range(nside-1):
            quad(top[j][i], top[j][i+1], top[j+1][i+1], top[j+1][i])

    # True continuous cliff descending from the battle shelf rim into open void.
    cliff = [[top[j][-1]] for j in range(naway)]
    depth_steps = 17
    for j, a in enumerate(away_values):
        for k in range(1, depth_steps + 1):
            d = k / depth_steps
            cliff_s = (rim(a) + 3.6*d
                        + .52*math.sin(d*15.0 + a*.29)*math.sin(math.pi*d)
                        + .23*math.sin(d*26.0 - a*.13)*math.sin(math.pi*d))
            cliff_y = -34*d
            cliff[j].append(add(point(cliff_s, a, cliff_y)))
        # Join to the volume bottom, not a detached photograph curtain.
        cliff[j][-1] = bottom[j][-1]

    for j in range(naway-1):
        for k in range(depth_steps):
            quad(cliff[j][k], cliff[j][k+1], cliff[j+1][k+1], cliff[j+1][k])

    # Bottom, three closed remaining boundary walls.
    for j in range(naway-1):
        for i in range(nside-1):
            quad(bottom[j+1][i], bottom[j+1][i+1], bottom[j][i+1], bottom[j][i])
    for i in range(nside-1):
        quad(top[0][i+1], top[0][i], bottom[0][i], bottom[0][i+1])
        quad(top[-1][i], top[-1][i+1], bottom[-1][i+1], bottom[-1][i])
    for j in range(naway-1):
        quad(top[j][0], top[j+1][0], bottom[j+1][0], bottom[j][0])

    # The deeper body has substantial thickness and camera-facing cliff relief.
    mesh = bpy.data.meshes.new("ENV021_manifold_base_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new("ENV021_CONTINUOUS_CANYON_LEDGE_WIP", mesh)
    bpy.context.collection.objects.link(ob)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return ob


def blend_scan(scan_path, base):
    """Fuse source scan relief to the cliff *within* Blender's voxel surface."""
    if not scan_path:
        raise RuntimeError("Authored WIP requires actual CC0 source scan")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(scan_path))
    imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == "MESH"]
    if not imported:
        raise RuntimeError("CC0 GLB contained no meshes")
    # Convert all imported glTF hierarchy transforms to coordinates before placement.
    bpy.ops.object.select_all(action="DESELECT")
    for ob in imported:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = imported[0]
    bpy.ops.object.convert(target="MESH")
    imported = [o for o in bpy.context.selected_objects if o.type == "MESH"]
    # Join multiple primitives into one real photogrammetric source patch.
    bpy.context.view_layer.objects.active = imported[0]
    bpy.ops.object.join()
    scan = bpy.context.object
    world = [scan.matrix_world @ Vector(v.co) for v in scan.data.vertices]
    minimum = Vector([min(v[i] for v in world) for i in range(3)])
    maximum = Vector([max(v[i] for v in world) for i in range(3)])
    span = maximum-minimum
    if min(span) <= 0:
        raise RuntimeError("Degenerate source scan")
    # Shape source along the canyon's camera-facing natural wall.
    # The broad 12-unit scan dimension runs along the cliff / away direction.
    # Geometry is deliberately sunk into the primary landmass before remeshing.
    center = (maximum+minimum)*.5
    a_center = 2.0
    for v in scan.data.vertices:
        local = scan.matrix_world @ v.co
        q = local - center
        # Use scan's dominant X direction for continuous cliff length, 
        # scan's thinner Z for side relief, Y for vertical elevation.
        away = a_center + q.x * 1.20
        side = 10.0 + q.z * .65
        vertical = -7.0 + q.y * 1.7
        v.co = point(side, away, vertical)
    scan.matrix_world.identity()
    scan.name = "CC0_PolyHaven_CoastalCliff02_fused_relief"

    # Union by a single watertight voxel sculpt; no detached cliff cards.
    bpy.ops.object.select_all(action="DESELECT")
    base.select_set(True)
    scan.select_set(True)
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.join()
    base.data.remesh_voxel_size = 0.34
    bpy.ops.object.voxel_remesh()
    # A restrained geological weathering pass on the fused high-detail surface.
    stone_tex = bpy.data.textures.new("ENV021_differential_weathering", type="CLOUDS")
    stone_tex.noise_scale = 1.75
    displace = base.modifiers.new("Weathered cohesive rock", type="DISPLACE")
    displace.texture = stone_tex
    displace.strength = .13
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.modifier_apply(modifier=displace.name)
    # Keep prototype reasonably small; art-first evaluation precedes LOD budgets.
    dec = base.modifiers.new("WIP_not_mobile_optimized", type="DECIMATE")
    dec.ratio = 0.55
    bpy.ops.object.modifier_apply(modifier=dec.name)
    return base


def build(scan_path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    land = build_landmass()
    blend_scan(scan_path, land)
    m = bpy.data.materials.new("ENV021_Clay_Not_Final_PBR")
    m.diffuse_color = (.45,.44,.42,1)
    land.data.materials.clear()
    land.data.materials.append(m)
    return {"source": "Poly Haven Coastal Cliff 02 CC0, pinned old PR #208",
            "massing": "single watertight continuous Blender voxel sculpt",
            "stage": "CLAY_WIP_NOT_ART_APPROVED",
            "note": "Scan used as fused sculpt relief; materials not baked; game camera unverified"}
