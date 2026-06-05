import bpy, re, json
from collections import defaultdict
# rebuild scope quickly via the manifest's exported names vs in-scope curve names
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
curves=[o for o in bpy.data.objects if o.type=='CURVE' and (('Brain' in anc(o.name)) or ('Cranial nerves' in anc(o.name)) or VI.search(o.name))]
dg=bpy.context.evaluated_depsgraph_get()
fails=[]
for o in curves:
    cu=o.data
    cu.bevel_object=None; cu.bevel_depth=max(cu.bevel_depth,0.0006); cu.bevel_mode='ROUND'
bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get()
for o in curves:
    me=bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    np=len(me.polygons) if me else 0
    if np==0:
        pts=[len(s.points)+len(s.bezier_points) for s in cu.splines]
        fails.append((o.name,[len(s.points)+len(s.bezier_points) for s in o.data.splines],o.data.dimensions[:]))
print("DBGTOTAL curves",len(curves),"fails",len(fails))
for n,pts,dim in fails:
    print("DBGFAIL",n,"pts/spline",pts)
