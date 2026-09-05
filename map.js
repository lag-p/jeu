// ===============================
// CARTE, ZONES ET DEPLACEMENTS
// ===============================

const mapData = {
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


function buildTestNeighborhood() {

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

    const buildings = [
        ["Résidence", 8, 12, 22, 18], ["Commerces", 35, 12, 26, 13],
        ["Résidence", 68, 12, 23, 17], ["Cour", 10, 64, 25, 22],
        ["Ateliers", 65, 61, 27, 18], ["Immeuble", 36, 70, 21, 18],
        ["Bureaux", 70, 37, 20, 15], ["Immeuble", 10, 38, 22, 16]
    ];
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
    map.classList.remove("placementActive");
    document.getElementById("mapPlacementControls")?.remove();
    if (cancel) cancel();

}


function showMapPlacementControls() {

    const controls = document.createElement("div");
    controls.id = "mapPlacementControls";
    controls.innerHTML = `<strong>${mapPlacement.label}</strong><span>Choisis un emplacement</span><button type="button" data-placement-confirm disabled>Confirmer</button><button type="button" data-placement-cancel>Annuler</button>`;
    map.appendChild(controls);
    controls.addEventListener("click", event => {
        if (event.target.dataset.placementCancel !== undefined) cancelMapPlacement();
        if (event.target.dataset.placementConfirm !== undefined && mapPlacement.selected) {
            const selected = mapPlacement.selected;
            const callback = mapPlacement.onConfirm;
            if (mapPlacement.marker) mapPlacement.marker.remove();
            mapPlacement = null;
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
    const x = Math.max(4, Math.min(96, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(4, Math.min(96, ((event.clientY - rect.top) / rect.height) * 100));
    mapPlacement.selected = { x, y };
    if (!mapPlacement.marker) {
        mapPlacement.marker = document.createElement("div");
        mapPlacement.marker.className = "placementMarker";
        map.appendChild(mapPlacement.marker);
    }
    mapPlacement.marker.style.left = x + "%";
    mapPlacement.marker.style.top = y + "%";
    document.querySelector("[data-placement-confirm]").disabled = false;
    return true;
}


function mapDistance(first, second) {

    return Math.hypot(first.x - second.x, first.y - second.y);

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

    if (!entity.element) {
        return;
    }

    entity.element.style.left = entity.x + "%";
    entity.element.style.top = entity.y + "%";

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

    entity.destination = {
        x: destination.x,
        y: destination.y,
        id: destination.id || null
    };
    entity.route = [entity.destination];
    entity.moving = true;
    entity.state = state;

    return true;

}


function moveMapEntity(entity, destination, delta, speed = 10) {

    if (!entity || !destination || !Number.isFinite(delta)) {
        return false;
    }

    entity.destination = {
        x: destination.x,
        y: destination.y,
        id: destination.id || null
    };
    entity.route = [entity.destination];

    const distance = mapDistance(entity, destination);
    const step = Math.max(0, speed) * delta;

    if (distance <= Math.max(0.35, step)) {
        entity.x = destination.x;
        entity.y = destination.y;
        entity.moving = false;
        entity.destination = null;
        entity.route = [];
        updateMapEntityVisual(entity);
        return true;
    }

    entity.x += ((destination.x - entity.x) / distance) * step;
    entity.y += ((destination.y - entity.y) / distance) * step;
    entity.moving = true;
    updateMapEntityVisual(entity);

    return false;

}


function createSalesPoint(seller, x, y) {

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
    seller.movedAt = performance.now();
    beginMapMovement(seller, newPoint, "en déplacement");

    return true;

}


function updateMapRealtime(delta) {

    mapData.salesPoints.forEach(point => {
        const seller = typeof getEmployeeById === "function"
            ? getEmployeeById(point.sellerId)
            : null;

        if (
            point.active && seller &&
            typeof getSellerProductStock === "function" &&
            seller.allowedProducts.every(product =>
                getSellerProductStock(seller, product) === 0
            )
        ) {
            point.stats.timeOutOfStock += delta;
        }
    });

    game.employees.forEach(employee => {
        if (
            employee.role === "vendeur" &&
            employee.policeRetreat &&
            employee.destination
        ) {
            if (moveMapEntity(employee, employee.destination, delta, 7)) {
                employee.policeRetreat = false;
                employee.state = employee.policeProtocolAction === "abandon"
                    ? "en pause"
                    : "en sécurité";
            }
            return;
        }

        if (
            employee.role === "vendeur" &&
            employee.pendingSalesPointId &&
            employee.destination
        ) {
            if (moveMapEntity(employee, employee.destination, delta, 7)) {
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


buildTestNeighborhood();
