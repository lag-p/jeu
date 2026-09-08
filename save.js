// Instantané versionné : le DOM et les caches de navigation sont reconstruits.
const SAVE_VERSION = 5;
const SAVE_KEY = "quartier.save";
let saveElapsed = 0, saveRequested = false, saveBlocked = false, saveMenuPending = false;

function serializeState(value) {
    return JSON.parse(JSON.stringify(value, (key, item) => ["element", "navRoute", "navKey", "route"].includes(key) ? undefined : item));
}
function createSaveSnapshot() {
    return serializeState({ version: SAVE_VERSION, game, customers, police,
        map: { mapId: mapData.mapId, schemaVersion: mapData.schemaVersion, salesPoints: mapData.salesPoints, zones: mapData.zones },
        camera: { zoom: camera.zoom, x: camera.x, y: camera.y } });
}
const NEW_GAME_SNAPSHOT = createSaveSnapshot();

// Les versions précédentes pouvaient référencer le premier appartement par
// l'index numérique 0, alors que les contrôles HTML renvoient "0". La
// sauvegarde canonise uniquement ces identifiants d'appartement et toutes les
// références associées avant la validation, sans toucher aux ressources.
function normalizeSavedApartmentIdentifiers(input) {
    const state = input?.game;
    if (!state || !Array.isArray(state.apartments)) return;
    const normalize = value => Number.isSafeInteger(value) && value >= 0 ? String(value) : value;
    state.apartments.forEach(apartment => { apartment.id = normalize(apartment.id); });
    state.activeApartmentId = normalize(state.activeApartmentId);
    state.employees?.forEach(employee => {
        if (employee.assignment) {
            employee.assignment.apartmentId = normalize(employee.assignment.apartmentId);
            if (employee.assignment.pending) employee.assignment.pending.apartmentId = normalize(employee.assignment.pending.apartmentId);
        }
    });
    state.teams?.forEach(team => { if (Array.isArray(team.apartmentIds)) team.apartmentIds = team.apartmentIds.map(normalize); });
    state.logisticsRequests?.forEach(request => { request.apartmentId = normalize(request.apartmentId); });
    state.logisticsMissions?.forEach(mission => {
        mission.apartmentId = normalize(mission.apartmentId);
        mission.returnApartmentId = normalize(mission.returnApartmentId);
    });
}

