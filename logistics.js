// ===============================
// APPARTEMENTS ET LOGISTIQUE
// ===============================

const apartmentDefinitions = {

    depot: {
        name: "Dépôt de stock",
        cost: 75,
        capacity: 80,
        role: "depot"
    },

    mixte: {
        name: "Appartement mixte",
        cost: 110,
        capacity: 60,
        role: "mixte"
    }

};


const logisticsPanel =
    document.getElementById("logisticsPanel");

const logisticsContent =
    document.getElementById("logisticsContent");


function createEmptyInventory() {

    return {
        "Produit A": 0,
        "Produit B": 0,
        "Produit C": 0
    };

}


function getInventoryQuantity(container, product) {

    if (!container || !container.inventory) {
        return 0;
    }


    const quantity = container.inventory[product];


    return Number.isSafeInteger(quantity) && quantity >= 0
        ? quantity
        : 0;

}


function getInventoryTotal(container) {

    return Object.keys(container.inventory || {})
        .reduce(
            (total, product) =>
                total + getInventoryQuantity(container, product),
            0
        );

}


function getInventoryFreeSpace(container) {

    if (!Number.isSafeInteger(container.capacity)) {
        return Infinity;
    }


    return Math.max(
        0,
        container.capacity - getInventoryTotal(container)
    );

}

// Une unité physique n'est comptée qu'une fois. En mode Cachette, le stock du
// vendeur vit dans localReserve, jamais dans employee.inventory.
function getNetworkStock() {
    const byProduct = createEmptyInventory();
    const add = container => Object.keys(byProduct).forEach(product => byProduct[product] += getInventoryQuantity(container, product));
    const player = { inventory: game.playerInventory || createEmptyInventory() };
    add(player);
    game.apartments.forEach(add);
    game.employees.filter(employee => employee.role === "vendeur").forEach(seller => { add(seller); add({ inventory: seller.localReserve || {} }); });
    game.employees.filter(employee => employee.role === "ravitailleur").forEach(add);
    const storage = getInventoryTotal(player) + game.apartments.reduce((sum, apartment) => sum + getInventoryTotal(apartment), 0);
    const sellers = game.employees.filter(employee => employee.role === "vendeur").reduce((sum, seller) => sum + getInventoryTotal(seller) + getInventoryTotal({ inventory: seller.localReserve || {} }), 0);
    const couriers = game.employees.filter(employee => employee.role === "ravitailleur").reduce((sum, courier) => sum + getInventoryTotal(courier), 0);
    return { total: storage + sellers + couriers, byProduct, storage, sellers, couriers, player: getInventoryTotal(player), apartments: storage - getInventoryTotal(player) };
}

function getNetworkStockDistribution() {
    const products = Object.keys(createEmptyInventory());
    const entry = (name, container) => ({ name, inventory: Object.fromEntries(products.map(product => [product, getInventoryQuantity(container, product)])) });
    return [entry("Joueur", { inventory: game.playerInventory || {} }), ...game.apartments.map(apartment => entry(apartment.name, apartment)), ...game.employees.filter(employee => employee.role === "vendeur").flatMap(seller => [entry(`Sacoche ${seller.name}`, seller), entry(`Réserve ${seller.name}`, { inventory: seller.localReserve || {} })]), ...game.employees.filter(employee => employee.role === "ravitailleur").map(courier => entry(`Transport ${courier.name}`, courier))];
}


function getSellerStorageContainer(seller) {

    if (seller.salesMode === "cachette") {
        return {
            inventory: seller.localReserve,
            capacity: seller.capacity
        };
    }


    return seller;

}


function getSellerProductStock(seller, product) {

    return getInventoryQuantity(
        getSellerStorageContainer(seller),
        product
    );

}


function transferInventory(source, target, product, quantity) {

    if (
        !source ||
        !target ||
        source.inventory === target.inventory ||
        !Object.hasOwn(PRODUCT_CONFIG, product) ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0 ||
        getInventoryQuantity(source, product) < quantity ||
        getInventoryFreeSpace(target) < quantity
    ) {
        return false;
    }


    source.inventory[product] =
        getInventoryQuantity(source, product) - quantity;

    target.inventory[product] =
        getInventoryQuantity(target, product) + quantity;
    if (typeof updateUI === "function") updateUI();
    return true;

}


