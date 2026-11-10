"""Validate an actual exported Ren GLB file, not Blender's exit code."""
import json
import pathlib
import struct
import sys

path = pathlib.Path(sys.argv[1])
data = path.read_bytes()
if len(data) < 24 or data[:4] != b"glTF":
    raise SystemExit("Not a GLB 2.0 file")
version, declared = struct.unpack_from("<II", data, 4)
if version != 2 or declared != len(data):
    raise SystemExit("GLB version or size mismatch")
chunk_size, chunk_type = struct.unpack_from("<I4s", data, 12)
if chunk_type != b"JSON":
    raise SystemExit("First GLB chunk is not JSON")
model = json.loads(data[20:20 + chunk_size])
meshes = model.get("meshes", [])
skins = model.get("skins", [])
animations = {a["name"] for a in model.get("animations", [])}
expected = {
    "Ren_Idle_Breathing_3s",
    "Ren_Attack_Unarmed_1p3s",
    "Ren_Guard_3s",
    "Ren_Hit_Reaction_0p9s",
    "Ren_Fall_1p5s",
}
if not meshes or not skins or not expected.issubset(animations):
    raise SystemExit("Invalid Ren: meshes={}, skins={}, clips={}".format(len(meshes),len(skins),sorted(animations)))
print(json.dumps({"meshes": len(meshes), "skins": len(skins),
    "animations": sorted(animations), "bytes": len(data)}, ensure_ascii=False, indent=2))
