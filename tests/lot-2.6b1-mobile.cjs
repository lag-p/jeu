// Real Chromium, sequential contexts; no Blender invocation here.
const { chromium } = require(process.env.JEU_PLAYWRIGHT || '/tmp/jeu-validation/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    try {
        for (const scenario of ['asset', 'missing-image', 'missing-manifest', 'bad-metadata', 'normal']) {
            const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
            const page = await context.newPage(), errors = [], requests = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', async route => {
                const url = new URL(route.request().url());
                assert.equal(url.origin, 'http://jeu.test');
                const file = url.pathname.slice(1) || 'index.html'; requests.push(file);
                if ((scenario === 'missing-image' && file.endsWith('.png')) || (scenario === 'missing-manifest' && file.endsWith('manifest.json'))) return route.fulfill({ status: 404, body: '' });
                let body;
                try { body = await fs.readFile(path.join(root, file)); } catch { return route.fulfill({ status: 404, body: '' }); }
                if (file === 'config.js' && scenario !== 'normal') body = Buffer.from(body.toString().replace('const DEBUG = false', 'const DEBUG = true'));
                if (scenario === 'bad-metadata' && file.endsWith('housing-block-long-v1.json')) { const meta = JSON.parse(body); meta.pivot.x = 3; body = Buffer.from(JSON.stringify(meta)); }
                await route.fulfill({ body, contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : file.endsWith('.png') ? 'image/png' : 'text/html' });
            });
            await page.goto('http://jeu.test/');
            await page.locator('#newGame').tap(); await page.locator('#configureDayButton').tap();
            await page.evaluate(async () => { await setMapRenderMode('isometric'); document.querySelector('.rendererMenu').open = false; });
            await page.waitForFunction(() => PhaserMapRenderer.isActive() && PhaserMapRenderer.scene.staticBuilt);
            const snapshot = () => page.evaluate(() => JSON.stringify({ save: createSaveSnapshot(), buildings: mapData.buildings, blocked: mapData.blockedPolygons, navigation: { nodes: mapData.navigation.nodes, connections: mapData.navigation.connections }, homes: mapData.apartmentSites, player: [game.playerX, game.playerY], customers: customers.map(c => [c.id, c.x, c.y]) }));
            const initial = await snapshot();
            const state = await page.evaluate(() => ({ debug: PhaserMapRenderer.getDebugInfo(), styles: PhaserMapRenderer.scene.staticObjects.filter(o => o.getData('buildingId')).map(o => [o.getData('buildingId'), o.getData('buildingRender')]) }));
            const success = ['asset', 'normal'].includes(scenario);
            assert.deepEqual(state.debug.assetBuildings, success ? ['BLOCK_N'] : []);
            assert.equal(new Set(state.styles.filter(([, style]) => style === 'procedural').map(([id]) => id)).size, success ? 5 : 6);
            assert.ok(state.styles.filter(([, style]) => style === 'asset').every(([id]) => id === 'BLOCK_N'));
            assert.equal(state.debug.assetErrors.length > 0, !success);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            assert.equal(await page.locator('[data-zoom]').first().isVisible(), false);
            assert.equal(await page.locator('#housingAssetMode').count(), scenario === 'normal' ? 0 : 1);
            if (scenario === 'normal') assert.equal(await page.evaluate(() => PhaserMapRenderer.setHousingMode('procedural')), false);
            if (scenario === 'asset') {
                assert.ok(requests.includes('assets/art-v1/buildings/housing-block-long-v1.png'));
                await page.screenshot({ path: '/tmp/jeu-2.6b1-map-390.png' });
                await page.evaluate(() => { const s = PhaserMapRenderer.scene; s.zoomTo(1.8); s.centerOnWorld({ x: 48, y: 12 }); });
                const cameraBefore = await page.evaluate(() => { const c = PhaserMapRenderer.scene.cameras.main; return [c.scrollX, c.scrollY, c.zoom]; });
                await page.evaluate(() => PhaserMapRenderer.setHousingMode('procedural'));
                assert.deepEqual(await page.evaluate(() => PhaserMapRenderer.getDebugInfo().assetBuildings), []);
                assert.equal(await snapshot(), initial, 'debug toggle preserves simulation, save, collision, navigation, apartments');
                await page.evaluate(() => PhaserMapRenderer.setHousingMode('asset'));
                assert.equal(await snapshot(), initial);
                assert.deepEqual(await page.evaluate(() => { const c = PhaserMapRenderer.scene.cameras.main; return [c.scrollX, c.scrollY, c.zoom]; }), cameraBefore);
                // Contact reconstruction and front/behind at both visible facades.
                const alignment = await page.evaluate(() => {
                    const s = PhaserMapRenderer.scene, m = s.cache.json.get('meta-housing-block-long-v1'), b = mapData.buildings.find(b => b.id === 'BLOCK_N');
                    const sprites = s.staticObjects.filter(o => o.getData('buildingRender') === 'asset');
                    const first = sprites[0], anchor = worldToIsometric({ x: 61, y: 15 });
                    return { dx: first.x + (1 - m.pivot.x) * m.pixels.width * m.phaserScale - anchor.x, dy: first.y + m.pivot.y * m.pixels.height * m.phaserScale - anchor.y,
                        depths: [{ x: 42, y: 16 }, { x: 42, y: 8 }, { x: 62, y: 12 }].map(p => {
                            const q = worldToIsometric(p); const sprite = sprites.find(o => q.x >= o.x && q.x < o.x + o.displayWidth);
                            return { point: p, entity: getIsoDepth(p, 60), building: sprite?.depth };
                        }) };
                });
                assert.ok(Math.abs(alignment.dx) < 1e-7 && Math.abs(alignment.dy) < 1e-7);
                assert.ok(alignment.depths[0].entity > alignment.depths[0].building);
                assert.ok(alignment.depths[1].entity < alignment.depths[1].building);
                assert.ok(alignment.depths[2].entity > alignment.depths[2].building);
                // Render an actual player at legal fixture positions, front then behind.
                for (const [name, x, y] of [['front', 42, 16], ['behind', 42, 8]]) {
                    await page.evaluate(({ x, y }) => { game.playerX = x; game.playerY = y; PhaserMapRenderer.scene.sync(); }, { x, y });
                    await page.waitForTimeout(100);
                    await page.screenshot({ path: `/tmp/jeu-2.6b1-${name}-390.png` });
                }
                await page.evaluate(() => { game.playerX = 42; game.playerY = 16; PhaserMapRenderer.scene.sync(); });
                await page.waitForTimeout(100);
                await page.screenshot({ path: '/tmp/jeu-2.6b1-game-390.png' });
                // Cached Phaser restart + legacy map must not receive the replacement.
                await page.evaluate(async () => { await setMapRenderMode('classic'); await setMapRenderMode('isometric'); });
                await page.waitForFunction(() => PhaserMapRenderer.scene?.staticBuilt);
                assert.deepEqual(await page.evaluate(() => PhaserMapRenderer.getDebugInfo().assetBuildings), ['BLOCK_N']);
                await page.evaluate(() => newGame('LEGACY_TEST_MAP'));
                assert.deepEqual(await page.evaluate(() => PhaserMapRenderer.getDebugInfo().assetBuildings), []);
            }
            assert.deepEqual(errors, []);
            console.log(`PASS 2.6B.1 Chromium 390x844 ${scenario}`, state.debug.assetErrors);
            await context.close();
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
