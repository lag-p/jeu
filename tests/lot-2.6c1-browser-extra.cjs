const {chromium}=require('/tmp/jeu-validation/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'assets/art-v2/masters/captures-2.6c1/extra');
(async()=>{await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,args:['--no-sandbox']});try{

 for(const missing of [null,'assets/characters/people.png','assets/art-v2/masters/neighborhood-night-master-v1.png']){const width=390,height=844;
 const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let seed=42;Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);});
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!=='http://jeu.test'){remote.push(u.href);return route.abort();}const p=u.pathname.slice(1)||'index.html';if(missing&&p===missing)return route.fulfill({status:404,body:''});try{let body=await fs.readFile(path.join(root,p));if(p==='config.js')body=Buffer.from(body.toString().replace('const DEBUG = false','const DEBUG = true'));await route.fulfill({body,contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.png')?'image/png':p.endsWith('.json')?'application/json':p.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404,body:''});}});
 await page.goto('http://jeu.test/');await page.locator('#newGame').tap();await page.locator('#configureDayButton').tap();await page.waitForFunction(()=>PhaserMapRenderer.scene?.staticBuilt);
 await page.evaluate(()=>{document.querySelector('.rendererMenu').open=false;});

 const sceneState=await page.evaluate(()=>({master:PhaserMapRenderer.scene.masterActive,atlas:PhaserMapRenderer.scene.visuals.get('player:player').atlas}));
 if(missing){
  assert.equal(sceneState.master,!missing.includes('masters'));assert.equal(sceneState.atlas,!missing.includes('characters'));
  assert.equal(await page.evaluate(()=>{const s=PhaserMapRenderer.scene;if(!s.masterActive)return s.staticObjects.every(o=>o.texture?.key!=='master-day');const v=s.visuals.get('player:player');return v.character&&v.body.type==='Graphics';}),true);
  await page.evaluate(()=>{const p=mapData.fallbackPoints[0];finishStartPointPlacement(p.x,p.y);clearWaitingCustomers();game.clock.paused=true;requestPlayerMovement(mapData.entries[4]);PhaserMapRenderer.scene.sync();});
  assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,missing.includes('characters')?'fallback-character.png':'fallback-master.png')});
  console.log('PASS missing asset fallback',missing);await context.close();continue;
 }
 const alpha=await page.evaluate(()=>{const image=PhaserMapRenderer.scene.textures.get('people').getSourceImage(),c=document.createElement('canvas');c.width=image.width;c.height=image.height;const g=c.getContext('2d');g.drawImage(image,0,0);const data=g.getImageData(0,0,c.width,c.height).data;let transparent=0,opaque=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)transparent++;if(data[i]===255)opaque++;}return {transparent,opaque};});assert.ok(alpha.transparent>500000&&alpha.opaque>10000);
 await page.evaluate(()=>{const p=mapData.fallbackPoints[0];finishStartPointPlacement(p.x,p.y);clearWaitingCustomers();game.events=[];police.patrols=[];police.alerts=[];police.activeOperation=null;police.plannedOperation=null;game.customerSpawnRemaining=999;for(let i=0;i<4;i++){const c=createCustomer();Object.assign(c,nearestWalkable(rasterPoint(440+i*35,834-i*18)));c.id='skin-'+i;setCustomerDestination(c,rasterPoint(685,705));}game.clock.paused=true;});
 const animation=await page.evaluate(()=>{const s=PhaserMapRenderer.scene,before=customers.map(c=>({x:c.x,y:c.y}));s.sync();const variants=[...new Set(customers.map(c=>s.visuals.get('customer:'+c.id).body.frame.name.split('-')[0]))];const a=s.visuals.get('customer:'+customers[0].id).body.frame.name;game.clock.paused=false;updateSimulation(.125);game.clock.paused=true;s.sync();const b=s.visuals.get('customer:'+customers[0].id).body.frame.name;return {variants,a,b,moving:customers.every((c,i)=>rasterDistance(before[i],c)>0)};});assert.equal(animation.variants.length,4);assert.notEqual(animation.a,animation.b);assert.ok(animation.moving);
 // Actual masked columns, front and rear, on walkable points near multiple facades.
 const pairs=[['CENTRAL',[650,511.53333333333336],[520,790]],['EAST_REAR',[794.2857142857141,577.4285714285716],[760,674]],['SOUTH_W',[120.5,946],[300,1420]],['COURT_N_WALL',[310,527.6363636363636],[300,608]],['TREE_COURT_N',[471.25,536.25],[375,584]]];
 const occlusions=[];
 for(const [id,back,front] of pairs)for(const [side,point] of [['behind',back],['front',front]]){
  const state=await page.evaluate(({id,point})=>{const q=rasterPoint(...point);game.playerX=q.x;game.playerY=q.y;game.playerDestination=null;const s=PhaserMapRenderer.scene;s.zoomTo(2.4);s.centerOnWorld(q);s.sync();const visual=s.visuals.get('player:player'),bands=s.masterPairs.filter(p=>p.frame.startsWith(id+'-')&&p.base.visible&&p.base.depth>visual.container.depth&&p.base.mask);return {walkable:isWalkable(q),reasons:masterOcclusionReasons(q,s.masterConfig),bands:bands.length};},{id,point});
  assert.ok(state.walkable,JSON.stringify({id,point}));assert.equal(state.reasons.some(r=>r.endsWith(':'+id)),side==='behind');if(side==='behind')assert.ok(state.bands>0,id);
  await page.screenshot({path:path.join(out,id+'-'+side+'.png')});occlusions.push({id,side,...state});
 }
 // Long routes across the entire quarter, shown directly over the surveyed roads.
 for(const [i,j] of [[0,4],[2,3],[5,1]]){
  const route=await page.evaluate(({i,j})=>{const from=mapData.entries[i],to=mapData.entries[j];game.playerX=from.x;game.playerY=from.y;game.playerDestination={x:to.x,y:to.y};playerMapEntity.navKey=null;moveMapEntity(playerMapEntity,game.playerDestination,0,9);const s=PhaserMapRenderer.scene;s.masterDebug=true;if(!s.masterDebugGraphic)drawMasterDebug(s);s.fitInitialCamera();s.sync();return {length:playerMapEntity.navRoute.length,from:rasterPixel(from),to:rasterPixel(to)};},{i,j});assert.ok(route.length>20);await page.screenshot({path:path.join(out,`long-route-${i}-${j}.png`)});
 }
 // Switching repeatedly releases all objects and preserves the save.
 await page.evaluate(()=>{const s=PhaserMapRenderer.scene;s.masterDebug=false;s.masterDebugGraphic?.setVisible(false);s.sync();});
 const switches=await page.evaluate(()=>{const save=JSON.stringify(createSaveSnapshot()),s=PhaserMapRenderer.scene,counts=[];for(let i=0;i<3;i++){PhaserMapRenderer.setHousingMode('procedural');if(s.masterActive)throw Error('mixed fallback');PhaserMapRenderer.setHousingMode('asset');s.sync();counts.push(s.staticObjects.length);}return {unchanged:save===JSON.stringify(createSaveSnapshot()),counts};});assert.ok(switches.unchanged);assert.equal(new Set(switches.counts).size,1);
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify({passed:true,alpha,animation,occlusions,switches,errors,remote},null,2)+'\n');
 console.log('PASS transparency, live animation, actual occlusion bands, long routes and switch cleanup');await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
