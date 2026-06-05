"""Run inside Blender:  blender Startup.blend --background --python scripts/inspect_scene.py
Dumps the collection tree + object inventory to build_inspect/ so we can decide
exactly which collections make up the brain and which objects are curves.
"""
import bpy, json, os, collections

OUT = os.path.join(os.path.dirname(bpy.data.filepath) or ".", "build_inspect")
os.makedirs(OUT, exist_ok=True)

# --- 1. Collection hierarchy (name + object count + child collections) ---
def walk(col, depth, lines):
    direct = len(col.objects)
    total = len(col.all_objects)
    lines.append(f"{'  '*depth}{col.name}  [direct:{direct} total:{total}]")
    for c in sorted(col.children, key=lambda c: c.name):
        walk(c, depth + 1, lines)

lines = []
walk(bpy.context.scene.collection, 0, lines)
with open(os.path.join(OUT, "collection_tree.txt"), "w") as f:
    f.write("\n".join(lines))

# --- 2. Per-object inventory: name, type, the collections it belongs to ---
obj_to_cols = collections.defaultdict(list)
for col in bpy.data.collections:
    for o in col.objects:
        obj_to_cols[o.name].append(col.name)

inv = []
type_counts = collections.Counter()
for o in bpy.data.objects:
    type_counts[o.type] += 1
    inv.append({"name": o.name, "type": o.type, "collections": obj_to_cols.get(o.name, [])})
inv.sort(key=lambda x: x["name"])
with open(os.path.join(OUT, "objects.json"), "w") as f:
    json.dump(inv, f, indent=1, ensure_ascii=False)

# --- 3. Collection -> object names (full), for grep-ability ---
cmap = {}
for col in bpy.data.collections:
    cmap[col.name] = sorted(o.name for o in col.objects)
with open(os.path.join(OUT, "collections.json"), "w") as f:
    json.dump(cmap, f, indent=1, ensure_ascii=False)

# --- 4. Quick summary to stdout ---
print("=== TYPE COUNTS ===", dict(type_counts))
print("=== TOTAL OBJECTS ===", len(bpy.data.objects))
print("=== TOTAL COLLECTIONS ===", len(bpy.data.collections))
brainish = [c for c in bpy.data.collections
            if any(k in c.name.lower() for k in
                   ("brain","cerebr","cerebell","ventric","mening","dura","arter",
                    "sinus","nerv","encephal","cortex","lobe","gyr","thalam","stem"))]
print("=== BRAIN-ISH COLLECTIONS ===")
for c in sorted(brainish, key=lambda c: c.name):
    print(f"  {c.name}  (total {len(c.all_objects)})")
print("WROTE:", OUT)
