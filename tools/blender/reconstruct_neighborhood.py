"""2.6B.2 extension of the 2.6B.1 Eevee pipeline. Sequential, resumable stages.
Source of geometry: neighborhood/scene-spec.json. Never reads the reference bitmap.
"""
import argparse, json, math, sys, time, resource
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, str(Path(__file__).resolve().parent))
from create_housing_block import box, meshes
from common.materials import material, palette
from common.render_utils import setup, render
from common.isometric_camera import make_camera
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/art-v2'
SPEC=json.loads((Path(__file__).parent/'neighborhood/scene-spec.json').read_text())
GROUPS={}
CURRENT='ground'
P={}

def cube(name,x,y,z,w,d,h,mat):
    o=box(name,(x*2,y*2,z+h/2),(w*2,d*2,h),mat)
    o['layer']=CURRENT
    GROUPS.setdefault(CURRENT,[]).append(o)
    return o

def building(b,detail,existing=False):
    global CURRENT
    CURRENT=b['id'];x,y,w,d=b['x'],b['y'],b['width'],b['height']; z=b['altitude'];H=b['floors']*3
    if not existing:
        cube('Concrete '+CURRENT,x+w/2,y+d/2,z,w,d,H,P['concrete'])
        cube('Plinth',x+w/2,y+d/2,z,w+.03,d+.03,.65,P['base'])
        cube('Roof membrane',x+w/2,y+d/2,z+H,w-.15,d-.15,.1,P['roof'])
        for xx in [x+.06,x+w-.06]:cube('Parapet',xx,y+d/2,z+H,.12,d,.45,P['concrete'])
        for yy in [y+.06,y+d-.06]:cube('Parapet',x+w/2,yy,z+H,w,.12,.45,P['concrete'])
    if not detail:return
    # Both visible facades, modular shared cube meshes. Long axes differ per slab.
    for axis,length in [('x',w),('y',d)]:
        long=length>10
        def face(name,t,zz,ww,hh,mat,depth=.07):
            return cube(name,x+t if axis=='x' else x+w+.04,y+d+.04 if axis=='x' else y+t,zz,ww/2 if axis=='x' else depth/2,depth/2 if axis=='x' else ww/2,hh,mat)
        positions=[1.0+i*1.65 for i in range(int((length-1)/1.65))]
        for floor in range(b['floors']):
            for i,t in enumerate(positions):
                zz=z+floor*3+.8;state=(i*17+floor*31+sum(map(ord,b['id'])))%11
                face('Window frame',t,zz,1.55,1.55,P['frame'],.11)
                face('Window glass',t,zz+.1,1.3,1.35,P['lit'] if state<2 else P['shutter'] if state<5 else P['glass'],.15)
                face('Window mullion',t,zz+.1,.07,1.35,P['frame'],.2)
                face('Window sill',t,zz-.1,1.8,.12,P['frame'],.35)
                if state==5:face('Weathering',t+.25,zz-.7,.16,.65,P['stain'],.02)
        if long:
            for t in [length*.25,length*.75]:
                face('Stairwell panel',t,z,2, H,P['blue'],.26)
                for floor in range(1,b['floors']):face('Stairwell glazing',t,z+floor*3+.35,1,1.9,P['glass'],.3)
                face('Entry door',t,z,1.8,2.25,P['door'],.35)
                face('Entry lintel',t,z+2.3,2.8,.15,P['tech'],1.4)
                face('Entry light',t,z+2.2,1.1,.1,P['lit'],.45)
            for t in [.3,length-.3]:face('Downpipe',t,z,.09,H,P['tech'],.4)
    for t in [.2,.5,.8]:
        xx=x+w*t if w>d else x+w*.55; yy=y+d*t if d>w else y+d*.5
        cube('Roof service',xx,yy,z+H,.8,.8,.7,P['tech'])
        cube('Vent cap',xx,yy,z+H+.7,1,1,.12,P['roof'])

