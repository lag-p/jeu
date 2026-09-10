// Read-only visual layers for the reference map; shared by Phaser and tests.
const NEIGHBORHOOD_CATEGORIES = Object.freeze(['ground', 'facade', 'wall', 'tree', 'parkedVehicle', 'light', 'furniture']);
function neighborhoodMood(minute) {
    if (minute < 1080) return { base: 'day', next: 'day', alpha: 0 };
    if (minute < 1200) return { base: 'day', next: 'dusk', alpha: (minute - 1080) / 120 };
    if (minute < 1260) return { base: 'dusk', next: 'dusk', alpha: 0 };
    if (minute < 1320) return { base: 'dusk', next: 'night', alpha: (minute - 1260) / 60 };
    return { base: 'night', next: 'night', alpha: 0 };
}
function validNeighborhoodLayer(entry, textureSize) {
    return Boolean(entry && /^[A-Za-z0-9_-]+$/.test(entry.id) && NEIGHBORHOOD_CATEGORIES.includes(entry.category) &&
        Number.isInteger(entry.width) && entry.width > 0 && entry.width <= 2048 && Number.isInteger(entry.height) && entry.height > 0 && entry.height <= 2048 &&
        Number.isFinite(entry.scale) && entry.scale > 0 && entry.scale < 3 &&
        ['x', 'y'].every(k => Number.isFinite(entry.anchor?.[k]) && entry.anchor[k] >= 0 && entry.anchor[k] <= 100) &&
        Array.isArray(entry.pivot) && entry.pivot.length === 2 && entry.pivot.every(Number.isFinite) &&
        Array.isArray(entry.footprint) && entry.footprint.length >= 3 && entry.footprint.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) &&
        entry.projection?.reflected === true && entry.projection?.tileWidth === ISO_RENDER_CONFIG.tileWidth && entry.projection?.tileHeight === ISO_RENDER_CONFIG.tileHeight &&
        ['day', 'dusk', 'night'].every(m => /^assets\/art-v2\/layers\/[a-z0-9_-]+\.png$/.test(entry.images?.[m]) &&
            (!textureSize || textureSize(m)?.width === entry.width && textureSize(m)?.height === entry.height)));
}
function preloadNeighborhood(scene, renderer) {
    scene.neighborhoodAssets = [];
    scene.load.once('filecomplete-json-neighborhood-manifest', (_key, _type, manifest) => {
        if (manifest?.version !== 2 || manifest.mapId !== 'REFERENCE_QUARTER_V1' || !Array.isArray(manifest.layers)) { renderer.assetError('Manifeste quartier invalide'); return; }
        const ids = new Set();
        for (const entry of manifest.layers) {
            if (!validNeighborhoodLayer(entry) || ids.has(entry.id)) { renderer.assetError(`Couche invalide : ${entry?.id}`); continue; }
            ids.add(entry.id); scene.neighborhoodAssets.push(entry);
            for (const mood of ['day', 'dusk', 'night']) scene.load.image(`quarter-${entry.id}-${mood}`, entry.images[mood]);
        }
    });
    scene.load.json('neighborhood-manifest', 'assets/art-v2/manifest.json');
}
function drawNeighborhood(scene, renderer) {
    if (mapData.mapId !== 'REFERENCE_QUARTER_V1') return false;
    scene.neighborhoodPairs = []; scene.assetBuildingIds = []; scene.fallbackCategories = [];
    const ground = scene.add.graphics().setDepth(-100001); scene.staticObjects.push(ground);
    scene.addPolygon(ground, mapData.perimeter.map(p => worldToIsometric(p)), 0x526451);
    const fallGround = () => {
        for (const [key, color] of Object.entries({ roads: 0x454c52, courts: 0xb6ac90, parking: 0x697078, sidewalks: 0xb7b9ab, transitions: 0xcab795, crossings: 0xe1dec8 }))
            for (const q of mapData[key]) scene.addPolygon(ground, q.polygon.map(p => worldToIsometric(p)), color);
    };
    const asset = (source, entry) => {
        if (renderer.housingMode !== 'asset' || !validNeighborhoodLayer(entry, mood => scene.textures.exists(`quarter-${entry.id}-${mood}`) ? scene.textures.get(`quarter-${entry.id}-${mood}`).getSourceImage() : null)) return false;
        const anchor = worldToIsometric(source?.anchor || (source ? { x: source.x, y: source.y } : entry.anchor));
        const left = anchor.x - entry.pivot[0] * entry.width * entry.scale, top = anchor.y - entry.pivot[1] * entry.height * entry.scale;
        const columns = ['facade','wall'].includes(entry.category), step = columns ? Math.ceil(entry.width / 40) : entry.width;
        for (let x = 0; x < entry.width; x += step) {
            const width = Math.min(step,entry.width-x), frame = `band-${x}`, screenX = left + x * entry.scale;
            for (const mood of ['day','dusk','night']) {
                const texture = scene.textures.get(`quarter-${entry.id}-${mood}`); texture.setFilter(window.Phaser.Textures.FilterMode.LINEAR);
                if (!texture.has(frame)) texture.add(frame,0,x,0,width,entry.height);
            }
            const point = columns ? housingColumnGround(source,screenX+width*entry.scale/2) : source?.anchor || entry.anchor;
            const depth = entry.category === 'ground' ? -100000 : getIsoDepth(point,5);
            const base = scene.add.image(screenX,top,`quarter-${entry.id}-day`,frame).setOrigin(0,0).setScale(entry.scale).setDepth(depth);
            const overlay = scene.add.image(screenX,top,`quarter-${entry.id}-dusk`,frame).setOrigin(0,0).setScale(entry.scale).setDepth(depth+.01).setAlpha(0);
            for (const sprite of [base,overlay]) { sprite.setData('layerId',source?.id || entry.id).setData('category',entry.category); if (entry.category === 'facade') sprite.setData('buildingId',source.id).setData('buildingRender','asset'); }
            scene.staticObjects.push(base,overlay); scene.neighborhoodPairs.push({base,overlay,entry,frame});
        }
        if (entry.category === 'facade') scene.assetBuildingIds.push(source.id);
        return true;
    };
    const fallback = category => { if (!scene.fallbackCategories.includes(category)) scene.fallbackCategories.push(category); renderer.assetError(`Repli procédural : ${category}`); };
    const entries = scene.neighborhoodAssets || [];
    if (!asset(null,entries.find(e=>e.category==='ground'))) { fallGround(); fallback('ground'); }
    mapData.buildings.forEach((b,i) => { if (!asset(b,entries.find(e=>e.id===b.id))) { scene.drawBuilding(MAP_BUILDINGS[i],i); fallback('facade'); } });
    for (const q of [...mapData.walls,...mapData.decor]) {
        const entry = entries.find(e=> q.asset ? e.asset === q.asset : e.id === q.id);
        if (asset(q,entry)) continue;
        fallback(q.visualType);
        const p=worldToIsometric(q.anchor || {x:q.x,y:q.y}), g=scene.add.graphics().setDepth(getIsoDepth(q.anchor || q,5));
        if (q.visualType==='tree') { g.fillStyle(0x765c42).fillRect(p.x-.6,p.y-9,1.2,9);g.fillStyle(0x376348).fillEllipse(p.x,p.y-12,9,14); }
        else if (q.visualType==='wall') { const pts=q.polygon.map(v=>worldToIsometric(v));scene.addPolygon(g,pts.map(v=>({x:v.x,y:v.y-5})),0x8a8171); }
        else if (q.visualType==='light') { g.lineStyle(1,0xa0adb1).lineBetween(p.x,p.y,p.x,p.y-11);g.fillStyle(0xffd68b).fillCircle(p.x,p.y-11,1.5); }
        else { scene.addPolygon(g,q.polygon.map(v=>worldToIsometric(v)),q.visualType==='parkedVehicle'?0x718996:0x938876); }
        scene.staticObjects.push(g);
    }
    [...mapData.entries,...mapData.buildingEntries,...mapData.fallbackPoints,...mapData.salesPoints].forEach((p,i)=>scene.drawPlaceMarker(p,i));
    scene.staticBuilt=true; syncNeighborhood(scene); return true;
}
function syncNeighborhood(scene) {
    if (!scene.neighborhoodPairs?.length) return;
    const minute=TIME_CONFIG.openingMinute+(TIME_CONFIG.closingMinute-TIME_CONFIG.openingMinute)*Math.min(1,game.dayElapsed/game.dayDuration);
    const mood=neighborhoodMood(minute);
    for (const pair of scene.neighborhoodPairs) {
        if (pair.baseMood!==mood.base) { pair.base.setTexture(`quarter-${pair.entry.id}-${mood.base}`,pair.frame);pair.baseMood=mood.base; }
        if (pair.nextMood!==mood.next) { pair.overlay.setTexture(`quarter-${pair.entry.id}-${mood.next}`,pair.frame);pair.nextMood=mood.next; }
        // Stable variation in illumination onset; no random state, timer or mutation.
        const seed=pair.entry.id.split('').reduce((n,c)=>n+c.charCodeAt(0),0);
        pair.overlay.setAlpha(Math.pow(mood.alpha,1+(seed%5)*.12));
    }
    scene.neighborhoodMood=mood;
}

// Orthographic vertical projection at the shared metre convention.
function neighborhoodPersonPixels() {
    return NEIGHBORHOOD_SPEC.scale.personMetres * Math.SQRT2 * ISO_RENDER_CONFIG.tileWidth / (2 * NEIGHBORHOOD_SPEC.scale.metresPerUnit) *
        Math.sqrt(1 - (ISO_RENDER_CONFIG.tileHeight / ISO_RENDER_CONFIG.tileWidth) ** 2);
}
