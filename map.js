// ===============================
// CARTE, ZONES ET DEPLACEMENTS
// ===============================

const LEGACY_MAP_DATA = {
    zones: [
        { id: "NORTH_ENTRANCE", x: 50, y: 10, type: "entry" },
        { id: "SOUTH_ENTRANCE", x: 50, y: 91, type: "entry" },
        { id: "WEST_ENTRANCE", x: 9, y: 52, type: "entry" },
        { id: "EAST_ENTRANCE", x: 91, y: 50, type: "entry" },
        { id: "MAIN_STREET", x: 50, y: 38, type: "avenue" },
        { id: "CENTRAL_SQUARE", x: 50, y: 54, type: "square" },
        { id: "RESIDENTIAL_BLOCK", x: 23, y: 27, type: "residential" },
        { id: "BACK_ALLEY", x: 78, y: 28, type: "alley" },
        { id: "PARKING", x: 78, y: 75, type: "parking" },
        { id: "INNER_COURT", x: 25, y: 75, type: "court" }
    ],
    entries: [
        { id: "entry-north", x: 50, y: 2 },
        { id: "entry-north-west", x: 16, y: 3 },
        { id: "entry-west", x: 2, y: 52 },
        { id: "entry-east", x: 98, y: 50 },
        { id: "entry-south", x: 50, y: 98 },
        { id: "entry-south-east", x: 88, y: 97 }
    ],
    fallbackPoints: [
        { id: "fallback-center", x: 50, y: 50 }
    ],
    salesPoints: [],
    strategicSalesSites: [
        { id: "SITE_AVENUE", x: 50, y: 36, traffic: 1.5, visibility: 1.4, accessibility: 1.4, capacity: 5, importance: 1.5 },
        { id: "SITE_SQUARE", x: 45, y: 57, traffic: 1.25, visibility: 1.1, accessibility: 1.2, capacity: 4, importance: 1.3 },
        { id: "SITE_ALLEY", x: 76, y: 30, traffic: 0.75, visibility: 0.45, accessibility: 0.7, capacity: 2, importance: 0.8 },
        { id: "SITE_COURT", x: 24, y: 73, traffic: 0.65, visibility: 0.35, accessibility: 0.55, capacity: 2, importance: 0.7 },
        { id: "SITE_PARKING", x: 76, y: 74, traffic: 1.05, visibility: 0.75, accessibility: 0.9, capacity: 3, importance: 1.05 }
    ],
    apartmentSites: [
        { id: "APT_CENTRAL", name: "Appartement central", x: 42, y: 48, capacityBonus: 0 },
        { id: "APT_NORTH", name: "Appartement nord", x: 28, y: 20, capacityBonus: 15 },
        { id: "APT_SOUTH", name: "Appartement sud", x: 54, y: 82, capacityBonus: 10 },
        { id: "APT_COURT", name: "Appartement cour", x: 20, y: 78, capacityBonus: 0 },
        { id: "APT_REMOTE", name: "Grand appartement", x: 84, y: 70, capacityBonus: 30 }
    ]
};

let mapPlacement = null;
let watcherRadiusOverlay = null;
const LEGACY_BUILDINGS = [
    ["Résidence", 8, 12, 22, 18], ["Commerces", 35, 12, 26, 13],
    ["Résidence", 68, 12, 23, 17], ["Cour", 10, 64, 25, 22],
    ["Ateliers", 65, 61, 27, 18], ["Immeuble", 36, 70, 21, 18],
    ["Bureaux", 70, 37, 20, 15], ["Immeuble", 10, 38, 22, 16]
];

