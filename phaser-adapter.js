// Adaptateur de lecture pour le prototype Phaser. Il ne modifie jamais la
// simulation : les coordonnées métier restent cartésiennes, de 0 à 100.
const ISO_RENDER_CONFIG = Object.freeze({
    tileWidth: 7.2,
    tileHeight: 4.2,
    originX: 380,
    originY: 42,
    worldWidth: 760,
    worldHeight: 470,
    minZoom: .2,
    maxZoom: 1.8
});

function worldToIsometric(point, config = ISO_RENDER_CONFIG) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    if (config === ISO_RENDER_CONFIG && isRasterMap()) return {x:point.x*8.53*.5,y:point.y*18.44*.5};
    const master = config === ISO_RENDER_CONFIG && typeof masterScene === 'function' && masterScene();
    if (master) return masterTransform(point, master.masterConfig);
    return {
        x: config.originX + (point.x - point.y) * config.tileWidth / 2,
        y: config.originY + (point.x + point.y) * config.tileHeight / 2
    };
}

function isometricToWorld(point, config = ISO_RENDER_CONFIG) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    if (config === ISO_RENDER_CONFIG && isRasterMap()) return {x:point.x/(8.53*.5),y:point.y/(18.44*.5)};
    const master = config === ISO_RENDER_CONFIG && typeof masterScene === 'function' && masterScene();
    if (master) return masterTransform(point, master.masterConfig, true);
    const horizontal = (point.x - config.originX) / (config.tileWidth / 2);
    const vertical = (point.y - config.originY) / (config.tileHeight / 2);
    return { x: (horizontal + vertical) / 2, y: (vertical - horizontal) / 2 };
}

function getIsoRenderKey(type, id) {
    return `${type}:${String(id)}`;
}

function getIsoDepth(point, elevation = 0) {
    const screen = worldToIsometric(point);
    return screen ? Math.round(screen.y * 100 + elevation) : 0;
}

function isoSceneToWorld(point, camera) {
    if (!point || !camera) return null;
    return isometricToWorld(camera.getWorldPoint(point.x, point.y));
}

function getIsometricMapBounds() {
    const corners = mapData.perimeter.map(point => worldToIsometric(point));
    const xs = corners.map(point => point.x), ys = corners.map(point => point.y);
    return { x: Math.min(...xs) - 20, y: Math.min(...ys) - 48, width: Math.max(...xs) - Math.min(...xs) + 40, height: Math.max(...ys) - Math.min(...ys) + 72 };
}

function isoRoleShape(role) {
    return ({ vendeur: "square", guetteur: "triangle", gerant: "diamond", ravitailleur: "capsule" })[role] || "circle";
}

function isoRoleColor(role) {
    return ({ PLAYER: 0xe9f1f4, vendeur: 0xf6a34f, guetteur: 0x75c7ff, gerant: 0xbd8cff, ravitailleur: 0x74d29c, customer: 0xf1d26a, apartment: 0x5fc4b5, police: 0xe87979 })[role] || 0xd6dde0;
}

function createIsometricRenderState() {
    const entities = [];
    const add = (type, id, source, role, selectable = true) => {
        if (!source || !Number.isFinite(source.x) || !Number.isFinite(source.y)) return;
        entities.push({
            key: getIsoRenderKey(type, id), businessId: id, type, role, visualType: type === "apartment" ? "door" : "character", shape: isoRoleShape(role),
            color: isoRoleColor(role), x: source.x, y: source.y,
            nextPoint: source.navRoute?.[0] || source.destination || null, walking: Boolean(source.moving && game.dayActive),
            state: source.operationalState || source.state || "",
            selectable
        });
    };
    add("player", "player", { x: game.playerX, y: game.playerY, navRoute:playerMapEntity.navRoute, moving:Boolean(game.playerDestination), destination:game.playerDestination }, "PLAYER", false);
    game.apartments.filter(apartment => apartment.active).forEach(apartment => add("apartment", apartment.id, apartment, "apartment"));
    game.employees.filter(employee => employee.active).forEach(employee => add("employee", employee.id, employee, employee.role));
    customers.forEach(customer => add("customer", customer.id, customer, "customer"));
    police.patrols.forEach(patrol => add("police", patrol.id, patrol, "police", false));
    return { entities, mapId: mapData.mapId, buildings: MAP_BUILDINGS, geometry: mapData, zones: mapData.zones, entries: mapData.entries, fallbackPoints: mapData.fallbackPoints, salesPoints: mapData.salesPoints };
}

function getIsometricEntityByKey(key) {
    const [type, ...idParts] = String(key).split(":");
    const id = idParts.join(":");
    if (type === "employee") return getEmployeeById(id);
    if (type === "apartment") return getApartmentById(id);
    if (type === "customer") return customers.find(customer => String(customer.id) === id) || null;
    return null;
}
