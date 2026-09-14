// Frontière de rendu Phaser : aucune règle métier ni boucle de simulation ici.
const PHASER_VERSION = "3.90.0";
const PHASER_LOCAL_URL = `assets/vendor/phaser-${PHASER_VERSION}.min.js`;
const ISO_GESTURE = Object.freeze({ tapSlop: 10, minPointers: 2 });

// Asset metadata belongs to rendering, never to mapData or the save snapshot.
function validHousingAsset(entry, meta, building, image) {
    const finite = value => Number.isFinite(value) && value > 0;
    return Boolean(entry && meta && building && image && meta.id === entry.id && meta.version === 1 &&
        meta.target?.mapId === entry.mapId && meta.target?.buildingId === building.id &&
        entry.buildingId === building.id && meta.worldDimensions?.width === building.width &&
        meta.worldDimensions?.depth === building.height && finite(meta.worldDimensions?.height) &&
        meta.groundContact?.x === building.width && meta.groundContact?.y === building.height && meta.groundContact?.z === 0 &&
        meta.orientation?.longAxis === '+X' && meta.orientation?.front === '+Y' && meta.orientation?.rotationDegrees === 0 &&
        meta.projection?.tileWidth === ISO_RENDER_CONFIG.tileWidth && meta.projection?.tileHeight === ISO_RENDER_CONFIG.tileHeight &&
        meta.phaserFlipX === true && finite(meta.phaserScale) && meta.phaserScale < 1 &&
        meta.pixels?.width * meta.phaserScale >= (building.width + building.height) * ISO_RENDER_CONFIG.tileWidth / 2 &&
        meta.pixels?.width * meta.phaserScale <= (building.width + building.height) * ISO_RENDER_CONFIG.tileWidth / 2 * 1.1 &&
        ['x', 'y'].every(key => Number.isFinite(meta.pivot?.[key]) && meta.pivot[key] >= 0 && meta.pivot[key] <= 1) &&
        meta.pixels?.width === image.width && meta.pixels?.height === image.height &&
        image.width >= 256 && image.width <= 2048 && image.height >= 128 && image.height <= 2048);
}

// Front edge at a screen column: verticals have no screen-X displacement.
function housingColumnGround(building, screenX) {
    const difference = (screenX - ISO_RENDER_CONFIG.originX) / (ISO_RENDER_CONFIG.tileWidth / 2);
    const x = Math.min(building.x + building.width, difference + building.y + building.height);
    return { x, y: x - difference };
}