function validateSaveSnapshot(input) {
    if (!input || ![1, 2, 3, 4, SAVE_VERSION].includes(input.version)) throw new Error("Version de sauvegarde non prise en charge");
    const safe = object => {
        if (typeof object === "number" && !Number.isFinite(object)) throw new Error("Nombre invalide");
        if (typeof object === "string" && (object.length > 2000 || /[<>]/.test(object))) throw new Error("Texte invalide");
        if (object && typeof object === "object") Object.entries(object).forEach(([key, value]) => {
            if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Champ interdit"); safe(value);
        });
    };
    safe(input);
    if (input.version < 5) input.map = { ...input.map, mapId: "LEGACY_TEST_MAP", schemaVersion: 1 };
    if (!Object.hasOwn(MAP_FACTORIES, input.map?.mapId) || input.map.schemaVersion !== 1) throw new Error("Carte ou schéma inconnu");
    const definition = MAP_FACTORIES[input.map.mapId]();
    if (input.version >= 5 && (input.map.zones?.length !== definition.zones.length || new Set(input.map.zones.map(z => z.id)).size !== definition.zones.length || input.map.zones.some(zone => !definition.zones.some(site => site.id === zone.id && (input.map.mapId === "LEGACY_TEST_MAP" || site.x === zone.x && site.y === zone.y))))) throw new Error("Zones incompatibles avec la carte");
    normalizeSavedApartmentIdentifiers(input);
    const state = input.game;
    if (!state || !Number.isInteger(state.day) || state.day < 1 || !Number.isFinite(state.money) || typeof state.dayActive !== "boolean" || !Number.isFinite(state.dayElapsed) || !Number.isFinite(state.dayDuration) || state.dayDuration <= 0 || state.dayElapsed < 0 || state.dayElapsed > state.dayDuration) throw new Error("État de journée invalide");
    if (input.version < 3) {
        // Préserver la fraction de journée des sauvegardes à 180 secondes.
        if (!state.phase) {
            state.dayElapsed = state.dayElapsed / state.dayDuration * GAME_CONFIG.dayDuration;
            state.dayDuration = GAME_CONFIG.dayDuration;
            state.phase = state.dayActive ? DAY_PHASE.ACTIVITE : state.economySettledDay === state.day ? DAY_PHASE.BILAN : DAY_PHASE.PREPARATION;
            state.clock = { paused: !state.dayActive, speed: 1, elapsed: (state.day - 1) * state.dayDuration + state.dayElapsed };
            (state.events || []).forEach(event => { event.dayScoped = true; });
        }
        state.retreat = state.retreat || { reason: null };
    }
    if (input.version < 4) {
        // Migration physique : aucun stock ni argent n'est déplacé pendant la
        // conversion. Hors activité, le normaliseur les place au prochain repli.
        state.personalFallback = state.personalFallback || {
            id: "personal-fallback", name: "Repli personnel", x: state.playerX, y: state.playerY,
            capacity: EMPLOYEE_PHYSICAL_CONFIG.fallbackInventoryCapacity, inventory: createEmptyInventory(), money: 0,
            active: true, provisional: true
        };
        state.employees.forEach(employee => {
            employee.assignment = employee.assignment || { apartmentId: null, managerId: null, manual: false, reason: "" };
            employee.assignment.pending = employee.assignment.pending || null;
            employee.operationalState = employee.operationalState || (state.phase === DAY_PHASE.ACTIVITE && employee.state === "en poste" ? EMPLOYEE_OPERATION.AT_POST : EMPLOYEE_OPERATION.RESTING);
            employee.navRoute = Array.isArray(employee.navRoute) ? employee.navRoute : [];
        });
    }
    if (!Object.values(DAY_PHASE).includes(state.phase) || state.dayActive !== [DAY_PHASE.ACTIVITE, DAY_PHASE.REPLI].includes(state.phase) ||
        !state.clock || typeof state.clock.paused !== "boolean" || !TIME_CONFIG.speeds.includes(state.clock.speed) ||
        !Number.isFinite(state.clock.elapsed) || state.clock.elapsed < 0 || !state.dayActive && !state.clock.paused ||
        state.phase === DAY_PHASE.REPLI && state.clock.speed !== 1) throw new Error("Horloge ou phase invalide");
    const inventory = value => {
        if (!value || Object.keys(PRODUCT_CONFIG).some(p => !Number.isSafeInteger(value[p]) || value[p] < 0)) throw new Error("Inventaire invalide");
    };
    inventory(state.playerInventory);
    for (const key of ["employees", "apartments", "teams", "logisticsRequests", "logisticsMissions"]) if (!Array.isArray(state[key]) || state[key].length > 1000) throw new Error("Collection invalide");
    state.apartments.forEach(apartment => {
        if (input.version < 5) apartment.mapId = input.map.mapId;
        if (apartment.mapId !== input.map.mapId || apartment.siteId && !definition.apartmentSites.some(site => site.id === apartment.siteId)) throw new Error("Appartement incompatible avec la carte");
    });
    const unique = list => new Set(list.map(e => e.id)).size === list.length && list.every(e => typeof e.id === "string");
    if (![state.employees, state.apartments, state.teams, state.logisticsMissions, input.customers || []].every(unique)) throw new Error("Identifiants dupliqués");
    const employees = new Map(state.employees.map(e => [e.id, e]));
    const apartments = new Set(state.apartments.map(a => a.id));
    const position = entity => Number.isFinite(entity?.x) && Number.isFinite(entity?.y) && entity.x >= 0 && entity.x <= 100 && entity.y >= 0 && entity.y <= 100;
    if (!position({ x: state.playerX, y: state.playerY })) throw new Error("Position joueur invalide");
    [...state.employees, ...state.apartments].forEach(entity => {
        inventory(entity.inventory);
        if (!Number.isFinite(entity.money) || entity.money < 0 || !Number.isFinite(entity.x) || !Number.isFinite(entity.y) || !Number.isSafeInteger(entity.capacity) || entity.capacity < 0) throw new Error("Entité invalide");
    });
    state.employees.forEach(e => {
        if (!Object.hasOwn(employeeTypes, e.role) || !e.assignment || !Number.isFinite(e.experience) || e.experience < 0) throw new Error("Employé invalide");
        if (e.role === "vendeur") { inventory(e.localReserve); if (!Array.isArray(e.allowedProducts) || e.allowedProducts.some(p => !PRODUCT_CONFIG[p])) throw new Error("Produits invalides"); }
    });
    if (state.personalFallback) {
        inventory(state.personalFallback.inventory);
        if (!position(state.personalFallback) || !Number.isFinite(state.personalFallback.money) || state.personalFallback.money < 0) throw new Error("Repli personnel invalide");
    }
    const couriers = new Set(), sellers = new Set();
    state.logisticsRequests.forEach(r => {
        if (employees.get(r.sellerId)?.role !== "vendeur" || !["SUPPLY", "SUPPLY_AND_COLLECTION", "CASH_COLLECTION"].includes(r.type) || !["pending", "WAITING_FOR_STOCK", "WAITING_FOR_COURIER", "READY", "ASSIGNED"].includes(r.status) || r.managerId && employees.get(r.managerId)?.role !== "gerant" || r.apartmentId && !apartments.has(r.apartmentId)) throw new Error("Demande invalide");
    });
    state.logisticsMissions.forEach(m => {
        if (!["CREATED", "GOING_TO_STORAGE", "LOADING", "GOING_TO_SELLER", "DELIVERING", "COLLECTING_MONEY", "RETURNING", "DEPOSITING_MONEY"].includes(m.stage)) throw new Error("Étape de mission invalide");
        if (employees.get(m.courierId)?.role !== "ravitailleur" || employees.get(m.sellerId)?.role !== "vendeur" || !apartments.has(m.apartmentId) || couriers.has(m.courierId) || !m.cancelled && sellers.has(m.sellerId)) throw new Error("Mission incompatible");
        if (m.product && !PRODUCT_CONFIG[m.product] || !Number.isSafeInteger(m.quantity) || m.quantity < 0) throw new Error("Transport invalide");
        couriers.add(m.courierId); if (!m.cancelled) sellers.add(m.sellerId);
    });
    const members = new Set();
    state.teams.forEach(t => {
        for (const key of ["sellerIds", "courierIds", "watcherIds", "apartmentIds"]) if (!Array.isArray(t[key])) throw new Error("Équipe invalide");
        for (const id of [t.managerId, ...t.sellerIds, ...t.courierIds, ...t.watcherIds]) { if (!employees.has(id) || members.has(id)) throw new Error("Équipe incompatible"); members.add(id); }
        if (t.apartmentIds.some(id => !apartments.has(id))) throw new Error("Dépôt inconnu");
        if (employees.get(t.managerId).role !== "gerant" || t.sellerIds.some(id => employees.get(id).role !== "vendeur") || t.courierIds.some(id => employees.get(id).role !== "ravitailleur") || t.watcherIds.some(id => employees.get(id).role !== "guetteur")) throw new Error("Rôles d'équipe invalides");
    });
    if (!Array.isArray(input.customers) || input.customers.length > CUSTOMER_FLOW.MAX_ACTIVE_CUSTOMERS || !input.police || !Array.isArray(input.police.patrols) || !Array.isArray(input.police.alerts) || !Array.isArray(input.map?.salesPoints) || !Array.isArray(input.map?.zones)) throw new Error("Simulation invalide");
    input.customers.forEach(c => {
        if (!PRODUCT_CONFIG[c.product] || !Number.isSafeInteger(c.quantity) || c.quantity < 1 || !Number.isFinite(c.price) || c.price < 0 || !Number.isFinite(c.x) || !Number.isFinite(c.y) || !["ENTERING", "SEARCHING", "GOING_TO_SELLER", "WAITING", "WAITING_FOR_RESTOCK", "BEING_SERVED", "LEAVING", "EXITED"].includes(c.state)) throw new Error("Client invalide");
        if (c.assignedSellerId && c.assignedSellerId !== PLAYER_SELLER_ID && employees.get(c.assignedSellerId)?.role !== "vendeur") throw new Error("File invalide");
        if (c.saleResolved && ["WAITING", "GOING_TO_SELLER"].includes(c.state)) throw new Error("Client déjà servi dans la file");
    });
    input.police.alerts.forEach(a => { if (!Array.isArray(a.informedEmployeeIds) || !Number.isFinite(a.duration) || !Number.isFinite(a.radius)) throw new Error("Alerte invalide"); });
    input.police.patrols.forEach(p => { if (!position(p) || !Array.isArray(p.zonesTraversed) || !Number.isFinite(p.speed)) throw new Error("Patrouille invalide"); });
    input.map.salesPoints.forEach(p => { if (!position(p) || employees.get(p.sellerId)?.role !== "vendeur" || !p.stats || !Number.isSafeInteger(p.capacity) || p.capacity < 1) throw new Error("Point de vente invalide"); });
    if (!input.map.zones.length || input.map.zones.some(z => !position(z))) throw new Error("Zones invalides");
    if (snapshotOperationInvalid(input.police.activeOperation) || snapshotOperationInvalid(input.police.plannedOperation)) throw new Error("Opération invalide");
    return { ...input, version: SAVE_VERSION };
}

