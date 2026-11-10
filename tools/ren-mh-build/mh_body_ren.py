# Stage 1: MakeHuman body for experimental Ren Teren — morph, re-pose to the game's rest pose, scale to game units.
# Produces Blender objects: Body (with MH vertex groups mapped to the game rig), Eyes, Lashes; returns landmarks.
import sys, math

import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix
import mhlib

SCN = bpy.context.scene
def G(x, y, z): return Vector((x, -z, y))          # game (x, up, front) -> blender
def GV(v): return Vector((v[0], v[2], -v[1]))      # blender -> game

GAME_BONES = ['hips', 'spine', 'head', 'shR', 'elR', 'handR', 'shL', 'elL', 'handL', 'hipR', 'kneeR', 'ankR', 'hipL', 'kneeL', 'ankL', 'capeA', 'capeB', 'capeC']

def mh_to_game(name):
    """MakeHuman bone -> [(game bone, share)]. MH '.L' sits at +x = the game's 'R' side."""
    side = 'R' if name.endswith('.L') else 'L' if name.endswith('.R') else ''
    b = name.split('.')[0]
    if b in ('root', 'pelvis', 'spine05'): return [('hips', 1)]
    if b in ('spine04', 'spine03', 'spine02', 'spine01', 'breast', 'clavicle'): return [('spine', 1)]
    if b == 'neck01': return [('spine', .5), ('head', .5)]
    if b == 'neck02': return [('spine', .25), ('head', .75)]
    if b == 'shoulder01': return [('sh' + side, .65), ('spine', .35)]
    if b in ('upperarm01', 'upperarm02'): return [('sh' + side, 1)]
    if b in ('lowerarm01', 'lowerarm02'): return [('el' + side, 1)]
    if b.startswith(('wrist', 'metacarpal', 'finger')): return [('hand' + side, 1)]
    if b in ('upperleg01', 'upperleg02'): return [('hip' + side, 1)]
    if b in ('lowerleg01', 'lowerleg02'): return [('knee' + side, 1)]
    if b.startswith(('foot', 'toe')): return [('ank' + side, 1)]
    return [('head', 1)]          # neck03, head, jaw, eyes, face, tongue

