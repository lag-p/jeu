from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[2]
im=Image.open(root/'references/lot-2.6c2/neighborhood-day-expanded-v2.png').convert('RGB')
d=ImageDraw.Draw(im)
for x in range(0,909,50):
    d.line((x,0,x,1536),fill='#00ffff',width=1)
    for y in range(0,1536,100):d.text((x+2,y+2),f'{x},{y}',fill='black',stroke_width=1,stroke_fill='white')
for y in range(0,1536,50):d.line((0,y,909,y),fill='#00ffff',width=1)
im.save(root/'assets/art-v2/masters/captures-2.6c2/survey-grid.png')
