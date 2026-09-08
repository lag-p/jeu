// Frontière de rendu Phaser : aucune règle métier ni boucle de simulation ici.
const PHASER_VERSION = "3.90.0";
const PHASER_LOCAL_URL = `assets/vendor/phaser-${PHASER_VERSION}.min.js`;
const ISO_GESTURE = Object.freeze({ tapSlop: 10, minPointers: 2 });

const PhaserMapRenderer = {
    mode: "classic", game: null, scene: null, loading: null, lastError: "",
    isActive() { return this.mode === "isometric" && Boolean(this.game && this.scene); },
    getDebugInfo() { return { mode: this.mode, mapId: mapData.mapId, buildings: mapData.buildings.length, nodes: mapData.navigation.nodes.length, edges: mapData.navigation.connections.length, activeObjects: this.scene ? this.scene.children.list.length + [...this.scene.visuals.values()].reduce((n, v) => n + v.container.list.length, 0) : 0, invalidPath: [...game.employees, ...customers, playerMapEntity].some(e => e.pathBlocked), error: this.lastError || "aucune" }; },
    updateStatus() {
        const select = document.getElementById("mapRendererMode"), status = document.getElementById("renderDebugStatus"), info = this.getDebugInfo();
        if (select) select.value = this.mode;
        if (status) { status.hidden = !DEBUG; status.textContent = `Rendu : ${info.mode === "isometric" ? "prototype isométrique" : "classique"} · ${info.activeObjects} objets${this.lastError ? " · repli activé" : ""}`; }
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
        class IsometricPrototypeScene extends Phaser.Scene {
            constructor() { super({ key: "isometric-prototype" }); this.visuals = new Map(); this.pointers = new Map(); this.gestureState = "IDLE"; this.placementMarker = null; this.staticObjects = []; this.staticBuilt = false; }
            create() {
                renderer.scene = this; this.bounds = getIsometricMapBounds();
                this.cameras.main.setOrigin(0, 0);
                this.drawStaticMap(); this.bindInput(); this.fitInitialCamera(); this.sync();
                this.scale.on("resize", () => { this.cancelGesture(); this.fitInitialCamera(); });
            }
            update() { this.sync(); }
            addPolygon(graphics, points, fill, line = 0x39484e) { graphics.fillStyle(fill, 1); graphics.fillPoints(points, true); graphics.lineStyle(1, line, .72); graphics.strokePoints(points, true); }
            drawRoadBand(graphics, first, second, width, color) {
                const dx = second.x - first.x, dy = second.y - first.y, length = Math.hypot(dx, dy) || 1, offset = { x: -dy / length * width / 2, y: dx / length * width / 2 };
                this.addPolygon(graphics, [worldToIsometric({ x: first.x + offset.x, y: first.y + offset.y }), worldToIsometric({ x: second.x + offset.x, y: second.y + offset.y }), worldToIsometric({ x: second.x - offset.x, y: second.y - offset.y }), worldToIsometric({ x: first.x - offset.x, y: first.y - offset.y })], color, 0x45555a);
            }
            drawStaticMap() {
                if (this.staticBuilt) return;
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
                const graphics = this.add.graphics(), elevation = mapData.buildings[index].visualHeight, bottom = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }].map(point => worldToIsometric(point)), top = bottom.map(point => ({ x: point.x, y: point.y - elevation })), roof = [0x9eaaa7, 0xb0b5a7, 0x95a6a1][index % 3];
                this.addPolygon(graphics, [top[3], top[2], bottom[2], bottom[3]], 0x26383d, 0x172428); this.addPolygon(graphics, [top[1], top[2], bottom[2], bottom[1]], 0x33464b, 0x172428); this.addPolygon(graphics, top, roof, 0x708187);
                graphics.setDepth(getIsoDepth({ x: x + width, y: y + height }, 5)); this.staticObjects.push(graphics);
            }
            drawPlaceMarker(point, index) {
                if (!point) return; const screen = worldToIsometric(point), graphics = this.add.graphics().setDepth(getIsoDepth(point, 45)), color = point.id?.includes("fallback") ? 0x7cd5c2 : point.sellerId ? 0xf2b95f : 0x94c5d8;
                graphics.lineStyle(2, color, .9).strokeCircle(screen.x, screen.y - 5, 7); if (index % 2 === 0) graphics.fillStyle(color, .8).fillTriangle(screen.x, screen.y - 12, screen.x - 4, screen.y - 5, screen.x + 4, screen.y - 5); this.staticObjects.push(graphics);
            }
            createVisual(entity) {
                const shadow = this.add.ellipse(0, 7, 24, 8, 0x0a1113, .42), body = this.add.rectangle(0, -2, entity.type === "player" ? 17 : 14, 18, entity.color).setStrokeStyle(1, 0x112025), head = this.add.circle(0, -14, 5, 0xf0c8a6).setStrokeStyle(1, 0x172328), badge = this.add.graphics(), badgeColor = entity.color;
                if (entity.role === "guetteur") badge.fillStyle(badgeColor, 1).fillTriangle(-5, -7, 5, -7, 0, -15); else if (entity.role === "gerant") badge.fillStyle(badgeColor, 1).fillPoints([{ x: 0, y: -16 }, { x: 5, y: -11 }, { x: 0, y: -6 }, { x: -5, y: -11 }], true); else if (entity.role === "ravitailleur") badge.fillStyle(badgeColor, 1).fillRect(-7, -7, 14, 5); else badge.fillStyle(badgeColor, 1).fillCircle(0, -10, 3);
                const ring = entity.type === "player" ? this.add.circle(0, 3, 13).setStrokeStyle(2, 0xe7f4ef, .9) : null, container = this.add.container(0, 0, [shadow, body, head, badge, ...(ring ? [ring] : [])]);
                container.setSize(34, 42); container.setData("isoKey", entity.key);
                // Zone séparée du conteneur : Phaser conserve alors la cible
                // tactile même quand les enfants sont masqués par un volume.
                const hit = this.add.circle(0, 0, 18, 0xffffff, .001);
                return { container, body, hit, entity };
            }
            sync() {
                const state = createIsometricRenderState(), incoming = new Set();
                state.entities.forEach(entity => { incoming.add(entity.key); let visual = this.visuals.get(entity.key); if (!visual) { visual = this.createVisual(entity); this.visuals.set(entity.key, visual); } visual.entity = entity; const point = worldToIsometric(entity), depth = getIsoDepth(entity, 60); visual.container.setPosition(point.x, point.y).setDepth(depth); visual.hit.setPosition(point.x, point.y).setDepth(depth + 1); visual.body.setFillStyle(entity.color, entity.state === EMPLOYEE_OPERATION.BLOCKED ? .62 : 1); });
                for (const [key, visual] of this.visuals) if (!incoming.has(key)) { visual.hit.destroy(); visual.container.destroy(true); this.visuals.delete(key); } if (!mapPlacement && this.placementMarker) this.clearPlacementMarker();
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
            zoomTo(requestedZoom, focus = { x: this.scale.width / 2, y: this.scale.height / 2 }, focusWorld = null) { const camera = this.cameras.main, zoom = Phaser.Math.Clamp(requestedZoom, ISO_RENDER_CONFIG.minZoom, ISO_RENDER_CONFIG.maxZoom), anchor = focusWorld || { x: camera.scrollX + focus.x / camera.zoom, y: camera.scrollY + focus.y / camera.zoom }; camera.setZoom(zoom); camera.scrollX = anchor.x - focus.x / zoom; camera.scrollY = anchor.y - focus.y / zoom; this.clampCamera(); }
            zoomBy(factor, x = this.scale.width / 2, y = this.scale.height / 2) { this.zoomTo(this.cameras.main.zoom * factor, { x, y }); }
            fitInitialCamera() { const camera = this.cameras.main, fit = Math.min(camera.width / this.bounds.width, camera.height / this.bounds.height) * .94; camera.setZoom(Phaser.Math.Clamp(fit, ISO_RENDER_CONFIG.minZoom, ISO_RENDER_CONFIG.maxZoom)); camera.scrollX = this.bounds.x + this.bounds.width / 2 - camera.width / (2 * camera.zoom); camera.scrollY = this.bounds.y + this.bounds.height / 2 - camera.height / (2 * camera.zoom); this.clampCamera(); }
            centerOnWorld(point) { const screen = point && worldToIsometric(point); if (screen) { const camera = this.cameras.main; camera.scrollX = screen.x - camera.width / (2 * camera.zoom); camera.scrollY = screen.y - camera.height / (2 * camera.zoom); this.clampCamera(); } else this.fitInitialCamera(); }
            clampCamera() { const camera = this.cameras.main, width = camera.width / camera.zoom, height = camera.height / camera.zoom; camera.scrollX = Phaser.Math.Clamp(camera.scrollX, this.bounds.x - width * .5, this.bounds.x + this.bounds.width - width * .5); camera.scrollY = Phaser.Math.Clamp(camera.scrollY, this.bounds.y - height * .5, this.bounds.y + this.bounds.height - height * .5); }
            showPlacementMarker(point) { this.clearPlacementMarker(); const screen = worldToIsometric(point); this.placementMarker = this.add.rectangle(screen.x, screen.y, 16, 9).setStrokeStyle(2, 0xf4d57b).setDepth(getIsoDepth(point, 100)); }
            clearPlacementMarker() { this.placementMarker?.destroy(); this.placementMarker = null; }
        }
        this.game = new Phaser.Game({ type: Phaser.AUTO, parent: host, transparent: false, backgroundColor: "#182126", width: host.clientWidth || 1, height: host.clientHeight || 1, scene: IsometricPrototypeScene, scale: { mode: Phaser.Scale.RESIZE, width: host.clientWidth || 1, height: host.clientHeight || 1 }, render: { pixelArt: true, antialias: false, roundPixels: true, resolution: Math.min(window.devicePixelRatio || 1, 2) } });
        this.game.canvas.id = "phaserMapCanvas"; host.classList.add("isometricRendererActive");
    },
    refreshMap() { if (!this.scene) return; this.scene.cancelGesture(); this.scene.staticObjects.forEach(object => object.destroy()); this.scene.staticObjects = []; this.scene.staticBuilt = false; this.scene.bounds = getIsometricMapBounds(); this.scene.drawStaticMap(); this.scene.sync(); this.scene.fitInitialCamera(); this.updateStatus(); },
    destroy() { this.scene?.inputController?.abort(); this.scene?.clearPlacementMarker?.(); this.scene?.cancelGesture?.(); this.scene = null; if (this.game) this.game.destroy(true); this.game = null; document.getElementById("mapViewport")?.classList.remove("isometricRendererActive"); },
    select(key) { const entity = getIsometricEntityByKey(key); if (!entity) return; if (key.startsWith("employee:")) selectEmployee(entity); else if (key.startsWith("customer:")) selectCustomer(entity); else if (key.startsWith("apartment:")) openApartmentDetails(entity.id); },
    zoomBy(factor, x, y) { this.scene?.zoomBy(factor, x, y); }, centerOnWorld(point) { this.scene?.centerOnWorld(point); }, showPlacementMarker(point) { this.scene?.showPlacementMarker(point); }, clearPlacementMarker() { this.scene?.clearPlacementMarker(); }
};

window.setMapRenderMode = mode => PhaserMapRenderer.setMode(mode);
window.addEventListener("DOMContentLoaded", () => { const select = document.getElementById("mapRendererMode"); select?.addEventListener("change", event => { PhaserMapRenderer.setMode(event.target.value); }); let preference = "classic"; try { preference = localStorage.getItem("quartier.mapRendererMode") || "classic"; } catch { /* préférence facultative */ } PhaserMapRenderer.updateStatus(); if (preference === "isometric") PhaserMapRenderer.setMode("isometric", { silent: true }); }, { once: true });