function transferMoney(source, target, amount) {

    if (
        !source ||
        !target ||
        source === target ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isFinite(source.money) ||
        source.money < amount
    ) {
        return false;
    }


    source.money -= amount;
    target.money =
        (Number.isFinite(target.money) ? target.money : 0) + amount;


    return true;

}


function getApartmentById(id) {

    return game.apartments.find(
        apartment => apartment.id === id
    ) || null;

}


function getActiveApartment() {

    return getApartmentById(game.activeApartmentId) ||
        game.apartments.find(apartment => apartment.active) ||
        null;

}


function createApartment(type, x, y) {
    ({ x, y } = nearestWalkable({ x, y }));

    const definition = apartmentDefinitions[type];


    if (!definition) {
        return null;
    }


    const apartment = {
        id: "apartment-" + Date.now() + "-" + Math.random(),
        name: definition.name,
        role: definition.role,
        cost: definition.cost,
        x,
        y,
        capacity: definition.capacity,
        inventory: createEmptyInventory(),
        money: 0,
        active: true,
        element: null
    };


    game.apartments.push(apartment);
    game.activeApartmentId = apartment.id;

    createApartmentMapVisual(apartment);


    return apartment;

}


function buyApartment(type, requestedSiteId = null) {

    const definition = apartmentDefinitions[type];
    const site = mapData.apartmentSites.find(candidate => (!requestedSiteId || candidate.id === requestedSiteId) && !game.apartments.some(apartment => apartment.siteId === candidate.id));
    if (!site) { showMessage("Aucun emplacement disponible."); return false; }
    const factor = site.id === "APT_CENTRAL" ? 1.5 : site.id === "APT_REMOTE" ? .8 : 1;
    const cost = Math.ceil((definition?.cost || 0) * factor);


    if (!definition || game.money < cost) {
        showMessage("Argent insuffisant.");
        return false;
    }


    recordExpense(cost);
    game.money -= cost;



    const apartment = createApartment(
        type,
        site ? site.x : 50,
        site ? site.y : 50
    );

    apartment.siteId = site ? site.id : null;
    if (site) {
        apartment.name = site.name;
        apartment.capacity += site.capacityBonus;
        apartment.rent = site.id === "APT_CENTRAL" ? 12 : site.id === "APT_REMOTE" ? 5 : 8;
        apartment.cost = cost;
        apartment.discretion = site.id === "APT_COURT" ? 85 : 50;
        if (site.id === "APT_CENTRAL") apartment.capacity = Math.round(apartment.capacity * .65);
    }


    renderLogisticsPanel();
    updateUI();
    showMessage(apartment.name + " acquis.");
    if (typeof requestSave === "function") requestSave();


    return true;

}


function getEmployeeById(id) {

    return game.employees.find(employee => employee.id === id) ||
        null;

}


function getSellerApartment(seller) {

    return getApartmentById(
        seller.assignment && seller.assignment.apartmentId
    );

}

function getTeamForMember(employeeId) {
    return (game.teams || []).find(team => [team.managerId, ...(team.sellerIds || []), ...(team.courierIds || []), ...(team.watcherIds || [])].includes(employeeId)) || null;
}

function getManagerScope(manager) {
    const team = getTeamForMember(manager.id);
    if (team && team.managerId === manager.id) return { team, sellers: (team.sellerIds || []).map(getEmployeeById).filter(Boolean), couriers: (team.courierIds || []).map(getEmployeeById).filter(Boolean), apartments: (team.apartmentIds || []).map(getApartmentById).filter(apartment => apartment && apartment.active) };
    return { team: null, sellers: game.employees.filter(employee => employee.assignment.managerId === manager.id && employee.role === "vendeur"), couriers: game.employees.filter(employee => employee.assignment.managerId === manager.id && employee.role === "ravitailleur"), apartments: game.apartments.filter(apartment => apartment.active) };
}

function chooseApartmentForRequest(seller, product, apartments, quantity = 1) {
    return apartments.filter(apartment => getUnreservedStock(apartment, product) >= quantity).sort((a, b) => mapDistance(a, seller) - mapDistance(b, seller))[0] || null;
}

function getUnreservedStock(apartment, product) {
    const reserved = game.logisticsMissions.filter(m => m.apartmentId === apartment?.id && m.product === product && ["CREATED", "GOING_TO_STORAGE", "LOADING"].includes(m.stage)).reduce((sum, m) => sum + m.quantity, 0);
    return Math.max(0, getInventoryQuantity(apartment, product) - reserved);
}

