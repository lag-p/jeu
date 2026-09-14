// Deterministic local atlas: shared articulated orthographic human model.
// No map texture is read or modified. Four directions, idle + four walking poses.
const {chromium}=require(process.env.JEU_PLAYWRIGHT||'/tmp/jeu-validation/node_modules/playwright');
const fs=require('node:fs/promises');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
const page=await browser.newPage();const output=await page.evaluate(()=>{
 const roles=['player','customer0','customer1','customer2','customer3','vendeur','guetteur','gerant','ravitailleur','police'];
 const clothes=['#dce7df','#af684c','#567b85','#a083a7','#819469','#bb864e','#647568','#484e62','#6583a1','#283e5a'];
 const skins=['#c58c67','#8c5c45','#e2b392','#b17d59','#d9a078','#b57b53','#e4b390','#956246','#b5805e','#d1a180'];
 const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=960;const g=canvas.getContext('2d');
 function limb(a,b,r,color){g.lineCap='round';g.strokeStyle='#263037';g.lineWidth=r*2+1.1;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();const grad=g.createLinearGradient(a[0]-r,a[1],a[0]+r,a[1]);grad.addColorStop(0,color);grad.addColorStop(1,'#36434c');g.strokeStyle=grad;g.lineWidth=r*2;g.stroke();}
 function oval(p,rx,ry,color){const grad=g.createRadialGradient(p[0]-rx*.35,p[1]-ry*.4,1,p[0],p[1],Math.max(rx,ry));grad.addColorStop(0,color);grad.addColorStop(1,'#4c4945');g.fillStyle=grad;g.beginPath();g.ellipse(p[0],p[1],rx,ry,0,0,Math.PI*2);g.fill();g.strokeStyle='#344049';g.lineWidth=.7;g.stroke();}
 const frames={};
 for(let row=0;row<roles.length;row++)for(let dir=0;dir<4;dir++)for(let frame=0;frame<5;frame++){
  const x=(dir*5+frame)*64,y=row*96;g.save();g.translate(x,y);
  const theta=[Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4][dir],walk=frame?Math.sin((frame-1)*Math.PI/2)*.7:0;
  const project=(a,b,z)=>[32+(a*Math.cos(theta)-b*Math.sin(theta))*18,82+(a*Math.sin(theta)+b*Math.cos(theta))*8-z*38];
  g.fillStyle='rgba(15,24,28,.22)';g.beginPath();g.ellipse(32,83,11,4,0,0,Math.PI*2);g.fill();
  const shapes=[];const bone=(a,b,r,color)=>shapes.push({depth:(a[0]+b[0])*Math.sin(theta)+(a[1]+b[1])*Math.cos(theta),draw:()=>limb(project(...a),project(...b),r,color)});
  for(const side of [-1,1]){const sway=walk*side;bone([side*.19,0,.87],[side*.2,sway*.34,.45],3.4,'#394452');bone([side*.2,sway*.34,.45],[side*.21,sway*.6,.10],2.8,'#4a5462');bone([side*.21,sway*.6,.1],[side*.21,sway*.6+.16,.06],3,'#293039');}
  const torso=()=>{const pts=[project(-.34,0,1.45),project(.34,0,1.45),project(.26,0,.87),project(-.26,0,.87)];g.fillStyle=clothes[row];g.strokeStyle='#303b42';g.lineWidth=1;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(...p):g.moveTo(...p));g.closePath();g.fill();g.stroke();limb(project(-.22,-.02,1.42),project(-.16,-.02,.94),1.7,clothes[row]);};
  for(const side of [-1,1]){const swing=-walk*side;bone([side*.36,0,1.38],[side*.43,swing*.28,1.1],2.5,clothes[row]);bone([side*.43,swing*.28,1.1],[side*.4,swing*.5,.89],1.9,skins[row]);}
  shapes.sort((a,b)=>a.depth-b.depth);for(const s of shapes.filter(s=>s.depth<0))s.draw();torso();for(const s of shapes.filter(s=>s.depth>=0))s.draw();
  const neck=project(0,0,1.49),head=project(0,0,1.67);limb(neck,head,2.6,skins[row]);oval(head,5.9,7.2,skins[row]);
  g.fillStyle=row===7?'#40322d':'#2e2a29';g.beginPath();g.ellipse(head[0],head[1]-4,6,3.8,0,Math.PI,Math.PI*2);g.fill();
  if(dir<2){g.fillStyle='#35312d';g.fillRect(head[0]+(dir===0?2:-3),head[1]-1,1,1.5);}
  else {g.fillStyle='#322e2d';g.beginPath();g.ellipse(head[0],head[1]-1,5.6,5.1,0,0,Math.PI*2);g.fill();}
  if(roles[row]==='police'){g.fillStyle='#253b58';g.beginPath();g.ellipse(head[0],head[1]-6,6.7,2.7,0,0,Math.PI*2);g.fill();g.fillStyle='#c8d4dc';const badge=project(.13,.02,1.29);g.fillRect(badge[0]-1,badge[1]-1,2,3);}
  if(roles[row]==='ravitailleur'){const bag=project(-.38,-.03,1);oval(bag,4,6,'#a17b50');}
  g.restore();frames[`${roles[row]}-${dir}-${frame}`]={frame:{x,y,w:64,h:96},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:64,h:96},sourceSize:{w:64,h:96}};
 }
 return {png:canvas.toDataURL('image/png').split(',')[1],json:{frames,meta:{image:'people.png',size:{w:1280,h:960},scale:'1',roles,directions:['SE','SW','NW','NE'],poses:['idle','walk0','walk1','walk2','walk3'],source:'deterministic-shared-articulated-model-v1'}}};
});await fs.mkdir('assets/characters',{recursive:true});await fs.writeFile('assets/characters/people.png',Buffer.from(output.png,'base64'));await fs.writeFile('assets/characters/people.json',JSON.stringify(output.json,null,2)+'\n');console.log('PASS atlas generated: 10 appearances, 4 directions, 5 poses, 200 frames, transparent RGBA');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