function createLegacyMap() {
    return { ...JSON.parse(JSON.stringify(LEGACY_MAP_DATA)), schemaVersion: 1, dimensions: { width: 100, height: 100, unit: "simulation" },
        render: { assetManifest: "assets/art-v1/manifest.json", style: "legacy" }, altitude: { mode: "flat", levels: [0] }, sources: { geometry: "legacy-test", osmUsed: false }, vehicleNavigation: { nodes: [], connections: [], implemented: false },
        mapId: "LEGACY_TEST_MAP", buildings: LEGACY_BUILDINGS.map(([label, x, y, w, h], i) => mapRect(`LEGACY_BLOCK_${i}`, x, y, w, h, "facade", { label, visualHeight: 18 + i % 3 * 5 })),
        perimeter: [{ x: 1, y: 1 }, { x: 99, y: 1 }, { x: 99, y: 99 }, { x: 1, y: 99 }],
        roads: [], walls: [], transitions: [], courts: [], sidewalks: [], crossings: [], openSpaces: [], parking: [], vegetation: [], obstacles: [], buildingEntries: [], logisticsPlaces: [], pointsOfInterest: [] };
}
const MAP_FACTORIES = Object.freeze({ RASTER_QUARTER_V1: createRasterMap, REFERENCE_QUARTER_V1: createReferenceMap, PONCETTE_INSPIRED_V1: createInspiredMap, LEGACY_TEST_MAP: createLegacyMap });
const mapData = {};
let MAP_BUILDINGS = [];
function activateMapData(mapId) {
    if (!Object.hasOwn(MAP_FACTORIES, mapId)) throw new Error("Carte inconnue");
    Object.keys(mapData).forEach(key => delete mapData[key]);
    Object.assign(mapData, MAP_FACTORIES[mapId]());
    mapData.apartmentSites.forEach(site => { site.mapId = mapId; });
    MAP_BUILDINGS = mapData.buildings.map(b => [b.label || "Résidence", b.x, b.y, b.width, b.height]);
    mapData.blockedPolygons = [...mapData.buildings.map(b => isRasterMap() ? b : mapRect(b.id, b.x - .5, b.y - .5, b.width + 1, b.height + 1, b.visualType)), ...mapData.walls, ...mapData.obstacles, ...mapData.vegetation].map(b => b.polygon);
    buildNavigation();
    buildTestNeighborhood();
}

function pointOnSegment(p, a, b) {
    return Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) < 1e-8 &&
        p.x >= Math.min(a.x, b.x) - 1e-8 && p.x <= Math.max(a.x, b.x) + 1e-8 && p.y >= Math.min(a.y, b.y) - 1e-8 && p.y <= Math.max(a.y, b.y) + 1e-8;
}
function pointInPolygon(p, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[j], b = polygon[i];
        if (pointOnSegment(p, a, b)) return true;
        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}
function segmentsIntersect(a, b, c, d) {
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0 ||
        pointOnSegment(a, c, d) || pointOnSegment(b, c, d) || pointOnSegment(c, a, b) || pointOnSegment(d, a, b);
}

function isWalkable(position) {
    return Number.isFinite(position?.x) && Number.isFinite(position?.y) && pointInPolygon(position, mapData.perimeter) &&
        !mapData.blockedPolygons.some(polygon => pointInPolygon(position, polygon)) && (!isRasterMap() || rasterOnCorridor(position));
}

function walkableSegment(a, b) {
    if (!isWalkable(a) || !isWalkable(b)) return false;
    if (isRasterMap()) {
        const steps=Math.ceil(rasterDistance(a,b)/2);
        for(let i=1;i<steps;i++)if(!rasterOnCorridor({x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps}))return false;
    }
    // Intersection exacte : même un mur mince ou un angle touché est bloqué.
    return !mapData.blockedPolygons.some(polygon => polygon.some((p, i) => segmentsIntersect(a, b, p, polygon[(i + 1) % polygon.length])));
}

