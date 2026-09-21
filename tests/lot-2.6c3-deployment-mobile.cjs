const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('/tmp/jeu-validation/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/art-v2/masters/captures-2.6c3');
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
for(const [width,height] of [[320,568],[390,844],[430,932],[667,375]].filter(([w])=>!process.env.JEU_MOBILE_WIDTH||w===Number(process.env.JEU_MOBILE_WIDTH))){
 const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const file=new URL(route.request().url()).pathname.slice(1)||'index.html';try{await route.fulfill({body:await fs.readFile(path.join(root,file)),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:''});}});
 await page.goto('http://jeu.test/');await page.locator('#newGame').tap();await page.locator('#configureDayButton').tap();await page.waitForFunction(()=>PhaserMapRenderer.scene?.masterActive);
 await page.evaluate(()=>{document.querySelector('.rendererMenu').open=false;const p=nearestWalkable(ensurePersonalFallback()),e=createEmployee('vendeur',p.x,p.y);game.employees.push(e);normalizeEmployeePhysicalState(e);createEmployeeVisual(e);window.testSeller=e.id;selectEmployee(e);});
 if(!await page.locator('[data-employee-detail] > details').evaluate(e=>e.open)) await page.locator('[data-employee-detail] > details > summary').tap();
 const inputs=page.locator('[data-load-product]');for(let i=0;i<await inputs.count();i++)await inputs.nth(i).fill(i===0?'3':'0');
 await page.locator('[data-seller-preparation="load"]').tap();
 assert.equal(await page.evaluate(()=>getEmployeeById(testSeller).inventory['Produit A']),3);
 await page.locator('[data-seller-preparation="position"]').tap();
 const screen=await page.evaluate(()=>{const e=getEmployeeById(testSeller),s=PhaserMapRenderer.scene;
  const p=mapData.navigation.nodes.find(n=>isWalkable(n)&&mapDistance(n,e)>6&&mapDistance(n,e)<9);window.testGoal=p;s.zoomTo(2.4);s.centerOnWorld(p);s.sync();const q=worldToIsometric(p),c=s.cameras.main;return {x:(q.x-c.scrollX)*c.zoom,y:(q.y-c.scrollY)*c.zoom};});
 const box=await page.locator('#phaserMapCanvas').boundingBox();await page.touchscreen.tap(box.x+screen.x,box.y+screen.y);
 if(!await page.locator('[data-employee-detail] > details').evaluate(e=>e.open)) await page.locator('[data-employee-detail] > details > summary').tap();
 assert.ok(await page.evaluate(()=>!!getEmployeeById(testSeller).plannedSalesPosition));
 await page.locator('[data-seller-preparation="deploy"]').tap();
 const result=await page.evaluate(()=>{const e=getEmployeeById(testSeller),before={x:e.x,y:e.y},stock=getNetworkStock().total;closeMainPanel();
 for(let i=0;i<1200&&e.operationalState===EMPLOYEE_OPERATION.OUTBOUND;i++)updateSimulation(.1);
 const s=PhaserMapRenderer.scene;s.fitInitialCamera();s.sync();game.clock.paused=true;
 const v=s.visuals.get('employee:'+e.id),f=v.body.frame,canvas=document.createElement('canvas');canvas.width=f.cutWidth;canvas.height=f.cutHeight;
 const painter=canvas.getContext('2d');painter.drawImage(v.body.texture.getSourceImage(),f.cutX,f.cutY,f.cutWidth,f.cutHeight,0,0,f.cutWidth,f.cutHeight);
 const pixels=painter.getImageData(0,0,canvas.width,canvas.height).data;let top=canvas.height,bottom=-1;
 for(let i=3;i<pixels.length;i+=4)if(pixels[i]>128){const y=Math.floor(i/4/canvas.width);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 const actualHeight=(bottom-top+1)*v.body.scaleY*v.container.scaleY*s.cameras.main.zoom;
 return {actualHeight,arrived:e.operationalState===EMPLOYEE_OPERATION.AT_POST,moved:mapDistance(before,e)>0,stock,stockAfter:getNetworkStock().total,dayElapsed:game.dayElapsed,noAvatar:!s.visuals.has('player:player'),overflow:document.documentElement.scrollWidth>innerWidth};});
 assert.ok(result.arrived&&result.moved&&result.noAvatar);assert.ok(result.actualHeight>=20&&result.actualHeight<=28,JSON.stringify(result));assert.equal(result.stock,result.stockAfter);assert.equal(result.dayElapsed,0);assert.equal(result.overflow,false);
 await page.screenshot({path:path.join(out,`deployment-${width}x${height}-initial.png`)});
 // Touch selection must consume the gesture, without issuing a movement order.
 const touch=await page.evaluate(()=>{const e=getEmployeeById(testSeller),s=PhaserMapRenderer.scene;s.zoomTo(2.4);s.centerOnWorld(e);s.sync();const p=worldToIsometric(e),c=s.cameras.main;selectedEmployeeId=null;window.orderCalls=0;const original=requestSelectedEmployeeMove;requestSelectedEmployeeMove=p=>{orderCalls++;return original(p);};return {x:(p.x-c.scrollX)*c.zoom,y:(p.y-c.scrollY)*c.zoom-5};});
 await page.screenshot({path:path.join(out,`deployment-${width}x${height}-seller.png`)});
 await page.touchscreen.tap(box.x+touch.x,box.y+touch.y);await page.locator('#employeesPanel.visible').waitFor();assert.equal(await page.evaluate(()=>selectedEmployeeId),await page.evaluate(()=>testSeller));assert.equal(await page.evaluate(()=>orderCalls),0);
 await page.evaluate(()=>closeMainPanel());
 const cdp=await ctx.newCDPSession(page),cx=box.x+box.width/2,cy=box.y+box.height/2;
 for(const [type,points] of [['touchStart',[{x:cx-30,y:cy,id:1},{x:cx+30,y:cy,id:2}]],['touchMove',[{x:cx-60,y:cy,id:1},{x:cx+60,y:cy,id:2}]],['touchEnd',[]]])await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
 await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+50,cy+25,{steps:5});await page.mouse.up();assert.equal(await page.evaluate(()=>orderCalls),0);
 await page.locator('#centerPlayer').tap();
 await page.evaluate(()=>{game.dayElapsed=game.dayDuration*.95;PhaserMapRenderer.scene.sync();});await page.screenshot({path:path.join(out,`deployment-${width}x${height}-night.png`)});
 if(width===390){
  for(const category of ['facade','wall','tree']){
   const occlusion=await page.evaluate(category=>{const s=PhaserMapRenderer.scene,e=getEmployeeById(testSeller);
    const p=mapData.navigation.nodes.find(n=>masterOcclusionReasons(n,s.masterConfig).some(r=>r.startsWith(category+':')));
    if(!p)return null;Object.assign(e,{x:p.x,y:p.y});s.zoomTo(2.4);s.centerOnWorld(e);s.sync();
    const reason=masterOcclusionReasons(e,s.masterConfig).find(r=>r.startsWith(category+':')),id=reason.split(':')[1],v=s.visuals.get('employee:'+e.id);
    return {reason,masked:s.masterPairs.some(pair=>pair.frame.startsWith(id+'-')&&pair.base.visible&&pair.base.depth>v.container.depth)};
   },category);
   assert.ok(occlusion?.masked,JSON.stringify(occlusion));await page.screenshot({path:path.join(out,`occlusion-${category}-v3.png`)});
  }
 }
 await page.evaluate(()=>PhaserMapRenderer.setMode('classic'));assert.equal(await page.evaluate(()=>PhaserMapRenderer.isActive()),false);
 await page.evaluate(()=>PhaserMapRenderer.setMode('isometric'));await page.waitForFunction(()=>PhaserMapRenderer.scene?.masterActive);
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,`deployment-${width}x${height}.json`),JSON.stringify({passed:true,result,errors},null,2)+'\n');console.log('PASS deployment touch/pan/pinch',width,height);await ctx.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
