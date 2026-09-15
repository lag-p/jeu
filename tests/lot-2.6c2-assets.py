import hashlib,json
from pathlib import Path
from PIL import Image,ImageChops
root=Path(__file__).resolve().parents[1]
out=root/'assets/art-v2/masters'
m=json.loads((out/'manifest-expanded-v2.json').read_text())
source=Image.open(root/'references/lot-2.6c2/neighborhood-day-expanded-v2.png').convert('RGB')
for name,entry in m['images'].items():
    path=root/entry['image'];assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256']
    image=Image.open(path);assert image.size==(909,1536);assert image.getchannel('A').getextrema()==(255,255)
    expected=source.point([round(v*g) for g in entry['gains'] for v in range(256)])
    assert ImageChops.difference(image.convert('RGB'),expected).getbbox() is None
    print('PASS dimensions, hash, alpha and identical geometry:',name)
c=json.loads((out/'calibration-expanded-v2.json').read_text())
def area(p):
    a,b,c=p;return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
assert len(c['triangles'])==58
assert all(area([c['points'][i]['world'] for i in t])*area([c['points'][i]['image'] for i in t])>0 for t in c['triangles'])
print('PASS calibration: 58 triangles, no inversion')
atlas=root/'assets/characters/v2/people.json'
if atlas.exists():
    meta=json.loads(atlas.read_text());image=Image.open(atlas.with_suffix('.png'))
    assert image.size==(2048,2048);assert len(meta['frames'])==560
    assert image.getchannel('A').getextrema()==(0,255)
    for entry in meta['frames'].values():
        f=entry['frame'];assert f['x']+f['w']<=2048 and f['y']+f['h']<=2048
    assert hashlib.sha256(atlas.with_suffix('.png').read_bytes()).hexdigest()==meta['meta']['sha256']
    print('PASS atlas: 560 frames, transparent, one 16 MiB texture')
else: print('PENDING atlas export')
