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
PARENT_COLL = {
    "Globus pallidus": list(bpy.data.objects["Globus pallidus.l"].users_collection),
    "Thalamus":        list(bpy.data.objects["Thalamus.l"].users_collection),
    "Amygdaloid body": list(bpy.data.objects["Amygdaloid body.l"].users_collection),
    "Hypothalamus":    list(bpy.data.objects["Hypothalamus"].users_collection),
}
default_coll = PARENT_COLL["Globus pallidus"]   # basal-ganglia neighbours for parentless nuclei

# ---------------------------------------------------------------------------
# 1. Add every nucleus as a closed solid
# ---------------------------------------------------------------------------
for name, m in art["meshes"].items():
    coll = PARENT_COLL.get(m.get("parent"), default_coll)
    add_solid(name, m["verts"], m["faces"], coll, m["source"], m.get("parent"), m["region"])
    print(f"[add] {name} ({len(m['verts'])} v, {len(m['faces'])} f)")

# ---------------------------------------------------------------------------
# 1b. Realign the geniculate bodies into the atlas frame.
# The thalamic nuclei are now atlas-placed (MNI via the registration affine), but the
# metathalamic geniculate bodies kept their original Z-Anatomy positions, which sit
# ~9 mm medial of where they belong - so they ended up medial to the pulvinar instead
# of lateral/inferior to it. Translate each so its centroid lands on the affine-mapped
# canonical MNI coordinate (mesh-space left is +x; the affine handles the L/R flip).
# ---------------------------------------------------------------------------
import mathutils
AFF = json.load(open(os.path.normpath(os.path.join(BLEND_DIR, "..", "scripts", "atlas_data", "registration_affine.json"))))
T = mathutils.Matrix(AFF["mni_to_mesh"])           # MNI mm -> mesh world (homogeneous)
SCALE = AFF["mesh_units_per_mm"]


def centroid(o):
    return sum((o.matrix_world @ v.co for v in o.data.vertices), mathutils.Vector()) / len(o.data.vertices)


def shrink(o, f):
    """Scale a mesh about its own (local) centroid; world centroid is unchanged.
    Left/right geniculates share mesh data in Z-Anatomy, so make it single-user
    first or the scale would be applied twice (once per hemisphere)."""
    if o.data.users > 1:
        o.data = o.data.copy()
    me = o.data
    c = sum((v.co for v in me.vertices), mathutils.Vector()) / len(me.vertices)
    for v in me.vertices:
        v.co = c + (v.co - c) * f
    me.update()


# Place the geniculates on the postero-dorsal pulvinar, sitting against its lateral
# aspect (where they appear in atlas figures), and trim them 30% toward atlas size.
# Targets are offsets from the pulvinar centroid (mesh units; left is +x):
#   y +5 mm back, z +3.4 mm dorsal; lateral offset larger for the LGN than the MGN.
POST, DORS = 0.0045, 0.003
LAT = {"Lateral geniculate body": 0.008, "Medial geniculate body": 0.005}
for base_name in ("Lateral geniculate body", "Medial geniculate body"):
    for s in ("l", "r"):
        o = bpy.data.objects.get(f"{base_name}.{s}")
        if not o:
            continue
        shrink(o, 0.7)                                  # 30% smaller, about its centroid
        p = centroid(bpy.data.objects[f"Pulvinar.{s}"])
        lat = 1.0 if s == "l" else -1.0                 # mesh-space left is +x
        tgt = mathutils.Vector((p.x + lat * LAT[base_name], p.y + POST, p.z + DORS))
        d = tgt - centroid(o)
        o.matrix_world.translation += d
        print(f"[align] {base_name}.{s} moved {d.length/SCALE:.1f} mm")

# Size sanity (mm) for the geniculate question.
for n in ("Lateral geniculate body.l", "Medial geniculate body.l", "Pulvinar.l"):
    o = bpy.data.objects.get(n)
    if o:
        co = [o.matrix_world @ v.co for v in o.data.vertices]
        dim = [(max(c[i] for c in co) - min(c[i] for c in co)) / SCALE for i in range(3)]
        print(f"[size] {n}: {dim[0]:.1f} x {dim[1]:.1f} x {dim[2]:.1f} mm")

# ---------------------------------------------------------------------------
# 2. Remove redundant originals (whole GP, whole thalamus, lentiform = Pu + GP)
# ---------------------------------------------------------------------------
for name in ("Globus pallidus.l", "Globus pallidus.r", "Thalamus.l", "Thalamus.r",
             "Lentiform nucleus.l", "Lentiform nucleus.r",
             "Amygdaloid body.l", "Amygdaloid body.r", "Hypothalamus"):
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o, do_unlink=True)
        print(f"[remove] {name}")

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print(f"[saved] {OUT_BLEND}")
