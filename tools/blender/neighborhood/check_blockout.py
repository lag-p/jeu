"""Validate the recovered checkpoint without reconstructing or rendering it."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'assets/art-v2'
if (OUT/'source/blockout-validated.blend').exists():
    raise SystemExit('Validated checkpoint exists; nothing to redo')
bpy.ops.wm.open_mainfile(filepath=str(OUT/'source/blockout.blend'))
s=bpy.context.scene;c=s.camera
objects=[o for o in s.objects if o.type=='MESH']
points=[o.matrix_world@Vector(v) for o in objects for v in o.bound_box]
before=[world_to_camera_view(s,c,p) for p in points]
# Orthographic framing is unchanged by moving along the optical axis.
# The inherited 150 m distance put foreground geometry behind the camera.
direction=c.rotation_euler.to_matrix()@Vector((0,0,1))
c.location+=direction*400;c.data.clip_end=1500
bpy.context.view_layer.update()
after=[world_to_camera_view(s,c,p) for p in points]
assert all(p.z>c.data.clip_start for p in after)
assert all(0<=p.x<=1 and 0<=p.y<=1 for p in after)
assert max(abs(a.x-b.x)+abs(a.y-b.y) for a,b in zip(before,after))<1e-5
# Source canvas resolution may be increased without changing projection ratios.
s.render.resolution_percentage=100
lock=dict(location=list(c.location),rotation=list(c.rotation_euler),scale=c.data.ortho_scale,width=s.render.resolution_x,height=s.render.resolution_y)
(OUT/'source/camera-final.json').write_text(json.dumps(lock,indent=2)+'\n')
report=dict(objects=len(objects),faces=sum(len(o.data.polygons) for o in objects),originalBehindCamera=sum(p.z<=0 for p in before),allBoundsInFrame=True,projectionPreserved=True,composition='7 slabs, central long Y slab, two open courts; wider and less dense than reference',portrait='fit full parcel by width; zoom available for detail',visualReview='blockout-raw.png reviewed; near clipping found and corrected without rerender')
(OUT/'source/blockout-validation.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source/blockout-validated.blend'))
print(json.dumps(report))