const PhaserMapRenderer = {
    mode: "classic", game: null, scene: null, loading: null, lastError: "", housingMode: "asset", assetErrors: [],
    setHousingMode(mode) {
        if (!DEBUG || !['procedural', 'asset'].includes(mode)) return false;
        this.housingMode = mode;
        if (this.scene) { this.scene.staticObjects.forEach(object => object.destroy()); this.scene.staticObjects = []; this.scene.staticBuilt = false; this.scene.drawStaticMap(); if (!this.scene.masterActive) this.scene.bounds = getIsometricMapBounds(); this.scene.fitInitialCamera(); }
        this.updateStatus(); return true;
    },
    assetError(message) { if (!this.assetErrors.includes(message)) this.assetErrors.push(message); if (DEBUG) console.warn('Asset bâtiment :', message); },
    isActive() { return this.mode === "isometric" && Boolean(this.game && this.scene); },
    getDebugInfo() { return { mode: this.mode, mapId: mapData.mapId, buildings: mapData.buildings.length, nodes: mapData.navigation.nodes.length, edges: mapData.navigation.connections.length, activeObjects: this.scene ? this.scene.children.list.length + [...this.scene.visuals.values()].reduce((n, v) => n + v.container.list.length, 0) : 0, invalidPath: [...game.employees, ...customers, playerMapEntity].some(e => e.pathBlocked), housingMode: this.housingMode, assetBuildings: this.scene?.assetBuildingIds || [], assetErrors: [...this.assetErrors], error: this.lastError || "aucune" }; },
    updateStatus() {
        const select = document.getElementById("mapRendererMode"), status = document.getElementById("renderDebugStatus"), info = this.getDebugInfo();
        if (select) select.value = this.mode;
        const housing = document.getElementById('housingAssetMode');
        if (housing) housing.value = this.housingMode;
        if (status) { status.hidden = !DEBUG; status.textContent = `Rendu : ${info.mode === "isometric" ? "prototype isométrique" : "classique"} · ${info.activeObjects} objets${this.lastError ? " · repli activé" : ""}${this.assetErrors.length ? ` · ${this.assetErrors.join(' ; ')}` : ""}`; }
    },
    async loadPhaser() {
        if (window.Phaser) return window.Phaser;
        if (this.loading) return this.loading;
        this.loading = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = window.__PHASER_URL_OVERRIDE__ || PHASER_LOCAL_URL; script.async = true; script.dataset.phaserVersion = PHASER_VERSION;
            script.onload = () => window.Phaser ? resolve(window.Phaser) : reject(new Error("Phaser chargé mais indisponible"));
            script.onerror = () => reject(new Error(`Chargement Phaser ${PHASER_VERSION} impossible`)); document.head.appendChild(script);
        }).finally(() => { this.loading = null; });
        return this.loading;
    },
    async setMode(mode, options = {}) {
        if (!['classic', 'isometric'].includes(mode)) return false;
        if (mode === "classic") { this.destroy(); this.mode = "classic"; this.lastError = ""; this.persist(); this.updateStatus(); return true; }
        if (mapPlacement) { showMessage("Termine le placement avant d'activer le prototype."); this.updateStatus(); return false; }
        try { await this.loadPhaser(); this.start(); this.mode = "isometric"; this.lastError = ""; this.persist(); this.updateStatus(); return true; }
        catch (error) {
            this.destroy(); this.mode = "classic"; this.lastError = error.message; console.error("Prototype isométrique indisponible :", error);
            if (!options.silent) showMessage("Prototype indisponible : rendu classique conservé."); this.persist(); this.updateStatus(); return false;
        }
    },
    persist() { try { localStorage.setItem("quartier.mapRendererMode", this.mode); } catch { /* préférence non métier */ } },
    start() {
        if (this.game) return;
        const Phaser = window.Phaser, host = document.getElementById("mapViewport");
        if (!Phaser || !host) throw new Error("Canvas prototype indisponible");
        const renderer = this;
        renderer.assetErrors = [];
        class IsometricPrototypeScene extends Phaser.Scene {
            constructor() { super({ key: "isometric-prototype" }); this.visuals = new Map(); this.pointers = new Map(); this.gestureState = "IDLE"; this.placementMarker = null; this.staticObjects = []; this.staticBuilt = false; }
            preload() {
                this.housingAssets = [];
                this.load.on('loaderror', file => renderer.assetError(`Chargement impossible : ${file.key}`));
                // Keep both map families available when restoring a save in this scene.
                // This loads four local images, never the quarter-* Blender layers.
                preloadMasters(this, renderer);
                this.load.atlas('people','assets/characters/people.png','assets/characters/people.json');
                this.load.once('filecomplete-json-art-manifest', (_key, _type, manifest) => {
                    const entries = manifest?.buildings;
                    if (manifest?.version !== 1 || !Array.isArray(entries)) { renderer.assetError('Manifeste bâtiments invalide'); return; }
                    const ids = new Set(), targets = new Set();
                    for (const entry of entries) {
                        const target = `${entry?.mapId}:${entry?.buildingId}`;
                        if (!entry || !/^[a-z0-9-]+$/.test(entry.id) || ids.has(entry.id) || targets.has(target) ||
                            !/^assets\/art-v1\/buildings\/[a-z0-9-]+\.png$/.test(entry.image) ||
                            !/^assets\/art-v1\/buildings\/[a-z0-9-]+\.json$/.test(entry.metadata)) {
                            renderer.assetError('Entrée de manifeste invalide ou dupliquée'); continue;
                        }
                        ids.add(entry.id); targets.add(target); this.housingAssets.push(entry);
                        this.load.json(`meta-${entry.id}`, entry.metadata);
                        this.load.image(entry.id, entry.image);
                    }
                });
                this.load.json('art-manifest', 'assets/art-v1/manifest.json');
            }
            create() {
                renderer.scene = this; this.bounds = getIsometricMapBounds();
                this.cameras.main.setOrigin(0, 0);
                // Independent rounding of narrow image bands opens vertical seams.
                this.cameras.main.setRoundPixels(false);
                this.drawStaticMap(); this.bindInput(); this.fitInitialCamera(); this.sync();
                this.scale.on("resize", () => { this.cancelGesture(); this.fitInitialCamera(); });
                renderer.updateStatus();
            }
            update() { this.sync(); }
            addPolygon(graphics, points, fill, line = 0x39484e) { graphics.fillStyle(fill, 1); graphics.fillPoints(points, true); graphics.lineStyle(1, line, .72); graphics.strokePoints(points, true); }
            drawRoadBand(graphics, first, second, width, color) {
                const dx = second.x - first.x, dy = second.y - first.y, length = Math.hypot(dx, dy) || 1, offset = { x: -dy / length * width / 2, y: dx / length * width / 2 };
                this.addPolygon(graphics, [worldToIsometric({ x: first.x + offset.x, y: first.y + offset.y }), worldToIsometric({ x: second.x + offset.x, y: second.y + offset.y }), worldToIsometric({ x: second.x - offset.x, y: second.y - offset.y }), worldToIsometric({ x: first.x - offset.x, y: first.y - offset.y })], color, 0x45555a);
            }
            drawStaticMap() {
                if (this.staticBuilt) return;
                this.masterDebugGraphic = null;
                this.masterPathGraphic = null;this.masterReasonText=null;
                this.neighborhoodPairs = [];
                if (drawMasters(this, renderer)) return;
                if (drawNeighborhood(this, renderer)) return;
                this.assetBuildingIds = [];
                const state = createIsometricRenderState(), ground = this.add.graphics().setDepth(-100000);
                this.staticObjects.push(ground);
                this.addPolygon(ground, mapData.perimeter.map(point => worldToIsometric(point)), 0x526451, 0x405157);
                const colors = { openSpaces: 0x9d9d80, courts: 0xb6ac90, sidewalks: 0xb7b9ab, roads: 0x454c52, parking: 0x697078, crossings: 0xe1dec8, vegetation: 0x315a40, walls: 0x8a8171, obstacles: 0x8a8171, transitions: 0xcab795 };
                Object.entries(colors).forEach(([key, color]) => mapData[key].forEach(item => {
                    this.addPolygon(ground, item.polygon.map(point => worldToIsometric(point)), color);
                    if (["transitions", "parking", "crossings"].includes(key)) {
                        for (let y = item.y + .8; y < item.y + item.height; y += 1) this.drawRoadBand(ground, { x: item.x, y }, { x: item.x + item.width, y }, .2, 0xe1dec8);
                    }
                    if (key === "vegetation") { const p = worldToIsometric({ x: item.x + item.width / 2, y: item.y + item.height / 2 }); ground.fillStyle(0x51805b).fillCircle(p.x, p.y - 3, 5); }
                }));
                const zones = state.zones, links = [];
                if (mapData.mapId === "LEGACY_TEST_MAP") state.entries.forEach(entry => { const zone = zones.reduce((best, item) => !best || mapDistance(entry, item) < mapDistance(entry, best) ? item : best, null); if (zone) links.push([entry, zone, 7]); });
                [["NORTH_ENTRANCE", "MAIN_STREET"], ["MAIN_STREET", "CENTRAL_SQUARE"], ["CENTRAL_SQUARE", "SOUTH_ENTRANCE"], ["WEST_ENTRANCE", "CENTRAL_SQUARE"], ["CENTRAL_SQUARE", "EAST_ENTRANCE"], ["CENTRAL_SQUARE", "INNER_COURT"], ["CENTRAL_SQUARE", "PARKING"], ["MAIN_STREET", "BACK_ALLEY"]].forEach(([a, b]) => { const first = zones.find(zone => zone.id === a), second = zones.find(zone => zone.id === b); if (first && second) links.push([first, second, b === "BACK_ALLEY" || b === "INNER_COURT" ? 4 : 8]); });
                links.forEach(([first, second, width]) => this.drawRoadBand(ground, first, second, width + 2, 0x69777a)); links.forEach(([first, second, width]) => this.drawRoadBand(ground, first, second, width, width < 6 ? 0x3b4a4e : 0x4a595d));
                state.buildings.forEach((building, index) => this.drawBuilding(building, index)); [...state.entries, ...mapData.buildingEntries, ...state.fallbackPoints, ...state.salesPoints].forEach((point, index) => this.drawPlaceMarker(point, index)); this.staticBuilt = true;
            }
            drawBuilding([label, x, y, width, height], index) {
                if (this.drawHousingAsset(mapData.buildings[index])) return;
                const graphics = this.add.graphics(), elevation = mapData.buildings[index].visualHeight, bottom = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }].map(point => worldToIsometric(point)), top = bottom.map(point => ({ x: point.x, y: point.y - elevation })), roof = [0x9eaaa7, 0xb0b5a7, 0x95a6a1][index % 3];
                this.addPolygon(graphics, [top[3], top[2], bottom[2], bottom[3]], 0x26383d, 0x172428); this.addPolygon(graphics, [top[1], top[2], bottom[2], bottom[1]], 0x33464b, 0x172428); this.addPolygon(graphics, top, roof, 0x708187);
                graphics.setData('buildingId', mapData.buildings[index].id).setData('buildingRender', 'procedural');
                graphics.setDepth(getIsoDepth({ x: x + width, y: y + height }, 5)); this.staticObjects.push(graphics);
            }
            drawHousingAsset(building) {
                if (renderer.housingMode !== 'asset') return false;
                const entry = this.housingAssets.find(item => item.mapId === mapData.mapId && item.buildingId === building.id);
                if (!entry) return false;
                const meta = this.cache.json.get(`meta-${entry.id}`), texture = this.textures.exists(entry.id) ? this.textures.get(entry.id) : null;
                if (!validHousingAsset(entry, meta, building, texture?.getSourceImage())) { renderer.assetError(`Asset absent ou incompatible : ${entry.id}`); return false; }
                texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
                const anchor = worldToIsometric({ x: building.x + meta.groundContact.x, y: building.y + meta.groundContact.y });
                const left = anchor.x - (1 - meta.pivot.x) * meta.pixels.width * meta.phaserScale;
                const top = anchor.y - meta.pivot.y * meta.pixels.height * meta.phaserScale;
                // One texture, 64 frames: front-edge depth handles walking along either facade.
                const step = Math.ceil(meta.pixels.width / 64);
                for (let x = 0; x < meta.pixels.width; x += step) {
                    const width = Math.min(step, meta.pixels.width - x), frame = `column-${x}`;
                    if (!texture.has(frame)) texture.add(frame, 0, meta.pixels.width - x - width, 0, width, meta.pixels.height);
                    const screenX = left + x * meta.phaserScale;
                    const sprite = this.add.image(screenX, top, entry.id, frame).setOrigin(0, 0).setScale(meta.phaserScale).setFlipX(true);
                    sprite.setData('buildingId', building.id).setData('buildingRender', 'asset');
                    sprite.setDepth(getIsoDepth(housingColumnGround(building, screenX + width * meta.phaserScale / 2), 5));
                    this.staticObjects.push(sprite);
                }
                this.assetBuildingIds.push(building.id); return true;
            }
            drawPlaceMarker(point, index) {
                if (!point || !DEBUG) return; const screen = worldToIsometric(point), graphics = this.add.graphics().setDepth(getIsoDepth(point, 45)), color = point.id?.includes("fallback") ? 0x7cd5c2 : point.sellerId ? 0xf2b95f : 0x94c5d8;
                graphics.lineStyle(2, color, .9).strokeCircle(screen.x, screen.y - 5, 7); if (index % 2 === 0) graphics.fillStyle(color, .8).fillTriangle(screen.x, screen.y - 12, screen.x - 4, screen.y - 5, screen.x + 4, screen.y - 5); this.staticObjects.push(graphics);
            }
            createVisual(entity) {
                if (entity.type !== 'apartment') return createRasterCharacter(this,entity);
                const shadow = this.add.ellipse(0, 7, 24, 8, 0x0a1113, .42), body = this.add.rectangle(0, -2, entity.type === "player" ? 17 : 14, 18, entity.color).setStrokeStyle(1, 0x112025), head = this.add.circle(0, -14, 5, 0xf0c8a6).setStrokeStyle(1, 0x172328), badge = this.add.graphics(), badgeColor = entity.color;
                if (entity.role === "guetteur") badge.fillStyle(badgeColor, 1).fillTriangle(-5, -7, 5, -7, 0, -15); else if (entity.role === "gerant") badge.fillStyle(badgeColor, 1).fillPoints([{ x: 0, y: -16 }, { x: 5, y: -11 }, { x: 0, y: -6 }, { x: -5, y: -11 }], true); else if (entity.role === "ravitailleur") badge.fillStyle(badgeColor, 1).fillRect(-7, -7, 14, 5); else badge.fillStyle(badgeColor, 1).fillCircle(0, -10, 3);
                const ring = entity.type === "player" ? this.add.circle(0, 3, 13).setStrokeStyle(2, 0xe7f4ef, .9) : null, container = this.add.container(0, 0, [shadow, body, head, badge, ...(ring ? [ring] : [])]);
                container.setSize(34, 42); container.setData("isoKey", entity.key);
                // Zone séparée du conteneur : Phaser conserve alors la cible
                // tactile même quand les enfants sont masqués par un volume.
                const hit = this.add.circle(0, 0, 18, 0xffffff, .001);
                const selection = this.add.ellipse(0, 0, 7, 4).setStrokeStyle(1, 0xffe4a0).setVisible(false);
                return { container, body, hit, selection, entity };
            }
            sync() {
                syncNeighborhood(this);
                const state = createIsometricRenderState(), incoming = new Set();
                state.entities.forEach(entity => {
                    incoming.add(entity.key);
                    let visual = this.visuals.get(entity.key);
                    if (!visual) { visual = this.createVisual(entity); this.visuals.set(entity.key, visual); }
                    visual.entity = entity;
                    const point = worldToIsometric(entity), depth = getIsoDepth(entity, 60);
                    const quarter = mapData.mapId === "REFERENCE_QUARTER_V1";
                    const scale = visual.character ? (isRasterMap()?1:2) : this.masterActive ? .25 : 1;
                    const selected = entity.type === "employee" && String(entity.businessId) === String(selectedEmployeeId) ||
                        entity.type === "customer" && String(entity.businessId) === String(selectedCustomer?.id) ||
                        entity.type === "apartment" && interfaceState.activePanel === "logisticsPanel" && String(entity.businessId) === String(game.activeApartmentId);
                    visual.container.setPosition(point.x, point.y).setDepth(depth).setScale(scale).setVisible(!this.masterActive || entity.type !== "apartment" || DEBUG);
                    visual.hit.setPosition(point.x, point.y).setDepth(depth + 1);
                    visual.selection.setPosition(point.x, point.y).setDepth(depth + 2).setVisible((quarter || isRasterMap()) && selected);
                    if(visual.character)syncRasterCharacter(visual,entity);
                    else visual.body.setFillStyle(entity.color, entity.state === EMPLOYEE_OPERATION.BLOCKED ? .62 : 1);
                });
                for (const [key, visual] of this.visuals) if (!incoming.has(key)) { visual.hit.destroy(); visual.selection.destroy(); visual.container.destroy(true); this.visuals.delete(key); } if (!mapPlacement && this.placementMarker) this.clearPlacementMarker();
                syncMasters(this);
            }
            bindInput() {
                // Une seule source d'intentions. Aucun écouteur d'objet/scène
                // Phaser ne peut rejouer le pointerup natif.
                const canvas = this.sys.game.canvas, controller = new AbortController(); this.inputController = controller;
                const listen = (target, type, callback) => target.addEventListener(type, callback, { signal: controller.signal });
                const point = event => { const rect = canvas.getBoundingClientRect(); return { id: event.pointerId, x: (event.clientX - rect.left) * this.scale.width / rect.width, y: (event.clientY - rect.top) * this.scale.height / rect.height }; };
                listen(canvas, "pointerdown", event => { if (event.button > 0) return; const p = point(event); canvas.setPointerCapture(event.pointerId); this.beginGesture(p, this.hitKeyAt(p)); });
                listen(canvas, "pointermove", event => this.moveGesture(point(event)));
                listen(canvas, "pointerup", event => { const p = point(event); if (p.x < 0 || p.y < 0 || p.x > this.scale.width || p.y > this.scale.height) this.cancelPointer(p); else { this.moveGesture(p); this.endGesture(p); } });
                listen(canvas, "pointercancel", () => this.cancelGesture());
                listen(canvas, "lostpointercapture", event => { if (this.pointers.has(event.pointerId)) this.cancelGesture(); });
                listen(window, "blur", () => this.cancelGesture());
                this.events.once("shutdown", () => controller.abort());
            }
            hitKeyAt(pointer) {
                const camera = this.cameras.main;
                return [...this.visuals.values()].filter(v => v.entity.selectable).map(v => {
                    const x = (v.hit.x - camera.scrollX) * camera.zoom, y = (v.hit.y - camera.scrollY) * camera.zoom;
                    return { v, distance: Math.hypot(pointer.x - x, pointer.y - (y - 6 * camera.zoom)) };
                }).filter(item => item.distance <= Math.max(22, 22 * camera.zoom)).sort((a, b) => a.distance - b.distance || b.v.hit.depth - a.v.hit.depth || a.v.entity.key.localeCompare(b.v.entity.key))[0]?.v.entity.key || null;
            }
            beginGesture(pointer, key) { if (this.pointers.has(pointer.id)) return; this.pointers.set(pointer.id, { x: pointer.x, y: pointer.y, startX: pointer.x, startY: pointer.y, key: key || null, consumed: false, cancelled: this.gestureState === "CANCELLED" }); if (this.pointers.size >= ISO_GESTURE.minPointers) this.startPinch(); else if (this.gestureState === "IDLE") this.gestureState = "TAP_CANDIDATE"; }
            startPinch() { const [a, b] = [...this.pointers.values()]; if (!a || !b) return; const focus = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; this.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.cameras.main.zoom, focusWorld: this.cameras.main.getWorldPoint(focus.x, focus.y) }; this.gestureState = "PINCH"; this.pointers.forEach(item => { item.cancelled = true; }); }
            moveGesture(pointer) {
                const item = this.pointers.get(pointer.id); if (!item) return; const previous = { x: item.x, y: item.y }; item.x = pointer.x; item.y = pointer.y;
                if (this.gestureState === "PINCH") { const [a, b] = [...this.pointers.values()]; if (!a || !b) return; const focus = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance = Math.hypot(a.x - b.x, a.y - b.y); this.zoomTo(this.pinch.zoom * distance / this.pinch.distance, focus, this.pinch.focusWorld); return; }
                if (this.gestureState === "TAP_CANDIDATE" && Math.hypot(item.x - item.startX, item.y - item.startY) > ISO_GESTURE.tapSlop) this.gestureState = "PAN";
                if (this.gestureState === "PAN") { const camera = this.cameras.main; camera.scrollX -= (item.x - previous.x) / camera.zoom; camera.scrollY -= (item.y - previous.y) / camera.zoom; item.cancelled = true; this.clampCamera(); }
            }
            endGesture(pointer) { const item = this.pointers.get(pointer.id); if (!item) return; const wasTap = this.gestureState === "TAP_CANDIDATE" && !item.cancelled && this.pointers.size === 1; this.pointers.delete(pointer.id); if (wasTap) this.handleTap(item); if (this.gestureState === "PINCH" && this.pointers.size) this.gestureState = "CANCELLED"; else if (!this.pointers.size) { this.gestureState = "IDLE"; this.pinch = null; } }
            cancelPointer(pointer) { this.pointers.delete(pointer.id); this.gestureState = "CANCELLED"; if (!this.pointers.size) this.gestureState = "IDLE"; }
            cancelGesture() { this.pointers.clear(); this.pinch = null; this.gestureState = "IDLE"; }
            handleTap(item) {
                if (item.consumed) return;
                item.consumed = true;
                if (item.key) { renderer.select(item.key); return; }
                const world = isoSceneToWorld(item, this.cameras.main); if (!world) return;
                // Les conteneurs Phaser et Safari ne livrent pas toujours la
                // même cible tactile. La zone métier élargie est le repli
                // déterministe : une entité garde toujours priorité sur sol.
                const hit = this.hitKeyAt(item);
                if (hit) { renderer.select(hit); return; }
                if (mapPlacement) { setMapPlacementSelection(world); return; }
                if (game.startPointPlacementActive) { finishStartPointPlacement(world.x, world.y); return; }
                if (placementMode) { placeEmployee(world.x, world.y); return; }
                requestPlayerMovement(world);
            }
            rasterMinZoom() { return Math.max(this.cameras.main.width/426.5,this.cameras.main.height/922); }
            zoomTo(requestedZoom, focus = { x: this.scale.width / 2, y: this.scale.height / 2 }, focusWorld = null) { const camera = this.cameras.main, min=this.masterActive?this.rasterMinZoom():ISO_RENDER_CONFIG.minZoom, max=this.masterActive?Math.max(min,2.4):mapData.mapId === "REFERENCE_QUARTER_V1" ? 4 : ISO_RENDER_CONFIG.maxZoom, zoom = Phaser.Math.Clamp(requestedZoom,min,max), anchor = focusWorld || { x: camera.scrollX + focus.x / camera.zoom, y: camera.scrollY + focus.y / camera.zoom }; camera.setZoom(zoom); camera.scrollX = anchor.x - focus.x / zoom; camera.scrollY = anchor.y - focus.y / zoom; this.clampCamera(); }
            zoomBy(factor, x = this.scale.width / 2, y = this.scale.height / 2) { this.zoomTo(this.cameras.main.zoom * factor, { x, y }); }
            fitInitialCamera() {
                if (this.masterActive) {
                    const camera=this.cameras.main, width=this.masterConfig.width*.5, height=this.masterConfig.height*.5;
                    camera.setZoom(this.rasterMinZoom());
                    camera.scrollX=width/2-camera.width/(2*camera.zoom);camera.scrollY=height/2-camera.height/(2*camera.zoom);this.clampCamera();return;
                }
                const camera = this.cameras.main, fit = Math.min(camera.width / this.bounds.width, camera.height / this.bounds.height) * .94; camera.setZoom(Phaser.Math.Clamp(fit, ISO_RENDER_CONFIG.minZoom, ISO_RENDER_CONFIG.maxZoom)); camera.scrollX = this.bounds.x + this.bounds.width / 2 - camera.width / (2 * camera.zoom); camera.scrollY = this.bounds.y + this.bounds.height / 2 - camera.height / (2 * camera.zoom); this.clampCamera(); }
            centerOnWorld(point) { const screen = point && worldToIsometric(point); if (screen) { const camera = this.cameras.main; camera.scrollX = screen.x - camera.width / (2 * camera.zoom); camera.scrollY = screen.y - camera.height / (2 * camera.zoom); this.clampCamera(); } else this.fitInitialCamera(); }
            clampCamera() { const camera = this.cameras.main;
                if(this.masterActive){camera.setZoom(Math.max(camera.zoom,this.rasterMinZoom()));camera.scrollX=Phaser.Math.Clamp(camera.scrollX,0,Math.max(0,426.5-camera.width/camera.zoom));camera.scrollY=Phaser.Math.Clamp(camera.scrollY,0,Math.max(0,922-camera.height/camera.zoom));return;}
                const width = camera.width / camera.zoom, height = camera.height / camera.zoom; camera.scrollX = Phaser.Math.Clamp(camera.scrollX, this.bounds.x - width * .5, this.bounds.x + this.bounds.width - width * .5); camera.scrollY = Phaser.Math.Clamp(camera.scrollY, this.bounds.y - height * .5, this.bounds.y + this.bounds.height - height * .5); }
            showPlacementMarker(point) { this.clearPlacementMarker(); const screen = worldToIsometric(point); this.placementMarker = this.add.rectangle(screen.x, screen.y, 16, 9).setStrokeStyle(2, 0xf4d57b).setDepth(getIsoDepth(point, 100)); }
            clearPlacementMarker() { this.placementMarker?.destroy(); this.placementMarker = null; }
        }
        this.game = new Phaser.Game({ type: Phaser.AUTO, parent: host, transparent: false, backgroundColor: "#182126", width: host.clientWidth || 1, height: host.clientHeight || 1, scene: IsometricPrototypeScene, scale: { mode: Phaser.Scale.RESIZE, width: host.clientWidth || 1, height: host.clientHeight || 1 }, render: { pixelArt: false, antialias: true, roundPixels: false, resolution: Math.min(window.devicePixelRatio || 1, 2) } });
        this.game.canvas.id = "phaserMapCanvas"; host.classList.add("isometricRendererActive");
    },
    refreshMap() { if (!this.scene) return; this.scene.cancelGesture(); this.scene.staticObjects.forEach(object => object.destroy()); this.scene.staticObjects = []; this.scene.staticBuilt = false; this.scene.bounds = getIsometricMapBounds(); this.scene.drawStaticMap(); this.scene.sync(); this.scene.fitInitialCamera(); this.updateStatus(); },
    destroy() { this.scene?.inputController?.abort(); this.scene?.clearPlacementMarker?.(); this.scene?.cancelGesture?.(); this.scene = null; if (this.game) this.game.destroy(true); this.game = null; document.getElementById("mapViewport")?.classList.remove("isometricRendererActive"); },
    select(key) { const entity = getIsometricEntityByKey(key); if (!entity) return; if (key.startsWith("employee:")) selectEmployee(entity); else if (key.startsWith("customer:")) selectCustomer(entity); else if (key.startsWith("apartment:")) openApartmentDetails(entity.id); },
    zoomBy(factor, x, y) { this.scene?.zoomBy(factor, x, y); }, centerOnWorld(point) { this.scene?.centerOnWorld(point); }, showPlacementMarker(point) { this.scene?.showPlacementMarker(point); }, clearPlacementMarker() { this.scene?.clearPlacementMarker(); }
};

