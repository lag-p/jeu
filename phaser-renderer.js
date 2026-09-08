// Renderer expérimental, chargé seulement à la demande. Phaser 3.90.0 est
// volontairement figé et servi par CDN pour ne pas introduire de compilation.
const PHASER_VERSION = "3.90.0";
const PHASER_CDN_URL = `https://cdn.jsdelivr.net/npm/phaser@${PHASER_VERSION}/dist/phaser.min.js`;

const PhaserMapRenderer = {
    mode: "classic",
    game: null,
    scene: null,
    loading: null,
    lastError: "",

    isActive() { return this.mode === "isometric" && Boolean(this.game && this.scene); },
    getDebugInfo() {
        return { mode: this.mode, activeObjects: this.scene?.visuals?.size || 0, error: this.lastError || "aucune" };
    },
    updateStatus() {
        const select = document.getElementById("mapRendererMode");
        const status = document.getElementById("renderDebugStatus");
        if (select) select.value = this.mode;
        if (status) {
            const info = this.getDebugInfo();
            status.textContent = `Rendu : ${info.mode === "isometric" ? "prototype isométrique" : "classique"} · ${info.activeObjects} objets${this.lastError ? " · repli activé" : ""}`;
        }
    },
    async loadPhaser() {
        if (window.Phaser) return window.Phaser;
        if (this.loading) return this.loading;
        this.loading = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = window.__PHASER_URL_OVERRIDE__ || PHASER_CDN_URL;
            script.async = true;
            script.dataset.phaserVersion = PHASER_VERSION;
            script.onload = () => window.Phaser ? resolve(window.Phaser) : reject(new Error("Phaser chargé mais indisponible"));
            script.onerror = () => reject(new Error(`Chargement Phaser ${PHASER_VERSION} impossible`));
            document.head.appendChild(script);
        }).finally(() => { this.loading = null; });
        return this.loading;
    },
    async setMode(mode, options = {}) {
        if (!['classic', 'isometric'].includes(mode)) return false;
        if (mode === "classic") {
            this.destroy(); this.mode = "classic"; this.lastError = ""; this.persist(); this.updateStatus(); return true;
        }
        if (mapPlacement) {
            showMessage("Termine le placement avant d'activer le prototype.");
            this.updateStatus(); return false;
        }
        try {
            await this.loadPhaser();
            this.start(); this.mode = "isometric"; this.lastError = ""; this.persist(); this.updateStatus(); return true;
        } catch (error) {
            this.destroy(); this.mode = "classic"; this.lastError = error.message;
            console.error("Prototype isométrique indisponible :", error);
            if (!options.silent) showMessage("Prototype indisponible : rendu classique conservé.");
            this.persist(); this.updateStatus(); return false;
        }
    },
    persist() {
        try { localStorage.setItem("quartier.mapRendererMode", this.mode); } catch { /* préférence facultative */ }
    },
    start() {
        if (this.game) return;
        const Phaser = window.Phaser;
        const host = document.getElementById("mapViewport");
        if (!Phaser || !host) throw new Error("Canvas prototype indisponible");
        const renderer = this;
        class IsometricPrototypeScene extends Phaser.Scene {
            constructor() { super({ key: "isometric-prototype" }); this.visuals = new Map(); this.pointers = new Map(); this.placementMarker = null; }
            create() {
                renderer.scene = this;
                this.cameras.main.setBounds(0, 0, ISO_RENDER_CONFIG.worldWidth, ISO_RENDER_CONFIG.worldHeight);
                this.cameras.main.setZoom(1);
                this.cameras.main.centerOn(ISO_RENDER_CONFIG.worldWidth / 2, ISO_RENDER_CONFIG.worldHeight / 2);
                this.input.addPointer(2);
                this.drawStaticMap(); this.bindInput(); this.sync();
                this.scale.on("resize", () => this.clampCamera());
            }
            update() { this.sync(); }
            drawStaticMap() {
                const state = createIsometricRenderState(), graphics = this.add.graphics().setDepth(1);
                const polygon = (x, y, width, height, color) => {
                    const points = [worldToIsometric({ x, y }), worldToIsometric({ x: x + width, y }), worldToIsometric({ x: x + width, y: y + height }), worldToIsometric({ x, y: y + height })];
                    graphics.fillStyle(color, 1); graphics.fillPoints(points, true); graphics.lineStyle(1, 0x314048, .8); graphics.strokePoints(points, true);
                };
                // Passages schématiques issus des zones et des entrées de mapData.
                graphics.lineStyle(8, 0x394449, 1);
                for (const entry of state.entries) { const target = state.zones.reduce((best, zone) => !best || mapDistance(entry, zone) < mapDistance(entry, best) ? zone : best, null); if (target) { const a = worldToIsometric(entry), b = worldToIsometric(target); graphics.lineBetween(a.x, a.y, b.x, b.y); } }
                graphics.lineStyle(7, 0x3e4b50, 1);
                for (let index = 1; index < state.zones.length; index++) { const a = worldToIsometric(state.zones[index - 1]), b = worldToIsometric(state.zones[index]); graphics.lineBetween(a.x, a.y, b.x, b.y); }
                state.buildings.forEach(([, x, y, width, height]) => polygon(x, y, width, height, 0x29343a));
                state.zones.forEach(zone => { const point = worldToIsometric(zone); graphics.fillStyle(0x91a3a4, .65); graphics.fillCircle(point.x, point.y, 3); });
                this.staticObjectCount = state.buildings.length + state.zones.length + state.entries.length;
            }
            createVisual(entity) {
                const point = worldToIsometric(entity);
                let shape;
                if (entity.shape === "square") shape = this.add.rectangle(point.x, point.y, 12, 12, entity.color);
                else if (entity.shape === "triangle") shape = this.add.triangle(point.x, point.y, 0, 11, 6, 0, 12, 11, entity.color);
                else if (entity.shape === "diamond") shape = this.add.polygon(point.x, point.y, [0, -7, 7, 0, 0, 7, -7, 0], entity.color);
                else if (entity.shape === "capsule") shape = this.add.rectangle(point.x, point.y, 15, 8, entity.color);
                else if (entity.type === "apartment") shape = this.add.rectangle(point.x, point.y, 16, 12, entity.color);
                else shape = this.add.circle(point.x, point.y, entity.type === "customer" ? 5 : 6, entity.color);
                shape.setStrokeStyle(2, 0x10161a, 1).setDepth(getIsoDepth(entity, 50));
                if (entity.selectable) {
                    shape.setInteractive({ useHandCursor: true });
                    shape.on("pointerdown", pointer => {
                        const state = this.pointers.get(pointer.id) || { x: pointer.x, y: pointer.y, lastX: pointer.x, lastY: pointer.y, dragged: false, key: null };
                        state.key = entity.key; this.pointers.set(pointer.id, state);
                    });
                    shape.on("pointerup", pointer => { const state = this.pointers.get(pointer.id); if (state && !state.dragged && state.key === entity.key) renderer.select(entity.key); });
                }
                return shape;
            }
            sync() {
                const state = createIsometricRenderState(), incoming = new Set();
                state.entities.forEach(entity => {
                    incoming.add(entity.key);
                    let visual = this.visuals.get(entity.key);
                    if (!visual) { visual = this.createVisual(entity); this.visuals.set(entity.key, visual); }
                    const point = worldToIsometric(entity);
                    visual.setPosition(point.x, point.y).setDepth(getIsoDepth(entity, 50));
                    visual.setFillStyle(entity.color, entity.state === EMPLOYEE_OPERATION.BLOCKED ? .65 : 1);
                });
                for (const [key, visual] of this.visuals) if (!incoming.has(key)) { visual.destroy(); this.visuals.delete(key); }
                if (!mapPlacement && this.placementMarker) this.clearPlacementMarker();
                renderer.updateStatus();
            }
            bindInput() {
                this.input.on("pointerdown", pointer => {
                    const current = this.pointers.get(pointer.id);
                    this.pointers.set(pointer.id, { x: pointer.x, y: pointer.y, lastX: pointer.x, lastY: pointer.y, dragged: false, key: current?.key || null });
                });
                this.input.on("pointermove", pointer => {
                    const state = this.pointers.get(pointer.id); if (!state) return;
                    const active = [...this.pointers.values()];
                    if (active.length >= 2) {
                        const [a, b] = active, distance = Math.hypot(a.lastX - b.lastX, a.lastY - b.lastY);
                        const previousX = state.lastX, previousY = state.lastY;
                        state.lastX = pointer.x; state.lastY = pointer.y;
                        const nextDistance = Math.hypot(a.lastX - b.lastX, a.lastY - b.lastY);
                        if (distance > 0 && nextDistance > 0) this.zoomBy(nextDistance / distance, (a.lastX + b.lastX) / 2, (a.lastY + b.lastY) / 2);
                        active.forEach(item => { item.dragged = true; });
                        // Les valeurs précédentes ne sont conservées que pour
                        // rendre explicite que le calcul porte sur un delta.
                        void previousX; void previousY;
                    } else if (!state.key) {
                        const dx = pointer.x - state.lastX, dy = pointer.y - state.lastY;
                        if (Math.hypot(pointer.x - state.x, pointer.y - state.y) > 10) state.dragged = true;
                        if (state.dragged) { this.cameras.main.scrollX -= dx / this.cameras.main.zoom; this.cameras.main.scrollY -= dy / this.cameras.main.zoom; this.clampCamera(); }
                    }
                    if (active.length < 2) { state.lastX = pointer.x; state.lastY = pointer.y; }
                });
                this.input.on("pointerup", pointer => {
                    const state = this.pointers.get(pointer.id);
                    if (state && !state.dragged && !state.key && mapPlacement) {
                        const rect = document.getElementById("map").getBoundingClientRect();
                        handleMapPlacement({ clientX: rect.left + pointer.x, clientY: rect.top + pointer.y, target: this.game.canvas });
                    }
                    this.pointers.delete(pointer.id);
                });
                this.input.on("pointerupoutside", pointer => this.pointers.delete(pointer.id));
            }
            zoomBy(factor, x = this.scale.width / 2, y = this.scale.height / 2) {
                const camera = this.cameras.main, previous = camera.zoom, zoom = Phaser.Math.Clamp(previous * factor, ISO_RENDER_CONFIG.minZoom, ISO_RENDER_CONFIG.maxZoom);
                const world = camera.getWorldPoint(x, y); camera.setZoom(zoom); const after = camera.getWorldPoint(x, y);
                camera.scrollX += world.x - after.x; camera.scrollY += world.y - after.y; this.clampCamera();
            }
            centerOnWorld(point) { const screen = worldToIsometric(point); if (screen) { this.cameras.main.centerOn(screen.x, screen.y); this.clampCamera(); } }
            clampCamera() {
                const camera = this.cameras.main, width = camera.width / camera.zoom, height = camera.height / camera.zoom;
                camera.scrollX = Phaser.Math.Clamp(camera.scrollX, 0, Math.max(0, ISO_RENDER_CONFIG.worldWidth - width));
                camera.scrollY = Phaser.Math.Clamp(camera.scrollY, 0, Math.max(0, ISO_RENDER_CONFIG.worldHeight - height));
            }
            showPlacementMarker(point) {
                this.clearPlacementMarker(); const screen = worldToIsometric(point); this.placementMarker = this.add.rectangle(screen.x, screen.y, 16, 9).setStrokeStyle(2, 0xf4d57b).setDepth(getIsoDepth(point, 100));
            }
            clearPlacementMarker() { this.placementMarker?.destroy(); this.placementMarker = null; }
        }
        this.game = new Phaser.Game({
            type: Phaser.AUTO, parent: host, transparent: false, backgroundColor: "#182126",
            width: host.clientWidth || 1, height: host.clientHeight || 1,
            scene: IsometricPrototypeScene,
            scale: { mode: Phaser.Scale.RESIZE, width: host.clientWidth || 1, height: host.clientHeight || 1 },
            render: { pixelArt: true, antialias: false, roundPixels: true, resolution: Math.min(window.devicePixelRatio || 1, 2) }
        });
        this.game.canvas.id = "phaserMapCanvas";
        host.classList.add("isometricRendererActive");
    },
    destroy() {
        this.scene?.clearPlacementMarker?.(); this.scene = null;
        if (this.game) this.game.destroy(true);
        this.game = null; document.getElementById("mapViewport")?.classList.remove("isometricRendererActive");
    },
    select(key) {
        const entity = getIsometricEntityByKey(key);
        if (!entity) return;
        if (key.startsWith("employee:")) selectEmployee(entity);
        else if (key.startsWith("customer:")) selectCustomer(entity);
        else if (key.startsWith("apartment:")) openApartmentDetails(entity.id);
    },
    zoomBy(factor, x, y) { this.scene?.zoomBy(factor, x, y); },
    centerOnWorld(point) { this.scene?.centerOnWorld(point); },
    showPlacementMarker(point) { this.scene?.showPlacementMarker(point); },
    clearPlacementMarker() { this.scene?.clearPlacementMarker(); }
};

window.setMapRenderMode = mode => PhaserMapRenderer.setMode(mode);
window.addEventListener("DOMContentLoaded", () => {
    const select = document.getElementById("mapRendererMode");
    select?.addEventListener("change", event => { PhaserMapRenderer.setMode(event.target.value); });
    let preference = "classic";
    try { preference = localStorage.getItem("quartier.mapRendererMode") || "classic"; } catch { /* préférence facultative */ }
    PhaserMapRenderer.updateStatus();
    if (preference === "isometric") PhaserMapRenderer.setMode("isometric", { silent: true });
}, { once: true });