def plant(id,x,y,variant):
    global CURRENT
    CURRENT=id
    H=[7,10,13][variant]
    cube('Trunk',x,y,0,.16,.16,H*.65,P['bark'])
    import random
    r=random.Random(variant+262)
    for i in range(13):
        # Shared smooth low-poly canopy lobes, no alpha leaf textures.
        meshname='Canopy '+str(variant)
        if meshname not in meshes:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
            temp=bpy.context.object;mesh=temp.data;mesh.name=meshname;mesh.materials.append(P['leaf'+str(variant)])
            for p in mesh.polygons:p.use_smooth=True
            meshes[meshname]=mesh;bpy.data.objects.remove(temp,do_unlink=True)
        o=bpy.data.objects.new('Foliage',meshes[meshname]);bpy.context.collection.objects.link(o)
        a=r.random()*math.tau;radius=r.random()*H*.22
        o.location=(x*2+math.cos(a)*radius,y*2+math.sin(a)*radius,H*.55+r.random()*H*.28)
        o.scale=(H*.21,H*.21,H*.22);o['layer']=id;GROUPS.setdefault(id,[]).append(o)

def prop(id,x,y,kind):
    global CURRENT
    CURRENT=id
    if kind.startswith('tree'):plant(id,x,y,int(kind[-1]));return
    if kind.startswith('car'):
        w,d=(2.2,1) if kind=='car-x' else (1,2.2)
        cube('Car body',x,y,.3,w,d,.6,P['car'])
        cube('Car glasshouse',x,y,.9,w*.6,d*.6,.55,P['glass'])
        cube('Car roof',x,y,1.45,w*.49,d*.49,.07,P['car'])
        for dx in [-w*.37,w*.37]:
            for dy in [-d*.37,d*.37]:cube('Tire',x+dx,y+dy,.15,.22,.22,.45,P['rubber'])
        for side in [-1,1]:cube('Bumper',x+side*w*.46,y,.48,.1,d,.14,P['tech'])
    elif kind=='lamp':
        cube('Lamp base',x,y,0,.2,.2,.4,P['tech']);cube('Lamp pole',x,y,.4,.06,.06,5.5,P['tech'])
        cube('Lantern',x,y,5.9,.22,.22,.45,P['lit']);cube('Lantern cap',x,y,6.35,.3,.3,.12,P['roof'])
        light=bpy.data.lights.new('Warm '+id,'POINT');light.color=(1,.52,.20);light.energy=0;light.shadow_soft_size=1;light.use_shadow=False
        lamp=bpy.data.objects.new('Warm '+id,light);bpy.context.collection.objects.link(lamp);lamp.location=(x*2,y*2,5.9)
    elif kind=='bench':
        cube('Bench seat',x,y,.5,1.5,.35,.1,P['wood']);cube('Bench back',x,y+.2,.6,1.5,.07,.45,P['wood'])
        for dx in [-.55,.55]:cube('Bench leg',x+dx,y,0,.06,.3,.5,P['tech'])
    else:
        cube('Waste container',x,y,0,.5,.5,1.1,P['base']);cube('Container lid',x,y,1.1,.56,.56,.1,P['tech'])

