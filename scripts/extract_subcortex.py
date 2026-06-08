"""Pass 1 of the nuclei pipeline (run in Blender).

Dumps, in Blender world space, the data the registration + partition step needs:
  - centroids of the landmark structures present in BOTH the model and the CIT168 /
    Najdenovska atlases (caudate, putamen, globus pallidus, thalamus; left+right),
  - the full per-vertex coordinates of the meshes we will partition (globus
    pallidus and thalamus, left+right), in stable vertex-index order.

Run:  blender Z-Anatomy/Startup.blend --background --python scripts/extract_subcortex.py

Output: scripts/atlas_data/registration_input.json
"""
import bpy, json, os

OUT = os.path.join(os.path.dirname(bpy.data.filepath), "..", "scripts", "atlas_data")
OUT = os.path.normpath(OUT)
os.makedirs(OUT, exist_ok=True)

# Structures used as registration landmarks (centroid in both spaces). The deep
# grey + thalamus cluster is nearly coplanar in the vertical axis, so hypothalamus
# and mammillary body (both inferior, and present in CIT168) are added to constrain
# the vertical direction where the inferior nuclei (STN/SN/RN) will be placed.
LANDMARKS = [
    "Caudate nucleus.l", "Caudate nucleus.r",
    "Putamen.l", "Putamen.r",
    "Globus pallidus.l", "Globus pallidus.r",
    "Thalamus.l", "Thalamus.r",
    "Hypothalamus",
    "Mamillary body.l", "Mamillary body.r",
]
# Meshes we partition into sub-parts (need full geometry, vertex-index stable).
PARTITION = ["Globus pallidus.l", "Globus pallidus.r", "Thalamus.l", "Thalamus.r"]

# Held-out controls: structures present in BOTH the model and an atlas but NOT used
# as registration landmarks, so their predicted-vs-actual gap is an honest
# out-of-sample check of the registration (see validate_nuclei.py). Red nucleus
# already ships with Z-Anatomy (under the brainstem) and exists in CIT168.
CONTROLS = ["Red nucleus.l", "Red nucleus.r"]


def world_verts(o):
    mw = o.matrix_world
    return [list(mw @ v.co) for v in o.data.vertices]  # index order preserved


def centroid(verts):
    n = len(verts)
    return [sum(v[i] for v in verts) / n for i in range(3)]


data = {"centroids": {}, "verts": {}, "controls": {}}
for name in CONTROLS:
    o = bpy.data.objects.get(name)
    if o is not None:
        data["controls"][name] = centroid(world_verts(o))
for name in LANDMARKS:
    o = bpy.data.objects.get(name)
    if o is None:
        raise SystemExit(f"[extract] missing landmark object: {name!r}")
    vs = world_verts(o)
    data["centroids"][name] = centroid(vs)
    if name in PARTITION:
        data["verts"][name] = vs

for name in PARTITION:
    if name not in data["verts"]:
        o = bpy.data.objects.get(name)
        data["verts"][name] = world_verts(o)

path = os.path.join(OUT, "registration_input.json")
with open(path, "w") as f:
    json.dump(data, f)

print(f"[extract] wrote {path}")
for k, v in data["centroids"].items():
    print(f"  centroid {k:22s} ({v[0]:.3f}, {v[1]:.3f}, {v[2]:.3f})")
for k, v in data["verts"].items():
    print(f"  verts    {k:22s} n={len(v)}")