function buildNavigation() {
    const raster = isRasterMap() ? buildRasterNavigation() : null;
    const nodes = raster?.nodes || [], lookup = raster?.lookup || new Map();
    if (!raster) for (let x = 1; x <= 99; x += 2) for (let y = 1; y <= 99; y += 2) {
        const node = { id: `${x},${y}`, x, y, edges: [] };
        if (isWalkable(node)) { nodes.push(node); lookup.set(node.id, node); }
    }
    if (!raster) nodes.forEach(node => {
        for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
            const other = lookup.get(`${node.x + dx},${node.y + dy}`);
            if (other && walkableSegment(node, other)) node.edges.push(other.id);
        }
    });
    mapData.navigation = raster || { nodes, lookup, connections: nodes.flatMap(node => node.edges.filter(id => node.id < id).map(id => ({ from: node.id, to: id, distance: mapDistance(node, lookup.get(id)) }))) };
    [...mapData.strategicSalesSites, ...mapData.apartmentSites, ...mapData.zones].forEach(site => {
        if (mapData.mapId === "LEGACY_TEST_MAP") Object.assign(site, nearestWalkable(site));
        else if (!isWalkable(site)) throw new Error(`Lieu inaccessible : ${site.id}`);
    });
    mapData.zones.forEach(zone => {
        const site = nearestSalesSite(zone);
        Object.assign(zone, { traffic: site.traffic, visibility: site.visibility, clientFlow: site.traffic, policeAttention: site.visibility, logisticsAccessibility: site.accessibility });
    });
    [...mapData.entries, ...mapData.apartmentSites, ...mapData.buildingEntries, ...mapData.fallbackPoints, ...mapData.strategicSalesSites].forEach(site => {
        const node = nodes.slice().sort((a, b) => mapDistance(site, a) - mapDistance(site, b) || a.id.localeCompare(b.id)).find(node => walkableSegment(site, node));
        site.navNodeId = node?.id || null;
    });
    mapData.transitions.forEach(transition => {
        transition.navNodeIds = [transition.from, transition.to].map(point => nodes.slice().sort((a, b) => mapDistance(point, a) - mapDistance(point, b) || a.id.localeCompare(b.id)).find(node => walkableSegment(point, node))?.id);
    });
}

function nearestWalkable(position) {
    if (isWalkable(position)) return { x: position.x, y: position.y };
    const node = mapData.navigation.nodes.reduce((best, item) => !best || mapDistance(position, item) < mapDistance(position, best) ? item : best, null);
    return { x: node.x, y: node.y };
}

function findMapPath(start, goal) {
    if(isRasterMap())return findRasterPath(start,goal);
    const destination = nearestWalkable(goal);
    if (walkableSegment(start, destination)) return [destination];
    const nodes = mapData.navigation.nodes, lookup = mapData.navigation.lookup;
    const nearest = point => nodes.slice().sort((a, b) => mapDistance(a, point) - mapDistance(b, point)).find(node => walkableSegment(point, node));
    const first = nearest(start), last = nearest(destination);
    if (!first || !last) return [];
    const open = new Set([first.id]), cost = new Map([[first.id, 0]]), previous = new Map();
    while (open.size) {
        const id = [...open].reduce((best, id) => !best ||
            cost.get(id) + mapDistance(lookup.get(id), last) < cost.get(best) + mapDistance(lookup.get(best), last) ||
            (cost.get(id) + mapDistance(lookup.get(id), last) === cost.get(best) + mapDistance(lookup.get(best), last) && id.localeCompare(best) < 0) ? id : best, null);
        if (id === last.id) {
            const route = [destination]; let cursor = id;
            while (cursor) { const node = lookup.get(cursor); route.unshift({ x: node.x, y: node.y }); cursor = previous.get(cursor); }
            return route;
        }
        open.delete(id);
        for (const neighbor of lookup.get(id).edges) {
            const next = cost.get(id) + mapDistance(lookup.get(id), lookup.get(neighbor));
            if (next < (cost.get(neighbor) ?? Infinity)) { cost.set(neighbor, next); previous.set(neighbor, id); open.add(neighbor); }
        }
    }
    return [];
}

function nearestSalesSite(position) {
    return mapData.strategicSalesSites.reduce((best, site) => !best || mapDistance(position, site) < mapDistance(position, best) ? site : best, null);
}

