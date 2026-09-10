"""Independent geometry audit before game integration; no rendering."""
import json, collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
s=json.loads((Path(__file__).parent/'scene-spec.json').read_text())
obs=[dict(b,x=b['x']-.5,y=b['y']-.5,width=b['width']+1,height=b['height']+1) for b in s['buildings']]+s['walls']+s['obstacles']
def inside(p):
    x,y=p;v=s['perimeter'];c=False
    for a,b in zip(v,v[1:]+v[:1]):
        if (a['y']>y)!=(b['y']>y) and x<(b['x']-a['x'])*(y-a['y'])/(b['y']-a['y'])+a['x']:c=not c
    return c
def free(p):return inside(p) and not any(b['x']<=p[0]<=b['x']+b['width'] and b['y']<=p[1]<=b['y']+b['height'] for b in obs)
def edge(a,b):
    return all(free((a[0]+(b[0]-a[0])*i/20,a[1]+(b[1]-a[1])*i/20)) for i in range(21))
nodes={(x,y) for x in range(1,100,2) for y in range(1,100,2) if free((x,y))}
left=set(nodes);sizes=[]
while left:
    pending=[left.pop()];count=0
    while pending:
        p=pending.pop();count+=1
        for dx,dy in [(2,0),(-2,0),(0,2),(0,-2)]:
            q=(p[0]+dx,p[1]+dy)
            if q in left and edge(p,q):left.remove(q);pending.append(q)
    sizes.append(count)
points=s['entries']+s['buildingEntries']+s['zones']+s['fallbackPoints']+s['pointsOfInterest']
assert all(free((p['x'],p['y'])) for p in points)
report=dict(buildings=len(s['buildings']),decor=len(s['decor']),nodes=len(nodes),components=sorted(sizes,reverse=True),allFunctionalPointsWalkable=True)
(ROOT/'assets/art-v2/source/navigation-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
