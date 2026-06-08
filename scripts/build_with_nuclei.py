"""Pass 3 of the nuclei pipeline (run in Blender).

Consumes scripts/atlas_data/nuclei_artifacts.json and, on top of the pristine
Z-Anatomy scene:
  - adds every deep nucleus as a CLOSED solid generated in mesh space (GPe/GPi, the
    seven thalamic nuclei groups, subthalamic n., substantia nigra, nucleus
    accumbens),
  - removes the now-redundant originals (whole globus pallidus, whole thalamus, and
    the lentiform nucleus, which is just putamen + GP),
  - tags every derived object with _nuc_source / _nuc_parent / _nuc_region so the
    exporter can record provenance,
then saves Z-Anatomy/Startup_nuclei.blend for export_brain.py to pick up.

Thalamic nuclei inherit the whole thalamus's collection membership (so they scope
and categorise as diencephalon); the basal-ganglia nuclei inherit the globus
pallidus's. Both source objects are read before they are removed.

Run:  blender Z-Anatomy/Startup.blend --background --python scripts/build_with_nuclei.py
"""
import bpy, bmesh, json, os

BLEND_DIR = os.path.dirname(bpy.data.filepath)
ART = os.path.normpath(os.path.join(BLEND_DIR, "..", "scripts", "atlas_data", "nuclei_artifacts.json"))
OUT_BLEND = os.path.join(BLEND_DIR, "Startup_nuclei.blend")
art = json.load(open(ART))


def recalc_normals(me):
    """Consistent outward face normals. Geometry built with from_pydata has no
    custom split normals, so without this the exporter would write winding-derived
    normals that can point inward and the viewer (FrontSide) would cull the surface."""
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free(); me.update()


def add_solid(name, verts, faces, collections, source, parent, region):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [list(f) for f in faces])
    me.update()
    o = bpy.data.objects.new(name, me)
    if o.name != name:        # Blender appended .001 -> a same-named object exists
        raise SystemExit(f"[build] name collision: {name!r} already in scene "
                         f"(it likely already exists in the model).")
    for c in collections:                 # mirror a sibling's collection membership
        c.objects.link(o)
    recalc_normals(o.data)                 # closed solid -> outward
    o["_nuc_source"] = source
    if parent:
        o["_nuc_parent"] = parent
    if region:
        o["_nuc_region"] = region
    return o


# Collection membership of the structures we replace, captured before removal so the
# new nuclei get the same exporter scope, view-layer visibility and category.
gp_coll = list(bpy.data.objects["Globus pallidus.l"].users_collection)
thal_coll = list(bpy.data.objects["Thalamus.l"].users_collection)

# ---------------------------------------------------------------------------
# 1. Add every nucleus as a closed solid
# ---------------------------------------------------------------------------
for name, m in art["meshes"].items():
    coll = thal_coll if m.get("parent") == "Thalamus" else gp_coll
    add_solid(name, m["verts"], m["faces"], coll, m["source"], m.get("parent"), m["region"])
    print(f"[add] {name} ({len(m['verts'])} v, {len(m['faces'])} f)")

# ---------------------------------------------------------------------------
# 2. Remove redundant originals (whole GP, whole thalamus, lentiform = Pu + GP)
# ---------------------------------------------------------------------------
for name in ("Globus pallidus.l", "Globus pallidus.r", "Thalamus.l", "Thalamus.r",
             "Lentiform nucleus.l", "Lentiform nucleus.r"):
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)
        print(f"[remove] {name}")

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print(f"[saved] {OUT_BLEND}")
