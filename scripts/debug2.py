import bpy, re
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

VI=re.compile(r"cerebral artery|cerebellar artery|communicating artery|basilar artery|internal carotid|vertebral artery",re.I)

arts=[o for o in bpy.data.objects if o.type=='CURVE' and VI.search(o.name)]
print("DBG artery curves in file:",len(arts))
# Are they in active view layer?
vl=set(bpy.context.view_layer.objects)
print("DBG arteries in view layer:",sum(o in vl for o in arts),"/",len(arts))

# Try the exact convert flow
bpy.ops.object.select_all(action='DESELECT')
for o in arts:
    if o in vl: o.select_set(True)
if arts:
    bpy.context.view_layer.objects.active=arts[0]
    bpy.ops.object.convert(target='MESH')
kept=[o for o in arts if bpy.data.objects[o.name].type=='MESH' and len(bpy.data.objects[o.name].data.polygons)>0]
print("DBG arteries kept after convert (polys>0):",len(kept))
for o in arts[:5]:
    oo=bpy.data.objects[o.name]
    print("   ",o.name,"type=",oo.type,"polys=",len(oo.data.polygons) if oo.type=='MESH' else '-')

# Count 0-poly among ALL original meshes that are in 'Brain'
brainmesh=[o for o in bpy.data.objects if o.type=='MESH' and 'Brain' in anc(o.name)]
zero=[o for o in brainmesh if len(o.data.polygons)==0]
print("DBG brain meshes:",len(brainmesh)," zero-poly:",len(zero))
print("   sample zero-poly:",[o.name for o in zero[:8]])
