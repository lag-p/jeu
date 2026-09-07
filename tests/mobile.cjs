// PLAYWRIGHT_BROWSERS_PATH=/tmp/jeu-validation/browsers node tests/mobile.cjs
const { chromium } = require(process.env.JEU_PLAYWRIGHT || '/tmp/jeu-validation/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
    for (const [width, height] of [[320, 568], [390, 844], [430, 932], [667, 375]]) {
        if (process.env.JEU_MOBILE_WIDTH && width !== Number(process.env.JEU_MOBILE_WIDTH)) continue;
        const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
        try {
            const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
            const page = await context.newPage(), errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('http://jeu.test/**', async route => {
                const name = new URL(route.request().url()).pathname.slice(1) || 'index.html';
                try { await route.fulfill({ body: await fs.readFile(path.join(root, name)), contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html' }); }
                catch { await route.fulfill({ status: 404, body: '' }); }
            });
            await page.goto('http://jeu.test/');
            await page.locator('#newGame').tap();
            await page.locator('#configureDayButton').tap();
            await page.locator('#stockButton').tap();
            assert.equal(await page.locator('#stockPanel').evaluate(e => e.classList.contains('visible')), true);
            await page.locator('#closeStock').tap();
            await page.locator('#prepareDay').tap();
            await page.locator('#startDayButton').tap();
            const map = await page.locator('#mapViewport').boundingBox();
            await page.touchscreen.tap(map.x + map.width / 2, map.y + map.height / 2);
            assert.equal(await page.evaluate(() => game.phase), 'ACTIVITE');
            await page.locator('#speedTwo').tap();
            assert.equal(await page.evaluate(() => game.clock.speed), 2);
            await page.locator('#pauseTime').tap();
            const before = await page.evaluate(() => JSON.stringify(serializeState({ elapsed: game.clock.elapsed, customers, missions: game.logisticsMissions, police })));
            await page.waitForTimeout(250);
            assert.equal(await page.evaluate(() => JSON.stringify(serializeState({ elapsed: game.clock.elapsed, customers, missions: game.logisticsMissions, police }))), before);
            await page.locator('#managementButton').tap();
            assert.equal(await page.locator('#managementPanel').evaluate(e => e.classList.contains('visible')), true);
            for (const id of ['pauseTime', 'speedOne', 'speedTwo']) {
                const box = await page.locator('#' + id).boundingBox();
                assert.ok(box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x + box.width <= width && box.y + box.height <= height);
            }
            await page.locator('#closeManagement').tap();
            const hud = await page.locator('#dayUI').boundingBox();
            const visibleMap = await page.locator('#mapViewport').boundingBox();
            assert.ok(visibleMap.y >= hud.y + hud.height - 1 && visibleMap.height > 100);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.screenshot({ path: `/tmp/jeu-mobile-${width}.png` });
            await page.evaluate(() => {
                police.activeOperation = { id: 'mobile-operation', phase: 'ACTIVE', elapsed: 0, targetZoneIds: [], affectedEmployeeIds: [], stockLost: 0, moneyLost: 0, pointsDisrupted: 0, clientsLost: 0 };
            });
            await page.waitForTimeout(100);
            assert.equal(await page.locator('#speedTwo').isDisabled(), true);
            assert.equal(await page.evaluate(() => game.clock.paused), true);
            await page.locator('#pauseTime').tap();
            await page.locator('#closeDay').tap();
            assert.equal(await page.evaluate(() => game.phase), 'REPLI');
            await page.evaluate(() => { for (let i = 0; i < 1200 && game.dayActive; i++) updateSimulation(.1); });
            assert.equal(await page.evaluate(() => game.phase), 'BILAN');
            await page.screenshot({ path: `/tmp/jeu-bilan-${width}.png` });
            await page.locator('#nextDayButton').tap();
            assert.equal(await page.evaluate(() => game.phase), 'PREPARATION');
            assert.deepEqual(errors, []);
            console.log(`PASS mobile ${width}×${height} : commandes, pause, panneaux, repli, bilan, aucune erreur JS`);
            await context.close();
        } finally { await browser.close(); }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