def build(target_height=1.86, out_preview=None):
    global SCN; SCN = bpy.context.scene
    V0, VT, F = mhlib.load_obj()
    T = mhlib.TG
    spec = mhlib.macro_spec(gender=1.0, muscle=0.55, weight=0.43, height=0.61, proportions=0.55, race={'caucasian': 1.0})
    # [ПРЕДЛОЖЕНИЕ] Visual Ren, not canon: lean working build, moderate jaw/face shaping.
    spec += [('chin/chin-width-incr', .18), ('head/head-square', .18),
             ('cheek/l-cheek-bones-incr', .22), ('cheek/r-cheek-bones-incr', .22),
             ('eyebrows/eyebrows-trans-down', .10), ('nose/nose-hump-incr', .18)]
    V = mhlib.apply_targets(V0, spec)
    bones, joints = mhlib.skeleton(); W = mhlib.weights()
    keep_groups = {'body': 'body', 'helper-l-eye': 'eye', 'helper-r-eye': 'eye', 'helper-l-eyelashes-1': 'lash', 'helper-r-eyelashes-1': 'lash', 'helper-l-eyelashes-2': 'lash', 'helper-r-eyelashes-2': 'lash'}
    # ---- scale to game units (feet on the ground) ----
    body_vi = sorted({vi for g, c in F if g == 'body' for vi, _ in c})
    ymin, ymax = V[body_vi, 1].min(), V[body_vi, 1].max()
    s = target_height / (ymax - ymin)
    P = (V - np.array([0, ymin, 0])) * s           # game coords (x, up, front)
    # ---- Blender mesh with all kept faces; keep MH vertex indices as an attribute map ----
    used = sorted({vi for g, c in F if g in keep_groups for vi, _ in c}); remap = {v: i for i, v in enumerate(used)}
    me = bpy.data.meshes.new('MH'); bm = bmesh.new(); bv = [bm.verts.new(G(*P[v])) for v in used]; bm.verts.ensure_lookup_table()
    uvl = bm.loops.layers.uv.new('UV'); part = bm.faces.layers.int.new('part'); parts = {'body': 0, 'eye': 1, 'lash': 2}
    for g, c in F:
        if g not in keep_groups: continue
        try: f = bm.faces.new([bv[remap[vi]] for vi, _ in c])
        except ValueError: continue
        f[part] = parts[keep_groups[g]]
        for lp, (_, ti) in zip(f.loops, c):
            if ti >= 0: lp[uvl].uv = VT[ti]
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('MH', me); SCN.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    # ---- MakeHuman armature (in game units) ----
    jp = {k: P[v].mean(0) for k, v in joints.items()}
    arm = bpy.data.armatures.new('MHRig'); rig = bpy.data.objects.new('MHRig', arm); SCN.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig; rig.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
    for n, b in bones.items():
        eb = arm.edit_bones.new(n); eb.head = G(*jp[b['head']]); eb.tail = G(*jp[b['tail']])
        if (eb.tail - eb.head).length < 1e-4: eb.tail = eb.head + Vector((0, 0, .01))
    for n, b in bones.items():
        if b['parent']: arm.edit_bones[n].parent = arm.edit_bones[b['parent']]
    bpy.ops.object.mode_set(mode='OBJECT')
    # vertex groups with MH weights (only for vertices we kept)
    for bn, lst in W.items():
        vg = ob.vertex_groups.new(name=bn)
        for vi, w in lst:
            if vi in remap: vg.add([remap[vi]], w, 'REPLACE')
    md = ob.modifiers.new('arm', 'ARMATURE'); md.object = rig
    # ---- re-pose: arms hang down (slight abduction), straight forearms, fists, legs closer ----
    bpy.context.view_layer.objects.active = rig; bpy.ops.object.mode_set(mode='POSE')
    def upd(): bpy.context.view_layer.update()
    def aim(n, tgt_game):
        pb = rig.pose.bones[n]; upd(); h = pb.head.copy(); d = (pb.tail - pb.head).normalized(); t = G(*tgt_game).normalized()
        R = d.rotation_difference(t).to_matrix().to_4x4()
        pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix; upd()
    def rot(n, axis_game, ang):
        pb = rig.pose.bones[n]; upd(); h = pb.head.copy(); R = Matrix.Rotation(ang, 4, G(*axis_game).normalized())
        pb.matrix = Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ pb.matrix; upd()
    ab = math.radians(9); fw = math.radians(3)
    for sx, S in ((1, 'L'), (-1, 'R')):
        aim(f'upperarm01.{S}', (sx * math.sin(ab), -math.cos(ab), math.sin(fw)))
        aim(f'upperarm02.{S}', (sx * math.sin(ab), -math.cos(ab), math.sin(fw)))
        aim(f'lowerarm01.{S}', (sx * math.sin(ab * .6), -math.cos(ab * .6), math.sin(math.radians(9))))
        aim(f'lowerarm02.{S}', (sx * math.sin(ab * .6), -math.cos(ab * .6), math.sin(math.radians(9))))
        aim(f'wrist.{S}', (sx * .05, -1, .08))
        aim(f'upperleg01.{S}', (sx * .035, -1, 0)); aim(f'upperleg02.{S}', (sx * .035, -1, 0))
        aim(f'lowerleg01.{S}', (sx * .02, -1, -.02)); aim(f'lowerleg02.{S}', (sx * .02, -1, -.02))
    # fingers: the sword hand (MH .L = game R) closes into a fist, the other hand relaxes
    upd()
    for S, fist in (('L', True), ('R', False)):
        wr = rig.pose.bones[f'wrist.{S}']; w0 = GV(wr.head); i1 = GV(rig.pose.bones[f'finger2-1.{S}'].head); p1 = GV(rig.pose.bones[f'finger5-1.{S}'].head)
        palm = (i1 - w0).cross(p1 - w0).normalized()
        if palm.x * (1 if S == 'L' else -1) > 0: palm = -palm          # palm faces the thigh
        for f in range(2, 6):
            for seg, a in ((1, 72 if fist else 22), (2, 85 if fist else 28), (3, 60 if fist else 18)):
                n = f'finger{f}-{seg}.{S}'; pb = rig.pose.bones[n]; d = GV(pb.tail) - GV(pb.head)
                axis = d.cross(palm).normalized(); rot(n, axis, math.radians(a))
        for seg, a in ((1, 25 if fist else 8), (2, 40 if fist else 12), (3, 30 if fist else 8)):
            n = f'finger1-{seg}.{S}'; pb = rig.pose.bones[n]; d = GV(pb.tail) - GV(pb.head); axis = d.cross(palm).normalized(); rot(n, axis, math.radians(a))
    bpy.ops.object.mode_set(mode='OBJECT'); upd()
    # posed joint landmarks (game coords)
    PB = {n: (GV(rig.pose.bones[n].head), GV(rig.pose.bones[n].tail)) for n in bones}
    # apply the pose to the mesh
    bpy.context.view_layer.objects.active = ob; ob.select_set(True); bpy.ops.object.modifier_apply(modifier='arm'); ob.select_set(False)
    # map MH weights -> game bones (vertex groups 'g_*')
    gw = [dict() for _ in range(len(ob.data.vertices))]
    name_of = {g.index: g.name for g in ob.vertex_groups}
    for v in ob.data.vertices:
        for g in v.groups:
            for gb, sh in mh_to_game(name_of[g.group]): gw[v.index][gb] = gw[v.index].get(gb, 0) + g.weight * sh
    for vg in list(ob.vertex_groups): ob.vertex_groups.remove(vg)
    for gb in GAME_BONES: ob.vertex_groups.new(name='g_' + gb)
    for vi, d in enumerate(gw):
        tot = sum(d.values()) or 1
        for gb, w in d.items(): ob.vertex_groups['g_' + gb].add([vi], w / tot, 'REPLACE')
    bpy.data.objects.remove(rig)
    L = dict(
        hipR=PB['upperleg01.L'][0], hipL=PB['upperleg01.R'][0], kneeR=PB['lowerleg01.L'][0], kneeL=PB['lowerleg01.R'][0], ankR=PB['foot.L'][0], ankL=PB['foot.R'][0],
        toeR=PB['foot.L'][1], toeL=PB['foot.R'][1], shR=PB['upperarm01.L'][0], shL=PB['upperarm01.R'][0], elR=PB['lowerarm01.L'][0], elL=PB['lowerarm01.R'][0],
        handR=PB['wrist.L'][0], handL=PB['wrist.R'][0], fingR=PB['finger3-1.L'][0], fingL=PB['finger3-1.R'][0], spine=PB['spine04'][0], neck=PB['neck01'][0], headB=PB['head'][0], headT=PB['head'][1],
        eyeR=PB['eye.L'][0], eyeL=PB['eye.R'][0], chest=PB['spine01'][0], clavR=PB['clavicle.L'][0], clavL=PB['clavicle.R'][0], jaw=PB['jaw'][0], jawT=PB['jaw'][1])
    L['hips'] = (L['hipR'] + L['hipL']) / 2 + Vector((0, .045, -.01))
    # split eyes / lashes into their own objects
    def split(part_id, name):
        bpy.context.view_layer.objects.active = ob; bpy.ops.object.mode_set(mode='EDIT'); bm = bmesh.from_edit_mesh(ob.data); lay = bm.faces.layers.int['part']
        for f in bm.faces: f.select = f[lay] == part_id
        bmesh.update_edit_mesh(ob.data); bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
        o = [x for x in bpy.context.selected_objects if x is not ob][-1]; o.name = name; o.select_set(False); return o
    eyes = split(1, 'Eyes'); lashes = split(2, 'Lashes'); ob.name = 'Body'
    for o in (ob, eyes, lashes):
        bpy.context.view_layer.objects.active = o; o.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.delete_loose(); bpy.ops.object.mode_set(mode='OBJECT'); o.select_set(False)
    return ob, eyes, lashes, L, s

