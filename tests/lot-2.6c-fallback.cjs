// Focused Chromium checks for failed local assets, debug and texture disposal.
const { chromium } = require('/tmp/jeu-validation/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const results = [];
    await fs.mkdir(path.join(root,'assets/art-v2/masters/captures'),{recursive:true});
    try {
        for (const scenario of ['missing-manifest', 'missing-image', 'invalid-manifest', 'debug-history'].filter(s => !process.env.JEU_FALLBACK_SCENARIO || process.env.JEU_FALLBACK_SCENARIO === s)) {
            const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
            const page = await context.newPage(), errors = [], remote = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', async route => {
                const url = new URL(route.request().url());
                if (url.origin !== 'http://jeu.test') { remote.push(url.href); return route.abort(); }
                const name = url.pathname.slice(1) || 'index.html';
                if (scenario === 'missing-manifest' && name === 'assets/art-v2/masters/manifest.json' || scenario === 'missing-image' && name === 'assets/art-v2/masters/neighborhood-night-master-v1.png') return route.fulfill({ status: 404, body: '' });
                let body;
                try { body = await fs.readFile(path.join(root, name)); } catch { return route.fulfill({ status: 404, body: '' }); }
                if (name === 'config.js') body = Buffer.from(body.toString().replace('const DEBUG = false', 'const DEBUG = true'));
                if (scenario === 'invalid-manifest' && name === 'assets/art-v2/masters/manifest.json') {
                    const manifest = JSON.parse(body); manifest.version = -1; body = Buffer.from(JSON.stringify(manifest));
                }
                await route.fulfill({ body, contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : name.endsWith('.json') ? 'application/json' : 'text/html' });
            });
            await page.goto('http://jeu.test/');
            await page.locator('#newGame').tap();
            await page.locator('#configureDayButton').tap();
            await page.waitForFunction(() => PhaserMapRenderer.isActive() && PhaserMapRenderer.scene.staticBuilt);
            assert.equal(await page.locator('.rendererMenu').isVisible(), true);
            const snapshot = () => page.evaluate(() => JSON.stringify(createSaveSnapshot()));
            const before = await snapshot();
            const info = await page.evaluate(() => ({ categories: PhaserMapRenderer.scene.fallbackCategories, errors: PhaserMapRenderer.assetErrors, buildings: PhaserMapRenderer.scene.assetBuildingIds }));
            if (scenario !== 'debug-history') {
                assert.deepEqual(info.categories.sort(), ['facade', 'furniture', 'ground', 'light', 'parkedVehicle', 'tree', 'wall']);
                assert.deepEqual(info.buildings, []); assert.ok(info.errors.length);
                assert.match(await page.locator('#renderDebugStatus').textContent(), /Repli procédural/);
            } else {
                assert.equal(info.buildings.length, 7); assert.deepEqual(info.errors, []);
                await page.locator('.rendererMenu summary').tap();
                await page.locator('#housingAssetMode').selectOption('procedural');
                assert.equal(await snapshot(), before);
                await page.locator('#housingAssetMode').selectOption('asset');
                assert.equal(await snapshot(), before);
                assert.equal(await page.evaluate(() => PhaserMapRenderer.scene.assetBuildingIds.length), 7);
            }
            await page.evaluate(() => { window.oldTextures = PhaserMapRenderer.scene.textures; window.oldScene = PhaserMapRenderer.scene; });
            await page.locator('.rendererMenu').evaluate(menu => { menu.open = true; });
            await page.locator('#mapRendererMode').selectOption('classic');
            await page.waitForFunction(() => !document.querySelector('#phaserMapCanvas'));
            assert.equal(await snapshot(), before);
            assert.equal(await page.evaluate(() => Object.keys(oldTextures.list || {}).length), 0, 'old texture manager released');
            await page.locator('#mapRendererMode').selectOption('isometric');
            await page.waitForFunction(() => PhaserMapRenderer.isActive() && PhaserMapRenderer.scene.staticBuilt);
            assert.equal(await snapshot(), before);
            if (scenario === 'debug-history') {
                // Same running renderer restores both historical geometries.
                for (const id of ['PONCETTE_INSPIRED_V1', 'LEGACY_TEST_MAP', 'REFERENCE_QUARTER_V1']) {
                    await page.evaluate(id => { newGame(id); game.money = 1234; game.playerInventory['Produit A'] = 19; const saved = createSaveSnapshot(); restoreSaveSnapshot(saved); }, id);
                    assert.equal(await page.evaluate(() => mapData.mapId), id);
                    assert.equal(await page.evaluate(() => game.money), 1234);
                    assert.equal(await page.evaluate(() => game.playerInventory['Produit A']), 19);
                    assert.equal(await page.evaluate(() => PhaserMapRenderer.scene.assetBuildingIds.length), id === 'REFERENCE_QUARTER_V1' ? 7 : id === 'PONCETTE_INSPIRED_V1' ? 1 : 0);
                }
            }
            assert.deepEqual(errors, []); assert.deepEqual(remote, []);
            results.push({ scenario, passed: true });
            await fs.writeFile(path.join(root, `assets/art-v2/masters/captures/fallback-${scenario}.json`), JSON.stringify(results.at(-1), null, 2) + '\n');
            console.log('PASS 2.6C fallback/debug/history', scenario);
            await context.close();
        }
        if (!process.env.JEU_FALLBACK_SCENARIO) await fs.writeFile(path.join(root, 'assets/art-v2/masters/captures/fallback-validation.json'), JSON.stringify(results, null, 2) + '\n');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
