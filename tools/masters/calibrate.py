"""Reviewed ground landmarks, piecewise affine mesh; never edits simulation geometry."""
import json,pathlib
spec=json.loads(pathlib.Path('tools/blender/neighborhood/scene-spec.json').read_text())

# Corresponding ground corners in source pixels, clockwise in world order.
feet={
'NORTH_W':[[450,390],[504,410],[152,580],[98,550]],
'NORTH_E':[[675,425],[1040,594],[983,623],[618,453]],
'CENTRAL':[[658,620],[720,650],[204,920],[142,890]],
'EAST_REAR':[[1080,690],[1135,720],[841,713],[786,685]],
'SOUTH_W':[[110,1045],[306,1333],[251,1363],[57,1073]],
'SOUTH_E':[[644,965],[986,1137],[934,1167],[592,995]],
'FRONT_E':[[1000,1260],[1052,1290],[714,1470],[661,1438]]}
points=[]; zones=[]
for b in spec['buildings']:
 f=feet[b['id']]; x,y,w,h=[b[k] for k in ['x','y','width','height']]; world=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]
 for i,(p,q) in enumerate(zip(world,f)):points.append({'id':b['id']+'-'+str(i),'world':p,'image':q})
 elevation=122 if b['floors']==5 else 120
 roof=[[p[0],p[1]-elevation] for p in f]
 # Silhouette follows the roof's back edges and the front ground edge.
 zones.append({'id':b['id'],'category':'building','polygon':[roof[0],roof[1],f[1],f[2],f[3],roof[3]],'ground':[f[1],f[2],f[3]]})
# Visible crossings and stair endpoints constrain the spaces between the blocks.
for name,p,q in [
 ('north-crossing',[11,7],[168,310]),('west-access',[13,44],[35,620]),
 ('mid-stair-top',[35,52],[268,905]),('mid-stair-bottom',[35,61],[255,975]),
 ('front-stair-top',[48,81],[383,1460]),('front-stair-bottom',[48,88],[343,1545]),
 ('front-road-west',[29,91],[80,1435]),('front-road-east',[91,94],[810,1690]),
 ('north-road',[30,3],[738,367])]:pass # Additional landmarks reserved for independent residual checks.
# Boundary extrapolation. East of the raster is deliberately a procedural extension.
for i,(p,q) in enumerate([([0,0],[400,-600]),([100,0],[2300,400]),([100,100],[800,2500]),([0,100],[-1600,1300])]):points.append({'id':'boundary-'+str(i),'world':p,'image':q})
# Bowyer-Watson triangulation in world coordinates, deterministic order.
xy=[p['world'] for p in points]+[[-1000,-1000],[3000,-1000],[-1000,3000]]; n=len(points); triangles=[(n,n+1,n+2)]
def area(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def inside(t,p):
 a,b,c=[xy[i] for i in t]; ax,ay=a[0]-p[0],a[1]-p[1]; bx,by=b[0]-p[0],b[1]-p[1]; cx,cy=c[0]-p[0],c[1]-p[1]
 d=(ax*ax+ay*ay)*(bx*cy-cx*by)-(bx*bx+by*by)*(ax*cy-cx*ay)+(cx*cx+cy*cy)*(ax*by-bx*ay)
 return d*area(a,b,c)>1e-7
for i in range(n):
 bad=[t for t in triangles if inside(t,xy[i])]; edges={}
 for t in bad:
  for a,b in zip(t,(t[1],t[2],t[0])):
   e=tuple(sorted((a,b)));edges[e]=edges.get(e,0)+1
 triangles=[t for t in triangles if t not in bad]+[(a,b,i) for (a,b),count in edges.items() if count==1 and abs(area(xy[a],xy[b],xy[i]))>1e-7]
triangles=[t for t in triangles if max(t)<n]
def valid(t):
 return area(*[points[i]['world'] for i in t])*area(*[points[i]['image'] for i in t])>1e-5
for attempt in range(1000):
 changed=False
 for t in list(triangles):
  if valid(t):continue
  for u in list(triangles):
   shared=set(t)&set(u)
   if len(shared)!=2:continue
   a,b=shared;c=next(i for i in t if i not in shared);d=next(i for i in u if i not in shared)
   # Only a convex quadrilateral can be flipped in world space.
   if area(xy[c],xy[d],xy[a])*area(xy[c],xy[d],xy[b])>=0:continue
   alt=[(c,d,a),(c,d,b)]
   if sum(valid(v) for v in alt)>int(valid(t))+int(valid(u)):
    triangles.remove(t);triangles.remove(u);triangles.extend(alt);changed=True;break
  if changed:break
 if not changed:break
invalid=[t for t in triangles if area(*[points[i]['world'] for i in t])*area(*[points[i]['image'] for i in t])<=0]
print('triangles',len(triangles),'inversions',[[points[i]['id'] for i in t] for t in invalid])
assert not invalid, 'A folded calibration must never be published'
zones.extend([
 {'id':'wall-mid','category':'wall','polygon':[[294,978],[593,830],[594,884],[294,1032]],'ground':[[294,1032],[594,884]]},
 {'id':'wall-court','category':'wall','polygon':[[306,1004],[660,1234],[660,1284],[306,1054]],'ground':[[306,1054],[660,1284]]},
 {'id':'wall-front-west','category':'wall','polygon':[[0,1356],[323,1462],[309,1544],[0,1439]],'ground':[[0,1439],[309,1544]]},
 {'id':'wall-front-east','category':'wall','polygon':[[393,1500],[632,1592],[631,1666],[372,1567]],'ground':[[372,1567],[631,1666]]},
 {'id':'crown-central','category':'tree','polygon':[[445,480],[470,451],[505,464],[548,494],[557,526],[539,549],[504,557],[466,535]],'ground':[[445,586],[557,586]]},
 {'id':'crown-front','category':'tree','polygon':[[392,1315],[435,1281],[474,1298],[498,1345],[485,1380],[449,1398],[402,1367]],'ground':[[392,1450],[498,1450]]},
 {'id':'crown-court','category':'tree','polygon':[[475,1002],[501,976],[538,991],[557,1025],[539,1055],[501,1061],[472,1040]],'ground':[[472,1090],[557,1090]]}
])
config={'version':1,'sceneUnitsPerPixel':.5,'width':853,'height':1844,'points':points,'triangles':triangles,'occlusion':zones}
pathlib.Path('assets/art-v2/masters/calibration.json').write_text(json.dumps(config,indent=2)+'\n')