def build(detail):
    global CURRENT,P
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    P=palette()
    P.update({k:material(k,c,concrete=k in ['asphalt','paving','earth']) for k,c in dict(asphalt=(.16,.18,.2),paving=(.48,.47,.43),earth=(.2,.26,.16),marking=(.72,.72,.65),bark=(.16,.13,.09),leaf0=(.10,.19,.06),leaf1=(.075,.15,.09),leaf2=(.12,.20,.10),car=(.36,.40,.43),rubber=(.015,.02,.024),wood=(.23,.19,.10)).items()})
    CURRENT='ground'
    mesh=bpy.data.meshes.new('Parcel');mesh.from_pydata([(p['x']*2,p['y']*2,-.02) for p in SPEC['perimeter']],[],[list(range(len(SPEC['perimeter'])))]);mesh.materials.append(P['earth']);o=bpy.data.objects.new('Parcel',mesh);bpy.context.collection.objects.link(o);o['layer']='ground';GROUPS['ground']=[o]
    for key in ['roads','courts','parking','sidewalks','crossings']:
        for q in SPEC[key]:
            cube(q['id'],q['x']+q['width']/2,q['y']+q['height']/2,.02,q['width'],q['height'],.08,P['asphalt' if key in ['roads','parking'] else 'paving'])
            if detail and key=='parking':
                for t in range(1,int(q['height']),2):cube('Parking marking',q['x']+q['width']/2,q['y']+t,.13,q['width'],.045,.01,P['marking'])
            if detail and key=='crossings':
                for t in range(int(q['width'])):cube('Crosswalk',q['x']+t+.3,q['y']+q['height']/2,.13,.3,q['height'],.01,P['marking'])
    for q in SPEC['transitions']:
        for i in range(12):cube(q['id'],q['x']+q['width']/2,q['y']+(i+.5)*q['height']/12,0,q['width'],q['height']/12,q['altitudeFrom']*(12-i)/12+.1,P['paving'])
    for q in SPEC['walls']:
        CURRENT=q['id'];cube(q['id'],q['x']+q['width']/2,q['y']+q['height']/2,0,q['width'],q['height'],q['metresHeight'],P['concrete'])
        if detail:
            for i in range(int(q['width']*2)):
                cube('Railing',q['x']+i*.5,q['y']+q['height']/2,q['metresHeight'],.035,.035,.85,P['tech'])
            cube('Handrail',q['x']+q['width']/2,q['y']+q['height']/2,q['metresHeight']+.8,q['width'],.04,.04,P['tech'])
    for b in SPEC['buildings']:building(b,detail)
    if detail:
        for d in SPEC['decor']:prop(d['id'],d['anchor']['x'],d['anchor']['y'],d['asset'])
    # Merge mesh instances by layer/material: low scene traversal/memory, keep shared prototypes source.
    for key,objects in list(GROUPS.items()):
        buckets={}
        for o in objects:buckets.setdefault(o.data.materials[0].name,[]).append(o)
        merged=[]
        for items in buckets.values():
            bpy.ops.object.select_all(action='DESELECT')
            for o in items:o.select_set(True)
            items[0].data=items[0].data.copy()
            bpy.context.view_layer.objects.active=items[0]
            if len(items)>1:bpy.ops.object.join()
            merged.append(bpy.context.view_layer.objects.active)
        GROUPS[key]=merged
    setup()
    # Preserve camera angles from 2.6B.1; lock full-scene bounds at blockout.
    if detail:
        lock=json.loads((OUT/'source/camera.json').read_text());c=bpy.data.objects.new('Camera locked',bpy.data.cameras.new('Orthographic'));bpy.context.collection.objects.link(c)
        c.data.type='ORTHO';c.location=lock['location'];c.rotation_euler=lock['rotation'];c.data.ortho_scale=lock['scale'];bpy.context.scene.camera=c
        bpy.context.scene.render.resolution_x=lock['width'];bpy.context.scene.render.resolution_y=lock['height']
    else:
        c,_,_=make_camera([o for values in GROUPS.values() for o in values],width=1200)
        # include 13 m peripheral crowns in final frame with explicit 8% margin
        c.data.ortho_scale*=1.08
        s=bpy.context.scene
        (OUT/'source/camera.json').write_text(json.dumps(dict(location=list(c.location),rotation=list(c.rotation_euler),scale=c.data.ortho_scale,width=s.render.resolution_x,height=s.render.resolution_y),indent=2)+'\n')
    # Sun is bounded and independent of scene size (unlike local 2.6B.1 area lights).
    for o in list(bpy.context.scene.objects):
        if o.type=='LIGHT':bpy.data.objects.remove(o,do_unlink=True)
    light=bpy.data.lights.new('Sun','SUN');o=bpy.data.objects.new('Sun',light);bpy.context.collection.objects.link(o);o.rotation_euler=(.4,-.6,-.4)
    light.angle=.15
    set_mood('day')
    bpy.context.scene.eevee.taa_render_samples=16 if detail else 4
    bpy.context.preferences.filepaths.save_version=0

