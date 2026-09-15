"""Compile stable vehicle graph and a review overlay from the manual survey."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/art-v2/masters'
spec=json.loads((ROOT/'tools/masters/road-survey.json').read_text())
def point(p): return p
def key(p): return 'road-'+str(p[0])+'-'+str(p[1])
nodes={};edges=[]
for name,kind,points in spec['lines']:
    for p in points:
        nodes[key(p)]={'id':key(p),'x':point(p)[0],'y':point(p)[1],'exit':p in spec['exits']}
    for i,(a,b) in enumerate(zip(points,points[1:])):
        edges.append(dict(id=f'{name}-{i:02}',fromNode=key(a),toNode=key(b),type=kind,
                          direction='both',speedLimit=None,parking=kind=='parking-access',clearancePixels=4))
network=dict(version=2,status='validated-visible-carriageways',mapId='RASTER_QUARTER_V1',coordinateSystem='native-master-pixels',
             implemented=False,nodes=list(nodes.values()),connections=edges,
             exits=[key(p) for p in spec['exits']],terminals=[dict(node=key(t['point']),reason=t['reason']) for t in spec['terminals']],survey=spec)
(OUT/'vehicle-road-network.json').write_text(json.dumps(network,indent=2)+'\n')
im=Image.open(ROOT/'references/lot-2.6c2/neighborhood-day-expanded-v2.png').convert('RGB');draw=ImageDraw.Draw(im)
for edge in edges:
    a,b=nodes[edge['fromNode']],nodes[edge['toNode']]
    draw.line([(a['x'],a['y']),(b['x'],b['y'])],fill='#00ffff',width=3)
for n in nodes.values():
    x,y=n['x'],n['y'];draw.ellipse((x-3,y-3,x+3,y+3),fill='#ffdf00' if n['exit'] else '#ffffff')
im.save(OUT/'captures-2.6c2/road-review.png')
print('Compiled',len(nodes),'nodes and',len(edges),'edges')
