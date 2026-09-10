"""Validate exported PNGs and preserved recovery artifacts without rerendering."""
import json,hashlib
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1];out=root/'assets/art-v2';m=json.loads((out/'manifest.json').read_text())
assert m['version']==2 and m['mapId']=='REFERENCE_QUARTER_V1'
assert len(m['layers'])==21
ids=set();total=0;decoded=0
for e in m['layers']:
    assert e['id'] not in ids;ids.add(e['id']);assert len(e['pivot'])==2 and e['scale']>0
    assert e['footprint'] and e['projection']['reflected']
    dims=[]; hashes=[]
    for mood,p in e['images'].items():
        assert p.startswith('assets/art-v2/layers/') and '..' not in p
        f=root/p;assert f.is_file();total+=f.stat().st_size
        with Image.open(f) as im:
            assert im.mode=='RGBA';assert im.size==(e['width'],e['height']);assert max(im.size)<=2048
            alpha=im.getchannel('A').histogram();assert alpha[0]>0 and sum(alpha[1:])>0
            assert sum(alpha[1:255])>0,'antialiasing réel'
            dims.append(im.size);decoded+=im.width*im.height*4
        hashes.append(hashlib.sha256(f.read_bytes()).hexdigest())
    assert len(set(dims))==1
    assert len(set(hashes))>1,'états visuels distincts'
for item in json.loads((out/'source/resume-inventory.json').read_text()):
    # Navigation correction changes generated data only, never a completed asset.
    if item['path'].endswith(('blockout.blend','blockout-raw.png','camera.json','composition-plan.png')):
        assert hashlib.sha256((root/item['path']).read_bytes()).hexdigest()==item['sha256'],item['path']
for inventory in ['resume-inventory-20260909.json', 'resume-inventory-20260910.json']:
    for item in json.loads((out/'source'/inventory).read_text()):
        assert hashlib.sha256((root/item['path']).read_bytes()).hexdigest()==item['sha256'],item['path']
assert decoded<96*1024*1024
report=dict(layers=len(ids),files=len(ids)*3,pngBytes=total,decodedBytes=decoded,preservedRecoveryAssets=True)
(out/'source/asset-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('PASS assets 2.6B.2',report)
