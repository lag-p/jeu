"""Publish each completed raw raster once: reflected projection, premultiplied AA.
No Blender invocation. Existing successful final PNGs are never rewritten.
"""
import json
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
ROOT=Path(__file__).resolve().parents[3]; OUT=ROOT/'assets/art-v2'
def publish(src,dst):
    if dst.exists():
        with Image.open(dst) as im:im.verify()
        return
    with Image.open(src) as raw:
        im=ImageOps.mirror(raw.convert('RGBA'))
        im=im.convert('RGBa').resize((max(1,im.width//2),max(1,im.height//2)),Image.Resampling.LANCZOS).convert('RGBA')
        im.save(dst,optimize=True)
meta=json.loads((OUT/'source/export-metadata.json').read_text())
for e in meta['layers']:
    for mood,filename in e['images'].items():
        dst=ROOT/filename;publish(dst.with_name(dst.stem+'-raw.png'),dst)
    with Image.open(ROOT/e['images']['day']) as im:
        oldw=e['width'];e['width'],e['height']=im.size;e['scale']*=oldw/im.width
    e['bytes']={m:(ROOT/f).stat().st_size for m,f in e['images'].items()}
    e['depth']='ground' if e['category']=='ground' else 'front-edge-columns' if e['category'] in ['facade','wall'] else 'anchor'
    e['projection']={'tileWidth':7.2,'tileHeight':4.2,'reflected':True}
manifest=dict(version=2,mapId=meta['mapId'],generator='2.6B.2',scale=json.loads((Path(__file__).parent/'scene-spec.json').read_text())['scale'],layers=meta['layers'])
manifest_path=OUT/'manifest.json'
manifest_text=json.dumps(manifest,indent=2)+'\n'
if manifest_path.exists():
    assert manifest_path.read_text()==manifest_text,'Existing manifest differs; inspect before replacing'
else:
    manifest_path.write_text(manifest_text)
for mood in ['day','dusk','night']:
    src=OUT/'previews'/('full-'+mood+'-raw.png')
    if src.exists():publish(src,OUT/'previews'/('full-'+mood+'.png'))
ref=ROOT/'references/neighborhood-target.jpeg';final=OUT/'previews/full-night.png';compare=OUT/'previews/reference-vs-night.png'
if final.exists() and not compare.exists():
    canvas=Image.new('RGB',(1600,1500),'#121d29');d=ImageDraw.Draw(canvas)
    for p,x,title in [(ref,0,'Reference fournie'),(final,730,'Reconstruction locale / cadrage complet')]:
        with Image.open(p) as im:
            im.thumbnail((710 if x==0 else 860,1440));canvas.paste(im,(x+(710-im.width)//2 if x==0 else x,50))
        d.text((x+16,16),title,fill='white')
    canvas.save(compare)
print(json.dumps(dict(layers=len(meta['layers']),textureBytes=sum(sum(e['bytes'].values()) for e in meta['layers']))))
