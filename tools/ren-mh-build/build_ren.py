"""REN-MH-004 [ПРЕДЛОЖЕНИЕ]. MakeHuman + Blender Ren Teren production candidate.
Creates a textured 3D character and skinned animation tracks. This is NOT approved art.
Adapted from the MakeHuman/Blender method used for Duncan in Dgoh-game.
Run via Blender background mode, not ordinary system Python.
"""
import json
import math
import os
from pathlib import Path
import random
import sys
import bpy
import bmesh
import numpy as np
from mathutils import Vector
import mh_body_ren

OUT = Path(os.environ.get("REN_BUILD_OUT", "/tmp/ren-model"))
OUT.mkdir(parents=True, exist_ok=True)
random.seed(41)
bpy.ops.wm.read_factory_settings(use_empty=True)
# mh_body_ren.build() reads its helpers at call time.
BODY, EYES, LASHES, LAND, SCALE = mh_body_ren.build(2.12)  # authoring units: match 2.1m accessory layout
G, GV = mh_body_ren.G, mh_body_ren.GV
L = {key: Vector(value) for key, value in LAND.items()}
SCENE = bpy.context.scene
SCENE.render.fps = 24

def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

def apply_modifier(obj, kind, **kwargs):
    mod = obj.modifiers.new("Ren_" + kind, kind)
    for key, val in kwargs.items():
        setattr(mod, key, val)
    active(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)

def smooth(obj):
    for face in obj.data.polygons:
        face.use_smooth = True

PALETTE = {
    "skin": ((.48, .32, .25), .66, 0.0),
    "eye": ((.77, .72, .61), .34, 0.0),
    "linen": ((.54, .49, .38), .91, 0.0),
    "coat": ((.18, .22, .18), .89, 0.0),
    "coat_worn": ((.25, .27, .22), .89, 0.0),
    "trouser": ((.16, .17, .15), .94, 0.0),
    "boot": ((.14, .11, .09), .84, 0.0),
    "leather": ((.28, .16, .10), .78, 0.0),
    "rope": ((.54, .45, .30), .95, 0.0),
    "scarf": ((.40, .16, .12), .91, 0.0),
    "hair": ((.075, .060, .054), .72, 0.0),
    "metal": ((.34, .32, .28), .39, .69),
}
MATERIALS = {}
def pbr(name):
    if name in MATERIALS:
        return MATERIALS[name]
    rgb, rough, metal = PALETTE[name]
    # Small deterministic colour texture: woven/scuffed rather than flat vertex paint.
    res = 256 if name not in ("skin", "linen", "coat") else 512
    y, x = np.mgrid[0:res, 0:res]
    noise = np.random.default_rng(100 + list(PALETTE).index(name)).normal(0, .04, (res, res))
    grain = np.sin(x * .71) * np.sin(y * .89) * .025
    wear = np.sin(x * .031 + y * .016) * .028
    factor = np.clip(.95 + noise + grain + wear, .68, 1.15)
    px = np.empty((res, res, 4), dtype=np.float32)
    for c in range(3):
        px[:, :, c] = np.clip(rgb[c] * factor, 0, 1)
    px[:, :, 3] = 1
    img = bpy.data.images.new("REN_" + name + "_alb", res, res, alpha=True)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = str(OUT / ("ren_" + name + "_albedo.png"))
    img.file_format = "PNG"
    img.save()
    mat = bpy.data.materials.new("REN_PBR_" + name)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Metallic"].default_value = metal
    texture = mat.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image = img
    mat.node_tree.links.new(texture.outputs["Color"], bs.inputs["Base Color"])
    if name in ("scarf", "hair"):
        mat.use_backface_culling = False
    MATERIALS[name] = mat
    return mat

def assign(obj, key):
    obj.data.materials.clear()
    obj.data.materials.append(pbr(key))
    smooth(obj)
    return obj

