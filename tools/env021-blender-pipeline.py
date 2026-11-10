#!/usr/bin/env python3
"""ENV021 Blender headless authoring/export PIPELINE, not a production canyon.
Usage: blender -b --factory-startup --python tools/env021-blender-pipeline.py -- [--source=art/env021/scene.blend] --output build/env021
The demo geometry is deliberately simple so a passing CI job cannot be confused with artistic acceptance.
"""
import argparse
import hashlib
import json
import math
import pathlib
import importlib.util
import sys

import bpy
from mathutils import Vector


def cli():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="")
    parser.add_argument("--output", required=True)
    parser.add_argument("--mode", choices=("smoke", "sculpt", "sculpt2", "sculpt3", "sculpt4", "sculpt5", "sculpt6", "sculpt7"), default="smoke")
    parser.add_argument("--scan", default="")
    return parser.parse_args(argv)


def material(name, rgba):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba
    return mat


def smoke_geometry():
    """Two unmistakably dummy primitive masses for a pipeline smoke test only."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    stone = material("SMOKE_ONLY_no_authored_sculpt", (0.44, 0.43, 0.40, 1.0))
    far = material("SMOKE_ONLY_distant_block", (0.58, 0.57, 0.55, 1.0))
    for name, loc, scale, mat in (
        ("SMOKE_NEAR_PRIMITIVE_not_art", (-1.6, 0.8, -0.5), (4.4, 4.0, 0.85), stone),
        ("SMOKE_FAR_PRIMITIVE_not_art", (5.5, 7.0, 0.2), (1.8, 5.0, 2.1), far),
    ):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        ob = bpy.context.object
        ob.name = name
        ob.scale = scale
        ob.data.materials.append(mat)
        bevel = ob.modifiers.new("Pipeline test bevel", "BEVEL")
        bevel.width = 0.15
        bevel.segments = 2
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=bevel.name)


def add_camera(radius, name, native_gltf=False):
    # Reference ONLY: Babylon target and basis must be calibrated against real live game screenshots.
    # ArcRotateCamera alpha=-3*pi/4, beta=.96; Babylon Y-up to Blender Z-up.
    alpha, beta = -3 * math.pi / 4, 0.96
    target = Vector((0.0, 0.0, 1.0))
    x = radius * math.sin(beta) * math.cos(alpha)
    babylon_z = radius * math.sin(beta) * math.sin(alpha)
    height = radius * math.cos(beta)
    # Official Babylon glTF root transform reverses legacy Blender X/Y camera
    # reference. Sculpt6 renders from the actual native-import-equivalent side.
    if native_gltf:
        x, babylon_z = -x, -babylon_z
    camera_pos = Vector((x, babylon_z, height + 1.0))
    camera = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, camera)
    bpy.context.collection.objects.link(obj)
    obj.location = camera_pos
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.type = "PERSP"
    # Babylon ArcRotateCamera uses vertical FOV .8 rad and scene aspect 844/390.
    camera.sensor_fit = "VERTICAL"
    camera.lens = camera.sensor_height/(2*math.tan(.8/2))
    return obj


def clay_render(path, camera, cpu=False):
    scene = bpy.context.scene
    scene.camera = camera
    if cpu:
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = 8
        # Ubuntu Blender 4.0.2 is compiled without OpenImageDenoiser.
        for view_layer in scene.view_layers:
            if hasattr(view_layer, "cycles"):
                view_layer.cycles.use_denoising = False
        scene.render.threads_mode = "FIXED"
        scene.render.threads = 2
        world = scene.world or bpy.data.worlds.new("ENV021_art_review_world")
        scene.world = world
        world.use_nodes = True
        bg = world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs["Color"].default_value = (.32,.35,.39,1)
            bg.inputs["Strength"].default_value = .85
        if bpy.data.objects.get("ENV021_CLAY_LIGHT") is None:
            light_data = bpy.data.lights.new("ENV021_CLAY_LIGHT", "AREA")
            light = bpy.data.objects.new("ENV021_CLAY_LIGHT", light_data)
            scene.collection.objects.link(light)
            light.location = (-5,-8,20)
            light_data.energy = 2100
            light_data.shape = "DISK"
            light_data.size = 18
            light.rotation_euler = (Vector((0,0,0))-light.location).to_track_quat("-Z","Y").to_euler()
        # CPU Cycles avoids headless Workbench OpenGL context.
        for obj in bpy.data.objects:
            if obj.type != "MESH": continue
            for mat in obj.data.materials:
                if not mat: continue
                mat.use_nodes = True
                principled = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
                if principled:
                    principled.inputs["Base Color"].default_value = mat.diffuse_color
                    principled.inputs["Roughness"].default_value = 1.0
    else:
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "MATERIAL"
        scene.display.shading.show_shadows = True
    scene.render.resolution_x = 844
    scene.render.resolution_y = 390
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main():
    args = cli()
    output = pathlib.Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    if args.source:
        src = pathlib.Path(args.source).resolve()
        if not src.is_file() or src.suffix.lower() != ".blend":
            raise RuntimeError("Missing .blend input")
        bpy.ops.wm.open_mainfile(filepath=str(src))
        mode = "USER_SOURCE_UNREVIEWED"
        source_hash = hashlib.sha256(src.read_bytes()).hexdigest()
    elif args.mode in ("sculpt", "sculpt2", "sculpt3", "sculpt4", "sculpt5", "sculpt6", "sculpt7"):
        if not args.scan or not pathlib.Path(args.scan).is_file():
            raise RuntimeError("ENV021 sculpt mode requires a verified CC0 scan")
        module_path = pathlib.Path(__file__).with_name("env021-art-pass-007.py" if args.mode == "sculpt7" else "env021-art-pass-006.py" if args.mode == "sculpt6" else "env021-art-pass-005.py" if args.mode == "sculpt5" else "env021-art-pass-004.py" if args.mode == "sculpt4" else "env021-art-pass-003.py" if args.mode == "sculpt3" else "env021-art-pass-002.py" if args.mode == "sculpt2" else "env021-build-geology.py")
        spec = importlib.util.spec_from_file_location("env021_geology", module_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        provenance = module.build(pathlib.Path(args.scan).resolve())
        mode = "ART_PASS_007_UNREVIEWED" if args.mode == "sculpt7" else "ART_PASS_006_UNREVIEWED" if args.mode == "sculpt6" else "ART_PASS_005_UNREVIEWED" if args.mode == "sculpt5" else "ART_PASS_004_UNREVIEWED" if args.mode == "sculpt4" else "ART_PASS_003_UNREVIEWED" if args.mode == "sculpt3" else "ART_PASS_002_UNREVIEWED" if args.mode == "sculpt2" else "CLAY_SCULPT_WIP_WITH_CC0"
        source_hash = hashlib.sha256(pathlib.Path(args.scan).read_bytes()).hexdigest()
    else:
        smoke_geometry()
        mode = "SMOKE_GEOMETRY_ONLY"
        source_hash = None

    mesh_objects = [o for o in bpy.data.objects if o.type == "MESH" and not o.hide_render]
    if args.mode in ("sculpt2", "sculpt3", "sculpt4", "sculpt5", "sculpt6", "sculpt7"):
        mesh_objects = [o for o in mesh_objects if not o.name.startswith("REF_")]
    if not mesh_objects:
        raise RuntimeError("No visible mesh objects to export")
    near = add_camera(12.0, "ENV021_REFERENCE_default_native_glTF" if args.mode in ("sculpt6","sculpt7") else "ENV021_REFERENCE_default_not_calibrated",native_gltf=args.mode in ("sculpt6","sculpt7"))
    distant = add_camera(19.0, "ENV021_REFERENCE_far_native_glTF" if args.mode in ("sculpt6","sculpt7") else "ENV021_REFERENCE_far_not_calibrated",native_gltf=args.mode in ("sculpt6","sculpt7"))

    clay_render(output / "clay-default.png", near, cpu=args.mode in ("sculpt3", "sculpt4", "sculpt5", "sculpt6", "sculpt7"))
    clay_render(output / "clay-far.png", distant, cpu=args.mode in ("sculpt3", "sculpt4", "sculpt5"))

    # Save inspectable source before exporting. Does not modify user-supplied source.
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "source.blend"))
    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(output / "scene.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
    )

    if not (output / "scene.glb").is_file():
        raise RuntimeError("Blender GLB exporter did not create scene.glb")
    raw = (output / "scene.glb").read_bytes()
    manifest = {
        "stage": "ENV021",
        "mode": mode,
        "acceptance": "NOT_ART_APPROVED",
        "camera": "NATIVE_GLTF_ORIENTED_REFERENCE" if args.mode in ("sculpt6","sculpt7") else "APPROXIMATE_REFERENCE_NOT_GAME_VERIFIED",
        "hud": "NOT_INCLUDED",
        "blender_version": bpy.app.version_string,
        "source_sha256": source_hash,
        "source_provenance": provenance if args.mode in ("sculpt", "sculpt2", "sculpt3", "sculpt4", "sculpt5", "sculpt6", "sculpt7") and not args.source else None,
        "glb_sha256": hashlib.sha256(raw).hexdigest(),
        "glb_bytes": len(raw),
        "mesh_count": len(mesh_objects),
        "mesh_names": [o.name for o in mesh_objects],
        "asset_license_manifest": "REQUIRED_BEFORE_EXTERNAL_ASSET_USE",
        "webgl_test": "NOT_RUN",
        "iphone_test": "NOT_RUN",
    }
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("ENV021_PIPELINE_OK " + json.dumps(manifest))


if __name__ == "__main__":
    main()
