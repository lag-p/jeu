"""2.6C.3: nine new geometry sheets, four idle and six walk poses.

Run with --background --factory-startup --threads 2 --python-exit-code 1.
An existing people.blend is reopened; completed sheets are never rendered again.
"""
import bpy
import math
import json
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/characters/v3/source'
ROLES = {
    'customer0': ((.64,.13,.11),(.075,.10,.16),(.025,.018,.01),'hoodie'),
    'customer1': ((.12,.38,.30),(.13,.22,.39),(.18,.08,.035),'jacket'),
    'customer2': ((.55,.38,.15),(.06,.075,.10),(.045,.025,.012),'coat'),
    'customer3': ((.39,.18,.48),(.16,.12,.19),(.035,.022,.012),'tracksuit'),
    'vendeur': ((.92,.38,.07),(.09,.15,.26),(.025,.015,.01),'hoodie'),
    'guetteur': ((.10,.49,.70),(.05,.08,.14),(.12,.055,.02),'tracksuit'),
    'gerant': ((.34,.20,.53),(.085,.08,.11),(.16,.08,.035),'coat'),
    'ravitailleur': ((.21,.55,.20),(.13,.22,.35),(.025,.018,.012),'jacket'),
    'police': ((.055,.12,.27),(.04,.07,.15),(.025,.018,.012),'uniform'),
}