function chooseCourierForRequest(request, apartment, couriers) {
    return getAvailableCouriers(couriers, request).sort((a, b) => getCourierRequestScore(b, request, apartment) - getCourierRequestScore(a, request, apartment))[0] || null;
}

function getAvailableCouriers(couriers, request = null) {
    return couriers.filter(courier => courier.role === "ravitailleur" && courier.active && ["en poste", "disponible"].includes(courier.state) && !courier.currentMissionId && !game.logisticsMissions.some(mission => mission.courierId === courier.id) && (!request || request.type === "CASH_COLLECTION" || courier.capacity - getInventoryTotal(courier) > 0));
}

function getCourierRequestScore(courier, request, apartment) {
    const freeCapacity = Math.max(0, courier.capacity - getInventoryTotal(courier));
    const coverage = request.type === "CASH_COLLECTION" ? 0 : Math.min(freeCapacity, request.requested || 0);
    // La capacité utile prime : un grand trajet évité vaut plus qu'un léger écart de distance.
    return coverage * 10 - mapDistance(courier, apartment || getEmployeeById(request.sellerId));
}

function getSellerTargetStock(seller, product) {
    const base = Number.isSafeInteger(seller.targetStock) ? seller.targetStock : Math.max(1, seller.capacity - 4);
    const rate = seller.salesRate?.[product] || 0;
    // Prépare la cible dynamique sans la rendre instable : au plus +2 unités pour un point très actif.
    const share = Math.max(1, Math.floor(seller.capacity / Math.max(1, seller.allowedProducts.length)));
    return Math.min(share, Math.max(1, Math.min(base, LOGISTICS_CONFIG.slowTarget) + (rate >= .25 ? 12 : rate >= .1 ? 6 : 0)));
}

function estimateStockSeconds(seller, product) {
    const rate = seller.salesRate?.[product] || 0;
    const stock = getSellerProductStock(seller, product);
    return stock === 0 ? 0 : rate > .001 ? stock / rate : Infinity;
}

function configureTeam(team) {
    const roleLists = { sellerIds: "vendeur", courierIds: "ravitailleur", watcherIds: "guetteur" };
    if (getEmployeeById(team.managerId)?.role !== "gerant") return false;
    const ids = [team.managerId];
    for (const [key, role] of Object.entries(roleLists)) {
        if (!Array.isArray(team[key]) || team[key].some(id => getEmployeeById(id)?.role !== role)) return false;
        ids.push(...team[key]);
    }
    if (new Set(ids).size !== ids.length || team.apartmentIds.some(id => !getApartmentById(id))) return false;
    const previous = game.teams.find(t => t.managerId === team.managerId);
    const affected = new Set([...ids, ...(previous ? [previous.managerId, ...previous.sellerIds, ...previous.courierIds, ...previous.watcherIds] : [])]);
    if (game.logisticsMissions.some(m => affected.has(m.sellerId) || affected.has(m.courierId))) return false;
    if (game.teams.some(t => t !== previous && [t.managerId, ...t.sellerIds, ...t.courierIds, ...t.watcherIds].some(id => ids.includes(id)))) return false;
    game.employees.filter(e => e.assignment.managerId === team.managerId).forEach(e => { e.assignment.managerId = null; });
    game.logisticsRequests = game.logisticsRequests.filter(r => r.managerId !== team.managerId);
    game.teams = game.teams.filter(t => t !== previous);
    game.teams.push({ ...team, name: String(team.name).replace(/[<>]/g, "").slice(0, 50) });
    ids.filter(id => id !== team.managerId).forEach(id => { getEmployeeById(id).assignment.managerId = team.managerId; });
    return true;
}

function getTeamPerformance(team) {
    const points = mapData.salesPoints.filter(p => team.sellerIds.includes(p.sellerId));
    const total = key => points.reduce((sum, p) => sum + (p.stats[key] || 0), 0);
    const served = total("customersServed");
    const manager = getEmployeeById(team.managerId);
    return { revenue: total("revenue"), served, lost: total("customersLost"), stockouts: total("stockouts"), wait: served ? total("totalWaitTime") / served : 0, service: served ? total("totalServiceTime") / served : 0, logistics: manager?.logisticsStats?.requestsHandled ? manager.logisticsStats.totalMissionSeconds / manager.logisticsStats.requestsHandled : 0 };
}


