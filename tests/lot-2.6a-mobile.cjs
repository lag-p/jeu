// Chromium réel, fichiers locaux uniquement. Gestes tactiles synthétiques CDP.
const { chromium } = require(process.env.JEU_PLAYWRIGHT || '/tmp/jeu-validation/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    try {
        for (const [width, height] of [[390, 844], [667, 375], [320, 568], [430, 932]]) {
            const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
            const page = await context.newPage(), errors = [], remote = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', async route => {
                const url = new URL(route.request().url());
                if (url.origin !== 'http://jeu.test') { remote.push(url.href); return route.abort(); }
                const name = url.pathname.slice(1) || 'index.html';
                try { await route.fulfill({ body: await fs.readFile(path.join(root, name)), contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html' }); }
                catch { await route.fulfill({ status: 404, body: '' }); }
            });
            await page.goto('http://jeu.test/');
            await page.locator('#newGame').tap(); await page.evaluate(() => newGame('PONCETTE_INSPIRED_V1'));
            await page.locator('#configureDayButton').tap();
            await page.evaluate(async () => { await setMapRenderMode('isometric'); document.querySelector('.rendererMenu').open = false; });
            await page.waitForFunction(() => PhaserMapRenderer.isActive() && PhaserMapRenderer.scene.staticBuilt);
            await page.locator('#centerPlayer').tap();
            await page.waitForTimeout(80);
            assert.equal(await page.evaluate(() => mapData.mapId), 'PONCETTE_INSPIRED_V1');
            assert.equal(await page.locator('[data-zoom]').first().isVisible(), false);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            const fitted = await page.evaluate(() => {
                const s = PhaserMapRenderer.scene, c = s.cameras.main, b = s.bounds;
                return { left: (b.x - c.scrollX) * c.zoom, right: (b.x + b.width - c.scrollX) * c.zoom,
                    top: (b.y - c.scrollY) * c.zoom, bottom: (b.y + b.height - c.scrollY) * c.zoom, width: c.width, height: c.height,
                    objects: PhaserMapRenderer.getDebugInfo().activeObjects, staticCount: s.staticObjects.length };
            });
            assert.ok(fitted.left >= 0 && fitted.top >= 0 && fitted.right <= fitted.width && fitted.bottom <= fitted.height, JSON.stringify(fitted));
            assert.ok(fitted.staticCount >= 23 && fitted.objects < 150);
            await page.screenshot({ path: `/tmp/jeu-2.6a-map-${width}.png` });
            await page.evaluate(() => {
                const home = createApartment('depot', 33, 20); home.inventory['Produit A'] = 20;
                const seller = createEmployee('vendeur', 46, 75); seller.assignment.apartmentId = home.id; seller.assignment.manual = true;
                game.employees.push(seller); createEmployeeVisual(seller); createSalesPoint(seller, 46, 75);
                game.playerPlaced = true; startDay(); clearWaitingCustomers();
                const c = createCustomer(); Object.assign(c, { x: 48, y: 27 });
                game.clock.paused = true; window.testIds = { seller: seller.id, customer: c.id, home: home.id };
                window.movementCalls = 0; window.selectionCalls = 0;
                const move = requestPlayerMovement, select = PhaserMapRenderer.select;
                requestPlayerMovement = p => { window.movementCalls++; return move(p); };
                PhaserMapRenderer.select = key => { window.selectionCalls++; return select.call(PhaserMapRenderer, key); };
                PhaserMapRenderer.scene.sync();
            });
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
                    return { x: (v.hit.x - c.scrollX) * c.zoom, y: (v.hit.y - c.scrollY - 10) * c.zoom };
                }, kind);
            }
            for (const kind of ['customer', 'employee', 'apartment']) {
                // Séparer le vendeur de son domicile pour tester chaque cible.
                if (kind === 'employee') await page.evaluate(() => { Object.assign(getEmployeeById(testIds.seller), { x: 46, y: 75 }); });
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
            const physical = await page.evaluate(() => {
                const seller = getEmployeeById(testIds.seller); beginEmployeeActivity();
                game.clock.paused = false; clearWaitingCustomers();
                const initial = { x: seller.x, y: seller.y }; updateSimulation(.1); const moved = mapDistance(initial, seller) > 0;
                for (let i = 0; i < 1000 && seller.operationalState !== EMPLOYEE_OPERATION.AT_POST; i++) updateSimulation(.1);
                const atPost = seller.operationalState;
                clearWaitingCustomers(); game.events = []; police.patrols.forEach(p => p.element?.remove()); police.patrols = []; police.alerts = []; police.activeOperation = null; police.plannedOperation = null;
                beginRetreat('manual');
                for (let i = 0; i < 2000 && game.dayActive; i++) updateSimulation(.1);
                return { moved, atPost, phase: game.phase, operation: seller.operationalState };
            });
            assert.deepEqual(physical, { moved: true, atPost: 'AT_POST', phase: 'BILAN', operation: 'DONE' });
            await page.locator('#nextDayButton').tap();
            await page.locator('#configureDayButton').tap();
            const layout = await page.evaluate(() => {
                const box = id => document.getElementById(id).getBoundingClientRect(); const hud = box('dayUI'), map = box('mapViewport'), nav = box('bottomMenu'), controls = box('cameraControls');
                return hud.bottom <= map.top + 1 && map.bottom <= nav.top + 1 && controls.top >= map.top && controls.bottom <= map.bottom && document.documentElement.scrollWidth <= innerWidth;
            });
            assert.equal(layout, true); assert.deepEqual(errors, []); assert.deepEqual(remote, []);
            console.log(`PASS 2.6A Chromium ${width}x${height}: carte, sélection unique, sol, pan, pinch CDP, bascules, repli, réseau local`);
            await context.close();
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
