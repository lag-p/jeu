// Organisation physique commune. Ce module ne connaît aucun élément DOM : les
// positions, itinéraires et transitions restent dans la simulation.
function createPersonalFallback() {
    const point = mapData.mapId === "LEGACY_TEST_MAP" ? { x: game.playerX, y: game.playerY } : mapData.fallbackPoints[0];
    return { id: "personal-fallback", mapId: mapData.mapId, name: "Repli personnel", x: point.x, y: point.y,
        capacity: EMPLOYEE_PHYSICAL_CONFIG.fallbackInventoryCapacity, inventory: createEmptyInventory(), money: 0,
        active: true, provisional: true };
}

function ensurePersonalFallback() {
    if (!game.personalFallback) game.personalFallback = createPersonalFallback();
    const fallback = game.personalFallback;
    if (!Number.isFinite(fallback.x) || !Number.isFinite(fallback.y)) Object.assign(fallback, nearestWalkable({ x: game.playerX, y: game.playerY }));
    fallback.inventory = fallback.inventory || createEmptyInventory();
    fallback.capacity = Number.isSafeInteger(fallback.capacity) ? fallback.capacity : EMPLOYEE_PHYSICAL_CONFIG.fallbackInventoryCapacity;
    fallback.money = Math.max(0, Number(fallback.money) || 0);
    return fallback;
}

function isFallbackAllowed(employee) {
    return ["vendeur", "guetteur"].includes(employee?.role);
}

function getEmployeeHome(employee) {
    const apartment = employee?.assignment?.apartmentId && getApartmentById(employee.assignment.apartmentId);
    if (apartment?.active) return apartment;
    // Compatibilité des scénarios et sauvegardes antérieurs : avant le lot 2,
    // certains employés déjà existants n'avaient pas encore reçu la proposition
    // automatique. Un appartement actif est alors un rattachement prudent.
    if (!employee?.assignment?.manual) {
        const automaticHome = getActiveApartment();
        if (automaticHome?.active) return automaticHome;
    }
    return isFallbackAllowed(employee) ? ensurePersonalFallback() : null;
}

function getEmployeeHomeLabel(employee) {
    const home = getEmployeeHome(employee);
    return home ? home.name : "Aucun rattachement valide";
}

function employeeOperationLabel(employee) {
    const labels = { RESTING: "Au repli", PREPARING: "Préparation", OUTBOUND: "En trajet", AT_POST: "En poste", MISSION: "En mission", RETREAT_ORDERED: "Retour", RETURNING: "Retour", DEPOSITING: "Dépôt", DONE: "Au repli", BLOCKED: "Attention requise" };
    return labels[employee?.operationalState] || employee?.state || "Attention requise";
}

function setEmployeeOperation(employee, operation, warning = "") {
    if (!employee) return false;
    employee.operationalState = operation;
    employee.operationalWarning = warning;
    const legacy = {
        [EMPLOYEE_OPERATION.AT_POST]: "en poste", [EMPLOYEE_OPERATION.MISSION]: "en ravitaillement",
        [EMPLOYEE_OPERATION.OUTBOUND]: "en déplacement", [EMPLOYEE_OPERATION.RETURNING]: "en déplacement",
        [EMPLOYEE_OPERATION.RETREAT_ORDERED]: "en déplacement", [EMPLOYEE_OPERATION.DEPOSITING]: "en ravitaillement",
        [EMPLOYEE_OPERATION.RESTING]: "disponible", [EMPLOYEE_OPERATION.PREPARING]: "disponible",
        [EMPLOYEE_OPERATION.DONE]: "disponible", [EMPLOYEE_OPERATION.BLOCKED]: "bloqué"
    };
    employee.state = legacy[operation] || "bloqué";
    return true;
}