function snapshotOperationInvalid(operation) {
    return operation && (!Array.isArray(operation.affectedEmployeeIds) || !Array.isArray(operation.targetZoneIds) || !Number.isFinite(operation.elapsed) || !["PLANNED", "PREPARING", "ACTIVE", "ENDING", "COMPLETED"].includes(operation.phase));
}

function restoreSaveSnapshot(input) {
    const snapshot = validateSaveSnapshot(serializeState(input));
    if (typeof AudioSystem !== "undefined") AudioSystem.stopAll();
    // Toute validation précède la première mutation de la partie vivante.
    if (mapPlacement) cancelMapPlacement();
    clearWaitingCustomers();
    [...game.employees, ...game.apartments, ...police.patrols, ...police.alerts].forEach(e => e.element?.remove());
    watcherRadiusOverlay?.remove(); watcherRadiusOverlay = null;
    Object.keys(game).forEach(key => delete game[key]);
    Object.assign(game, serializeState(NEW_GAME_SNAPSHOT.game), snapshot.game);
    Object.assign(police, serializeState(NEW_GAME_SNAPSHOT.police), snapshot.police);
    enforceTimeConstraints();
    activateMapData(snapshot.map.mapId);
    mapData.salesPoints = snapshot.map.salesPoints;
    mapData.zones = snapshot.map.zones;
    if (mapData.mapId === "LEGACY_TEST_MAP") mapData.zones.forEach(zone => Object.assign(zone, nearestWalkable(zone)));
    customers = snapshot.customers;
    selectedCustomer = null; selectedEmployeeId = null; placementMode = null; salesPointMoveSellerId = null;
    playerMapEntity.navRoute = []; playerMapEntity.navKey = null; playerMapEntity.pathBlocked = false;
    game.startPointPlacementActive = false;
    document.body.classList.remove("startPointPlacementActive"); map.classList.remove("startPointPlacementActive");
    normalizeExistingEmployees();
    normalizePhysicalEmployees({ placeAtHome: snapshot.game.phase !== DAY_PHASE.ACTIVITE && snapshot.game.phase !== DAY_PHASE.REPLI });
    game.employees.forEach(employee => { delete employee.cashCarried; employee.currentMissionId = null; createEmployeeVisual(employee); });
    game.logisticsMissions.forEach(m => { getEmployeeById(m.courierId).currentMissionId = m.id; if (!m.cancelled) getEmployeeById(m.sellerId).currentMissionId = m.id; });
    game.apartments.forEach(createApartmentMapVisual);
    customers.forEach(customer => {
        MapRenderer.create(customer, "customer", "👤", selectCustomer);
    });
    police.patrols.forEach(patrol => MapRenderer.create(patrol, "policePatrol", "🚓"));
    police.alerts.forEach(alert => { const element = document.createElement("div"); element.className = "policeAlertZone"; alert.element = element; Object.assign(element.style, { left: `${alert.x}%`, top: `${alert.y}%`, width: `${alert.radius * 2}%`, height: `${alert.radius * 2}%` }); alert.teamIds = alert.teamIds || []; map.appendChild(element); });
    Object.assign(camera, snapshot.camera || { zoom: 1, x: 0, y: 0 }); applyCamera();
    employeeSimulationElapsed = 0; lastFrame = performance.now(); saveElapsed = 0;
    closeMainPanel(); closeCustomerPanel();
    interfaceState.history = []; interfaceState.panels.clear();
    document.getElementById("saveMenu")?.classList.add("hidden");
    document.getElementById("startDayOverlay").classList.remove("saveChoicePending");
    document.getElementById("configureDayButton").disabled = false;
    document.getElementById("startDayButton").style.display = "";
    document.getElementById("startDayTitle").textContent = `JOUR ${game.day}`;
    document.getElementById("placementText").textContent = game.playerPlaced ? "Ton point est conservé." : "Choisis ton point de départ directement sur la carte.";
    document.getElementById("startDayOverlay").classList.toggle("hidden", game.phase !== DAY_PHASE.PREPARATION);
    document.getElementById("endDayOverlay").classList.add("hidden");
    if (game.phase === DAY_PHASE.BILAN) renderDailySummary();
    if (isTrading()) { const remaining = game.customerSpawnRemaining; scheduleCustomerSpawn(); if (Number.isFinite(remaining) && remaining > 0) game.customerSpawnRemaining = remaining; }
    updatePlayer(); updateUI(); saveBlocked = false; saveMenuPending = false;
    window.PhaserMapRenderer?.refreshMap();
    return true;
}