function placementDescription(position) {
    const nearest = nearestSalesSite(position);
    const site = mapDistance(position, nearest) <= 11 ? nearest : { traffic: .8, visibility: .8, accessibility: .8, capacity: 3 };
    const stars = value => "★".repeat(Math.max(1, Math.min(5, Math.round(value)))) + "☆".repeat(5 - Math.max(1, Math.min(5, Math.round(value))));
    return `Trafic ${stars(site.traffic * 3)} · discrétion ${stars(5 - site.visibility * 2.5)} · logistique ${stars(site.accessibility * 3)} · ${site.capacity} clients`;
}

// Types partagés par toutes les entités de la carte. Les flux métier ne
// doivent jamais déduire le type d'une entité depuis son apparence DOM.
const ENTITY_TYPES = Object.freeze({
    PLAYER: "PLAYER",
    CUSTOMER: "CUSTOMER",
    EMPLOYEE: "EMPLOYEE",
    POLICE: "POLICE"
});

const PLAYER_SALE_RANGE = 8;
const SELLER_SALE_RANGE = 8;


function buildTestNeighborhood() {

    document.getElementById("mapScene")?.remove();

    map.querySelectorAll(".road, .building").forEach(
        element => element.remove()
    );

    const scene = document.createElement("div");
    scene.id = "mapScene";
    scene.innerHTML = `
        <div class="urbanRoad avenue"></div>
        <div class="urbanRoad crossStreet"></div>
        <div class="urbanRoad southRoad"></div>
        <div class="urbanAlley alleyNorth"></div>
        <div class="urbanAlley alleySouth"></div>
        <div class="urbanSquare">PLACE</div>
        <div class="urbanParking">P</div>
        <div class="urbanCourt"></div>
    `;
    map.prepend(scene);
    if (mapData.mapId !== "LEGACY_TEST_MAP") {
        scene.replaceChildren();
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none");
        svg.style.cssText = "width:100%;height:100%;position:absolute;inset:0";
        const shape = (polygon, color) => { const p = document.createElementNS(svg.namespaceURI, "polygon"); p.setAttribute("points", polygon.map(p => `${p.x},${p.y}`).join(" ")); p.setAttribute("fill", color); svg.appendChild(p); };
        shape(mapData.perimeter, "#526451");
        const colors = { roads: "#454c52", courts: "#b6ac90", sidewalks: "#b7b9ab", crossings: "#e1dec8", openSpaces: "#9d9d80", parking: "#697078", vegetation: "#315a40", walls: "#8a8171", obstacles: "#8a8171", transitions: "#cab795" };
        Object.entries(colors).forEach(([key, color]) => mapData[key].forEach(item => shape(item.polygon, color)));
        scene.appendChild(svg);
    }

    const buildings = MAP_BUILDINGS;
    buildings.forEach(([label, left, top, width, height]) => {
        const building = document.createElement("div");
        building.className = "urbanBuilding";
        building.textContent = label;
        building.style.left = left + "%";
        building.style.top = top + "%";
        building.style.width = width + "%";
        building.style.height = height + "%";
        scene.appendChild(building);
    });

    mapData.strategicSalesSites.forEach(site => {
        const marker = document.createElement("div");
        marker.className = "salesSiteMarker";
        marker.style.left = site.x + "%";
        marker.style.top = site.y + "%";
        marker.title = site.id;
        scene.appendChild(marker);
    });

    mapData.apartmentSites.forEach(site => {
        const marker = document.createElement("div");
        marker.className = "apartmentSiteMarker";
        marker.style.left = site.x + "%";
        marker.style.top = site.y + "%";
        marker.title = site.name;
        scene.appendChild(marker);
    });
}


function beginMapPlacement(label, onConfirm, onCancel = null) {

    mapPlacement = { label, onConfirm, onCancel, selected: null, marker: null };
    map.classList.add("placementActive");
    showMapPlacementControls();

}


