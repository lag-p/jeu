"""Deterministic, local colour variants. Geometry remains the native 909x1536."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/art-v2/masters'
SOURCE = ROOT / 'references/lot-2.6c2/neighborhood-day-expanded-v2.png'
SCALE = 1536 / 1844

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    day = Image.open(SOURCE).convert('RGB')
    assert day.size == (909, 1536)
    old = Image.open(OUT / 'neighborhood-day-master-v1.png').convert('RGB')
    reference = ImageStat.Stat(old).mean
    manifest = dict(version=2, mapId='RASTER_QUARTER_V1', width=909, height=1536,
                    sceneUnitsPerPixel=0.5/SCALE, images={},
                    geometry='Identical source samples; channel LUT only, no resampling',
                    oldToExpanded=dict(scale=SCALE, translationOldPixels=[120,-2]),
                    sourceSha256=digest(SOURCE), decodedBytes=909*1536*4*3)
    for mood in ['day','dusk','night']:
        ref = ImageStat.Stat(Image.open(OUT / f'neighborhood-{mood}-master-v1.png').convert('RGB')).mean
        gains = [min(1, b/a) for a,b in zip(reference,ref)] if mood != 'day' else [1,1,1]
        # Monotone channel maps preserve geometry, gradients and edge positions.
        lut = [round(value*g) for g in gains for value in range(256)]
        result = day.point(lut).convert('RGBA')
        path = OUT / f'neighborhood-{mood}-expanded-v2.png'
        assert not path.exists(), f'Refusing to regenerate {path}'
        result.save(path)
        manifest['images'][mood] = dict(image=str(path.relative_to(ROOT)),width=909,height=1536,
                                        bytes=path.stat().st_size,sha256=digest(path),gains=gains)
    (OUT/'manifest-expanded-v2.json').write_text(json.dumps(manifest,indent=2)+'\n')
    calibration=json.loads((OUT/'calibration.json').read_text())
    calibration.update(version=2,width=909,height=1536,sceneUnitsPerPixel=.5/SCALE)
    def transform(p): return [(p[0]+120)*SCALE,(p[1]-2)*SCALE]
    for point in calibration['points']: point['image']=transform(point['image'])
    for zone in calibration['occlusion']:
        for field in ['polygon','ground']: zone[field]=list(map(transform,zone[field]))
    (OUT/'calibration-expanded-v2.json').write_text(json.dumps(calibration,indent=2)+'\n')
    print(json.dumps(manifest,indent=2))

if __name__ == '__main__': main()
