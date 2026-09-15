"""Pack completed Blender checkpoints once, without rendering or resizing them."""
import hashlib,json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/characters/v2'
roles=['player','customer0','customer1','customer2','customer3','vendeur','guetteur','gerant','ravitailleur','police']
assert all((OUT/f'{r}-sheet.png').exists() for r in roles), 'Incomplete Blender export'
assert not (OUT/'people.png').exists(), 'Atlas already packed'
image=Image.new('RGBA',(2048,2048));frames={};index=0
for role in roles:
    sheet=Image.open(OUT/f'{role}-sheet.png').convert('RGBA')
    assert sheet.size==(512,672)
    for direction in range(8):
        for pose in range(7):
            x=(index%32)*64;y=(index//32)*96;index+=1
            tile=sheet.crop((direction*64,pose*96,direction*64+64,pose*96+96))
            image.paste(tile,(x,y))
            frames[f'{role}-{direction}-{pose}']=dict(frame=dict(x=x,y=y,w=64,h=96),rotated=False,trimmed=False,
                spriteSourceSize=dict(x=0,y=0,w=64,h=96),sourceSize=dict(w=64,h=96))
image.save(OUT/'people.png')
meta=dict(app='Blender 5.0.1 Eevee / local pack_people.py',version=2,image='people.png',format='RGBA8888',size=dict(w=2048,h=2048),scale='1',
          frames=560,directions=8,walkFrames=6,idleFrames=1,footAnchor=[.5,82/96],decodedBytes=2048*2048*4,
          sha256=hashlib.sha256((OUT/'people.png').read_bytes()).hexdigest())
(OUT/'people.json').write_text(json.dumps(dict(frames=frames,meta=meta),indent=2)+'\n')
preview=Image.new('RGBA',(640,192),(48,58,56,255))
for i,role in enumerate(roles):
    sheet=Image.open(OUT/f'{role}-sheet.png').convert('RGBA')
    preview.alpha_composite(sheet.crop((64,0,128,96)),(i*64,0))
    preview.alpha_composite(sheet.crop((64,192,128,288)),(i*64,96))
preview.save(OUT/'preview.png')
print(json.dumps(meta,indent=2))
