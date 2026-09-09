// Structural assets and deterministic model plan; no second Blender render.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file));
const manifest = JSON.parse(read('assets/art-v1/manifest.json'));
assert.equal(manifest.version, 1);
assert.equal(manifest.buildings.length, 1);
assert.equal(new Set(manifest.buildings.map(e => e.id)).size, manifest.buildings.length);
const entry = manifest.buildings[0], meta = JSON.parse(read(entry.metadata)), png = read(entry.image);
for (const file of ['tools/blender/create_housing_block.py', 'tools/blender/common/materials.py', 'tools/blender/common/isometric_camera.py', 'tools/blender/common/render_utils.py', 'assets/art-v1/source/housing-block-long-v1.blend', 'assets/art-v1/previews/housing-block-long-v1-preview.png']) assert.ok(read(file).length > 100, file);
assert.ok(read('assets/art-v1/source/housing-block-long-v1.blend').length > 10000);
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(png.readUInt32BE(16), meta.pixels.width);
assert.equal(png.readUInt32BE(20), meta.pixels.height);
assert.equal(png[24], 8); assert.equal(png[25], 6, 'RGBA'); assert.equal(png[28], 0, 'non interlaced');
assert.ok(png.length < 2 * 1024 * 1024);
// Decode PNG row filters to verify actual transparent, opaque and AA pixels.
const chunks = [];
for (let i = 8; i < png.length;) { const size = png.readUInt32BE(i); if (png.toString('ascii', i + 4, i + 8) === 'IDAT') chunks.push(png.subarray(i + 8, i + 8 + size)); i += size + 12; }
const raw = zlib.inflateSync(Buffer.concat(chunks)), stride = meta.pixels.width * 4;
let previous = Buffer.alloc(stride), offset = 0, clear = 0, solid = 0, antialias = 0;
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
for (let y = 0; y < meta.pixels.height; y++) {
    const filter = raw[offset++], row = Buffer.from(raw.subarray(offset, offset + stride)); offset += stride;
    for (let i = 0; i < stride; i++) {
        const a = i >= 4 ? row[i - 4] : 0, b = previous[i], c = i >= 4 ? previous[i - 4] : 0;
        row[i] = (row[i] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]) & 255;
        if (i % 4 === 3) { if (row[i] === 0) clear++; else if (row[i] === 255) solid++; else antialias++; }
    }
    previous = row;
}
assert.ok(clear > 1000 && solid > 1000 && antialias > 100);
const context = vm.createContext({ window: { addEventListener() {} } });
for (const file of ['map-catalog.js', 'phaser-adapter.js', 'phaser-renderer.js']) vm.runInContext(read(file).toString(), context);
const map = vm.runInContext('createInspiredMap()', context), building = map.buildings.find(b => b.id === entry.buildingId);
Object.assign(context, { entry, meta, building, image: meta.pixels });
assert.equal(entry.mapId, map.mapId); assert.equal(entry.buildingId, 'BLOCK_N');
assert.equal(vm.runInContext('validHousingAsset(entry, meta, building, image)', context), true);
assert.equal(vm.runInContext('validHousingAsset(entry, meta, building, null)', context), false);
assert.equal(vm.runInContext('validHousingAsset(entry, {...meta, pivot: {x: NaN, y: 1}}, building, image)', context), false);
assert.equal(vm.runInContext('validHousingAsset(entry, {...meta, worldDimensions: {width: 24, depth: 6}}, building, image)', context), false);
assert.equal(vm.runInContext('validHousingAsset(entry, meta, createInspiredMap().buildings[0], image)', context), false);
for (const point of [{ x: 40, y: 15 }, { x: 61, y: 12 }]) {
    context.point = point;
    const ground = vm.runInContext('housingColumnGround(building, worldToIsometric(point).x)', context);
    assert.ok(Math.abs(ground.x - point.x) < 1e-8 && Math.abs(ground.y - point.y) < 1e-8);
}
// Compare full generated geometry plans twice using the real build() AST,
// replacing only Blender's box sink and material creation (no raster comparison).
const plan = JSON.parse(execFileSync('python3', ['-c', `
import ast, json, random, hashlib
from pathlib import Path
source = ast.parse(Path('tools/blender/create_housing_block.py').read_text())
build = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == 'build')
meta = json.loads(Path('${entry.metadata}').read_text())
plans = []
for _ in range(2):
    boxes = []
    colors = ['concrete','base','blue','roof','frame','glass','lit','door','tech','shutter','stain']
    env = dict(random=random, SEED=meta['seed'], palette=lambda: dict(zip(colors,colors)), box=lambda *args: boxes.append(args))
    exec(compile(ast.Module(body=[build], type_ignores=[]), '<model-plan>', 'exec'), env)
    states = env['build']()
    plans.append((boxes, states))
assert plans[0] == plans[1]
assert len(boxes) == meta['geometry']['buildingObjects']
assert hashlib.sha256(','.join(states).encode()).hexdigest() == meta['windowStateHash']
print(json.dumps(dict(objects=len(boxes), windows=len(states))))
`], { cwd: root, encoding: 'utf8' }));
assert.equal(meta.render.engine, 'BLENDER_EEVEE'); assert.equal(meta.blenderVersion, '5.0.1');
assert.ok(meta.geometry.polygons < 15000); assert.equal(meta.geometry.polygons, plan.objects * 6);
assert.ok(meta.generatorVersion && meta.seed === 261);
console.log('PASS 2.6B.1 structure, alpha réel, manifeste, pivot, projection, cible, modèle déterministe', { ...plan, clear, solid, antialias });
