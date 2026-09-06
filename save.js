// Instantané versionné : le DOM et les caches de navigation sont reconstruits.
const SAVE_VERSION = 2;
const SAVE_KEY = "quartier.save";
let saveElapsed = 0, saveRequested = false, saveBlocked = false, saveMenuPending = false;

function serializeState(value) {
    return JSON.parse(JSON.stringify(value, (key, item) => ["element", "navRoute", "navKey", "route"].includes(key) ? undefined : item));
}
function createSaveSnapshot() {
    return serializeState({ version: SAVE_VERSION, game, customers, police,
        map: { salesPoints: mapData.salesPoints, zones: mapData.zones },
        camera: { zoom: camera.zoom, x: camera.x, y: camera.y } });
}
const NEW_GAME_SNAPSHOT = createSaveSnapshot();

function validateSaveSnapshot(input) {
    if (!input || ![1, SAVE_VERSION].includes(input.version)) throw new Error("Version de sauvegarde non prise en charge");
    const safe = object => {
        if (typeof object === "number" && !Number.isFinite(object)) throw new Error("Nombre invalide");
        if (typeof object === "string" && (object.length > 2000 || /[<>]/.test(object))) throw new Error("Texte invalide");
        if (object && typeof object === "object") Object.entries(object).forEach(([key, value]) => {
            if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Champ interdit"); safe(value);
        });
    };
    safe(input);
    const state = input.game;
    if (!state || !Number.isInteger(state.day) || state.day < 1 || !Number.isFinite(state.money) || typeof state.dayActive !== "boolean" || !Number.isFinite(state.dayElapsed) || !Number.isFinite(state.dayDuration) || state.dayDuration <= 0 || state.dayElapsed < 0 || state.dayElapsed > state.dayDuration) throw new Error("État de journée invalide");
    const inventory = value => {
        if (!value || Object.keys(PRODUCT_CONFIG).some(p => !Number.isSafeInteger(value[p]) || value[p] < 0)) throw new Error("Inventaire invalide");
    };
    inventory(state.playerInventory);
    for (const key of ["employees", "apartments", "teams", "logisticsRequests", "logisticsMissions"]) if (!Array.isArray(state[key]) || state[key].length > 1000) throw new Error("Collection invalide");
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
        if (!PRODUCT_CONFIG[c.product] || !Number.isSafeInteger(c.quantity) || c.quantity < 1 || !Number.isFinite(c.price) || c.price < 0 || !Number.isFinite(c.x) || !Number.isFinite(c.y) || !["ENTERING", "SEARCHING", "GOING_TO_SELLER", "WAITING", "BEING_SERVED", "LEAVING", "EXITED"].includes(c.state)) throw new Error("Client invalide");
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
    mapData.salesPoints = snapshot.map.salesPoints;
    mapData.zones = snapshot.map.zones;
    customers = snapshot.customers;
    selectedCustomer = null; selectedEmployeeId = null; placementMode = null; salesPointMoveSellerId = null;
    playerMapEntity.navRoute = []; playerMapEntity.navKey = null;
    game.startPointPlacementActive = false;
    document.body.classList.remove("startPointPlacementActive"); map.classList.remove("startPointPlacementActive");
    normalizeExistingEmployees();
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
    document.querySelectorAll(".sidePanel.visible").forEach(panel => panel.classList.remove("visible"));
    document.getElementById("saveMenu")?.classList.add("hidden");
    document.getElementById("startDayButton").style.display = "";
    document.getElementById("startDayTitle").textContent = `JOUR ${game.day}`;
    document.getElementById("placementText").textContent = game.playerPlaced ? "Ton point est conservé." : "Choisis ton point de départ directement sur la carte.";
    document.getElementById("startDayOverlay").classList.toggle("hidden", game.dayActive || game.economySettledDay === game.day);
    document.getElementById("endDayOverlay").classList.add("hidden");
    if (!game.dayActive && game.economySettledDay === game.day) renderDailySummary();
    if (game.dayActive) { const remaining = game.customerSpawnRemaining; scheduleCustomerSpawn(); if (Number.isFinite(remaining) && remaining > 0) game.customerSpawnRemaining = remaining; }
    updatePlayer(); updateUI(); saveBlocked = false; saveMenuPending = false;
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
function newGame() { restoreSaveSnapshot(NEW_GAME_SNAPSHOT); saveBlocked = false; saveGame(); }

const saveMenu = document.createElement("div"); saveMenu.id = "saveMenu";
saveMenu.innerHTML = '<button id="continueGame">CONTINUER</button><button id="newGame">NOUVELLE PARTIE</button><p id="saveStatus"></p>';
document.querySelector("#startDayOverlay .dayBox").appendChild(saveMenu);
document.getElementById("startDayButton").style.display = "none";
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
