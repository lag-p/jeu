// Chromium réel, fichiers locaux uniquement. Gestes tactiles synthétiques CDP.
const { chromium } = require(process.env.JEU_PLAYWRIGHT || '/tmp/jeu-validation/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
async function captureOnce(page, name) {
    const target = path.join(root, 'assets/art-v2/masters/captures', name);
    await fs.mkdir(path.dirname(target), { recursive: true }); await page.screenshot({ path: target });
}
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const results = [];
    try {
        for (const [width, height] of [[390, 844], [667, 375], [320, 568], [430, 932]].filter(([w]) => !process.env.JEU_MOBILE_WIDTH || Number(process.env.JEU_MOBILE_WIDTH) === w)) {
            const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
            const page = await context.newPage(), errors = [], remote = []; const started=Date.now();
            await page.addInitScript(() => { let seed=42; Math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296); });
            page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR', error.message); });
            await page.route('**/*', async route => {
                const url = new URL(route.request().url());
                if (url.origin !== 'http://jeu.test') { remote.push(url.href); return route.abort(); }
                const name = url.pathname.slice(1) || 'index.html';
                try { await route.fulfill({ body: await fs.readFile(path.join(root, name)), contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : name.endsWith('.json') ? 'application/json' : 'text/html' }); }
                catch { await route.fulfill({ status: 404, body: '' }); }
            });
            await page.goto('http://jeu.test/');
            console.log('CHECK mobile loaded',width,height);
            await page.locator('#newGame').tap();
            console.log('CHECK new game',width,height);
            await page.locator('#configureDayButton').tap();
            await page.evaluate(async () => { await setMapRenderMode('isometric'); document.querySelector('.rendererMenu').open = false; });
            await page.waitForFunction(() => PhaserMapRenderer.isActive() && PhaserMapRenderer.scene.staticBuilt);
            await page.waitForTimeout(80);
            assert.equal(await page.evaluate(() => mapData.mapId), 'REFERENCE_QUARTER_V1');
            assert.equal(await page.locator('.rendererMenu').isVisible(),false);
            assert.equal(await page.evaluate(()=>PhaserMapRenderer.scene.assetBuildingIds.length),7);
            // Includes navigation construction and UI actions on this software-rendered host.
            // Record the budget separately so a slow host does not skip functional checks.
            const loadMs=Date.now()-started, loadBudgetMet=loadMs<30000;
            if (!loadBudgetMet) console.warn(`PERF initialisation ${loadMs} ms: budget indicatif 30 s dépassé`);
            assert.deepEqual(await page.evaluate(()=>PhaserMapRenderer.assetErrors),[]);
            assert.equal(await page.locator('[data-zoom]').first().isVisible(), false);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            const fitted = await page.evaluate(() => {
                const s=PhaserMapRenderer.scene,c=s.cameras.main;
                return {master:s.masterActive,left:-c.scrollX*c.zoom,right:(426.5-c.scrollX)*c.zoom,top:-c.scrollY*c.zoom,bottom:(922-c.scrollY)*c.zoom,width:c.width,height:c.height,staticCount:s.staticObjects.length,objects:s.children.list.length,textures:s.textures.getTextureKeys()};
            });
            assert.equal(fitted.master,true);
            assert.deepEqual(await page.evaluate(() => {
                const pair=PhaserMapRenderer.scene.masterPairs[0];
                return [pair.base.frame.name,pair.base.width,pair.base.height];
            }), ['__BASE',853,1844], 'full master survives addition of occlusion frames');
            assert.ok(fitted.left<=.1&&fitted.top<=.1&&fitted.right>=fitted.width-.1&&fitted.bottom>=fitted.height-.1,JSON.stringify(fitted));
            assert.deepEqual(fitted.textures.filter(k=>k.startsWith('master-')).sort(),['master-day','master-dusk','master-night']);
            assert.equal(fitted.textures.some(k=>k.startsWith('quarter-')),false);
            await captureOnce(page, `phaser-${width}x${height}.png`);
            await page.evaluate(() => {
                const home = createApartment('depot', 23, 17); home.inventory['Produit A'] = 20;
                const seller = createEmployee('vendeur', 34, 35); seller.assignment.apartmentId = home.id; seller.assignment.manual = true;
                game.employees.push(seller); createEmployeeVisual(seller); createSalesPoint(seller, 34, 35);
                game.playerPlaced = true; startDay(); clearWaitingCustomers();
                const c = createCustomer(); Object.assign(c, { x: 70, y: 69 });
                game.clock.paused = true; window.testIds = { seller: seller.id, customer: c.id, home: home.id };
                window.movementCalls = 0; window.selectionCalls = 0;
                const move = requestPlayerMovement, select = PhaserMapRenderer.select;
                requestPlayerMovement = p => { window.movementCalls++; return move(p); };
                PhaserMapRenderer.select = key => { window.selectionCalls++; return select.call(PhaserMapRenderer, key); };
                PhaserMapRenderer.scene.sync();
            });
            await page.locator('#speedTwo').tap();
            assert.equal(await page.evaluate(() => game.clock.speed), 2);
            await page.locator('#speedOne').tap();
            assert.equal(await page.evaluate(() => game.clock.speed), 1);
            await page.locator('#pauseTime').tap();
            await page.locator('#pauseTime').tap();
            assert.equal(await page.evaluate(() => game.clock.paused), true);
            const pausedTime = await page.evaluate(() => game.dayElapsed);
            await page.waitForTimeout(100);
            assert.equal(await page.evaluate(() => game.dayElapsed), pausedTime);
            const canvas = await page.locator('#phaserMapCanvas').boundingBox();
            async function focusEntity(kind) {
                await page.evaluate(kind => {
                    const entity = kind === 'customer' ? customers[0] : kind === 'employee' ? getEmployeeById(testIds.seller) : getApartmentById(testIds.home);
                    const s = PhaserMapRenderer.scene; s.zoomTo(1.4); s.centerOnWorld(entity); s.sync();
                }, kind);
                await page.waitForTimeout(70);
                return page.evaluate(kind => {
                    const id = kind === 'customer' ? testIds.customer : kind === 'employee' ? testIds.seller : testIds.home;
                    const s = PhaserMapRenderer.scene, v = s.visuals.get(`${kind}:${id}`), c = s.cameras.main;
                    return { x: (v.hit.x - c.scrollX) * c.zoom, y: (v.hit.y - c.scrollY - 1) * c.zoom };
                }, kind);
            }
            for (const kind of ['customer', 'employee', 'apartment']) {
                // Séparer le vendeur de son domicile pour tester chaque cible.
                if (kind === 'employee') await page.evaluate(() => { Object.assign(getEmployeeById(testIds.seller), { x: 34, y: 35 }); });
                const target = await focusEntity(kind);
                const before = await page.evaluate(() => ({ moves: movementCalls, selects: selectionCalls, destination: game.playerDestination || null }));
                await page.touchscreen.tap(canvas.x + target.x, canvas.y + target.y);
                const panel = kind === 'customer' ? '#customerPanel' : kind === 'employee' ? '#employeesPanel' : '#logisticsPanel';
                await page.locator(panel).waitFor({ state: 'visible', timeout: 3000 });
                assert.deepEqual(await page.evaluate(() => ({ moves: movementCalls, selects: selectionCalls, destination: game.playerDestination || null })), { ...before, selects: before.selects + 1 }, kind);
                await page.evaluate(() => { closeCustomerPanel(); closeMainPanel(); });
            }
            // Rue vide réellement touchée dans le canvas.
            await page.evaluate(() => { const s = PhaserMapRenderer.scene; s.zoomTo(1.2); s.centerOnWorld({ x: 50, y: 50 }); });
            await page.waitForTimeout(70);
            const ground = await page.evaluate(() => {
                const s = PhaserMapRenderer.scene;
                for (let y = 45; y < s.scale.height - 20; y += 15) for (let x = 45; x < s.scale.width - 70; x += 15) {
                    const point = { x, y }, world = isoSceneToWorld(point, s.cameras.main);
                    if (!s.hitKeyAt(point) && isWalkable(world) && mapDistance(world, { x: game.playerX, y: game.playerY }) > 3) return point;
                }
                return null;
            });
            assert.ok(ground);
            let calls = await page.evaluate(() => movementCalls);
            await page.touchscreen.tap(canvas.x + ground.x, canvas.y + ground.y);
            assert.equal(await page.evaluate(() => movementCalls), calls + 1);
            assert.ok(await page.evaluate(() => Boolean(game.playerDestination)));
            assert.equal(await page.evaluate(() => { const start = { x: game.playerX, y: game.playerY }; game.clock.paused = false; updateSimulation(.2); game.clock.paused = true; return mapDistance(start, { x: game.playerX, y: game.playerY }) > 0; }), true);
            calls++;
            const beforePan = await page.evaluate(() => PhaserMapRenderer.scene.cameras.main.scrollX);
            await page.mouse.move(canvas.x + 50, canvas.y + 50); await page.mouse.down();
            await page.mouse.move(canvas.x + 110, canvas.y + 85, { steps: 5 }); await page.mouse.up();
            assert.notEqual(await page.evaluate(() => PhaserMapRenderer.scene.cameras.main.scrollX), beforePan);
            assert.equal(await page.evaluate(() => movementCalls), calls);
            const cdp = await context.newCDPSession(page);
            const beforeZoom = await page.evaluate(() => PhaserMapRenderer.scene.cameras.main.zoom);
            const cy = canvas.y + canvas.height / 2, cx = canvas.x + canvas.width / 2;
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 25, y: cy, id: 1 }, { x: cx + 25, y: cy, id: 2 }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 45, y: cy, id: 1 }, { x: cx + 45, y: cy, id: 2 }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            assert.ok(await page.evaluate(z => PhaserMapRenderer.scene.cameras.main.zoom > z, beforeZoom));
            assert.equal(await page.evaluate(() => movementCalls), calls);
            await page.locator('#centerPlayer').tap();
            // Bascule répétée : un geste ne doit jamais avoir deux consommateurs.
            for (let i = 0; i < 2; i++) {
                await page.evaluate(async () => { await setMapRenderMode('classic'); });
                await page.waitForFunction(() => !document.querySelector('#phaserMapCanvas'));
                await page.evaluate(async () => { await setMapRenderMode('isometric'); });
                await page.waitForFunction(() => PhaserMapRenderer.isActive());
                const target = await focusEntity('customer');
                const selects = await page.evaluate(() => selectionCalls);
                await page.touchscreen.tap(canvas.x + target.x, canvas.y + target.y);
                assert.equal(await page.evaluate(() => selectionCalls), selects + 1);
                assert.equal(await page.evaluate(() => movementCalls), calls);
                await page.evaluate(() => closeCustomerPanel());
            }
            const presentationState=await page.evaluate(()=>({playerX:game.playerX,playerY:game.playerY,dayElapsed:game.dayElapsed}));
            const visualChecks=await page.evaluate(()=>{
                const s=PhaserMapRenderer.scene;game.clock.paused=true;
                const before=JSON.stringify(createSaveSnapshot()),count=s.children.list.length, textures=s.textures.getTextureKeys();
                for(let i=0;i<120;i++)s.sync();
                const unchanged=before===JSON.stringify(createSaveSnapshot())&&count===s.children.list.length&&JSON.stringify(textures)===JSON.stringify(s.textures.getTextureKeys());
                const bounds=[.01,99].map(z=>{s.zoomTo(z);return s.cameras.main.zoom;});
                const times=[720,1140,1200,1290,1320].map(minute=>{game.dayElapsed=(minute-720)/720*game.dayDuration;s.sync();return {...s.neighborhoodMood};});
                let roundtrip=0;
                for(const node of mapData.navigation.nodes){const p=worldToIsometric(node),q=isometricToWorld(p);roundtrip=Math.max(roundtrip,mapDistance(node,q));}
                const zone=s.masterConfig.occlusion.find(z=>z.id==='CENTRAL');
                const x=400,y=masterGroundY(zone,x),front={x:x*.5,y:(y+4)*.5},behind={x:x*.5,y:(y-4)*.5};
                return {unchanged,bounds,times,roundtrip,front:front.y*100+60>y*.5*100+5,behind:behind.y*100+60<y*.5*100+5,textureCount:textures.length,staticCount:count};
            });
            assert.equal(visualChecks.unchanged,true);assert.deepEqual(visualChecks.bounds,[.2,2.4]);
            assert.ok(visualChecks.roundtrip<1e-7);assert.ok(visualChecks.front&&visualChecks.behind);
            assert.equal(visualChecks.times[0].base,'day');assert.equal(visualChecks.times[2].base,'dusk');assert.equal(visualChecks.times[4].base,'night');
            if(width===390){
                for(const [label,minute] of [['day',720],['dusk',1200],['night',1320]]){
                    await page.evaluate(minute=>{game.dayElapsed=(minute-720)/720*game.dayDuration;const s=PhaserMapRenderer.scene;s.fitInitialCamera();s.sync();},minute);
                    await page.waitForTimeout(80);await captureOnce(page,`master-${label}-390x844.png`);
                }
                for(const [label,x,y] of [['front',54,45],['behind',41,45]]){
                    await page.evaluate(({x,y})=>{game.playerX=x;game.playerY=y;game.dayElapsed=0;const s=PhaserMapRenderer.scene;s.zoomTo(2.4);s.centerOnWorld({x,y});s.sync();},{x,y});
                    await page.waitForTimeout(80);await captureOnce(page,`depth-${label}-390x844.png`);
                }
                // Same loaded scene after rotation; inverse projection stays exact.
                await page.setViewportSize({width:667,height:375});await page.waitForTimeout(100);
                assert.ok(await page.evaluate(()=>{const p={x:49,y:45};return mapDistance(p,isometricToWorld(worldToIsometric(p)))<1e-8;}));
                await captureOnce(page,'rotation-667x375.png');await page.setViewportSize({width,height});
            }
            // Presentation fixtures must not leave the player away from their active route.
            await page.evaluate(state=>{Object.assign(game,state);PhaserMapRenderer.scene.sync();},presentationState);
            const physical = await page.evaluate(() => {
                const seller = getEmployeeById(testIds.seller); beginEmployeeActivity();
                game.clock.paused = false; clearWaitingCustomers();
                const initial = { x: seller.x, y: seller.y }; updateSimulation(.1); const moved = mapDistance(initial, seller) > 0;
                for (let i = 0; i < 1000 && seller.operationalState !== EMPLOYEE_OPERATION.AT_POST; i++) updateSimulation(.1);
                const atPost = seller.operationalState;
                clearWaitingCustomers(); game.events = []; police.patrols.forEach(p => p.element?.remove()); police.patrols = []; police.alerts = []; police.activeOperation = null; police.plannedOperation = null;
                beginRetreat('manual');
                for (let i = 0; i < 2000 && game.dayActive; i++) updateSimulation(.1);
                if(game.phase!=='BILAN')console.error('RETREAT BLOCKERS',JSON.stringify(getRetreatBlockers()));
                return { moved, atPost, phase: game.phase, operation: seller.operationalState };
            });
            assert.deepEqual(physical, { moved: true, atPost: 'AT_POST', phase: 'BILAN', operation: 'DONE' });
            await page.locator('#nextDayButton').tap();
            await page.locator('#configureDayButton').tap();
            const layout = await page.evaluate(() => {
                const box = id => document.getElementById(id).getBoundingClientRect(); const hud = box('dayUI'), map = box('mapViewport'), nav = box('bottomMenu'), controls = box('cameraControls');
                return hud.bottom <= map.top + 1 && map.bottom <= nav.top + 1 && controls.top >= map.top && controls.bottom <= map.bottom && document.documentElement.scrollWidth <= innerWidth;
            });
            assert.equal(layout, true);
            for (const name of ['employees', 'stock', 'logistics', 'management', 'police']) {
                await page.locator(`#${name}Button`).tap();
                const panel = page.locator(`#${name}Panel`);
                await panel.locator('details').evaluateAll(items => items.forEach(item => { item.open = true; }));
                const accessible = await panel.evaluate(panel => {
                    const body=panel.lastElementChild; body.scrollTop=body.scrollHeight;
                    const last=[...body.querySelectorAll('button,input,select')].filter(e=>e.checkVisibility()).at(-1);
                    last?.scrollIntoView({block:'nearest'});
                    const r=last?.getBoundingClientRect(), hit=r && document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                    return document.documentElement.scrollWidth<=innerWidth && (!last || (hit===last || last.contains(hit)) && r.bottom<=document.getElementById('bottomMenu').getBoundingClientRect().top+1);
                });
                assert.equal(accessible, true, `${name}: dernier contrôle accessible`);
                await panel.locator('.panelHeader button').last().tap();
            }
            const heap = await cdp.send('Runtime.getHeapUsage');
            assert.deepEqual(errors, []); assert.deepEqual(remote, []);
            results.push({width,height,loadMs,loadBudgetMet,objects:fitted.objects,staticObjects:fitted.staticCount,heapUsedBytes:heap.usedSize,heapTotalBytes:heap.totalSize,visualChecks,passed:true});
            await fs.writeFile(path.join(root,`assets/art-v2/masters/captures/mobile-${width}x${height}.json`),JSON.stringify(results.at(-1),null,2)+'\n');
            assert.deepEqual(errors, []); assert.deepEqual(remote, []);
            console.log(`PASS 2.6C Chromium ${width}x${height}: carte, sélection unique, sol, pan, pinch CDP, bascules, repli, réseau local; chargement ${loadMs} ms`);
            await context.close();
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
