"""Match the Phaser ground slopes without perspective.

Camera +X,+Y sees screen-right (-X,+Y). Metadata requests a horizontal
reflection in Phaser to obtain ((x-y)*3.6, (x+y)*2.1); verticals stay fixed.
"""
import math
import bpy
from mathutils import Vector

TILE_WIDTH, TILE_HEIGHT = 7.2, 4.2
WORLD_PER_METRE = .5
ELEVATION = math.asin(TILE_HEIGHT / TILE_WIDTH)


def make_camera(objects, width=1024):
    camera = bpy.data.objects.new('Camera Phaser', bpy.data.cameras.new('Orthographique'))
    bpy.context.scene.collection.objects.link(camera)
    camera.data.type = 'ORTHO'
    direction = Vector((math.cos(ELEVATION) / math.sqrt(2),
                        math.cos(ELEVATION) / math.sqrt(2), math.sin(ELEVATION)))
    camera.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    rotation = camera.rotation_euler.to_matrix()
    right, up = rotation.col[0], rotation.col[1]
    bpy.context.view_layer.update()
    corners = [obj.matrix_world @ Vector(c) for obj in objects for c in obj.bound_box]
    xs, ys = [v.dot(right) for v in corners], [v.dot(up) for v in corners]
    # 1.2% per side, enough for antialiasing without a large empty canvas.
    span = (max(xs) - min(xs)) * 1.024
    height = math.ceil((max(ys) - min(ys) + span * .024) / span * width)
    center = right * ((max(xs) + min(xs)) / 2) + up * ((max(ys) + min(ys)) / 2)
    camera.location = center + direction * 150
    camera.data.ortho_scale = span
    camera.data.lens = 50
    bpy.context.scene.camera = camera
    bpy.context.scene.render.resolution_x = width
    bpy.context.scene.render.resolution_y = height
    bpy.context.view_layer.update()
    return camera, span, height