function normalizeEmployeePhysicalState(employee, options = {}) {
    if (!employee) return false;
    employee.assignment = employee.assignment || { apartmentId: null, managerId: null, manual: false, reason: "" };
    employee.assignment.pending = employee.assignment.pending || null;
    employee.route = Array.isArray(employee.route) ? employee.route : [];
    employee.navRoute = Array.isArray(employee.navRoute) ? employee.navRoute : [];
    if (!employee.assignment.apartmentId && !employee.assignment.manual) {
        const automaticHome = getActiveApartment();
        if (automaticHome?.active) employee.assignment.apartmentId = automaticHome.id;
    }
    if (!Object.values(EMPLOYEE_OPERATION).includes(employee.operationalState)) {
        setEmployeeOperation(employee, game.phase === DAY_PHASE.ACTIVITE && employee.state === "en poste" ? EMPLOYEE_OPERATION.AT_POST : EMPLOYEE_OPERATION.RESTING);
    }
    const home = getEmployeeHome(employee);
    if (!home) {
        setEmployeeOperation(employee, EMPLOYEE_OPERATION.BLOCKED, "Aucun appartement valide pour ce rôle.");
        return false;
    }
    // Migration v4 : les anciennes parties n'avaient pas de domicile ni de
    // trajet. On les replace uniquement hors activité, sans toucher au fret.
    if (options.placeAtHome && !employee.currentMissionId && !employee.moving) {
        Object.assign(employee, nearestWalkable(home));
        setEmployeeOperation(employee, EMPLOYEE_OPERATION.RESTING);
    }
    return true;
}

function normalizePhysicalEmployees(options = {}) {
    ensurePersonalFallback();
    game.employees.forEach(employee => normalizeEmployeePhysicalState(employee, options));
}

function getEmployeePost(employee) {
    if (employee.role === "vendeur") return getSalesPointForSeller(employee.id);
    if (employee.role === "guetteur") return employee.watchedZone || employee.assignment.salesPoint || null;
    if (employee.role === "gerant") {
        const scope = getManagerScope(employee);
        const positions = [...scope.sellers, ...scope.couriers].map(member => getSalesPointForSeller(member.id) || member).filter(Boolean);
        if (!positions.length) return getEmployeeHome(employee);
        return nearestWalkable({ x: positions.reduce((n, item) => n + item.x, 0) / positions.length, y: positions.reduce((n, item) => n + item.y, 0) / positions.length, id: "supervision-" + employee.id });
    }
    return getEmployeeHome(employee);
}

function canEmployeeOperate(employee) {
    return Boolean(employee?.active && employee.operationalState === EMPLOYEE_OPERATION.AT_POST && !employee.operationalWarning);
}

function getManagerSupervisionBonus(employee) {
    if (!employee || !canEmployeeOperate(employee)) return 0;
    const manager = employee.assignment?.managerId && getEmployeeById(employee.assignment.managerId);
    return manager && manager.active && canEmployeeOperate(manager) && mapDistance(manager, employee) <= EMPLOYEE_PHYSICAL_CONFIG.managerRadius ? EMPLOYEE_PHYSICAL_CONFIG.managerBonus : 0;
}

function prepareSellerLoad(employee, home) {
    if (employee.role !== "vendeur" || !home?.inventory) return;
    const container = getSellerStorageContainer(employee);
    const products = employee.allowedProducts || [];
    products.forEach(product => {
        // Le départ prépare une sacoche utile sans consommer toute sa capacité :
        // le ravitaillement reste possible pendant l'activité.
        const target = Math.max(1, Math.min(Math.ceil(employee.capacity / 2), getSellerTargetStock(employee, product)));
        const needed = Math.max(0, target - getInventoryQuantity(container, product));
        const quantity = Math.min(needed, getInventoryQuantity(home, product), getInventoryFreeSpace(container));
        if (quantity) transferInventory(home, container, product, quantity);
    });
}

