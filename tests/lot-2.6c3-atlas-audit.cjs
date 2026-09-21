// Read-only atlas inspection: ordered frames, pixel identity and foot bounds.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('/tmp/jeu-validation/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'assets/art-v2/masters/captures-2.6c3');
(async () => {
    await fs.mkdir(out, { recursive: true });
    const meta = JSON.parse(await fs.readFile(path.join(root, 'assets/characters/v3/people.json')));
    const data = (await fs.readFile(path.join(root, 'assets/characters/v3/people.png'))).toString('base64');
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
        await page.setContent('<body style="margin:0;background:#26342f;color:white;font:16px sans-serif"><h1>2.6C.3 — Atlas livré, poses originales</h1><p>Chaque ligne = une direction. Colonnes 0–3 : attente ; 4–9 : marche. Ligne rouge : ancrage 82/96.</p><canvas id="sheet" width="1440" height="1080"></canvas></body>');
        const results = await page.evaluate(async ({ meta, data }) => {
            const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode();
            const source = document.createElement('canvas'); source.width = img.width; source.height = img.height;
            const sx = source.getContext('2d', { willReadFrequently: true }); sx.drawImage(img, 0, 0);
            const canvas = document.getElementById('sheet'), ctx = canvas.getContext('2d');
            const records = [], roles = [...new Set(Object.keys(meta.frames).map(n => n.split('-')[0]))];
            for (const role of roles) for (let direction = 0; direction < 8; direction++) {
                const entries = [];
                for (let frame = 0; frame < 10; frame++) {
                    const f = meta.frames[`${role}-${direction}-${frame}`].frame;
                    const bytes = sx.getImageData(f.x, f.y, f.w, f.h).data;
                    let hash = 2166136261, top = f.h, bottom = -1;
                    for (let i = 0; i < bytes.length; i++) { hash = Math.imul(hash ^ bytes[i], 16777619); if (i % 4 === 3 && bytes[i] > 128) { const y = Math.floor(i / 4 / f.w); top = Math.min(top, y); bottom = Math.max(bottom, y); } }
                    entries.push({ frame, hash: hash >>> 0, top, bottom });
                    if (role === 'vendeur') {
                        const x = 80 + frame * 130, y = 20 + direction * 132;
                        ctx.fillStyle = 'white'; ctx.font = '14px sans-serif'; ctx.fillText(`D${direction} F${frame}`, x, y + 14);
                        ctx.drawImage(img, f.x, f.y, f.w, f.h, x, y + 20, 64, 96);
                        ctx.strokeStyle = '#f47979'; ctx.beginPath(); ctx.moveTo(x, y + 102); ctx.lineTo(x + 64, y + 102); ctx.stroke();
                    }
                }
                records.push({ role, direction, distinctIdle: new Set(entries.slice(0, 4).map(e => e.hash)).size, distinctWalk: new Set(entries.slice(4).map(e => e.hash)).size, entries });
            }
            return records;
        }, { meta, data });
        assert.equal(results.length,72);
        for(const group of results) {
            assert.equal(group.distinctIdle,4,group.role+' idle '+group.direction);
            assert.equal(group.distinctWalk,6,group.role+' walk '+group.direction);
            assert.equal(new Set(group.entries.slice(0,4).map(e=>e.bottom)).size,1,'idle feet remain fixed');
        }
        const geometry=JSON.parse(await fs.readFile(path.join(root,'assets/characters/v3/source/geometry-audit.json')));
        assert.equal(geometry.length,80);
        for(const pose of geometry)assert.ok(Math.abs(Math.min(...pose.soleHeights))<1e-6 && pose.soleHeights.every(h=>h>=-1e-6),pose.pose);
        await page.screenshot({ path: path.join(out, 'atlas-vendeur-8-directions-10-poses.png'), fullPage: true });
        await fs.writeFile(path.join(out, 'atlas-pixel-audit.json'), JSON.stringify(results, null, 2) + '\n');
        console.log(JSON.stringify({ groups: results.length, idleDistinct: [...new Set(results.map(r => r.distinctIdle))], walkDistinct: [...new Set(results.map(r => r.distinctWalk))] }));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
