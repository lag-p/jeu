const {chromium}=require('/tmp/jeu-validation/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/art-v2/masters/captures-2.6c1');
(async()=>{await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{
 const sizes=[[390,844],[667,375],[320,568],[430,932]].filter(([w])=>!process.env.JEU_MOBILE_WIDTH||+process.env.JEU_MOBILE_WIDTH===w);
 for(const [width,height] of sizes){
 if(process.env.JEU_RESUME==='1')try{const previous=JSON.parse(await fs.readFile(path.join(out,`mobile-${width}x${height}.json`),'utf8'));if(previous.passed){console.log('REUSED raster mobile',width,height);continue;}}catch{}
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let seed=42;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);});
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!=='http://jeu.test'){remote.push(u.href);return route.abort();}const p=u.pathname.slice(1)||'index.html';try{let body=await fs.readFile(path.join(root,p));if(p==='config.js')body=Buffer.from(body.toString().replace('const DEBUG = false','const DEBUG = true'));await route.fulfill({body,contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.png')?'image/png':p.endsWith('.json')?'application/json':p.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:''});}});
 await page.goto('http://jeu.test/');await page.locator('#newGame').tap();await page.locator('#configureDayButton').tap();await page.waitForFunction(()=>PhaserMapRenderer.scene?.masterActive);
 await page.evaluate(()=>{document.querySelector('.rendererMenu').open=false;});
 const screenshot=async name=>{const file=path.join(out,`${name}-${width}x${height}.png`);try{await fs.access(file);return;}catch{}await page.waitForTimeout(80);await page.screenshot({path:file});};
 const coverage=async()=>{
 const v=await page.evaluate(()=>{const s=PhaserMapRenderer.scene,c=s.cameras.main;return {zoom:c.zoom,min:s.rasterMinZoom(),x:c.scrollX,y:c.scrollY,right:c.scrollX+c.width/c.zoom,bottom:c.scrollY+c.height/c.zoom,oldGraphics:s.staticObjects.filter(o=>o.type==='Graphics'&&o.displayList&&!o.visible===false).length,overflow:document.documentElement.scrollWidth>innerWidth};});
 assert.ok(v.zoom+1e-8>=v.min&&v.x>=-1e-8&&v.y>=-1e-8&&v.right<=426.5+1e-7&&v.bottom<=922+1e-7,JSON.stringify(v));assert.equal(v.overflow,false);return v;
 };
 await page.evaluate(()=>PhaserMapRenderer.scene.zoomTo(.001));const min=await coverage();await screenshot('minimum-day');
 assert.equal(await page.evaluate(()=>PhaserMapRenderer.scene.staticObjects.some(o=>o.type==='Graphics'&&o.displayList)),false,'no procedural graphics below master');
 await page.evaluate(()=>PhaserMapRenderer.scene.zoomTo(99));assert.equal((await coverage()).zoom,2.4);
 for(const [x,y] of [[-1e5,-1e5],[-1e5,1e5],[1e5,-1e5],[1e5,1e5]]){await page.evaluate(({x,y})=>{const s=PhaserMapRenderer.scene;s.cameras.main.scrollX=x;s.cameras.main.scrollY=y;s.clampCamera();},{x,y});await coverage();}
 await page.locator('#centerPlayer').tap();assert.ok(Math.abs((await coverage()).zoom-min.min)<1e-7);
 await page.evaluate(()=>{
  const p=rasterPoint(360,878);finishStartPointPlacement(p.x,p.y);clearWaitingCustomers();game.clock.paused=false;game.events=[];police.patrols=[];police.alerts=[];police.activeOperation=null;police.plannedOperation=null;game.customerSpawnRemaining=999;
  for(let i=0;i<4;i++){const c=createCustomer(),p=rasterPoint(440+i*35,834-i*18);Object.assign(c,p);setCustomerDestination(c,rasterPoint(685,705));}
  game.clock.paused=true;const s=PhaserMapRenderer.scene;s.zoomTo(1.7);s.centerOnWorld(p);s.sync();window.moves=0;const move=requestPlayerMovement;requestPlayerMovement=p=>{moves++;return move(p);};
 });await screenshot('normal-skins');
 const skin=await page.evaluate(()=>{const v=PhaserMapRenderer.scene.visuals.get('player:player');return {atlas:v.atlas,key:v.body.texture.key,height:v.body.displayHeight,frame:v.body.frame.name};});assert.equal(skin.key,'people');assert.ok(skin.height<12);
 // Actual client tap consumes the gesture before any movement request.
 const touch=await page.evaluate(()=>{const c=customers[0],s=PhaserMapRenderer.scene;s.centerOnWorld(c);s.sync();const p=worldToIsometric(c),cam=s.cameras.main;return {x:(p.x-cam.scrollX)*cam.zoom,y:(p.y-cam.scrollY)*cam.zoom-5};});
 const box=await page.locator('#phaserMapCanvas').boundingBox();await page.touchscreen.tap(box.x+touch.x,box.y+touch.y);await page.locator('#customerPanel').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>moves),0);await page.evaluate(()=>closeCustomerPanel());
 // Actual route tap, then the same simulated time at x1 and x2.
 const road=await page.evaluate(()=>{const s=PhaserMapRenderer.scene,p=rasterPoint(205,962);s.centerOnWorld(p);s.sync();const q=worldToIsometric(p),c=s.cameras.main;return {x:(q.x-c.scrollX)*c.zoom,y:(q.y-c.scrollY)*c.zoom};});
 await page.touchscreen.tap(box.x+road.x,box.y+road.y);assert.equal(await page.evaluate(()=>moves),1);assert.ok(await page.evaluate(()=>game.playerDestination));
 const walk=await page.evaluate(()=>{const s=PhaserMapRenderer.scene,start=createSaveSnapshot();const before={x:game.playerX,y:game.playerY};game.clock.paused=false;game.clock.speed=1;updateSimulation(.5);const a={x:game.playerX,y:game.playerY};restoreSaveSnapshot(start);game.clock.paused=false;game.clock.speed=2;updateSimulation(.25);const b={x:game.playerX,y:game.playerY};game.clock.paused=true;s.sync();return {distance:rasterDistance(a,b),moved:rasterDistance(before,a)};});assert.ok(walk.distance<1e-7&&walk.moved>0);
 // Camera zoom must not mutate a save, pause included.
 assert.equal(await page.evaluate(()=>{const a=JSON.stringify(createSaveSnapshot()),s=PhaserMapRenderer.scene;s.zoomTo(2.4);for(let i=0;i<20;i++)s.sync();return a===JSON.stringify(createSaveSnapshot());}),true);
 const calls=await page.evaluate(()=>moves);
 await page.mouse.move(box.x+100,box.y+80);await page.mouse.down();await page.mouse.move(box.x+180,box.y+120,{steps:5});await page.mouse.up();await coverage();assert.equal(await page.evaluate(()=>moves),calls);
 const cdp=await context.newCDPSession(page),cx=box.x+box.width/2,cy=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-40,y:cy,id:1},{x:cx+40,y:cy,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-8,y:cy,id:1},{x:cx+8,y:cy,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await coverage();assert.equal(await page.evaluate(()=>moves),calls);
 // Long route around CENTRAL, graph + obstacle overlay uses the actual route.
 await page.evaluate(()=>{const p=rasterPoint(300,608);Object.assign(game,{playerX:p.x,playerY:p.y});game.playerDestination=rasterPoint(520,790);playerMapEntity.navKey=null;moveMapEntity(playerMapEntity,game.playerDestination,0,9);const s=PhaserMapRenderer.scene;s.masterDebug=true;drawMasterDebug(s);s.zoomTo(1.2);s.centerOnWorld(rasterPoint(400,740));s.sync();});await screenshot('route-around-central');
 await page.evaluate(()=>{const s=PhaserMapRenderer.scene;s.masterDebug=false;s.masterDebugGraphic?.setVisible(false);s.sync();});
 for(const [label,p] of [['front',[360,878]],['behind',[375,584]]]){await page.evaluate(p=>{const q=rasterPoint(...p);game.playerX=q.x;game.playerY=q.y;game.playerDestination=null;const s=PhaserMapRenderer.scene;s.zoomTo(2.4);s.centerOnWorld(q);s.sync();},p);await screenshot(`facade-${label}`);}
 await page.evaluate(()=>{game.dayElapsed=600;const s=PhaserMapRenderer.scene;s.fitInitialCamera();s.sync();});await coverage();await screenshot('minimum-night');
 await page.setViewportSize({width:height,height:width});await page.waitForTimeout(100);await coverage();await page.setViewportSize({width,height});await page.waitForTimeout(100);await coverage();
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 await fs.writeFile(path.join(out,`mobile-${width}x${height}.json`),JSON.stringify({width,height,passed:true,min,skin,walk,errors,remote},null,2)+'\n');console.log('PASS raster mobile',width,height);
 await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
