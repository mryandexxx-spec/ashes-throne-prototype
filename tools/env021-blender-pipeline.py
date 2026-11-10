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
    parser.add_argument("--mode", choices=("smoke", "sculpt"), default="smoke")
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


def add_camera(radius, name):
    # Reference ONLY: Babylon target and basis must be calibrated against real live game screenshots.
    # ArcRotateCamera alpha=-3*pi/4, beta=.96; Babylon Y-up to Blender Z-up.
    alpha, beta = -3 * math.pi / 4, 0.96
    target = Vector((0.0, 0.0, 1.0))
    x = radius * math.sin(beta) * math.cos(alpha)
    babylon_z = radius * math.sin(beta) * math.sin(alpha)
    height = radius * math.cos(beta)
    camera_pos = Vector((x, babylon_z, height + 1.0))
    camera = bpy.data.cameras.new(name)
    obj = bpy.data.objects.new(name, camera)
    bpy.context.collection.objects.link(obj)
    obj.location = camera_pos
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.type = "PERSP"
    camera.lens = 35
    return obj


def clay_render(path, camera):
    scene = bpy.context.scene
    scene.camera = camera
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
    elif args.mode == "sculpt":
        if not args.scan or not pathlib.Path(args.scan).is_file():
            raise RuntimeError("ENV021 sculpt mode requires a verified CC0 scan")
        module_path = pathlib.Path(__file__).with_name("env021-build-geology.py")
        spec = importlib.util.spec_from_file_location("env021_geology", module_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        provenance = module.build(pathlib.Path(args.scan).resolve())
        mode = "CLAY_SCULPT_WIP_WITH_CC0"
        source_hash = hashlib.sha256(pathlib.Path(args.scan).read_bytes()).hexdigest()
    else:
        smoke_geometry()
        mode = "SMOKE_GEOMETRY_ONLY"
        source_hash = None

    mesh_objects = [o for o in bpy.data.objects if o.type == "MESH" and not o.hide_render]
    if not mesh_objects:
        raise RuntimeError("No visible mesh objects to export")
    near = add_camera(12.0, "ENV021_REFERENCE_default_not_calibrated")
    distant = add_camera(19.0, "ENV021_REFERENCE_far_not_calibrated")

    clay_render(output / "clay-default.png", near)
    clay_render(output / "clay-far.png", distant)

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
        "camera": "APPROXIMATE_REFERENCE_NOT_GAME_VERIFIED",
        "hud": "NOT_INCLUDED",
        "blender_version": bpy.app.version_string,
        "source_sha256": source_hash,
        "source_provenance": provenance if args.mode == "sculpt" and not args.source else None,
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