function cancelMapPlacement() {

    if (mapPlacement && mapPlacement.marker) {
        mapPlacement.marker.remove();
    }
    const cancel = mapPlacement && mapPlacement.onCancel;
    mapPlacement = null;
    window.PhaserMapRenderer?.clearPlacementMarker();
    map.classList.remove("placementActive");
    document.getElementById("mapPlacementControls")?.remove();
    if (cancel) cancel();

}


function showMapPlacementControls() {

    const controls = document.createElement("div");
    controls.id = "mapPlacementControls";
    controls.innerHTML = `<strong>${mapPlacement.label}</strong><span>Choisis un emplacement</span><button type="button" data-placement-confirm disabled>Confirmer</button><button type="button" data-placement-cancel>Annuler</button>`;
    (document.getElementById("mapViewport") || map).appendChild(controls);
    controls.addEventListener("click", event => {
        if (event.target.dataset.placementCancel !== undefined) cancelMapPlacement();
        if (event.target.dataset.placementConfirm !== undefined && mapPlacement.selected) {
            const selected = mapPlacement.selected;
            const callback = mapPlacement.onConfirm;
            if (mapPlacement.marker) mapPlacement.marker.remove();
            mapPlacement = null;
            window.PhaserMapRenderer?.clearPlacementMarker();
            map.classList.remove("placementActive");
            controls.remove();
            callback(selected.x, selected.y);
        }
    });
}


function handleMapPlacement(event) {

    if (!mapPlacement || event.target.closest("#mapPlacementControls")) {
        return Boolean(mapPlacement);
    }
    const rect = map.getBoundingClientRect();
    return setMapPlacementSelection({ x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 });
}

// Utilisé par les deux rendus : le canvas transmet des coordonnées métier,
// le DOM transmet un événement. La sélection et la confirmation restent
// identiques.
function setMapPlacementSelection(position) {
    if (!mapPlacement || !position) return false;
    const { x, y } = nearestWalkable({ x: Math.max(4, Math.min(96, position.x)), y: Math.max(4, Math.min(96, position.y)) });
    mapPlacement.selected = { x, y };
    if (window.PhaserMapRenderer?.isActive()) {
        window.PhaserMapRenderer.showPlacementMarker(mapPlacement.selected);
    } else if (!mapPlacement.marker) {
        mapPlacement.marker = document.createElement("div");
        mapPlacement.marker.className = "placementMarker";
        map.appendChild(mapPlacement.marker);
    }
    if (mapPlacement.marker) {
        mapPlacement.marker.style.left = x + "%";
        mapPlacement.marker.style.top = y + "%";
    }
    document.querySelector("[data-placement-confirm]").disabled = false;
    document.querySelector("#mapPlacementControls span").textContent = placementDescription({ x, y });
    return true;
}


function mapDistance(first, second) {

    return Math.hypot(first.x - second.x, first.y - second.y);

}


function isMapEntityInRange(first, second, range) {

    return Boolean(first && second) &&
        Number.isFinite(range) &&
        range >= 0 &&
        mapDistance(first, second) <= range;

}


function getMapZoneAt(position) {

    return mapData.zones.reduce(
        (nearest, zone) =>
            !nearest || mapDistance(position, zone) < mapDistance(position, nearest)
                ? zone
                : nearest,
        null
    );

}


function updateMapEntityVisual(entity) {
    MapRenderer.position(entity);
}


function showWatcherRadius(watcher) {

    if (watcherRadiusOverlay) watcherRadiusOverlay.remove();
    if (!watcher || watcher.role !== "guetteur") return;
    watcherRadiusOverlay = document.createElement("div");
    watcherRadiusOverlay.className = "watcherRadiusOverlay";
    watcherRadiusOverlay.style.left = watcher.x + "%";
    watcherRadiusOverlay.style.top = watcher.y + "%";
    watcherRadiusOverlay.style.width = watcher.observationRadius * 2 + "%";
    watcherRadiusOverlay.style.height = watcher.observationRadius * 2 + "%";
    map.appendChild(watcherRadiusOverlay);

}