function getSellerWaitingCustomers(sellerId) {

    return typeof customers === "undefined"
        ? 0
        : customers.filter(customer =>
            customer.state === "WAITING" &&
            customer.assignedSellerId === sellerId
        ).length;

}


function getLogisticsPriority(seller, apartment) {

    const remaining = getInventoryTotal(getSellerStorageContainer(seller));
    const stockRatio = seller.capacity > 0
        ? remaining / seller.capacity
        : 0;
    const waiters = getSellerWaitingCustomers(seller.id);
    const salesPoint = getSalesPointForSeller(seller.id);
    const importance = salesPoint ? salesPoint.importance : 1;
    const distance = mapDistance(seller, apartment);
    const urgency = remaining === 0 ? 40 : stockRatio < 0.25 ? 25 : 10;

    const seconds = Math.min(...seller.allowedProducts.map(product => estimateStockSeconds(seller, product)));
    return urgency + Math.max(0, 60 - seconds) + waiters * 12 + importance * 8 - distance * 0.35;

}


function createLogisticsRequest(seller, manager = null, product = null, options = {}) {
    if (seller.logisticsAutomation === false) {
        return false;
    }
    const scope = manager ? getManagerScope(manager) : null;
    const apartments = scope ? scope.apartments : game.apartments.filter(apartment => apartment.active);

    const existing = game.logisticsRequests.find(request => request.sellerId === seller.id && request.product === product && request.status !== "COMPLETED");
    const collectionAlreadyPlanned = options.cashOnly && game.logisticsRequests.some(request => request.sellerId === seller.id && request.type.includes("COLLECTION") && request.status !== "COMPLETED");

    if (existing || collectionAlreadyPlanned) {
        return false;
    }

    const stockSpace = getInventoryFreeSpace(getSellerStorageContainer(seller));
    const threshold = Number.isSafeInteger(seller.restockThreshold)
        ? seller.restockThreshold : Math.max(1, Math.floor(seller.capacity / 2));
    const neededProduct = product && seller.allowedProducts.includes(product) && (getSellerProductStock(seller, product) <= threshold || estimateStockSeconds(seller, product) < LOGISTICS_CONFIG.forecastSeconds) && getSellerProductStock(seller, product) < getSellerTargetStock(seller, product) ? product : null;
    const apartment = neededProduct && chooseApartmentForRequest(seller, neededProduct, apartments);
    const needsSupply = Boolean(neededProduct) && stockSpace > 0;
    const needsCashCollection = (options.cashOnly || needsSupply) && seller.money >= (game.logisticsSettings?.maxSellerCash || 150);

    if (!needsSupply && !needsCashCollection) {
        return false;
    }

    const request = {
        id: "request-" + Date.now() + "-" + Math.random(),
        sellerId: seller.id,
        apartmentId: apartment ? apartment.id : null,
        type: needsSupply && needsCashCollection
            ? "SUPPLY_AND_COLLECTION"
            : needsSupply
                ? "SUPPLY"
                : "CASH_COLLECTION",
        product: neededProduct || null,
        targetStock: neededProduct ? getSellerTargetStock(seller, neededProduct) : 0,
        requested: neededProduct ? Math.max(0, getSellerTargetStock(seller, neededProduct) - getSellerProductStock(seller, neededProduct)) : 0,
        priority: getLogisticsPriority(seller, apartment || seller),
        status: "WAITING_FOR_STOCK",
        managerId: manager ? manager.id : seller.assignment.managerId || null,
        blockedReason: needsSupply && !apartment ? (apartments.length ? `${neededProduct} : rupture au dépôt` : "Aucun appartement accessible") : null,
        createdAt: performance.now()
    };

    game.logisticsRequests.push(request);

    if (!request.blockedReason) request.status = "READY";
    if (request.blockedReason) showMessage(`${manager ? manager.name : "Réseau"} : ${request.blockedReason} pour ${seller.name}.`);
    return true;

}

