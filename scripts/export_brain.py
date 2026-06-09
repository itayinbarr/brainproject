"""Export the Z-Anatomy brain to a single web-ready GLB + manifest.json.

Run:  blender Startup.blend --background --python scripts/export_brain.py

Selection scope (anatomically the "brain" + its coverings + supply):
  - Everything under the 'Brain' collection (cerebrum incl. gyri/sulci/lobes,
    cerebellum, brainstem, diencephalon, ventricles, deep grey, white matter).
  - Cranial meninges / dura reflections (falx cerebri, tentorium, etc.).
  - Cranial nerves (I-XII).
  - Cranial arteries + dural venous sinuses + cerebral veins (curve tubes / meshes
    that live in the cardiovascular tree), chosen by an anatomical name whitelist.

FONT label objects (.t / .g) and lights/cameras are dropped. Vessel & nerve
CURVE objects are converted to mesh so glTF (which has no curve type) keeps them.
"""
import bpy, bmesh, json, os, re, math, mathutils
from collections import defaultdict

BLEND_DIR = os.path.dirname(bpy.data.filepath)
OUT_DIR   = os.path.join(BLEND_DIR, "..", "brain-atlas", "models")
OUT_DIR   = os.path.normpath(OUT_DIR)
os.makedirs(OUT_DIR, exist_ok=True)
GLB  = os.path.join(OUT_DIR, "brain.glb")
MANI = os.path.join(OUT_DIR, "manifest.json")

# ----------------------------------------------------------------------------
# 1. Collection ancestry: for any object, the set of all ancestor collection names
# ----------------------------------------------------------------------------
parent_of = {}            # child collection name -> parent collection name
def index_parents(col):
    for c in col.children:
        parent_of[c.name] = col.name
        index_parents(c)
index_parents(bpy.context.scene.collection)

obj_direct_cols = defaultdict(set)
for col in bpy.data.collections:
    for o in col.objects:
        obj_direct_cols[o.name].add(col.name)

def ancestors(objname):
    seen = set()
    stack = list(obj_direct_cols.get(objname, ()))
    while stack:
        c = stack.pop()
        if c in seen:
            continue
        seen.add(c)
        p = parent_of.get(c)
        if p and p not in seen:
            stack.append(p)
    return seen

# ----------------------------------------------------------------------------
# 2. Inclusion rules
# ----------------------------------------------------------------------------
VESSEL_INCLUDE = re.compile(
    r"cerebral artery|cerebellar artery|communicating artery|basilar artery|"
    r"basilar venous plexus|internal carotid|vertebral artery|ophthalmic artery|"
    r"choroidal artery|pericallosal|callosomarginal|striate|pontine branch|"
    r"labyrinthine|anterior spinal artery|cerebral arterial circle|"
    r"superior sagittal sinus|inferior sagittal sinus|straight sinus|"
    r"transverse sinus|sigmoid sinus|occipital sinus|marginal sinus|"
    r"confluence of sinuses|cavernous sinus|intercavernous|sphenoparietal|"
    r"petrosal sinus|dural venous sinuses|great cerebral vein|internal cerebral vein|"
    r"basal vein|superior cerebral vein|inferior cerebral vein|emissary vein|"
    r"superior anastomotic vein|inferior anastomotic vein", re.I)
VESSEL_EXCLUDE = re.compile(
    r"coronary|aortic|pulmonary|renal|hepatic|splenic|mesenteric|iliac|femoral|"
    r"popliteal|tibial|fibular|brachial|radial|ulnar|axillary|subclavian|portal|"
    r"cardiac|prostatic|uterine|gastric|colic|intercostal|lumbar|sacral|digital|"
    r"palmar|plantar|metacarpal|metatarsal|facial|lingual|maxillary|temporal artery|"
    r"thyroid|pharyngeal|auricular|occipital artery|tympanic", re.I)

# meninges objects sometimes sit directly in 'Cranial dura' / named reflections
CRANIAL_DURA = re.compile(r"falx cerebr|tentorium cerebelli|diaphragma sellae|"
                          r"falx cerebelli|cranial dura|trigeminal cave", re.I)
SKIP_NAME = re.compile(r"spinal dura|spinal pia|spinal arachnoid", re.I)

# Z-Anatomy files each cranial nerve's TARGET organs/muscles under the nerve's
# collection (eyeball + extraocular muscles under CN III/IV/VI, trapezius/SCM under
# CN XI, tongue muscles under CN XII, glands ...). Those are not brain tissue.
NON_NEURAL = re.compile(
    r"muscle|eyeball|bulbus oculi|\brectus\b|oblique|levator palpebrae|tarsal plate|"
    r"\blung\b|bronch|pulmon|tongue|glossus|hyoid|trapez|sternocleido|digastric|"
    r"constrictor|cricothyroid|stylo|palato|tensor|larynx|pharyn|soft palate|uvula|"
    r"cornea|\blens\b|sclera|conjunctiva|lacrimal|parotid|submandibular|sublingual|"
    r"salivary|gland|skin|mucosa|cartilage|\bbone\b|ligament|aponeurosis|tendon|"
    r"esophagus|oesophagus|trachea|heart|atrium|ventricle of (heart|larynx)|"
    r"taste|tympanic membrane|auricle|cochlea|semicircular|vestibule|ampulla", re.I)
