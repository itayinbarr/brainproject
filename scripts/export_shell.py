"""Dump the brain parenchyma surface (for clipping tracts) and per-structure centroids
(for validating tract endpoints), both in mesh-world space.

The tract centerlines are placed by the deep-grey-anchored affine, whose ~1.26x lateral
stretch pushes cortical endpoints past the (narrower) BodyParts3D cortex, so tubes poke
out the side. build_tracts.py clips each centerline to this parenchyma hull, and reports
the nearest named structure at each endpoint using these centroids.

Outputs (into scripts/atlas_data):
  brain_shell.npz       - merged parenchyma mesh (verts, faces) in world space
  mesh_centroids.json   - { object_name: [x,y,z] } world centroid per Brain structure

Parenchyma = every MESH whose collection ancestry includes 'Brain' (this naturally
excludes cranial nerves, vessels and meninges, which live in other collection trees and
extend outside the brain). Ventricles are dropped so the hull hugs the outer surface.

Run:  blender Z-Anatomy/Startup_nuclei.blend --background --python scripts/export_shell.py
"""
import bpy, json, os, re, numpy as np
from collections import defaultdict

BLEND_DIR = os.path.dirname(bpy.data.filepath)
DATA = os.path.normpath(os.path.join(BLEND_DIR, "..", "scripts", "atlas_data"))
MESH_OUT = os.path.join(DATA, "brain_shell.npz")
CEN_OUT = os.path.join(DATA, "mesh_centroids.json")

# Collection ancestry (same walk export_brain.py uses).
parent_of = {}
def index_parents(col):
    for c in col.children:
        parent_of[c.name] = col.name
        index_parents(c)
index_parents(bpy.context.scene.collection)
obj_direct_cols = defaultdict(set)
for col in bpy.data.collections:
    for o in col.objects:
        obj_direct_cols[o.name].add(col.name)
def ancestors(name):
    seen, stack = set(), list(obj_direct_cols.get(name, ()))
    while stack:
        c = stack.pop()
        if c in seen:
            continue
        seen.add(c)
        p = parent_of.get(c)
        if p:
            stack.append(p)
    return seen

DROP = re.compile(r"ventricle|choroid plexus|septum pellucidum", re.I)

all_v = []
all_f = []
base = 0
centroids = {}
for o in bpy.data.objects:
    if o.type != "MESH" or "Brain" not in ancestors(o.name):
        continue
    mw = o.matrix_world
    world = np.array([(mw @ v.co)[:] for v in o.data.vertices], dtype=np.float32)
    if len(world) == 0:
        continue
    centroids[o.name] = world.mean(0).tolist()
    if DROP.search(o.name):                    # ventricles excluded from the hull only
        continue
    all_v.append(world)
    for p in o.data.polygons:                  # fan-triangulate (quads/ngons -> tris)
        vi = p.vertices
        for k in range(1, len(vi) - 1):
            all_f.append((base + vi[0], base + vi[k], base + vi[k + 1]))
    base += len(world)

verts = np.concatenate(all_v, 0)
faces = np.array(all_f, dtype=np.int64)
np.savez_compressed(MESH_OUT, verts=verts, faces=faces)
with open(CEN_OUT, "w") as fh:
    json.dump(centroids, fh)
print(f"[shell] {len(verts)} verts, {len(faces)} tris -> {MESH_OUT}")
print(f"[shell] {len(centroids)} structure centroids -> {CEN_OUT}")