function showMapIndicator(position, text) {

    const indicator = document.createElement("div");
    indicator.className = "mapIndicator";
    indicator.textContent = text;
    indicator.style.left = position.x + "%";
    indicator.style.top = position.y + "%";
    map.appendChild(indicator);
    setTimeout(() => indicator.remove(), 900);

}


function beginMapMovement(entity, destination, state = "en déplacement") {

    if (!entity || !destination) {
        return false;
    }

    const walkable = nearestWalkable(destination);
    entity.destination = {
        x: walkable.x,
        y: walkable.y,
        id: destination.id || null
    };
    entity.navRoute = findMapPath(entity, entity.destination);
    entity.route = entity.navRoute.map(point => ({ x: point.x, y: point.y }));
    if (!entity.navRoute.length && mapDistance(entity, entity.destination) > .01) {
        entity.pathBlocked = true;
        return false;
    }
    entity.moving = true;
    entity.state = state;

    return true;

}


function moveMapEntity(entity, destination, delta, speed = 10) {

    if (!entity || !destination || !Number.isFinite(delta)) {
        return false;
    }

    if (isRasterMap() && (!isWalkable(entity)||!isWalkable(destination))) {entity.pathBlocked=true;entity.moving=false;entity.navRoute=[];return false;}
    if (!isWalkable(entity)) Object.assign(entity, nearestWalkable(entity));
    const goal = nearestWalkable(destination), key = `${goal.x.toFixed(3)},${goal.y.toFixed(3)}`;
    if (entity.navKey !== key || !entity.navRoute?.length || isRasterMap()&&!walkableSegment(entity,entity.navRoute[0])) {
        entity.navKey = key;
        entity.navRoute = findMapPath(entity, goal);
    }
    if (!entity.navRoute.length) { entity.pathBlocked = true; entity.moving = false; return false; }
    entity.pathBlocked = false;
    let step = Math.max(0, simulationWalkingSpeed(speed) * delta);
    while (entity.navRoute.length && step >= 0) {
        const waypoint = entity.navRoute[0], distance = isRasterMap() ? rasterDistance(entity, waypoint) / 8.53 : mapDistance(entity, waypoint);
        if(isRasterMap()&&!walkableSegment(entity,waypoint)){entity.navRoute=[];entity.pathBlocked=true;entity.moving=false;return false;}
        if(isRasterMap())recordWalkingMotion(entity,entity,waypoint,Math.min(step,distance));
        if (distance <= step + 1e-10) { entity.x = waypoint.x; entity.y = waypoint.y; step = Math.max(0,step-distance); entity.navRoute.shift(); }
        else { entity.x += (waypoint.x - entity.x) / distance * step; entity.y += (waypoint.y - entity.y) / distance * step; break; }
    }
    entity.moving = entity.navRoute.length > 0;
    if (!entity.moving) entity.destination = null;
    updateMapEntityVisual(entity);
    return !entity.moving;

}

// L'ancien avatar joueur a été supprimé : un tap vide n'est jamais un ordre.
function requestPlayerMovement(destination) {
    return false;
}


function createSalesPoint(seller, x, y) {
    ({ x, y } = nearestWalkable({ x, y }));

    const site = mapData.strategicSalesSites.reduce(
        (nearest, candidate) =>
            !nearest || mapDistance({ x, y }, candidate) < mapDistance({ x, y }, nearest)
                ? candidate
                : nearest,
        null
    );
    const usesSite = site && mapDistance({ x, y }, site) <= 11;

    const point = {
        id: "sales-point-" + Date.now() + "-" + Math.random(),
        x,
        y,
        sellerId: seller.id,
        active: true,
        capacity: usesSite ? site.capacity : 3,
        currentVisitors: 0,
        importance: usesSite ? site.importance : 1,
        traffic: usesSite ? site.traffic : 0.8,
        visibility: usesSite ? site.visibility : 0.8,
        accessibility: usesSite ? site.accessibility : 0.8,
        strategicSiteId: usesSite ? site.id : null,
        stats: {
            customersServed: 0,
            customersLost: 0,
            totalWaitTime: 0,
            stockouts: 0,
            revenue: 0,
            timeOutOfStock: 0
        }
    };

    mapData.salesPoints.push(point);
    seller.assignment.salesPointId = point.id;
    seller.assignment.salesPoint = { x, y };

    return point;

}