NEURAL = re.compile(r"nerve|ganglio|nucleus|tract\b|\broot\b|chiasm|funiculus|"
                    r"lemniscus|peduncle|reticular|raphe|colliculus", re.I)

# Brain endocrine glands that Z-Anatomy files under "Endocrine glands" (outside the
# Brain collection) and that the gland/non-neural filter would otherwise drop.
BRAIN_ENDOCRINE = {"Adenohypophysis", "Neurohypophysis", "Pineal gland"}


def in_scope(o):
    name = o.name
    if o.type not in ("MESH", "CURVE"):
        return False
    anc = ancestors(name)
    # The cochlear nuclei are filed inconsistently in Z-Anatomy (only 1 of the 4 sits
    # under Brain, the rest under "Head") and are very coarse, so skip them rather than
    # ship a lopsided pair.
    if re.search(r"cochlear nucleus", name, re.I):
        return False
    # Anything under the Brain collection is brain tissue, so include it BEFORE the
    # non-neural filter runs. That filter is meant for the muscles/organs the cranial
    # nerves supply; applied to brain tissue it wrongly drops structures whose names
    # trip it by substring (e.g. "Gyrus rectus", "Uvula of vermis").
    if "Brain" in anc or name in BRAIN_ENDOCRINE:   # + pituitary/pineal (filed outside Brain)
        return True
    if SKIP_NAME.search(name) or NON_NEURAL.search(name):
        return False
    if "Cranial nerves" in anc:
        # keep only the neural structures, not the muscles/organs they supply
        return bool(NEURAL.search(name))
    if ("Meninges" in anc or "Dura" in anc):
        if CRANIAL_DURA.search(name) or "Cranial dura" in anc or "Cranial arachnoid" in anc \
           or "Cranial pia" in anc or "Leptomeninges" in anc:
            return True
        return False
    if VESSEL_INCLUDE.search(name) and not VESSEL_EXCLUDE.search(name):
        return True
    return False

# ----------------------------------------------------------------------------
# 3. Categorize (one primary subsystem per object) for UI layer grouping
# ----------------------------------------------------------------------------
def categorize(o):
    n = o.name
    anc = ancestors(n)
    if VESSEL_INCLUDE.search(n) and re.search(r"sinus|vein|venous|confluence|jugular", n, re.I):
        return "veins_sinuses"
    if VESSEL_INCLUDE.search(n) and re.search(r"arter|striate|pericallosal|callosomarginal|pontine", n, re.I):
        return "arteries"
    if "Cranial nerves" in anc or re.search(r"nerve \(|\b(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\)", n):
        return "cranial_nerves"
    if re.search(r"ventricle|choroid plexus|septum pellucidum", n, re.I) or "Lateral ventricle" in anc:
        return "ventricles"
    if "Meninges" in anc or "Dura" in anc or CRANIAL_DURA.search(n):
        return "meninges_dura"
    if "Brainstem" in anc:
        return "brainstem"
    if "Cerebellum" in anc:
        return "cerebellum"
    if "Diencephalon" in anc:
        return "diencephalon"
    if anc & {"Corpus striatum", "Basal forebrain"} or re.search(
            r"caudate|putamen|globus pallidus|lentiform|amygdal|accumbens|claustrum|"
            r"subthalamic|substantia nigra|red nucleus", n, re.I):
        return "deep_grey"
    if "White matter of telencephalon" in anc or re.search(
            r"corpus callosum|internal capsule|fornix|commissure|association fibre|"
            r"projection fibre|corona radiata", n, re.I):
        return "white_matter"
    if anc & {"Telencephalon", "Frontal lobe", "Parietal lobe", "Temporal lobe",
              "Occipital lobe", "Limbic lobe", "Insula", "Cerebral hemisphere",
              "Left cerebral hemisphere", "Right cerebal hemisphere"}:
        return "cortex"
    return "other"

def side(n):
    if n.endswith(".l"):
        return "left"
    if n.endswith(".r"):
        return "right"
    return "median"

# ----------------------------------------------------------------------------
# 4. Gather, then duplicate-link into a clean export collection
# ----------------------------------------------------------------------------
selected = [o for o in bpy.data.objects if in_scope(o)]
scope_names = [o.name for o in selected]   # capture before any datablock removal
print(f"[scope] {len(selected)} objects selected "
      f"({sum(o.type=='CURVE' for o in selected)} curves, "
      f"{sum(o.type=='MESH' for o in selected)} meshes)")