def material(name, color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    shader=m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=.85
    return m

def build():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    mats={name:material(name,color) for name,color in {
        'top':(.8,.5,.2),'pants':(.1,.17,.27),'hair':(.05,.025,.01),
        'skin':(.52,.29,.16),'shoe':(.07,.06,.055),'sole':(.6,.58,.5),
        'trim':(.72,.76,.70),'eye':(.015,.012,.01),'bag':(.13,.08,.05),
        'shadow':(.05,.06,.07)}.items()}
    # Shared smooth primitive mesh; limb lengths and joint positions supply the pose.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8)
    mesh=bpy.context.object.data.copy();bpy.data.objects.remove(bpy.context.object,do_unlink=True)
    for poly in mesh.polygons: poly.use_smooth=True
    elev=math.radians(35.6853347); up=Vector((0,math.sin(elev),math.cos(elev)))
    for direction in range(8):
        for pose in range(10):
            # 64x96 tile, projected feet at (32,82); camera-plane layout.
            center=Vector(((direction-3.5)*1.6,0,0))+up*((5-pose)*2.4-2.05)
            root=bpy.data.objects.new(f'person-{direction}-{pose}',None);bpy.context.collection.objects.link(root)
            root.location=center;root.rotation_euler.z=math.pi/2-direction*math.pi/4
            phase=(pose-4)*math.tau/6 if pose >= 4 else 0
            swing=.28*math.cos(phase) if pose >= 4 else 0
            breath=[0,.018,.007,-.012][pose] if pose < 4 else .012*math.cos(phase*2)
            def part(name,loc,scale,mat):
                obj=bpy.data.objects.new(name,mesh.copy());bpy.context.collection.objects.link(obj)
                obj.parent=root;obj.location=loc;
                if name not in ['thigh','calf','sole','shoe','shadow','hips']: obj.location.z += breath
                obj.scale=scale;obj.data.materials.clear();obj.data.materials.append(mats[mat]);return obj
            def limb(name,a,b,r,mat):
                a,b=Vector(a),Vector(b);o=part(name,(a+b)/2,(r,r,(b-a).length/2+r*.25),mat)
                o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
            for side in [-1,1]:
                x=side*.115;stride=swing*side
                lift=.12*max(0,math.sin(phase + (0 if side == 1 else math.pi))) if pose >= 4 else 0
                hip=(x,0,.83);knee=(x,stride*.5-.04,.46+lift*.6)
                foot=(x,stride,.09+lift)
                limb('thigh',hip,knee,.10,'pants');limb('calf',knee,foot,.075,'pants')
                part('sole',(x,foot[1]-.05,foot[2]-.045),(.09,.18,.045),'sole')
                part('shoe',(x,foot[1]-.05,foot[2]),(.09,.18,.075),'shoe')
                shoulder=(side*.23,0,1.34);elbow=(side*.30,-stride*.5,1.09);hand=(side*.28,-stride,.88)
                limb('upper-sleeve',shoulder,elbow,.085,'top');limb('lower-sleeve',elbow,hand,.07,'top')
                part('hand',hand,(.06,.065,.085),'skin')
            part('hips',(0,0,.85),(.205,.13,.16),'pants')
            part('torso',(0,0,1.17),(.25,.145,.30),'top')
            part('coat',(0,.005,.91),(.235,.16,.25),'top')
            part('neck',(0,0,1.48),(.07,.075,.10),'skin')
            part('head',(0,-.015,1.65),(.135,.125,.17),'skin')
            part('hair',(0,.005,1.755),(.14,.13,.095),'hair')
            part('nose',(0,-.141,1.645),(.035,.04,.04),'skin')
            for side in [-1,1]:
                part('ear',(side*.135,-.005,1.65),(.025,.035,.05),'skin')
                part('eye',(side*.052,-.13,1.68),(.013,.012,.014),'eye')
            limb('zip',(0,-.143,1.0),(0,-.143,1.4),.008,'trim')
            part('hood',(0,.09,1.44),(.175,.13,.115),'top')
            part('cap',(0,-.015,1.78),(.15,.14,.06),'top')
            part('cap-visor',(0,-.15,1.765),(.14,.10,.022),'top')
            part('backpack',(0,.19,1.20),(.19,.10,.23),'bag')
            part('badge',(-.10,-.14,1.31),(.033,.018,.05),'trim')
            # Subtle geometry shadow, no external texture or opaque ground plane.
            shadow=part('shadow',(0,0,.005),(.25,.19,.008),'shadow')
    scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE'
    scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.eevee.taa_render_samples=8;scene.eevee.use_raytracing=False
    scene.render.resolution_x=512;scene.render.resolution_y=960;scene.render.resolution_percentage=100
    scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.world.color=(.3,.3,.3);scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.6
    camera=bpy.data.cameras.new('camera');obj=bpy.data.objects.new('camera',camera);scene.collection.objects.link(obj)
    obj.location=(0,-100*math.cos(elev),100*math.sin(elev));obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
    camera.type='ORTHO';camera.ortho_scale=24;scene.camera=obj
    for name,loc,energy in [('key',(-20,-30,45),35000),('fill',(30,-10,35),22000)]:
        data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=30
        light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=loc
        light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'people.blend'))

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    if (OUT/'people.blend').exists(): bpy.ops.wm.open_mainfile(filepath=str(OUT/'people.blend'))
    else: build()
    contacts=[]
    for person in bpy.data.objects:
        if not person.name.startswith('person-'): continue
        soles=[child for child in person.children if child.name.split('.')[0]=='sole']
        heights=[child.location.z-child.scale.z for child in soles]
        assert len(heights)==2 and min(heights)>=-1e-6 and abs(min(heights))<1e-6, (person.name,heights)
        contacts.append({'pose':person.name,'soleHeights':heights})
    (OUT/'geometry-audit.json').write_text(json.dumps(contacts,indent=2)+'\n')
    for role,(top,pants,hair,style) in ROLES.items():
        path=OUT/f'{role}-sheet.png'
        if path.exists(): print('CHECKPOINT',role,flush=True);continue
        for name,color in [('top',top),('pants',pants),('hair',hair)]:
            mat=bpy.data.materials[name];mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
        for obj in bpy.data.objects:
            name=obj.name.split('.')[0]
            if name in ['hood','coat','cap','cap-visor','backpack','badge']:
                obj.hide_render=not ((name=='hood' and style=='hoodie') or (name=='coat' and style=='coat') or
                                     (name in ['cap','cap-visor','badge'] and role=='police') or (name=='backpack' and role=='ravitailleur'))
        bpy.context.scene.render.filepath=str(OUT/f'{role}-pending.png')
        bpy.ops.render.render(write_still=True)
        (OUT/f'{role}-pending.png').rename(path)
        print('EXPORTED',role,flush=True)
        # One sheet per process releases Eevee memory between checkpoints.
        break

if __name__=='__main__': main()