function queueEmployeeReturn(employee, reason = "") {
    if (!employee || employee.currentMissionId) return false;
    const home = getEmployeeHome(employee);
    if (!home) return setEmployeeOperation(employee, EMPLOYEE_OPERATION.BLOCKED, "Retour impossible : aucun rattachement valide.");
    const point = nearestWalkable(home);
    employee.destination = { ...point, id: home.id };
    employee.navRoute = findMapPath(employee, point);
    if (!employee.navRoute.length && mapDistance(employee, point) > .01) return setEmployeeOperation(employee, EMPLOYEE_OPERATION.BLOCKED, "Trajet de retour introuvable.");
    setEmployeeOperation(employee, EMPLOYEE_OPERATION.RETURNING, reason);
    return true;
}

function depositEmployeeResources(employee) {
    const home = getEmployeeHome(employee);
    if (!home) return false;
    const containers = employee.role === "vendeur" ? [employee, { inventory: employee.localReserve || {}, capacity: employee.capacity }] : [employee];
    containers.forEach(container => Object.keys(PRODUCT_CONFIG).forEach(product => {
        const quantity = Math.min(getInventoryQuantity(container, product), getInventoryFreeSpace(home));
        if (quantity) transferInventory(container, home, product, quantity);
    }));
    if (employee.money > 0) transferMoney(employee, home, employee.money);
    const remainingStock = containers.reduce((sum, container) => sum + getInventoryTotal(container), 0);
    if (remainingStock || employee.money > 0) {
        setEmployeeOperation(employee, EMPLOYEE_OPERATION.BLOCKED, "Dépôt incomplet : capacité du rattachement insuffisante.");
        return false;
    }
    return true;
}

function applyPendingEmployeeAssignment(employee) {
    const pending = employee?.assignment?.pending;
    if (!pending || ![DAY_PHASE.PREPARATION, DAY_PHASE.BILAN].includes(game.phase) || employee.currentMissionId || employee.moving) return false;
    Object.assign(employee.assignment, pending, { pending: null });
    employee.assignment.manual = true;
    normalizeEmployeePhysicalState(employee, { placeAtHome: true });
    return true;
}

function requestEmployeeAssignment(employee, change) {
    if (!employee) return false;
    const current = employee.assignment.pending || employee.assignment;
    const next = { apartmentId: change.apartmentId ?? current.apartmentId, managerId: change.managerId ?? current.managerId, reason: "", manual: true };
    if ([DAY_PHASE.ACTIVITE, DAY_PHASE.REPLI].includes(game.phase) || employee.currentMissionId || employee.operationalState === EMPLOYEE_OPERATION.OUTBOUND || employee.operationalState === EMPLOYEE_OPERATION.RETURNING) {
        employee.assignment.pending = next;
        return true;
    }
    Object.assign(employee.assignment, next);
    normalizeEmployeePhysicalState(employee, { placeAtHome: true });
    return true;
}

function beginEmployeeActivity() {
    normalizePhysicalEmployees({ placeAtHome: true });
    game.employees.forEach(employee => {
        if (!employee.active || employee.operationalState === EMPLOYEE_OPERATION.BLOCKED) return;
        const home = getEmployeeHome(employee), post = getEmployeePost(employee);
        if (!home || !post) return setEmployeeOperation(employee, EMPLOYEE_OPERATION.BLOCKED, "Poste ou rattachement inaccessible.");
        setEmployeeOperation(employee, EMPLOYEE_OPERATION.PREPARING);
        prepareSellerLoad(employee, home);
        if (employee.role === "ravitailleur") return setEmployeeOperation(employee, EMPLOYEE_OPERATION.AT_POST);
        const point = nearestWalkable(post);
        employee.destination = { ...point, id: post.id || null };
        employee.navRoute = findMapPath(employee, point);
        if (!employee.navRoute.length && mapDistance(employee, point) > .01) return setEmployeeOperation(employee, EMPLOYEE_OPERATION.BLOCKED, "Poste impossible à rejoindre.");
        setEmployeeOperation(employee, EMPLOYEE_OPERATION.OUTBOUND);
    });
}

