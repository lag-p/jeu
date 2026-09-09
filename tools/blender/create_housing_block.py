"""Original modular French housing block. Run with Blender --background.

One invocation creates the source, transparent asset, metadata and a separate
quality preview. Fixed seed/version, no date, dependencies, downloads or game load.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import sys
import time

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common.materials import palette, material
from common.isometric_camera import make_camera, ELEVATION, WORLD_PER_METRE
from common.render_utils import setup, render

ASSET_ID = 'housing-block-long-v1'
GENERATOR_VERSION = '2.6B.1-1'
SEED = 261
meshes = {}


def box(name, position, size, mat):
    # Shared cube mesh per material; dimensions live on each instance.
    if mat.name not in meshes:
        mesh = bpy.data.meshes.new('Module ' + mat.name)
        mesh.from_pydata([(-.5, -.5, -.5), (.5, -.5, -.5), (.5, .5, -.5), (-.5, .5, -.5),
                         (-.5, -.5, .5), (.5, -.5, .5), (.5, .5, .5), (-.5, .5, .5)], [],
                        [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])
        mesh.materials.append(mat)
        meshes[mat.name] = mesh
    obj = bpy.data.objects.new(name, meshes[mat.name])
    bpy.context.collection.objects.link(obj)
    obj.location, obj.scale = position, size
    return obj


def build():
    p, rng = palette(), random.Random(SEED)
    box('RDC distinct', (25, 6, 1.5), (50, 12, 3), p['base'])
    box('Quatre etages habitables', (25, 6, 9), (50, 12, 12), p['concrete'])
    box('Toit terrasse', (25, 6, 15.03), (49.6, 11.6, .12), p['roof'])
    for y in [.12, 11.88]:
        box('Acrotere longitudinal', (25, y, 15.25), (50, .24, .5), p['concrete'])
        box('Couvertine zinc', (25, y, 15.52), (50.1, .32, .06), p['tech'])
    for x in [.12, 49.88]:
        box('Acrotere pignon', (x, 6, 15.25), (.24, 12, .5), p['concrete'])
    for x in [10, 38]:
        box('Local technique', (x, 5, 15.65), (3.3, 2.8, 1.2), p['tech'])
        box('Coiffe local', (x, 5, 16.3), (3.6, 3.1, .15), p['roof'])
    for x in [5, 20, 30, 45]:
        box('Ventilation toiture', (x, 8, 15.45), (.7, .7, .7), p['tech'])
        box('Chapeau ventilation', (x, 8, 15.83), (.95, .95, .12), p['roof'])

    def front(name, x, z, w, h, mat, protrusion=.08, depth=.08, side=False):
        # Only the two camera-facing walls get fine detail; no invisible interior.
        if side:
            return box(name, (50 + protrusion, x, z), (depth, w, h), mat)
        return box(name, (x, 12 + protrusion, z), (w, depth, h), mat)

    window_states = []
    def window(x, z, side=False, narrow=False):
        w, h = (1.0, 1.75) if narrow else (1.65, 1.5)
        state = rng.choices(['dark', 'lit', 'shutter'], [65, 13, 22])[0]
        window_states.append(state)
        front('Encadrement saillant', x, z, w + .24, h + .24, p['frame'], side=side)
        front('Tableau en retrait', x, z, w, h, p['door'], .135, side=side)
        front('Volet ferme' if state == 'shutter' else 'Vitre ' + state,
              x, z, w - .10, h - .10, p['shutter' if state == 'shutter' else state if state == 'lit' else 'glass'], .18, side=side)
        if state != 'shutter':
            front('Meneau', x, z, .065, h, p['frame'], .23, side=side)
            if state == 'lit':
                front('Rideau discret', x - w * .3, z, w * .15, h, p['shutter'], .22, side=side)
        else:
            for dz in [-.48, -.24, 0, .24, .48]:
                front('Lames volet', x, z + dz, w - .1, .035, p['tech'], .23, side=side)
        front('Appui debordant', x, z - h / 2 - .15, w + .36, .12, p['concrete'], .24, .46, side)
        if rng.random() < .28:
            front('Patine sous appui', x + .35, z - h / 2 - .35, .16, .32, p['stain'], .008, .012, side)

    for z in [3.05, 6.05, 9.05, 12.05]:
        front('Joint horizontal discret', 25, z, 50, .07, p['base'], .015, .025)
    for x in [10, 38]:
        front('Cage escalier bleue', x, 7.5, 2.7, 15, p['blue'], .08, .18)
        for z in [4.6, 7.6, 10.6, 13.6]:
            window(x, z, narrow=True)
        front('Portail entree', x, 1.2, 2.15, 2.4, p['frame'], .18, .2)
        front('Porte double vitree', x, 1.15, 1.95, 2.15, p['door'], .30)
        front('Vitre entree', x, 1.6, 1.75, .95, p['glass'], .36)
        front('Montant porte', x, 1.15, .08, 2.2, p['frame'], .42)
        for dx in [-.16, .16]:
            front('Poignee', x + dx, 1.05, .06, .32, p['tech'], .48)
        front('Auvent sobre', x, 2.7, 3.2, .16, p['tech'], .7, 1.45)
        front('Bande lumineuse entree', x, 2.57, 1.1, .09, p['lit'], .5)
    for floor in range(5):
        for x in [2.7, 6.1, 14, 17.4, 20.8, 24.2, 27.6, 31, 34.4, 42, 45.4, 48]:
            if floor == 0 and x in [17.4, 31, 45.4]:
                front('Grille technique RDC', x, 1.4, 1.6, .9, p['door'])
                for offset in [-.5, -.25, 0, .25, .5]:
                    front('Barreau grille', x + offset, 1.4, .045, .8, p['tech'], .15)
            else:
                window(x, 1.65 + floor * 3)
        for y in [3, 8.5]:
            window(y, 1.65 + floor * 3, side=True)
    for x in [1, 25.6, 49.4]:
        front('Descente eaux pluviales', x, 7.5, .11, 15, p['tech'], .21, .11)
        for z in [2, 5, 8, 11, 14]:
            front('Collier descente', x, z, .19, .06, p['frame'], .24)
    return window_states


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path('assets/art-v1'))
    parser.add_argument('--preview-only', action='store_true', help='Resume an interrupted preview from the saved .blend; do not regenerate the asset')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    output = args.output.resolve()
    for folder in ['buildings', 'source', 'previews']:
        (output / folder).mkdir(parents=True, exist_ok=True)
    if args.preview_only:
        bpy.ops.wm.open_mainfile(filepath=str(output / 'source' / (ASSET_ID + '.blend')))
        preview(output)
        return
    started = time.monotonic()
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    states = build()
    objects = list(bpy.context.scene.objects)
    stats = {'buildingObjects': len(objects), 'polygons': sum(len(o.data.polygons) for o in objects),
             'triangles': sum(len(o.data.polygons) * 2 for o in objects), 'uniqueMeshes': len(meshes)}
    setup()
    camera, span, height = make_camera(objects)
    scene = bpy.context.scene
    contact = world_to_camera_view(scene, camera, Vector((50, 12, 0)))
    scale = span / 1024 * (3.6 * math.sqrt(2) * WORLD_PER_METRE)
    metadata = {
        'id': ASSET_ID, 'version': 1, 'generatorVersion': GENERATOR_VERSION,
        'seed': SEED, 'blenderVersion': bpy.app.version_string,
        'pixels': {'width': 1024, 'height': height},
        'worldDimensions': {'width': 25, 'depth': 6, 'height': 7.5, 'unit': 'simulation'},
        'modelDimensionsMetres': {'width': 50, 'depth': 12, 'roofHeight': 15, 'maximumHeight': 16.375},
        'pivot': {'x': round(contact.x, 9), 'y': round(1 - contact.y, 9)},
        # Blender camera +X,+Y has screen-right (-X,+Y); Phaser uses (+X,-Y).
        # Reflect at display time, including the pivot, without resampling PNG.
        'phaserFlipX': True,
        'groundContact': {'x': 25, 'y': 6, 'z': 0},
        'orientation': {'longAxis': '+X', 'front': '+Y', 'rotationDegrees': 0},
        'phaserScale': round(scale, 9),
        'projection': {'tileWidth': 7.2, 'tileHeight': 4.2, 'cameraElevationDegrees': math.degrees(ELEVATION), 'cameraAzimuthDegrees': 45},
        'target': {'mapId': 'PONCETTE_INSPIRED_V1', 'buildingId': 'BLOCK_N'},
        'geometry': stats, 'windowStateHash': hashlib.sha256(','.join(states).encode()).hexdigest(),
        'windowStates': {s: states.count(s) for s in sorted(set(states))},
        'render': {'engine': scene.render.engine, 'samples': 32, 'transparent': True, 'color': 'RGBA8', 'viewTransform': 'AgX'},
    }
    # Store a source ready to render the transparent game asset, without preview props.
    scene.render.filepath = str(output / 'buildings' / (ASSET_ID + '.png'))
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output / 'source' / (ASSET_ID + '.blend')))
    t = time.monotonic()
    render(output / 'buildings' / (ASSET_ID + '.png'))
    asset_seconds = time.monotonic() - t
    (output / 'buildings' / (ASSET_ID + '.json')).write_text(json.dumps(metadata, indent=2, sort_keys=True) + '\n')
    preview_seconds = preview(output)
    print('GENERATION_REPORT ' + json.dumps({**stats, 'sceneObjects': len(objects) + 4,
        'assetRenderSeconds': round(asset_seconds, 2), 'previewRenderSeconds': preview_seconds,
        'totalSeconds': round(time.monotonic() - started, 2), 'pixels': metadata['pixels'],
        'pngBytes': (output / 'buildings' / (ASSET_ID + '.png')).stat().st_size}))


def preview(output):
    # Separate quality image: same camera and framing, simple ground and 1.75 m figure.
    scene = bpy.context.scene
    box('Sol de presentation', (25, 6, -.13), (180, 180, .2), material('Sol nuit', (.045, .067, .09), True))
    human = material('Repere humain 1m75', (.58, .37, .19))
    for x in [29.87, 30.13]:
        box('Jambe repere', (x, 14.3, .43), (.16, .22, .86), human)
    box('Corps repere', (30, 14.3, 1.17), (.46, .28, .68), human)
    for x in [29.68, 30.32]:
        box('Bras repere', (x, 14.3, 1.1), (.14, .18, .7), human)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=.14, location=(30, 14.3, 1.61))
    bpy.context.object.name = 'Tete repere'
    bpy.context.object.data.materials.append(human)
    scene.render.film_transparent = False
    t = time.monotonic()
    render(output / 'previews' / (ASSET_ID + '-preview.png'))
    duration = round(time.monotonic() - t, 2)
    print('PREVIEW_REPORT ' + json.dumps({'seconds': duration}), flush=True)
    return duration


if __name__ == '__main__':
    main()