// Le joueur utilise la même file que le gérant, mais choisit explicitement
// tous les paramètres et le ravitailleur : aucune téléportation ni voie bis.
function createManualLogisticsMission(courierId, apartmentId, sellerId, product, quantity) {
    const courier = getEmployeeById(courierId);
    const apartment = getApartmentById(apartmentId);
    const seller = getEmployeeById(sellerId);
    if (!courier || courier.role !== "ravitailleur" || !courier.active || !["en poste", "disponible"].includes(courier.state)) return { success: false, message: "Ravitailleur inactif ou indisponible." };
    if (courier.currentMissionId || game.logisticsMissions.some(mission => mission.courierId === courier.id)) return { success: false, message: "Ravitailleur indisponible." };
    if (!apartment || !apartment.active) return { success: false, message: "Appartement inactif." };
    if (!seller || seller.role !== "vendeur" || !seller.active || seller.state !== "en poste") return { success: false, message: "Vendeur inactif." };
    if (!seller.allowedProducts.includes(product)) return { success: false, message: "Produit non autorisé chez ce vendeur." };
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > courier.capacity) return { success: false, message: "Quantité hors capacité." };
    if (getUnreservedStock(apartment, product) < quantity) return { success: false, message: "Stock appartement insuffisant ou réservé." };
    if (getInventoryFreeSpace(courier) < quantity) return { success: false, message: "Capacité de transport insuffisante." };
    if (getInventoryFreeSpace(getSellerStorageContainer(seller)) < quantity) return { success: false, message: "Réserve vendeur insuffisante." };
    if (seller.currentMissionId || game.logisticsRequests.some(request => request.sellerId === seller.id && request.status !== "COMPLETED")) return { success: false, message: "Une demande existe déjà pour ce vendeur." };

    const request = { id: "request-" + Date.now() + "-" + Math.random(), sellerId, apartmentId, type: seller.money > 0 ? "SUPPLY_AND_COLLECTION" : "SUPPLY", product, quantity, requested: quantity, priority: 1000, status: "READY", manual: true, courierId, createdAt: performance.now() };
    game.logisticsRequests.push(request);
    assignLogisticsRequests();
    if (request.status !== "ASSIGNED") game.logisticsRequests = game.logisticsRequests.filter(item => item !== request);
    return { success: request.status === "ASSIGNED", message: "Mission non attribuable." };
}


