"""Independent edge-patch measurements between masters; source pixels, no registration warp."""
import json,pathlib,sys,math
sys.path.insert(0,str(pathlib.Path(__file__).parent));from extract import inspect
root=pathlib.Path('assets/art-v2/masters'); images={}
for mood in ('day','dusk','night'):
 w,h,chunks,rows=inspect((root/f'neighborhood-{mood}-master-v1.png').read_bytes());bpp=len(rows[0])//w
 def lum(x,y):
  return sum(rows[y][x*bpp:x*bpp+3])/3
 # Signed differences remove much of the exposure change.
 images[mood]=[[lum(x+1,y)-lum(x-1,y) for x in range(1,w-1)] for y in range(h)]
landmarks={'north-roof':[450,274],'central-roof':[659,500],'south-roof':[59,951],'front-roof':[714,1295],'crossing':[164,321],'stairs':[350,1507],'wall':[407,1125],'road':[295,1373]}
report={}
for name,(x,y) in landmarks.items():
 report[name]={'day':[x,y]}
 for mood in ('dusk','night'):
  best=(-2,None)
  for dy in range(-6,7):
   for dx in range(-6,7):
    a=[];b=[]
    for sy in range(y-10,y+11,2):
     for sx in range(x-10,x+11,2):a.append(images['day'][sy][sx-1]);b.append(images[mood][sy+dy][sx+dx-1])
    score=sum(u*v for u,v in zip(a,b))/(math.sqrt(sum(u*u for u in a)*sum(v*v for v in b)) or 1)
    if score>best[0]:best=(score,[dx,dy])
  report[name][mood]={'shift':best[1],'edgeCorrelation':round(best[0],3)}
(root/'alignment.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
