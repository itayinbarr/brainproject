import bpy
names=["Basilar artery","Anterior cerebral artery.l","Vertebral artery.l","Internal carotid artery.l"]
dg=bpy.context.evaluated_depsgraph_get()
for nm in names:
    o=bpy.data.objects.get(nm)
    if not o:
        print("DBG",nm,"-> MISSING"); continue
    cu=o.data
    info=dict(type=o.type, splines=len(cu.splines) if o.type=='CURVE' else '-',
              pts=[len(s.points)+len(s.bezier_points) for s in cu.splines] if o.type=='CURVE' else '-',
              bevel_depth=getattr(cu,'bevel_depth',None),
              bevel_object=getattr(cu,'bevel_object',None).name if getattr(cu,'bevel_object',None) else None,
              bevel_mode=getattr(cu,'bevel_mode',None),
              dims=tuple(round(x,4) for x in o.dimensions),
              mods=[(m.name,m.type) for m in o.modifiers])
    ev=o.evaluated_get(dg)
    try:
        me=ev.to_mesh()
        info['eval_polys']=len(me.polygons); info['eval_verts']=len(me.vertices)
        ev.to_mesh_clear()
    except Exception as e:
        info['eval_err']=str(e)
    print("DBG",nm,"->",info)