function assignLogisticsRequests() {
    const candidates = game.logisticsRequests
        .filter(request => ["pending", "WAITING_FOR_STOCK", "WAITING_FOR_COURIER", "READY"].includes(request.status))
        .sort((first, second) => second.priority - first.priority);
    const blockedSellers = new Set(game.logisticsMissions.map(mission => mission.sellerId));

    candidates.forEach(request => {
        const seller = getEmployeeById(request.sellerId);
        const manager = request.managerId && getEmployeeById(request.managerId);
        const scope = manager ? getManagerScope(manager) : null;
        if (seller) request.priority = getLogisticsPriority(seller, getApartmentById(request.apartmentId) || seller);
        const apartments = scope ? scope.apartments : game.apartments.filter(apartment => apartment.active);
        const current = apartments.find(a => a.id === request.apartmentId);
        const apartment = request.manual ? current : request.type === "CASH_COLLECTION"
            ? (current || apartments[0])
            : seller && (current && getUnreservedStock(current, request.product) > 0 ? current : chooseApartmentForRequest(seller, request.product, apartments));
        request.apartmentId = apartment?.id || null;
        if (!seller || !apartment) {
            request.status = !apartment ? "WAITING_FOR_STOCK" : "WAITING_FOR_COURIER";
            request.blockedReason = !seller ? "Vendeur indisponible" : `${request.product || "Caisse"} : rupture au dépôt`;
        } else if (request.status === "WAITING_FOR_STOCK") {
            request.status = "READY";
            request.blockedReason = null;
        }
    });
    candidates.sort((a, b) => b.priority - a.priority);

    // Un passage attribue autant de missions que de ravitailleurs libres. Les plus
    // grandes capacités passent d'abord afin d'éviter un trajet supplémentaire.
    const allCouriers = game.employees.filter(employee => employee.role === "ravitailleur");
    const available = getAvailableCouriers(allCouriers);
    const orderedCouriers = available.sort((first, second) =>
        (second.capacity - getInventoryTotal(second)) - (first.capacity - getInventoryTotal(first)) ||
        mapDistance(first, getApartmentById(candidates[0]?.apartmentId) || first) - mapDistance(second, getApartmentById(candidates[0]?.apartmentId) || second)
    );

    orderedCouriers.forEach(courier => {
        const request = candidates.find(candidate => {
            if (candidate.status === "ASSIGNED" || !candidate.apartmentId || blockedSellers.has(candidate.sellerId)) return false;
            const manager = candidate.managerId && getEmployeeById(candidate.managerId);
            const scope = manager ? getManagerScope(manager) : null;
            const seller = getEmployeeById(candidate.sellerId);
            if (!seller?.active || seller.state !== "en poste" || (manager && !manager.active)) return false;
            if (candidate.manual && candidate.courierId !== courier.id) return false;
            if (scope && !scope.couriers.some(member => member.id === courier.id)) return false;
            // Un besoin qui dépasse la capacité est confié, si possible, au plus gros
            // véhicule encore libre ; les profils équivalents restent alternés.
            const largerCompatible = !candidate.manual && available.some(other => other.id !== courier.id && !other.currentMissionId && (!scope || scope.couriers.some(member => member.id === other.id)) && getCourierRequestScore(other, candidate, getApartmentById(candidate.apartmentId)) > getCourierRequestScore(courier, candidate, getApartmentById(candidate.apartmentId)));
            return !largerCompatible;
        });
        if (!request) return;
        const seller = getEmployeeById(request.sellerId);
        const apartment = getApartmentById(request.apartmentId);
        const quantity = request.type === "CASH_COLLECTION" ? 0 : Math.min(request.manual ? request.quantity : request.requested, getInventoryFreeSpace(getSellerStorageContainer(seller)), courier.capacity - getInventoryTotal(courier), getUnreservedStock(apartment, request.product));
        if (request.type !== "CASH_COLLECTION" && quantity <= 0) {
            request.status = "WAITING_FOR_STOCK";
            request.blockedReason = `${request.product} : rupture au dépôt ou capacité insuffisante`;
            return;
        }
        const mission = { id: "mission-" + Date.now() + "-" + Math.random(), requestId: request.id, type: request.type, courierId: courier.id, sellerId: seller.id, apartmentId: apartment.id, product: request.product, quantity, stage: "CREATED", stageElapsed: 0, createdAt: performance.now() };
        request.status = "ASSIGNED";
        request.missionId = mission.id;
        courier.currentMissionId = mission.id;
        seller.currentMissionId = mission.id;
        blockedSellers.add(seller.id);
        game.logisticsMissions.push(mission);
        showMapIndicator(courier, "📦");
        showMessage(`${getEmployeeById(request.managerId)?.name || "Gérant"} assigne ${courier.name} → ${seller.name} : ${request.product || "collecte"}${quantity ? ` ×${quantity}` : ""}.`);
    });

    game.logisticsRequests = game.logisticsRequests.filter(
        request => request.status !== "COMPLETED"
    );

}


function finishMission(mission, courier, seller) {
    if (!game.logisticsMissions.includes(mission)) return false;

    const request = game.logisticsRequests.find(
        item => item.id === mission.requestId
    );

    // Une mission ne peut pas effacer un transport d'argent encore physique.
    if (courier.money > 0) {
        return false;
    }
    if (request) {
        request.status = "COMPLETED";
        const manager = request.managerId && getEmployeeById(request.managerId);
        if (manager && !mission.cancelled && !mission.failed) {
            manager.logisticsStats = manager.logisticsStats || { requestsHandled: 0, stockoutsAvoided: 0, totalMissionSeconds: 0 };
            manager.logisticsStats.requestsHandled++;
            if (mission.stockoutAvoided) manager.logisticsStats.stockoutsAvoided++;
            awardEmployeeExperience(manager);
            manager.logisticsStats.totalMissionSeconds += mission.elapsed || 0;
        }
    }

    if (!mission.cancelled && !mission.failed) awardEmployeeExperience(courier, 2);
    courier.currentMissionId = null;
    courier.state = "disponible";
    if (seller.currentMissionId === mission.id) seller.currentMissionId = null;
    game.logisticsMissions = game.logisticsMissions.filter(
        item => item !== mission
    );
    game.logisticsRequests = game.logisticsRequests.filter(
        item => item.status !== "COMPLETED"
    );
    if (typeof updateUI === "function") updateUI();
    return true;

}


