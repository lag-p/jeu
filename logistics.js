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
    game.employees.filter(employee => employee.role === "vendeur").forEach(seller => add(getSellerStorageContainer(seller)));
    game.employees.filter(employee => employee.role === "ravitailleur").forEach(add);
    const storage = getInventoryTotal(player) + game.apartments.reduce((sum, apartment) => sum + getInventoryTotal(apartment), 0);
    const sellers = game.employees.filter(employee => employee.role === "vendeur").reduce((sum, seller) => sum + getInventoryTotal(getSellerStorageContainer(seller)), 0);
    const couriers = game.employees.filter(employee => employee.role === "ravitailleur").reduce((sum, courier) => sum + getInventoryTotal(courier), 0);
    return { total: storage + sellers + couriers, byProduct, storage, sellers, couriers, player: getInventoryTotal(player), apartments: storage - getInventoryTotal(player) };
}

function getNetworkStockDistribution() {
    const products = Object.keys(createEmptyInventory());
    const entry = (name, container) => ({ name, inventory: Object.fromEntries(products.map(product => [product, getInventoryQuantity(container, product)])) });
    return [entry("Joueur", { inventory: game.playerInventory || {} }), ...game.apartments.map(apartment => entry(apartment.name, apartment)), ...game.employees.filter(employee => employee.role === "vendeur").map(seller => entry(seller.salesMode === "cachette" ? `Cachette ${seller.name}` : seller.name, getSellerStorageContainer(seller))), ...game.employees.filter(employee => employee.role === "ravitailleur").map(courier => entry(`Transport ${courier.name}`, courier))];
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


function buyApartment(type) {

    const definition = apartmentDefinitions[type];


    if (!definition || game.money < definition.cost) {
        showMessage("Argent insuffisant.");
        return false;
    }


    recordExpense(definition.cost);
    game.money -= definition.cost;


    const site = mapData.apartmentSites.find(candidate =>
        !game.apartments.some(apartment => apartment.siteId === candidate.id)
    );

    const apartment = createApartment(
        type,
        site ? site.x : 50,
        site ? site.y : 50
    );

    apartment.siteId = site ? site.id : null;
    if (site) {
        apartment.name = site.name;
        apartment.capacity += site.capacityBonus;
    }


    renderLogisticsPanel();
    updateUI();
    showMessage(apartment.name + " acquis.");


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
    return apartments.filter(apartment => getInventoryQuantity(apartment, product) >= quantity).sort((a, b) => getInventoryQuantity(b, product) - getInventoryQuantity(a, product) || mapDistance(a, seller) - mapDistance(b, seller))[0] || null;
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
    return Math.min(seller.capacity, Math.max(1, base + (rate >= 0.25 ? 2 : 0)));
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

    return urgency + waiters * 12 + importance * 8 - distance * 0.35;

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
    const neededProduct = product && seller.allowedProducts.includes(product) && getSellerProductStock(seller, product) <= threshold ? product : null;
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
    if (getInventoryQuantity(apartment, product) < quantity) return { success: false, message: "Stock appartement insuffisant." };
    if (getInventoryFreeSpace(getSellerStorageContainer(seller)) < quantity) return { success: false, message: "Réserve vendeur insuffisante." };
    if (seller.currentMissionId || game.logisticsRequests.some(request => request.sellerId === seller.id && request.status !== "COMPLETED")) return { success: false, message: "Une demande existe déjà pour ce vendeur." };

    const request = { id: "request-" + Date.now() + "-" + Math.random(), sellerId, apartmentId, type: seller.money > 0 ? "SUPPLY_AND_COLLECTION" : "SUPPLY", product, quantity, requested: quantity, priority: 1000, status: "READY", manual: true, courierId, createdAt: performance.now() };
    game.logisticsRequests.push(request);
    assignLogisticsRequests();
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
        const apartments = scope ? scope.apartments : game.apartments.filter(apartment => apartment.active);
        const apartment = request.type === "CASH_COLLECTION"
            ? (getApartmentById(request.apartmentId) || apartments[0] || getSellerApartment(seller))
            : seller && (getApartmentById(request.apartmentId) || chooseApartmentForRequest(seller, request.product, apartments));
        if (apartment) request.apartmentId = apartment.id;
        if (!seller || !apartment) {
            request.status = !apartment ? "WAITING_FOR_STOCK" : "WAITING_FOR_COURIER";
            request.blockedReason = !seller ? "Vendeur indisponible" : `${request.product || "Caisse"} : rupture au dépôt`;
        } else if (request.status === "WAITING_FOR_STOCK") {
            request.status = "READY";
            request.blockedReason = null;
        }
    });

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
            if (candidate.manual && candidate.courierId !== courier.id) return false;
            if (scope && !scope.couriers.some(member => member.id === courier.id)) return false;
            // Un besoin qui dépasse la capacité est confié, si possible, au plus gros
            // véhicule encore libre ; les profils équivalents restent alternés.
            const largerCompatible = available.some(other => other.id !== courier.id && !other.currentMissionId && (!scope || scope.couriers.some(member => member.id === other.id)) && getCourierRequestScore(other, candidate, getApartmentById(candidate.apartmentId)) > getCourierRequestScore(courier, candidate, getApartmentById(candidate.apartmentId)));
            return !largerCompatible;
        });
        if (!request) return;
        const seller = getEmployeeById(request.sellerId);
        const apartment = getApartmentById(request.apartmentId);
        const quantity = request.type === "CASH_COLLECTION" ? 0 : Math.min(request.manual ? request.quantity : request.requested, getInventoryFreeSpace(getSellerStorageContainer(seller)), courier.capacity - getInventoryTotal(courier), getInventoryQuantity(apartment, request.product));
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

    const request = game.logisticsRequests.find(
        item => item.id === mission.requestId
    );

    // Une mission ne peut pas effacer un transport d'argent encore physique.
    if ((courier.cashCarried || 0) > 0) {
        return false;
    }
    if (request) {
        request.status = "COMPLETED";
        const manager = request.managerId && getEmployeeById(request.managerId);
        if (manager) {
            manager.logisticsStats = manager.logisticsStats || { requestsHandled: 0, stockoutsAvoided: 0, totalMissionSeconds: 0 };
            manager.logisticsStats.requestsHandled++;
            manager.logisticsStats.totalMissionSeconds += Math.max(0, performance.now() - mission.createdAt) / 1000;
        }
    }

    courier.currentMissionId = null;
    courier.state = "disponible";
    seller.currentMissionId = null;
    seller.state = "en poste";
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

        const speed = 10 * (courier.efficiency || 1);

        if (mission.stage === "CREATED") {
            courier.state = "en déplacement";
            progressMissionStage(
                mission,
                delta,
                0.5,
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
            if (progressMissionStage(mission, delta, 0.8, "GOING_TO_SELLER")) {
                if (!transferInventory(apartment, courier, mission.product, mission.quantity)) {
                    mission.stage = "COMPLETED";
                    finishMission(mission, courier, seller);
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
            if (progressMissionStage(mission, delta, 0.7, "COLLECTING_MONEY")) {
                const before = getSellerProductStock(seller, mission.product);
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
            if (progressMissionStage(mission, delta, 0.5, "RETURNING")) {
                // L'argent ne rejoint pas le dépôt avant le retour physique.
                transferMoney(seller, courier, seller.money);
                courier.cashCarried = courier.money;
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
            if (progressMissionStage(mission, delta, 0.4, "COMPLETED")) {
                const carried = Math.max(0, courier.cashCarried || courier.money || 0);
                if (carried > 0) transferMoney(courier, apartment, carried);
                if (carried > 0) showMessage(`${courier.name} a déposé ${Math.floor(carried)} €.`);
                courier.cashCarried = 0;
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
        buyApartment(type);
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
