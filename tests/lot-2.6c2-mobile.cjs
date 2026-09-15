// Targeted checkpoint checks; the road graph remains a separate review artifact.
const {chromium}=require('/tmp/jeu-validation/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/art-v2/masters/captures-2.6c2');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {for(const [width,height,missing] of [[390,844,null],[667,375,null],[320,568,null],[430,932,null],[390,844,'people.png']]){
  const name=`${width}x${height}${missing?'-fallback':''}`,context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{const u=new URL(route.request().url()),file=u.pathname.slice(1)||'index.html';requests.push(file);
   if(u.origin!=='http://jeu.test')throw Error('Remote asset');
   if(missing&&file==='assets/characters/v2/'+missing)return route.fulfill({status:404,body:''});
   try{const body=await fs.readFile(path.join(root,file));await route.fulfill({body,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.png')?'image/png':file.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:''});}
  });
  await page.goto('http://jeu.test/');await page.locator('#newGame').tap();await page.locator('#configureDayButton').tap();
  try { await page.waitForFunction(()=>PhaserMapRenderer.scene?.masterActive); }
  catch(error) {
   const diagnostic=await page.evaluate(()=>({renderer:PhaserMapRenderer.getDebugInfo(),scene:!!PhaserMapRenderer.scene,loading:PhaserMapRenderer.scene?.load?.isLoading()}));
   await fs.writeFile(path.join(out,`${name}-failure.json`),JSON.stringify({diagnostic,errors,requests},null,2)+'\n');
   throw new Error(`${error.message}\n${JSON.stringify({diagnostic,errors})}`);
  }
  const result=await page.evaluate(()=>{
   const s=PhaserMapRenderer.scene,c=s.cameras.main,p=mapData.fallbackPoints[0];finishStartPointPlacement(p.x,p.y);clearWaitingCustomers();game.clock.paused=true;s.sync();
   const snapshot=JSON.stringify(createSaveSnapshot()),checks=[];
   for(const zoom of [.001,99])for(const x of [-1e5,1e5])for(const y of [-1e5,1e5]){s.zoomTo(zoom);c.scrollX=x;c.scrollY=y;s.clampCamera();checks.push(c.scrollX>=0&&c.scrollY>=0&&c.scrollX+c.width/c.zoom<=s.bounds.width+1e-7&&c.scrollY+c.height/c.zoom<=s.bounds.height+1e-7);}
   s.fitInitialCamera();s.centerOnWorld(p);s.sync();const v=s.visuals.get('player:player');
   return {checks,unchanged:snapshot===JSON.stringify(createSaveSnapshot()),texture:v.body.texture.key,opaqueHeightEstimate:66*v.body.scaleY*c.zoom,min:s.rasterMinZoom(),bounds:s.bounds,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.ok(result.checks.every(Boolean));assert.ok(result.unchanged);assert.equal(result.texture,missing?'people':'people-v2');assert.ok(result.opaqueHeightEstimate>=32&&result.opaqueHeightEstimate<=40);assert.equal(result.overflow,false);
  for(const [mood,elapsed] of [['day',0],['dusk',480],['night',600]]){
   await page.evaluate(elapsed=>{game.dayElapsed=elapsed;PhaserMapRenderer.scene.sync();},elapsed);await page.screenshot({path:path.join(out,`${name}-${mood}.png`)});
  }
  await page.setViewportSize({width:height,height:width});await page.waitForTimeout(150);
  assert.ok(await page.evaluate(()=>{const s=PhaserMapRenderer.scene,c=s.cameras.main;return c.scrollX>=0&&c.scrollY>=0&&c.scrollX+c.width/c.zoom<=s.bounds.width+1e-7&&c.scrollY+c.height/c.zoom<=s.bounds.height+1e-7;}));
  assert.deepEqual(errors,[]);assert.ok(!requests.some(p=>p.includes('guide')||p.includes('references/')));
  await fs.writeFile(path.join(out,`${name}.json`),JSON.stringify({passed:true,result,errors,requests},null,2)+'\n');
  console.log('PASS camera, moods, character size, rotation, save immutability:',name);await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