function progressMissionStage(mission, delta, duration, nextStage) {

    mission.stageElapsed += delta;

    if (mission.stageElapsed >= duration) {
        mission.stage = nextStage;
        mission.stageElapsed = 0;
        return true;
    }

    return false;

}


function updateLogisticsRealtime(delta) {

    assignLogisticsRequests();

    game.logisticsMissions.slice().forEach(mission => {
        mission.elapsed = (mission.elapsed || 0) + delta;
        const courier = getEmployeeById(mission.courierId);
        const seller = getEmployeeById(mission.sellerId);
        const apartment = getApartmentById(mission.apartmentId);

        if (!courier || !seller || !apartment) {
            if (courier && courier.currentMissionId === mission.id) {
                courier.currentMissionId = null;
                courier.state = "disponible";
            }
            if (seller && seller.currentMissionId === mission.id) {
                seller.currentMissionId = null;
            }
            game.logisticsMissions = game.logisticsMissions.filter(
                item => item !== mission
            );
            game.logisticsRequests = game.logisticsRequests.filter(
                request => request.id !== mission.requestId
            );
            return;
        }

        const speed = (courier.movementSpeed || 10 * (courier.efficiency || 1)) * getEventModifier("logistics") * getEventModifier("efficiency") * (1 + (game.logisticsUpgrade || 0) * .1);

        if (mission.stage === "CREATED") {
            courier.state = "en déplacement";
            if (mission.reliabilityDelay === undefined) mission.reliabilityDelay = Math.random() * 100 > courier.reliability ? 2 : 0;
            progressMissionStage(
                mission,
                delta,
                LOGISTICS_CONFIG.creationSeconds + mission.reliabilityDelay,
                mission.type === "CASH_COLLECTION"
                    ? "GOING_TO_SELLER"
                    : "GOING_TO_STORAGE"
            );
            return;
        }

        if (mission.stage === "GOING_TO_STORAGE") {
            if (moveMapEntity(courier, apartment, delta, speed)) {
                mission.stage = "LOADING";
                mission.stageElapsed = 0;
                courier.state = "en ravitaillement";
            }
            return;
        }

        if (mission.stage === "LOADING") {
            if (progressMissionStage(mission, delta, LOGISTICS_CONFIG.loadingSeconds, "GOING_TO_SELLER")) {
                if (!transferInventory(apartment, courier, mission.product, mission.quantity)) {
                    mission.failed = true;
                    mission.stage = "RETURNING";
                }
                showMessage(`${courier.name} part vers ${seller.name}.`);
            }
            return;
        }

        if (mission.stage === "GOING_TO_SELLER") {
            if (moveMapEntity(courier, seller, delta, speed)) {
                mission.stage = mission.type === "CASH_COLLECTION"
                    ? "COLLECTING_MONEY"
                    : "DELIVERING";
                mission.stageElapsed = 0;
            }
            return;
        }

        if (mission.stage === "DELIVERING") {
            if (progressMissionStage(mission, delta, LOGISTICS_CONFIG.deliverySeconds, "COLLECTING_MONEY")) {
                const before = getSellerProductStock(seller, mission.product);
                mission.stockoutAvoided = before > 0;
                transferInventory(
                    courier,
                    getSellerStorageContainer(seller),
                    mission.product,
                    mission.quantity
                );
                showMessage(`${seller.name} ravitaillé : ${mission.product} ${before} → ${getSellerProductStock(seller, mission.product)}.`);
            }
            return;
        }

        if (mission.stage === "COLLECTING_MONEY") {
            if (progressMissionStage(mission, delta, LOGISTICS_CONFIG.collectionSeconds, "RETURNING")) {
                // L'argent ne rejoint pas le dépôt avant le retour physique.
                transferMoney(seller, courier, seller.money);
                courier.state = "en déplacement";
            }
            return;
        }

        if (mission.stage === "RETURNING" && moveMapEntity(courier, apartment, delta, speed)) {
            mission.stage = "DEPOSITING_MONEY";
            mission.stageElapsed = 0;
            return;
        }

        if (mission.stage === "DEPOSITING_MONEY") {
            if (progressMissionStage(mission, delta, LOGISTICS_CONFIG.depositSeconds, "COMPLETED")) {
                Object.keys(PRODUCT_CONFIG).forEach(product => {
                    const quantity = Math.min(getInventoryQuantity(courier, product), getInventoryFreeSpace(apartment));
                    if (quantity) transferInventory(courier, apartment, product, quantity);
                });
                const carried = Math.max(0, courier.money || 0);
                if (carried > 0) transferMoney(courier, apartment, carried);
                if (carried > 0) showMessage(`${courier.name} a déposé ${Math.floor(carried)} €.`);
                finishMission(mission, courier, seller);
            }
        }
    });

}


