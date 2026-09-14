"""Read-only checkpoint and PNG validation; never extracts or recalibrates."""
import ast, hashlib, json, pathlib, sys
root = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'tools/masters'))
from extract import inspect
manifest = json.loads((root / 'assets/art-v2/masters/manifest.json').read_text())
assert manifest['mapId'] == 'REFERENCE_QUARTER_V1'
for mood in ('day', 'dusk', 'night'):
    entry = manifest['images'][mood]
    raw = (root / entry['image']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == entry['sha256']
    assert len(raw) == entry['bytes']
    w, h, _, rows = inspect(raw)
    assert (w, h) == (853, 1844) == (entry['width'], entry['height'])
    assert entry['image'] == f'assets/art-v2/masters/neighborhood-{mood}-master-v1.png'
    if entry['sourceHeight'] == 1843:
        assert rows[-1] == rows[-2] and entry['normalization'] == 'duplicate last row'
    else:
        assert entry['sourceSha256'] == entry['sha256']
    print('PASS PNG CRC, dimensions, hash, normalization:', mood)
ast.parse((root / 'tools/masters/calibrate.py').read_text())
c = json.loads((root / 'assets/art-v2/masters/calibration.json').read_text())
def area(v):
    a,b,c=v
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
assert len(c['points']) == 32 and len(c['triangles']) == 58
assert all(area([c['points'][i]['world'] for i in t])*area([c['points'][i]['image'] for i in t]) > 0 for t in c['triangles'])
assert abs(sum(abs(area([c['points'][i]['world'] for i in t]))/2 for t in c['triangles'])-10000) < 1e-8
print('PASS complete Python AST, checkpoint topology: 58 triangles, 0 inversions, world coverage')