def enrich():
    """Continue the validated .blend; keep completed blockout meshes."""
    global CURRENT,P,GROUPS
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'source/blockout-validated.blend'))
    GROUPS={}
    for o in bpy.context.scene.objects:
        if o.type=='MESH' and 'layer' in o:GROUPS.setdefault(o['layer'],[]).append(o)
    P=palette()
    # Reuse materials already present in the checkpoint.
    for k,m in list(P.items()):
        base=m.name.rsplit('.',1)[0] if m.name[-3:].isdigit() else m.name
        if base in bpy.data.materials and bpy.data.materials[base]!=m:
            P[k]=bpy.data.materials[base];bpy.data.materials.remove(m)
    P.update({k:material(k,c) for k,c in dict(marking=(.72,.72,.65),bark=(.16,.13,.09),leaf0=(.10,.19,.06),leaf1=(.075,.15,.09),leaf2=(.12,.20,.10),car=(.36,.40,.43),rubber=(.015,.02,.024),wood=(.23,.19,.10)).items()})
    for b in SPEC['buildings']:building(b,True,existing=True)
    CURRENT='ground'
    for q in SPEC['parking']:
        for t in range(1,int(q['height']),2):cube('Parking marking',q['x']+q['width']/2,q['y']+t,.13,q['width'],.045,.01,P['marking'])
    for q in SPEC['crossings']:
        for t in range(int(q['width'])):cube('Crosswalk',q['x']+t+.3,q['y']+q['height']/2,.13,.3,q['height'],.01,P['marking'])
    for q in SPEC['walls']:
        CURRENT=q['id']
        for i in range(int(q['width']*2)):cube('Railing',q['x']+i*.5,q['y']+q['height']/2,q['metresHeight'],.035,.035,.85,P['tech'])
        cube('Handrail',q['x']+q['width']/2,q['y']+q['height']/2,q['metresHeight']+.8,q['width'],.04,.04,P['tech'])
    for d in SPEC['decor']:prop(d['id'],d['anchor']['x'],d['anchor']['y'],d['asset'])
    for key,objects in list(GROUPS.items()):
        buckets={}
        for o in objects:buckets.setdefault(o.data.materials[0].name,[]).append(o)
        merged=[]
        for items in buckets.values():
            bpy.ops.object.select_all(action='DESELECT')
            for o in items:o.select_set(True)
            items[0].data=items[0].data.copy()
            bpy.context.view_layer.objects.active=items[0]
            if len(items)>1:bpy.ops.object.join()
            merged.append(bpy.context.view_layer.objects.active)
        GROUPS[key]=merged
    s=bpy.context.scene;s.render.resolution_percentage=100
    s.render.resolution_x*=2;s.render.resolution_y*=2
    s.eevee.taa_render_samples=16
    bpy.context.preferences.filepaths.save_version=0
    set_mood('day')

def set_mood(mood):
    scene=bpy.context.scene
    strength,color,world,emission={'day':(2.1,(1,.94,.83),.5,0),'dusk':(.75,(.95,.65,.46),.35,1),'night':(.5,(.48,.64,1),.28,2.5)}[mood]
    bpy.data.lights['Sun'].energy=strength;bpy.data.lights['Sun'].color=color
    bg=scene.world.node_tree.nodes['Background'];bg.inputs[0].default_value=(.23,.3,.46,1);bg.inputs[1].default_value=world
    bpy.data.materials['Vitrage ambre'].node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=emission
    for light in bpy.data.lights:
        if light.name.startswith('Warm '):light.energy={'day':0,'dusk':160,'night':350}[mood]
    scene.view_settings.exposure=.6 if mood=='day' else .8

def report(stage,started,**kw):
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
    data=dict(stage=stage,seconds=round(time.monotonic()-started,3),maxRSSKiB=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,objects=len(bpy.context.scene.objects),faces=sum(len(o.data.polygons) for o in objects),triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),textures=sum(1 for i in bpy.data.images if i.source=='FILE'),**kw)
    with (OUT/'source/measurements.jsonl').open('a') as f:f.write(json.dumps(data)+'\n')
    print('REPORT '+json.dumps(data),flush=True)

def completed_png(path):
    if not path.exists():return False
    data=path.read_bytes()
    if data[:8]!=b'\x89PNG\r\n\x1a\n' or data[-12:]!=b'\x00\x00\x00\x00IEND\xaeB`\x82':
        raise RuntimeError('Incomplete PNG needs inspection, refusing overwrite: '+str(path))
    return True