function renderLogisticsPanel() {

    if (!logisticsContent) {
        return;
    }


    logisticsContent.innerHTML = `
        <div class="employeeCard">
            <strong>Appartements</strong>
            <label class="stockPurchaseLabel">Emplacement<select id="apartmentSiteChoice">${mapData.apartmentSites.filter(site => !game.apartments.some(a => a.siteId === site.id)).map(site => `<option value="${site.id}">${site.name} · ${site.id === "APT_CENTRAL" ? "central, petite capacité, prix +50%" : site.id === "APT_REMOTE" ? "éloigné, grande capacité, prix -20%" : site.id === "APT_COURT" ? "discret, capacité moyenne" : "intermédiaire"}</option>`).join("")}</select></label>
            <p>Les achats de stock sont déposés dans l'appartement actif.</p>
            <button type="button" data-apartment-type="depot">
                Acheter un dépôt · 75 €
            </button>
            <button type="button" data-apartment-type="mixte">
                Acheter un appartement mixte · 110 €
            </button>
        </div>
    `;


    game.apartments.forEach(apartment => {

        const card = document.createElement("div");
        card.className = "employeeCard";
        const servedSellers = game.employees.filter(employee =>
            employee.role === "vendeur" &&
            employee.assignment.apartmentId === apartment.id
        );
        card.innerHTML = `
            <div class="employeeTitle"><strong>${apartment.name}</strong></div>
            <p>Rôle : ${apartment.role} · capacité ${getInventoryTotal(apartment)}/${apartment.capacity}</p>
            <p>Stock : ${Object.entries(apartment.inventory).map(([p, q]) => `${p} : ${q}`).join(" · ")}</p>
            <p>Argent stocké : ${Math.floor(apartment.money)} €</p>
            <p>Vendeurs desservis : ${servedSellers.length || "aucun"}</p>
            <button type="button" data-active-apartment="${apartment.id}">
                ${apartment.id === game.activeApartmentId ? "Appartement actif" : "Définir comme actif"}
            </button>
            <button type="button" data-withdraw-apartment="${apartment.id}">
                Récupérer la caisse
            </button>
        `;
        logisticsContent.appendChild(card);

    });


    const missions = document.createElement("div");
    missions.className = "employeeCard";
    missions.innerHTML = `<strong>Missions</strong><p>${game.logisticsMissions.length ? game.logisticsMissions.map(mission => `${mission.type} : ${mission.product || "caisse"} × ${mission.quantity} (${mission.stage})`).join("<br>") : "Aucune mission active."}</p><p>Demandes en attente : ${game.logisticsRequests.filter(request => request.status !== "COMPLETED" && request.status !== "ASSIGNED").map(request => `${request.product || "Caisse"} : ${request.blockedReason || request.status}`).join("<br>") || "aucune"}</p>`;
    logisticsContent.appendChild(missions);

}


function openApartmentDetails(apartmentId) {

    game.activeApartmentId = apartmentId;
    renderLogisticsPanel();
    logisticsPanel.classList.add("visible");

}


document.getElementById("logisticsButton").addEventListener("click", () => {
    renderLogisticsPanel();
    logisticsPanel.classList.add("visible");
});

document.getElementById("closeLogistics").addEventListener("click", () => {
    logisticsPanel.classList.remove("visible");
});

logisticsContent.addEventListener("click", event => {

    const type = event.target.dataset.apartmentType;
    const apartmentId = event.target.dataset.activeApartment;
    const withdrawalId = event.target.dataset.withdrawApartment;

    if (type) {
        buyApartment(type, document.getElementById("apartmentSiteChoice")?.value);
    }

    if (apartmentId) {
        game.activeApartmentId = apartmentId;
        renderLogisticsPanel();
    }

    if (withdrawalId) {
        const apartment = getApartmentById(withdrawalId);

        if (apartment && transferMoney(apartment, game, apartment.money)) {
            updateUI();
            renderLogisticsPanel();
            showMessage("Caisse récupérée.");
        }
    }

});
