"""Tract pass 2 (run in Blender).

Consumes scripts/atlas_data/tract_artifacts.json (centerlines already in mesh space)
and, on top of Startup_nuclei.blend, adds each white-matter tract as a CURVE swept into
a tube. Curves are baked to tube meshes by export_brain.py (same path the cranial nerves
and vessels use), so nothing downstream needs to change beyond categorisation.

Each tract curve is linked into an existing white-matter collection (so it inherits the
Brain ancestry the exporter scopes on and is in the active view layer - a fresh
collection created in --background is not reliably added to the view layer). The
`tracts` category and the crossing note are carried explicitly as _nuc_cat /
_nuc_source / _nuc_region / _nuc_decussation temp props, which export_brain.py turns
into bx_* glTF extras (the _nuc_cat override wins over collection-based categorisation).

Run:  blender Z-Anatomy/Startup_nuclei.blend --background --python scripts/build_with_tracts.py
Out:  Z-Anatomy/Startup_tracts.blend
"""
import bpy, json, os

BLEND_DIR = os.path.dirname(bpy.data.filepath)
ART = os.path.normpath(os.path.join(BLEND_DIR, "..", "scripts", "atlas_data", "tract_artifacts.json"))
OUT_BLEND = os.path.join(BLEND_DIR, "Startup_tracts.blend")
art = json.load(open(ART))

# Host the tubes in an existing in-scope, in-view-layer collection (a white-matter
# structure's). The _nuc_cat override re-labels them as `tracts` at export, so the
# host collection only provides scope + view-layer membership, not the category.
HOST_CANDIDATES = ("Corpus callosum", "Corpus callosum.l", "Fornix.l",
                   "Anterior commissure", "Hippocampal commissure")
host_coll = None
for cand in HOST_CANDIDATES:
    o = bpy.data.objects.get(cand)
    if o and o.users_collection:
        host_coll = list(o.users_collection)
        print(f"[tracts] hosting tubes in {cand!r} collection(s): {[c.name for c in host_coll]}")
        break
if host_coll is None:
    raise SystemExit("[tracts] could not find a white-matter host collection")


def add_tube(name, points, radius, source, region, decussation):
    if bpy.data.objects.get(name):
        raise SystemExit(f"[tracts] name collision: {name!r} already in scene")
    cu = bpy.data.curves.new(name, type="CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    sp.points.add(len(points) - 1)                 # one point already exists
    for p, (x, y, z) in zip(sp.points, points):
        p.co = (x, y, z, 1.0)
    cu.bevel_mode = "ROUND"
    cu.bevel_depth = radius                         # export keeps this (it only floors thin tubes)
    cu.bevel_resolution = 2
    cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu)
    if o.name != name:
        raise SystemExit(f"[tracts] name collision on link: {name!r}")
    for c in host_coll:
        c.objects.link(o)
    o["_nuc_cat"] = "tracts"
    o["_nuc_source"] = source
    o["_nuc_region"] = region
    o["_nuc_decussation"] = decussation
    return o


for name, t in art["tracts"].items():
    add_tube(name, t["points"], t["radius"], t["source"], t["region"], t["decussation"])
    print(f"[add] {name} ({len(t['points'])} pts)")

bpy.context.view_layer.update()

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print(f"[saved] {OUT_BLEND}  ({len(art['tracts'])} tracts)")