# Work on a fresh view layer selection
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    o.hide_set(False)
    o.hide_viewport = False

# Ensure all selected are in the active view layer & selectable
view_objs = set(bpy.context.view_layer.objects)
sel = [o for o in selected if o in view_objs]
print(f"[scope] {len(sel)} of those are in the active view layer")

# Convert curves -> mesh. bpy.ops.object.convert is a no-op in --background (no
# VIEW_3D context), so we bake each vessel/nerve tube manually from the evaluated
# depsgraph via new_from_object and swap in a real mesh object under the same name.
curves = [o for o in sel if o.type == 'CURVE']
for o in curves:
    cu = o.data
    cu.bevel_mode = 'ROUND'
    cu.bevel_object = None               # drop profile objects (some bake empty)
    cu.bevel_depth = max(cu.bevel_depth, 0.0006)  # keep thin where set, force a tube otherwise
    cu.bevel_resolution = 2
    cu.use_fill_caps = True
bpy.context.view_layer.update()

# Phase 1: bake every curve's tube mesh up front. Removing objects mid-loop would
# invalidate the shared depsgraph and silently yield empty meshes, so bake first.
dg = bpy.context.evaluated_depsgraph_get()
pending = []   # (name, mesh, matrix_world, collection)
for o in list(curves):
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    if me is None or len(me.polygons) == 0:
        continue
    coll = o.users_collection[0] if o.users_collection else bpy.context.scene.collection
    pending.append((o.name, me, o.matrix_world.copy(), coll))

# Phase 2: now swap curves for their baked meshes (no depsgraph use here)
for name, me, mw, coll in pending:
    if name in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    nob = bpy.data.objects.new(name, me)
    nob.matrix_world = mw
    coll.objects.link(nob)
print(f"[curves] baked {len(pending)}/{len(curves)} curves to tube meshes")

# Re-resolve selection set against current datablocks (curves are now meshes)
sel = [bpy.data.objects[n] for n in scope_names if n in bpy.data.objects]
sel = [o for o in sel if o.type == 'MESH' and len(o.data.polygons) > 0]
print(f"[scope] {len(sel)} renderable meshes after curve conversion")