function beginEmployeeRetreat() {
    game.employees.forEach(employee => {
        if (!employee.active || employee.operationalState === EMPLOYEE_OPERATION.DONE) return;
        if (employee.currentMissionId) { setEmployeeOperation(employee, EMPLOYEE_OPERATION.RETREAT_ORDERED, "Fin de mission sûre puis retour."); return; }
        queueEmployeeReturn(employee, "Ordre de repli reçu.");
    });
}

function updateEmployeePhysicalRealtime(delta) {
    if (!game.dayActive || !Number.isFinite(delta) || delta <= 0) return;
    game.employees.forEach(employee => {
        if (!employee.active) return;
        if (employee.operationalState === EMPLOYEE_OPERATION.OUTBOUND) {
            const post = getEmployeePost(employee);
            if (!post) return setEmployeeOperation(employee, EMPLOYEE_OPERATION.BLOCKED, "Poste supprimé avant l'arrivée.");
            if (moveMapEntity(employee, post, delta, employee.movementSpeed || 10)) setEmployeeOperation(employee, EMPLOYEE_OPERATION.AT_POST);
        } else if (employee.operationalState === EMPLOYEE_OPERATION.RETURNING) {
            const home = getEmployeeHome(employee);
            if (!home) return setEmployeeOperation(employee, EMPLOYEE_OPERATION.BLOCKED, "Rattachement de retour invalide.");
            if (moveMapEntity(employee, home, delta, employee.movementSpeed || 10)) { employee.depositElapsed = 0; setEmployeeOperation(employee, EMPLOYEE_OPERATION.DEPOSITING); }
        } else if (employee.operationalState === EMPLOYEE_OPERATION.DEPOSITING) {
            employee.depositElapsed = (employee.depositElapsed || 0) + delta;
            if (employee.depositElapsed >= EMPLOYEE_PHYSICAL_CONFIG.depositSeconds && depositEmployeeResources(employee)) { setEmployeeOperation(employee, EMPLOYEE_OPERATION.DONE); applyPendingEmployeeAssignment(employee); }
        } else if (employee.operationalState === EMPLOYEE_OPERATION.RETREAT_ORDERED && !employee.currentMissionId) queueEmployeeReturn(employee);
        if (employee.pathBlocked) {
            employee.blockedSeconds = (employee.blockedSeconds || 0) + delta;
            if (employee.blockedSeconds >= EMPLOYEE_PHYSICAL_CONFIG.stuckSeconds) setEmployeeOperation(employee, EMPLOYEE_OPERATION.BLOCKED, "Trajet bloqué : vérifie le rattachement ou la carte.");
        } else employee.blockedSeconds = 0;
        // Exception documentée : après diagnostic persistant, la récupération
        // sûre ne détruit ni fret ni argent ; elle ne sert jamais au trajet normal.
        if (employee.operationalState === EMPLOYEE_OPERATION.BLOCKED) {
            employee.recoveryElapsed = (employee.recoveryElapsed || 0) + delta;
            if (employee.recoveryElapsed >= EMPLOYEE_PHYSICAL_CONFIG.recoverySeconds) {
                const home = getEmployeeHome(employee);
                if (home) {
                    Object.assign(employee, nearestWalkable(home)); employee.navRoute = []; employee.destination = null;
                    if (depositEmployeeResources(employee)) setEmployeeOperation(employee, EMPLOYEE_OPERATION.DONE, "Récupération sûre après trajet invalide.");
                }
            }
        } else employee.recoveryElapsed = 0;
    });
}

function getPhysicalRetreatBlockers() {
    return game.employees.filter(employee => employee.active && ![EMPLOYEE_OPERATION.DONE, EMPLOYEE_OPERATION.RESTING].includes(employee.operationalState)).length;
}

function recoverPersonalFallbackReceipts() {
    const fallback = ensurePersonalFallback();
    if (fallback.money > 0) transferMoney(fallback, game, fallback.money);
}
