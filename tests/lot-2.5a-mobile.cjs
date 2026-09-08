// Validation navigateur ciblée du prototype : Phaser réel servi localement,
// interactions canvas, HUD HTML et repli lorsque le CDN est indisponible.
const { chromium } = require(process.env.JEU_PLAYWRIGHT || '/tmp/jeu-validation/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const phaserFile = '/tmp/jeu-validation/node_modules/phaser/dist/phaser.min.js';

async function serve(route) {
    const url = route.request().url();
    if (url.includes('cdn.jsdelivr.net/npm/phaser@3.90.0/')) return route.fulfill({ body: await fs.readFile(phaserFile), contentType: 'text/javascript' });
    const name = new URL(url).pathname.slice(1) || 'index.html';
    try { return route.fulfill({ body: await fs.readFile(path.join(root, name)), contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html' }); }
    catch { return route.fulfill({ status: 404, body: '' }); }
}

(async () => {
    for (const [width, height] of [[390, 844], [667, 375], [320, 568]]) {
        const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
        try {
            const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
            const page = await context.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', serve);
            await page.goto('http://jeu.test/');
            await page.locator('#newGame').tap();
            await page.evaluate(() => {
                const home = createApartment('depot', 20, 20);
                const seller = createEmployee('vendeur', 78, 30);
                seller.assignment.apartmentId = home.id; seller.assignment.manual = true; seller.allowedProducts = ['Produit A'];
                game.employees.push(seller); createEmployeeVisual(seller); createSalesPoint(seller, 76, 30);
                game.playerPlaced = true; startDay();
                window.prototypeSellerId = seller.id;
            });
            await page.locator('#mapRendererMode').selectOption('isometric');
            await page.waitForFunction(() => PhaserMapRenderer.isActive() && document.querySelector('#phaserMapCanvas'));
            const canvas = page.locator('#phaserMapCanvas');
            const bounds = await canvas.boundingBox();
            assert.ok(bounds.width > 100 && bounds.height > 100, `${width}: canvas dimensionné`);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            assert.equal(await page.evaluate(() => PhaserMapRenderer.getDebugInfo().activeObjects >= 3), true);
            // Toucher court : la position est convertie par la caméra Phaser.
            const target = await page.evaluate(() => {
                const seller = getEmployeeById(window.prototypeSellerId); PhaserMapRenderer.centerOnWorld(seller);
                const p = worldToIsometric(seller), c = PhaserMapRenderer.scene.cameras.main;
                return { x: (p.x - c.scrollX) * c.zoom, y: (p.y - c.scrollY) * c.zoom };
            });
            await page.touchscreen.tap(bounds.x + target.x, bounds.y + target.y);
            await page.waitForFunction(() => document.getElementById('employeesPanel').classList.contains('visible'));
            await page.locator('#closeEmployees').tap();
            // Un glissement sur zone vide déplace la caméra sans ouvrir de fiche.
            const beforePan = await page.evaluate(() => ({ x: PhaserMapRenderer.scene.cameras.main.scrollX, y: PhaserMapRenderer.scene.cameras.main.scrollY }));
            await page.mouse.move(bounds.x + 30, bounds.y + 30); await page.mouse.down(); await page.mouse.move(bounds.x + 95, bounds.y + 75, { steps: 4 }); await page.mouse.up();
            const afterPan = await page.evaluate(() => ({ x: PhaserMapRenderer.scene.cameras.main.scrollX, y: PhaserMapRenderer.scene.cameras.main.scrollY }));
            assert.ok(beforePan.x !== afterPan.x || beforePan.y !== afterPan.y, `${width}: caméra déplacée`);
            assert.equal(await page.locator('#employeesPanel').evaluate(e => e.classList.contains('visible')), false);
            const zoom = await page.evaluate(() => { PhaserMapRenderer.zoomBy(10); const max = PhaserMapRenderer.scene.cameras.main.zoom; PhaserMapRenderer.zoomBy(.01); return { max, min: PhaserMapRenderer.scene.cameras.main.zoom }; });
            assert.ok(zoom.max <= ISO_RENDER_CONFIG.maxZoom && zoom.min >= ISO_RENDER_CONFIG.minZoom, `${width}: bornes zoom`);
            await page.locator('#stockButton').tap();
            assert.equal(await page.locator('#stockPanel').evaluate(e => e.classList.contains('visible')), true, `${width}: HUD HTML au-dessus du canvas`);
            await page.locator('#closeStock').tap();
            await page.locator('#pauseTime').tap();
            const paused = await page.evaluate(() => game.clock.elapsed);
            await page.waitForTimeout(180);
            assert.equal(await page.evaluate(() => game.clock.elapsed), paused, `${width}: pause unique`);
            await page.locator('#pauseTime').tap();
            await page.locator('#speedTwo').tap();
            assert.equal(await page.evaluate(() => game.clock.speed), 2, `${width}: vitesse ×2`);
            const resources = await page.evaluate(() => JSON.stringify(serializeState({ money: game.money, inventory: game.playerInventory, apartments: game.apartments, elapsed: game.clock.elapsed })));
            await page.locator('#mapRendererMode').selectOption('classic');
            await page.waitForFunction(() => !PhaserMapRenderer.isActive() && !document.querySelector('#phaserMapCanvas'));
            assert.equal(await page.evaluate(() => JSON.stringify(serializeState({ money: game.money, inventory: game.playerInventory, apartments: game.apartments, elapsed: game.clock.elapsed }))), resources, `${width}: bascule sans mutation`);
            // Échec simulé du chargement : pas de blocage, retour classique.
            await page.evaluate(async () => { PhaserMapRenderer.destroy(); delete window.Phaser; window.__PHASER_URL_OVERRIDE__ = '/phaser-absent.js'; await PhaserMapRenderer.setMode('isometric', { silent: true }); });
            assert.equal(await page.evaluate(() => PhaserMapRenderer.mode), 'classic', `${width}: repli Phaser`);
            assert.deepEqual(errors, [], `${width}: erreurs JavaScript`);
            console.log(`PASS 2.5A navigateur ${width}×${height}`);
            await context.close();
        } finally { await browser.close(); }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