function saveGame() {
    if (saveBlocked || saveMenuPending || mapPlacement || placementMode || game.startPointPlacementActive) return false;
    try {
        const snapshot = createSaveSnapshot(); validateSaveSnapshot(snapshot);
        localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
        saveRequested = false; saveElapsed = 0; game.saveStatus = "Sauvegardé"; return true;
    } catch (error) { game.saveStatus = "Sauvegarde indisponible"; showMessage("Sauvegarde impossible : " + error.message); saveElapsed = 0; saveRequested = false; return false; }
}
function loadGame() {
    try {
        const data = localStorage.getItem(SAVE_KEY); if (!data) return false;
        return restoreSaveSnapshot(JSON.parse(data));
    } catch (error) { showMessage("Chargement refusé : " + error.message); return false; }
}
function requestSave() { saveRequested = true; }
function updateSaveRealtime(delta) { saveElapsed += delta; if (saveElapsed >= GAME_CONFIG.autosaveSeconds || saveRequested && saveElapsed >= 1) saveGame(); }
function newGame(mapId = DEFAULT_MAP_ID) {
    if (!Object.hasOwn(MAP_FACTORIES, mapId)) throw new Error("Carte inconnue");
    const snapshot = serializeState(NEW_GAME_SNAPSHOT), definition = MAP_FACTORIES[mapId]();
    snapshot.map = { mapId, schemaVersion: definition.schemaVersion, salesPoints: [], zones: definition.zones };
    restoreSaveSnapshot(snapshot); saveBlocked = false; saveGame();
}
// Le debug lance une partie distincte, jamais une migration implicite.
window.startDebugMap = mapId => {
    if (![DAY_PHASE.PREPARATION, DAY_PHASE.BILAN].includes(game.phase) || mapPlacement || game.startPointPlacementActive) return false;
    if (!Object.hasOwn(MAP_FACTORIES, mapId)) return false;
    if (!window.confirm("Démarrer une nouvelle partie de test ? La sauvegarde actuelle sera remplacée.")) return false;
    newGame(mapId); return true;
};