function createApartmentMapVisual(apartment) {

    const marker = document.createElement("button");
    marker.className = "ownedApartmentMarker";
    marker.type = "button";
    marker.textContent = "⌂";
    marker.style.left = apartment.x + "%";
    marker.style.top = apartment.y + "%";
    marker.title = apartment.name;
    marker.addEventListener("click", event => {
        event.stopPropagation();
        if (typeof openApartmentDetails === "function") {
            openApartmentDetails(apartment.id);
        }
    });
    map.appendChild(marker);
    apartment.element = marker;
}


function getSalesPointById(id) {

    return mapData.salesPoints.find(point => point.id === id) || null;

}


function getSalesPointForSeller(sellerId) {

    const points = mapData.salesPoints.filter(
        point => point.sellerId === sellerId
    );

    return points.find(point => point.active) ||
        points[points.length - 1] ||
        null;

}


function requestSellerMove(seller, destination) {

    const oldPoint = getSalesPointForSeller(seller.id);

    if (oldPoint) {
        oldPoint.active = false;
    }

    const newPoint = createSalesPoint(seller, destination.x, destination.y);
    newPoint.active = false;
    seller.pendingSalesPointId = newPoint.id;
    seller.movedAt = game.clock.elapsed;
    beginMapMovement(seller, newPoint, "en déplacement");

    return true;

}


function updateMapRealtime(delta) {

    mapData.salesPoints.forEach(point => {
        const seller = typeof getEmployeeById === "function"
            ? getEmployeeById(point.sellerId)
            : null;

        if (
            isTrading() && point.active && seller &&
            typeof getSellerProductStock === "function" &&
            seller.allowedProducts.some(product =>
                getSellerProductStock(seller, product) === 0
            )
        ) {
            point.stats.timeOutOfStock += delta;
            game.dayStockoutSeconds = (game.dayStockoutSeconds || 0) + delta;
            if (!point.wasOutOfStock) point.stats.stockouts++;
            point.wasOutOfStock = true;
        } else point.wasOutOfStock = false;
    });

    game.employees.forEach(employee => {
        if (
            employee.role === "vendeur" &&
            employee.policeRetreat &&
            employee.destination
        ) {
            if (moveMapEntity(employee, employee.destination, delta, 7 * PEDESTRIAN_SPEED_MULTIPLIER)) {
                employee.policeRetreat = false;
                employee.state = employee.policeProtocolAction === "abandon"
                    ? "en pause"
                    : "en sécurité";
                if (employee.state === "en sécurité" && !police.alerts.some(a => a.informedEmployeeIds.includes(employee.id))) {
                    const point = getSalesPointForSeller(employee.id);
                    if (point) requestSellerMove(employee, point);
                }
            }
            return;
        }

        if (
            employee.role === "vendeur" &&
            employee.pendingSalesPointId &&
            employee.destination
        ) {
            if (moveMapEntity(employee, employee.destination, delta, 7 * PEDESTRIAN_SPEED_MULTIPLIER)) {
                const point = getSalesPointById(employee.pendingSalesPointId);
                if (point) {
                    point.active = true;
                    employee.assignment.salesPoint = { x: point.x, y: point.y };
                }
                employee.pendingSalesPointId = null;
                employee.state = "en poste";
            }
        }
    });

}


activateMapData(DEFAULT_MAP_ID);