if __name__ == '__main__':
    import os
    bpy.ops.wm.read_factory_settings(use_empty=True)
    body, eyes, lashes, L, s = build(); SCN = bpy.context.scene
    print('verts', len(body.data.vertices), 'faces', len(body.data.polygons), 'eyes', len(eyes.data.vertices), 'lashes', len(lashes.data.vertices))
    for k in ('hips', 'spine', 'neck', 'headB', 'headT', 'shR', 'elR', 'handR', 'hipR', 'kneeR', 'ankR', 'toeR', 'eyeR'): print(k, [round(x, 3) for x in L[k]])
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); SCN.collection.objects.link(cam); SCN.camera = cam
    SCN.render.engine = 'BLENDER_WORKBENCH'; SCN.display.shading.light = 'STUDIO'; SCN.display.shading.show_cavity = True; SCN.display.shading.color_type = 'SINGLE'
    SCN.render.resolution_x = 520; SCN.render.resolution_y = 760
    out = os.environ.get('REN_BUILD_OUT', '/tmp/ren-model')
    for nm, loc, tgt, lens in (('front', (0, 1.0, 4.6), (0, .95, 0), 55), ('side', (4.6, 1.0, .3), (0, .95, 0), 55), ('face', (.15, 1.72, .75), (0, 1.69, 0), 85)):
        cam.location = G(*loc); d = G(*tgt) - G(*loc); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = lens
        SCN.render.filepath = os.path.join(out, 'mh_' + nm + '.png'); bpy.ops.render.render(write_still=True)