def shell(source, name, predicate, lift, category, thick=.004):
    obj = source.copy()
    obj.data = source.data.copy()
    SCENE.collection.objects.link(obj)
    obj.name = "Ren_" + name
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    removed = [f for f in bm.faces if not predicate(GV(f.calc_center_median()))]
    bmesh.ops.delete(bm, geom=removed, context="FACES")
    if not bm.faces:
        bm.free()
        bpy.data.objects.remove(obj, do_unlink=True)
        raise RuntimeError("Empty garment " + name)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    for vertex in obj.data.vertices:
        vertex.co += vertex.normal * lift
    if thick:
        apply_modifier(obj, "SOLIDIFY", thickness=thick, offset=1)
    # Texture UVs for each independent garment; retains original skin weights.
    active(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(island_margin=.006)
    bpy.ops.object.mode_set(mode="OBJECT")
    return assign(obj, category)

SKINNED = []
# Anatomical body (MakeHuman), not capsule / tube primitives.
SKINNED += [assign(BODY, "skin"), assign(EYES, "eye"), assign(LASHES, "hair")]
SKINNED += [
    shell(BODY, "linen_tunic", lambda p: 1.01 < p.y < 1.65 and abs(p.x) < .39, .012, "linen"),
    shell(BODY, "travel_coat", lambda p: .92 < p.y < 1.68 and (p.z < .105 or abs(p.x) > .13 or p.y > 1.59), .026, "coat"),
    shell(BODY, "trousers", lambda p: .26 < p.y < 1.02 and abs(p.x) < .49, .016, "trouser"),
    shell(BODY, "boots", lambda p: p.y < .41, .024, "boot", .009),
    shell(BODY, "hair_sculpt", lambda p: p.y > 1.995 or
          (p.y > 1.87 and p.z < -.018) or
          (p.y > 1.92 and abs(p.x) > .15), .013, "hair", .001),
]
# Arm cloth and cuffs come from the existing MakeHuman mesh and its weights.
for side, sign in (("R", 1), ("L", -1)):
    SKINNED.append(shell(BODY, side + "_sleeve",
        lambda p, s=sign: p.x*s > .30 and .94 < p.y < 1.57, .028, "coat_worn"))
    SKINNED.append(shell(BODY, side + "_wrist_wrap",
        lambda p, s=sign: p.x*s > .35 and .79 < p.y < .98, .037, "leather"))

# Accessory meshes are given one matching bone influence, making them move with the rig.
def rigid(obj, bone):
    for group in list(obj.vertex_groups):
        obj.vertex_groups.remove(group)
    g = obj.vertex_groups.new(name="g_" + bone)
    g.add(list(range(len(obj.data.vertices))), 1., "REPLACE")
    SKINNED.append(obj)
    return obj

def curve_piece(name, pts, thickness, material, bone, closed=False):
    cv = bpy.data.curves.new("Ren_" + name, "CURVE")
    cv.dimensions = "3D"
    cv.resolution_u = 2
    cv.bevel_depth = thickness
    cv.resolution_u = 2
    cv.bevel_resolution = 2
    cv.use_fill_caps = True
    sp = cv.splines.new("POLY")
    sp.points.add(len(pts)-1)
    for i, p in enumerate(pts):
        # game-space (x, up, front) -> Blender
        bp = G(*p)
        sp.points[i].co = (bp.x, bp.y, bp.z, 1.)
    sp.use_cyclic_u = closed
    obj = bpy.data.objects.new("Ren_" + name, cv)
    SCENE.collection.objects.link(obj)
    active(obj)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    assign(obj, material)
    return rigid(obj, bone)

def box_piece(name, center, dims, category, bone, bevel=.018):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = "Ren_" + name
    obj.location = G(*center)
    obj.dimensions = (dims[0], dims[2], dims[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        apply_modifier(obj, "BEVEL", width=bevel, segments=3)
        apply_modifier(obj, "WEIGHTED_NORMAL", keep_sharp=True)
    active(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(island_margin=.01)
    bpy.ops.object.mode_set(mode="OBJECT")
    return rigid(assign(obj, category), bone)

def circle(cx, cy, cz, rx, rz, count=48, tilt=0):
    return [(cx + rx*math.cos(2*math.pi*i/count),
             cy + tilt*math.cos(2*math.pi*i/count),
             cz + rz*math.sin(2*math.pi*i/count)) for i in range(count)]

# Practical cliff-guide silhouette: unarmoured jacket, rust scarf, harness,
# side bag and rope. No unsupported weapon, crest or magical artefact.
curve_piece("waist_belt", circle(0, 1.025, 0, .305, .22), .029, "leather", "hips", True)
box_piece("buckle", (0, 1.02, .24), (.10, .065, .023), "metal", "spine")
curve_piece("harness_a", [(-.28, 1.59, .14), (-.22, 1.48, .24),
            (-.10, 1.34, .255), (.04, 1.18, .255), (.15, 1.05, .20)],
            .025, "leather", "spine")
curve_piece("harness_b", [(.24, 1.57, .15), (.17, 1.41, .24),
            (.08, 1.29, .265)], .022, "leather", "spine")
box_piece("satchel", (-.30, .99, .12), (.30, .27, .14), "leather", "hips")
box_piece("satchel_flap", (-.30, 1.085, .21), (.305, .105, .034), "coat_worn", "hips")
curve_piece("scarf_fold_1", circle(0, 1.695, .035, .195, .155, 56, .014),
            .045, "scarf", "spine", True)
curve_piece("scarf_fold_2", circle(0, 1.74, .028, .18, .16, 56, .007),
            .034, "scarf", "spine", True)
# Draped scarf tail drawn as overlapping curved cloth lengths.
for k in range(4):
    x = -.135 + .037*k
    curve_piece("scarf_tail_" + str(k),
                [(x, 1.70, .19), (x-.015, 1.54, .24),
                 (x+.005, 1.41, .22), (x+.035, 1.31, .205)],
                .026, "scarf", "spine")
# Coiled rope hangs behind the shoulder rather than becoming a magic weapon.
for k in range(3):
    curve_piece("climbing_rope_coil_" + str(k),
                circle(.30 + .025*k, 1.38, -.17 - .012*k, .17, .075, 54, .04),
                .011, "rope", "spine", True)
curve_piece("climbing_rope_tail", [(.32, 1.19, -.16), (.36, 1.04, -.18),
            (.34, .91, -.17)], .012, "rope", "hips")
for k in range(13):
    x = -.15 + .025*k
    curve_piece("hair_lock_" + str(k), [(x, 2.095, .035),
                (x+.012*math.sin(k), 2.065, .095),
                (x+.008*math.sin(k+.5), 2.022 - .013*(k%3), .127)],
                .008 + .002*(k%3), "hair", "head")

# Bone names and hierarchy mirror Duncan's simplified game rig.
joint = {
    "hips": (L["hips"], None), "spine": (L["spine"], "hips"),
    "head": (L["neck"], "spine"),
    "shR": (L["shR"], "spine"), "elR": (L["elR"], "shR"), "handR": (L["handR"], "elR"),
    "shL": (L["shL"], "spine"), "elL": (L["elL"], "shL"), "handL": (L["handL"], "elL"),
    "hipR": (L["hipR"], "hips"), "kneeR": (L["kneeR"], "hipR"), "ankR": (L["ankR"], "kneeR"),
    "hipL": (L["hipL"], "hips"), "kneeL": (L["kneeL"], "hipL"), "ankL": (L["ankL"], "kneeL"),
}
arm = bpy.data.armatures.new("RenGuideRigData")
rig = bpy.data.objects.new("RenGuideRig", arm)
SCENE.collection.objects.link(rig)
active(rig)
bpy.ops.object.mode_set(mode="EDIT")
for bn, (pos, parent) in joint.items():
    eb = arm.edit_bones.new(bn)
    eb.head = G(*pos)
    tip = {
        "head": L["headT"],
        "handR": L["handR"] + Vector((0, -.1, 0)),
        "handL": L["handL"] + Vector((0, -.1, 0)),
        "ankR": L["ankR"] + Vector((0, -.10, 0)),
        "ankL": L["ankL"] + Vector((0, -.10, 0)),
    }.get(bn, pos + Vector((0, .13 if bn in ("hips", "spine") else -.11, 0)))
    eb.tail = G(*tip)
    if (eb.tail-eb.head).length < .025:
        eb.tail = eb.head + Vector((0, 0, .09))
for bn, (_, parent) in joint.items():
    if parent:
        arm.edit_bones[bn].parent = arm.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")
for obj in SKINNED:
    obj.parent = rig
    obj.modifiers.new("RenSkin", "ARMATURE").object = rig

# 5 named keyframed clips compatible with RenGlbRuntime in the existing game.
def clip(name, count, stages):
    action = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = action
    bones = rig.pose.bones
    touched = sorted({bn for _, poses in stages for bn in poses})
    # Identity at start/end: no permanent pose contaminates battle state.
    for frame, poses in stages:
        for bn in touched:
            pb = bones[bn]
            pb.rotation_mode = "XYZ"
            pb.rotation_euler = tuple(math.radians(v) for v in poses.get(bn, (0, 0, 0)))
            pb.keyframe_insert(data_path="rotation_euler", frame=frame, group=bn)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, 1, action)
    strip.action_frame_start = 1
    strip.action_frame_end = count
    rig.animation_data.action = None

clip("Ren_Idle_Breathing_3s", 72, [
    (1, {"spine": (0, 0, 0), "head": (0, 0, 0), "shR": (0, 0, 0), "shL": (0, 0, 0)}),
    (36, {"spine": (1, 0, 0), "head": (-.5, 0, 0),
          "shR": (.6, 0, -1), "shL": (.6, 0, 1)}),
    (72, {}),
])
clip("Ren_Attack_Unarmed_1p3s", 32, [
    (1, {"spine": (0, 0, 0), "shR": (0, 0, 0), "elR": (0, 0, 0)}),
    (9, {"spine": (0, -10, 0), "shR": (-30, 0, 18), "elR": (-38, 0, 0)}),
    (15, {"spine": (0, 13, 0), "shR": (62, 0, -14), "elR": (-12, 0, 0)}),
    (32, {}),
])
clip("Ren_Guard_3s", 72, [
    (1, {"shR": (0, 0, 0), "elR": (0, 0, 0), "shL": (0, 0, 0), "elL": (0, 0, 0)}),
    (13, {"shR": (28, 0, -17), "elR": (-50, 0, 0), "shL": (29, 0, 16), "elL": (-45, 0, 0)}),
    (56, {"shR": (28, 0, -17), "elR": (-50, 0, 0), "shL": (29, 0, 16), "elL": (-45, 0, 0)}),
    (72, {}),
])
clip("Ren_Hit_Reaction_0p9s", 22, [
    (1, {"spine": (0, 0, 0), "head": (0, 0, 0), "shR": (0, 0, 0)}),
    (8, {"spine": (-12, 0, 9), "head": (8, 0, -3), "shR": (-18, 0, 11)}),
    (22, {}),
])
clip("Ren_Fall_1p5s", 36, [
    (1, {"spine": (0, 0, 0), "head": (0, 0, 0)}),
    (22, {"spine": (-55, 0, 7), "head": (14, 0, 0)}),
    (36, {"spine": (-78, 0, 4), "head": (19, 0, 0)}),
])
active(rig)
rig.select_set(True)
for obj in SKINNED:
    obj.select_set(True)
GLB = OUT / "ren-teren-mh-v01.glb"
bpy.ops.export_scene.gltf(filepath=str(GLB), export_format="GLB",
    use_selection=True, export_skins=True, export_animations=True,
    export_nla_strips=True, export_materials="EXPORT")
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "ren-teren-mh-v01.blend"))
manifest = {
    "status": "proposal", "source": "MakeHuman/Blender adapted from Dgoh-game",
    "character": "Ren Teren", "asset": GLB.name,
    "rendered": False, "rig_bones": len(joint), "clips": [
        "Ren_Idle_Breathing_3s", "Ren_Attack_Unarmed_1p3s",
        "Ren_Guard_3s", "Ren_Hit_Reaction_0p9s", "Ren_Fall_1p5s"
    ],
    "meshes": len(SKINNED), "bytes": GLB.stat().st_size,
    "warning": "Candidate only; visual/animation/iPhone acceptance not performed"
}
(OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print("REN-MH generated", json.dumps(manifest, ensure_ascii=False))
