"""Bounded Eevee rendering, sequential outputs, PNG RGBA."""
import bpy
from mathutils import Vector


def setup():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 2
    scene.eevee.taa_render_samples = 32
    scene.eevee.use_raytracing = False
    scene.eevee.shadow_pool_size = '128'
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 100
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.exposure = .6
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.055, .085, .16, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .35
    for name, location, energy, color, size in [
        ('Clair de lune doux', (5, 8, 45), 38000, (.63, .77, 1), 32),
        ('Remplissage facade', (30, 48, 24), 20000, (.67, .79, 1), 30),
        ('Liseres toit', (-20, -16, 30), 24000, (.42, .59, 1), 24),
    ]:
        light = bpy.data.lights.new(name, 'AREA')
        light.energy, light.color, light.shape, light.size = energy, color, 'DISK', size
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = location
        obj.rotation_euler = (Vector((25, 6, 7)) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def render(path):
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