// Existing restoration/frame adapters use this explicit window boundary.
window.PhaserMapRenderer = PhaserMapRenderer;
window.setMapRenderMode = mode => PhaserMapRenderer.setMode(mode);
window.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("mapRendererMode");
    const menu = document.querySelector(".rendererMenu");
    if (menu) menu.hidden = !DEBUG;
    select?.addEventListener("change", event => { PhaserMapRenderer.setMode(event.target.value); });
    if (DEBUG) {
        const label = document.createElement('label'); label.textContent = 'Décor';
        const housing = document.createElement('select'); housing.id = 'housingAssetMode'; housing.setAttribute('aria-label', 'Comparaison du décor');
        [['procedural', 'Procédural'], ['asset', 'Décor pré-rendu']].forEach(([value, text]) => { const option = document.createElement('option'); option.value = value; option.textContent = text; housing.appendChild(option); });
        housing.addEventListener('change', event => PhaserMapRenderer.setHousingMode(event.target.value)); label.appendChild(housing);
        document.querySelector('.rendererMenu')?.appendChild(label);
        const debug = document.createElement('button'); debug.textContent = 'Géométrie';
        debug.addEventListener('click', () => { const scene=PhaserMapRenderer.scene;if(scene){scene.masterDebug=!scene.masterDebug;if(scene.masterDebug && !scene.masterDebugGraphic)drawMasterDebug(scene);scene.masterDebugGraphic?.setVisible(scene.masterDebug);} });
        document.querySelector('.rendererMenu')?.appendChild(debug);
    }
    let preference = "isometric"; try { preference = localStorage.getItem("quartier.mapRendererMode") || "isometric"; } catch { /* préférence facultative */ }
    PhaserMapRenderer.updateStatus(); if (preference === "isometric") PhaserMapRenderer.setMode("isometric", { silent: true });
}, { once: true });