# ----------------------------------------------------------------------------
# 4b. Bake world transform into geometry + strip stray vertices.
#  - Some structures (corpus callosum, fornix, commissures) are parented to nodes
#    we don't export, so use_selection drops their offset and they collapse to the
#    origin. Baking matrix_world into the mesh and clearing the parent fixes that.
#  - A few source meshes have a single runaway vertex (e.g. orbital IFG.r sits 24
#    units away); we drop verts that are >0.6 from the per-axis median.
# ----------------------------------------------------------------------------
def bake_and_clean(o):
    if o.data.users > 1:
        o.data = o.data.copy()
    mw = o.matrix_world.copy()
    o.data.transform(mw)                       # bake world pose into vertices
    # Right-hemisphere structures are negative-scale mirrors of the left. Baking a
    # mirror (det < 0) into the vertices reverses the effective face winding without
    # flipping it back, so the mesh ends up wound inside-out: the viewer's front-face
    # culling then renders only its inner surface. Reverse the winding (this also flips
    # the normals) so mirrored meshes stay outward-facing, matching the left.
    if mw.determinant() < 0:
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(o.data); bm.free(); o.data.update()
    o.parent = None
    o.matrix_world = mathutils.Matrix.Identity(4)
    me = o.data
    n = len(me.vertices)
    if n >= 6:
        xs = sorted(v.co.x for v in me.vertices)
        ys = sorted(v.co.y for v in me.vertices)
        zs = sorted(v.co.z for v in me.vertices)
        mx, my, mz = xs[n//2], ys[n//2], zs[n//2]
        far = [v.index for v in me.vertices
               if abs(v.co.x-mx) > 0.6 or abs(v.co.y-my) > 0.6 or abs(v.co.z-mz) > 0.6]
        if far and len(far) < n:               # never delete the whole mesh
            bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
            bmesh.ops.delete(bm, geom=[bm.verts[i] for i in far], context='VERTS')
            bm.to_mesh(me); bm.free()
    me.update()

stray_fixed = 0
for o in list(sel):
    before = len(o.data.vertices)
    bake_and_clean(o)
    if len(o.data.vertices) != before:
        stray_fixed += 1
sel = [o for o in sel if len(o.data.polygons) > 0]
print(f"[clean] baked world transforms; stray-vertex cleanup touched {stray_fixed} meshes")

# ----------------------------------------------------------------------------
# 5. Clean human-readable labels
# ----------------------------------------------------------------------------
ABBR = {"Lat_Fis": "Lateral fissure", "ant": "anterior", "post": "posterior",
        "Horizont": "horizontal", "inf": "inferior", "sup": "superior"}
def clean_label(raw):
    s = re.sub(r"\.(l|r|j|g|t)$", "", raw)        # strip side / suffix markers
    s = s.replace("_", " ").replace("*", "")
    s = re.sub(r"\s+", " ", s).strip()
    s = s[:1].upper() + s[1:] if s else s
    return s

# (centering is done in the viewer from the core bbox, so geometry is left in place)

# ----------------------------------------------------------------------------
# 6. Build manifest + write per-object glTF extras (bx_*) for robust UI binding
# ----------------------------------------------------------------------------
bpy.ops.object.select_all(action='DESELECT')
manifest = {"nodes": [], "categories": {}}
CAT_LABELS = {
    "cortex": "Cortex – gyri, sulci & lobes",
    "white_matter": "White matter & commissures",
    "deep_grey": "Deep grey / basal ganglia",
    "diencephalon": "Diencephalon (thalamus, hypothalamus)",
    "brainstem": "Brainstem",
    "cerebellum": "Cerebellum",
    "ventricles": "Ventricular system",
    "meninges_dura": "Meninges & dura (falx, tentorium)",
    "arteries": "Arteries (circle of Willis)",
    "veins_sinuses": "Dural venous sinuses & veins",
    "cranial_nerves": "Cranial nerves (I–XII)",
    "other": "Other structures",
}
CORE_CATS = {"cortex","white_matter","deep_grey","diencephalon","brainstem","cerebellum","ventricles"}

for i, o in enumerate(sel):
    o.select_set(True)
    cat = categorize(o)
    raw = o.name
    lab = clean_label(raw)
    sd  = side(raw)
    anc = sorted(a for a in ancestors(raw) if not re.match(r"^\d+:", a))
    region = next((a for a in ("Frontal lobe","Parietal lobe","Temporal lobe",
                  "Occipital lobe","Limbic lobe","Insula","Brainstem","Cerebellum",
                  "Diencephalon","Telencephalon") if a in anc), cat)
    is_core = cat in CORE_CATS
    # Provenance for atlas-derived nuclei (build_with_nuclei.py tags them); plain
    # Z-Anatomy structures default to the base dataset. _nuc_* are temp props and
    # must not leak into the exported glTF extras, so pop them here.
    def take(key):
        val = o.get(key)
        if key in o.keys():
            del o[key]
        return val
    source = take("_nuc_source") or "Z-Anatomy / BodyParts3D"
    parent = take("_nuc_parent")
    reg_override = take("_nuc_region")
    if reg_override:
        region = reg_override
    # glTF extras -> three.js object.userData (survives name sanitization & dedup)
    o["bx_id"]    = i
    o["bx_cat"]   = cat
    o["bx_label"] = lab
    o["bx_side"]  = sd
    o["bx_region"]= region
    o["bx_core"]  = 1 if is_core else 0
    o["bx_source"]= source
    if parent:
        o["bx_parent"] = parent
    node = {
        "id": i, "name": raw, "label": lab, "category": cat,
        "side": sd, "region": region, "core": is_core, "ta2": anc,
        "source": source,
    }
    if parent:
        node["parent"] = parent
    manifest["nodes"].append(node)

by_cat = defaultdict(list)
for nd in manifest["nodes"]:
    by_cat[nd["category"]].append(nd)

for cat, nodes in by_cat.items():
    manifest["categories"][cat] = {
        "label": CAT_LABELS.get(cat, cat),
        "count": len(nodes),
    }

with open(MANI, "w") as f:
    json.dump(manifest, f, indent=1, ensure_ascii=False)
print(f"[manifest] wrote {MANI} with {len(manifest['nodes'])} nodes")
print("[categories]")
for c, v in sorted(manifest["categories"].items(), key=lambda kv: -kv[1]["count"]):
    print(f"   {v['count']:4d}  {c}")

bpy.context.view_layer.objects.active = sel[0]
print(f"[export] {len(sel)} objects selected for GLB")

# ----------------------------------------------------------------------------
# 7. Export GLB (selection only, names preserved as node names)
# ----------------------------------------------------------------------------
bpy.ops.export_scene.gltf(
    filepath=GLB,
    export_format='GLB',
    use_selection=True,
    export_apply=True,            # apply modifiers
    export_yup=True,
    export_materials='EXPORT',
    export_normals=True,
    export_extras=True,           # emit bx_* custom props as glTF node extras
    export_cameras=False,
    export_lights=False,
)
print(f"[export] wrote {GLB}  ({os.path.getsize(GLB)/1e6:.1f} MB)")