def main():
    p=argparse.ArgumentParser();p.add_argument('--stage',choices=['blockout','build','export','preview'],required=True)
    p.add_argument('--max-renders',type=int,default=0,help='Exit cleanly after this many new PNGs; 0 means unlimited. Existing PNGs are always skipped.')
    args=p.parse_args(sys.argv[sys.argv.index('--')+1:]);stage=args.stage;t=time.monotonic();rendered=0
    if args.max_renders<0:p.error('--max-renders must be nonnegative')
    if stage in ['blockout','build']:
        
        target=OUT/'source'/('blockout.blend' if stage=='blockout' else 'neighborhood.blend')
        if target.exists():raise RuntimeError('Checkpoint exists; refusing reconstruction: '+str(target))
        if stage=='build':enrich()
        else:build(False)
        report(stage+' construction',t)
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'source'/('blockout.blend' if stage=='blockout' else 'neighborhood.blend')))
        if stage=='blockout':
            s=bpy.context.scene;s.render.resolution_percentage=40;t=time.monotonic();render(OUT/'previews/blockout-raw.png');report('blockout render',t)
        return
    bpy.ops.wm.open_mainfile(filepath=str(OUT/'source/neighborhood.blend'))
    groups={}
    for o in bpy.context.scene.objects:
        if 'layer' in o:groups.setdefault(o['layer'],[]).append(o)
    s=bpy.context.scene;W,H=s.render.resolution_x,s.render.resolution_y
    if stage=='preview':
        for mood in ['day','dusk','night']:
            dest=OUT/'previews'/('full-'+mood+'-raw.png')
            if completed_png(dest):continue
            set_mood(mood);s.render.film_transparent=False;t=time.monotonic();render(dest);report('preview '+mood,t,file=str(dest.relative_to(ROOT)),width=W,height=H,bytes=dest.stat().st_size)
            rendered+=1
            if args.max_renders and rendered>=args.max_renders:return
        return
    entries=[]
    # Unique repeated props use a single raster per orientation/species; placement uses shared anchors.
    first={}
    for d in SPEC['decor']:first.setdefault(d['asset'],d['id'])
    allowed=['ground']+[b['id'] for b in SPEC['buildings']]+[w['id'] for w in SPEC['walls']]+list(first.values())
    for key in allowed:
        objects=groups[key];bpy.context.view_layer.update()
        coords=[world_to_camera_view(s,s.camera,o.matrix_world@Vector(c)) for o in objects for c in o.bound_box]
        x0=max(0,math.floor(min(v.x for v in coords)*W)-3);x1=min(W,math.ceil(max(v.x for v in coords)*W)+3)
        y0=max(0,math.floor(min(v.y for v in coords)*H)-3);y1=min(H,math.ceil(max(v.y for v in coords)*H)+3)
        s.render.use_border=True;s.render.use_crop_to_border=True;s.render.border_min_x=x0/W;s.render.border_max_x=x1/W;s.render.border_min_y=y0/H;s.render.border_max_y=y1/H
        for group,items in groups.items():
            for o in items:o.hide_render=group!=key
        source=next((q for q in SPEC['buildings']+SPEC['walls']+SPEC['decor'] if q['id']==key),None)
        anchor=source.get('anchor') or dict(x=source['x'],y=source['y']) if source else dict(x=50,y=50)
        a=world_to_camera_view(s,s.camera,Vector((anchor['x']*2,anchor['y']*2,0)))
        p0=world_to_camera_view(s,s.camera,Vector((0,0,0)));p1=world_to_camera_view(s,s.camera,Vector((2,0,0)))
        scale=3.6/abs((p1.x-p0.x)*W)
        entry=dict(width=x1-x0,height=y1-y0,id=key,category='ground' if not source else source['visualType'],asset=next((k for k,v in first.items() if v==key),None),anchor=anchor,crop=[x0,H-y1,x1-x0,y1-y0],pivot=[(x1-a.x*W)/(x1-x0),(y1-a.y*H)/(y1-y0)],scale=scale,footprint=source['polygon'] if source else SPEC['perimeter'],images={})
        for mood in ['day','dusk','night']:
            dest=OUT/'layers'/(key.lower()+'-'+mood+'-raw.png');entry['images'][mood]=str(dest.relative_to(ROOT)).replace('-raw.png','.png')
            if completed_png(dest):continue
            set_mood(mood);t=time.monotonic();render(dest);report('export '+key+' '+mood,t,file=str(dest.relative_to(ROOT)),width=x1-x0,height=y1-y0,bytes=dest.stat().st_size)
            rendered+=1
            if args.max_renders and rendered>=args.max_renders:return
        entries.append(entry)
    (OUT/'source/export-metadata.json').write_text(json.dumps(dict(mapId=SPEC['mapId'],camera=json.loads((OUT/'source/camera-final.json').read_text()),layers=entries),indent=2)+'\n')

if __name__=='__main__':main()
