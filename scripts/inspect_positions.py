"""Report world-space bbox center per in-scope object so we can spot outliers
(the 'bottom' cluster) and any non-brain geometry. Run on the PRISTINE blend."""
import bpy, re, mathutils, math
from collections import defaultdict

parent_of={}
def idx(c):
    for ch in c.children:
        parent_of[ch.name]=c.name; idx(ch)
idx(bpy.context.scene.collection)
odc=defaultdict(set)
for col in bpy.data.collections:
    for o in col.objects: odc[o.name].add(col.name)
def anc(n):
    seen=set(); st=list(odc.get(n,()))
    while st:
        c=st.pop()
        if c in seen: continue
        seen.add(c); p=parent_of.get(c)
        if p: st.append(p)
    return seen

VI=re.compile(r"cerebral artery|cerebellar artery|communicating artery|basilar artery|basilar venous plexus|internal carotid|vertebral artery|ophthalmic artery|choroidal artery|pericallosal|callosomarginal|striate|pontine branch|labyrinthine|anterior spinal artery|cerebral arterial circle|superior sagittal sinus|inferior sagittal sinus|straight sinus|transverse sinus|sigmoid sinus|occipital sinus|marginal sinus|confluence of sinuses|cavernous sinus|intercavernous|sphenoparietal|petrosal sinus|dural venous sinuses|great cerebral vein|internal cerebral vein|basal vein|superior cerebral vein|inferior cerebral vein|emissary vein|superior anastomotic vein|inferior anastomotic vein",re.I)
SKIP=re.compile(r"spinal dura|spinal pia|spinal arachnoid",re.I)
def in_scope(o):
    if o.type not in ("MESH","CURVE"): return False
    if SKIP.search(o.name): return False
    a=anc(o.name)
    if "Brain" in a: return True
    if "Cranial nerves" in a: return True
    if ("Meninges" in a or "Dura" in a):
        return bool(re.search(r"falx cerebr|tentorium|diaphragma sellae|falx cerebelli|cranial dura|cranial arachnoid|cranial pia|leptomeninges",o.name,re.I) or "Cranial dura" in a)
    if VI.search(o.name): return True
    return False

def wbb(o):
    mn=mathutils.Vector((math.inf,)*3); mx=mathutils.Vector((-math.inf,)*3)
    for c in o.bound_box:
        w=o.matrix_world@mathutils.Vector(c)
        for i in range(3):
            mn[i]=min(mn[i],w[i]); mx[i]=max(mx[i],w[i])
    return mn,mx

rows=[]
for o in bpy.data.objects:
    if in_scope(o):
        mn,mx=wbb(o); ctr=(mn+mx)/2
        rows.append((ctr.z, o.name, round(mn.z,3), round(mx.z,3), o.type, sorted(a for a in anc(o.name) if not re.match(r'^\d+:',a))[:1]))
rows.sort()
print("=== LOWEST 20 (by center Z) ===")
for r in rows[:20]: print(f"DBG z={r[0]:.3f} [{r[2]}..{r[3]}] {r[4]:5s} {r[1]}")
print("=== overall Z span ===", round(rows[0][0],3), "->", round(rows[-1][0],3))
# How many sit well below the cerebrum mass? cerebrum approx z>1.45
low=[r for r in rows if r[0]<1.35]
print("=== objects with center z<1.35 (neck-ish):", len(low),"===")
for r in low[:30]: print(f"   z={r[0]:.3f} {r[4]:5s} {r[1]}")
