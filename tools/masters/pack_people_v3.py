"""Pack the new v3 Blender geometry sheets, preserving every foot projection."""
import hashlib, json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE, OUT = ROOT / 'assets/characters/v3/source', ROOT / 'assets/characters/v3'
ROLES = ['customer0','customer1','customer2','customer3','vendeur','guetteur','gerant','ravitailleur','police']
OUT.mkdir(parents=True, exist_ok=True)
tile_w, tile_h, columns = 64, 96, 32
frames, tiles = {}, []
for role in ROLES:
    sheet = Image.open(SOURCE / f'{role}-sheet.png').convert('RGBA')
    assert sheet.size == (512, 960)
    for direction in range(8):
        for pose in range(10):
            tiles.append((f'{role}-{direction}-{pose}', sheet.crop((direction * tile_w, pose * tile_h, (direction + 1) * tile_w, (pose + 1) * tile_h))))
rows = (len(tiles) + columns - 1) // columns
atlas = Image.new('RGBA', (columns * tile_w, rows * tile_h))
for index, (name, tile) in enumerate(tiles):
    x, y = (index % columns) * tile_w, (index // columns) * tile_h
    atlas.alpha_composite(tile, (x, y))
    frames[name] = {'frame': {'x': x, 'y': y, 'w': tile_w, 'h': tile_h}, 'rotated': False, 'trimmed': False,
                    'spriteSourceSize': {'x': 0, 'y': 0, 'w': tile_w, 'h': tile_h}, 'sourceSize': {'w': tile_w, 'h': tile_h}}
png = OUT / 'people.png'; atlas.save(png)
meta = {'app': 'Blender v3 geometry / 2.6C.3 pack', 'version': 3, 'image': 'people.png', 'format': 'RGBA8888',
        'size': {'w': atlas.width, 'h': atlas.height}, 'frames': len(frames), 'directions': 8, 'walkFrames': 6,
        'idleFrames': 4, 'walkFps': 10, 'footAnchor': [.5, 82 / 96], 'sha256': hashlib.sha256(png.read_bytes()).hexdigest()}
(OUT / 'people.json').write_text(json.dumps({'frames': frames, 'meta': meta}, indent=2) + '\n')
print(json.dumps(meta, indent=2))