const saveMenu = document.createElement("div"); saveMenu.id = "saveMenu";
saveMenu.innerHTML = '<button id="continueGame">CONTINUER</button><button id="newGame">NOUVELLE PARTIE</button><p id="saveStatus"></p>';
document.querySelector("#startDayOverlay .dayBox").appendChild(saveMenu);
document.getElementById("startDayButton").style.display = "none";
document.getElementById("startDayOverlay").classList.add("saveChoicePending");
document.getElementById("configureDayButton").disabled = true;
let savedGameExists = false;
try {
    const saved = localStorage.getItem(SAVE_KEY); savedGameExists = Boolean(saved);
    if (saved) validateSaveSnapshot(JSON.parse(saved));
} catch { saveBlocked = true; }
saveMenuPending = savedGameExists;
document.getElementById("continueGame").disabled = !savedGameExists || saveBlocked;
document.getElementById("saveStatus").textContent = saveBlocked ? "Sauvegarde illisible ou version incompatible : elle reste conservée." : savedGameExists ? "Une partie est disponible sur cet appareil." : "Sauvegarde automatique sur cet appareil.";
document.getElementById("continueGame").addEventListener("click", loadGame);
document.getElementById("newGame").addEventListener("click", () => { if (!savedGameExists || window.confirm("Remplacer la sauvegarde par une nouvelle partie ?")) newGame(); });
