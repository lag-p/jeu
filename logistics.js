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


function getSellerWaitingCustomers(sellerId) {

    return typeof customers === "undefined"
        ? 0
        : customers.filter(customer =>
            customer.state === "waiting" &&
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


function createLogisticsRequest(seller) {

    const apartment = getSellerApartment(seller);

    if (!apartment || seller.currentMissionId) {
        return false;
    }

    const existing = game.logisticsRequests.find(request =>
        request.sellerId === seller.id &&
        request.status !== "completed"
    );

    if (existing) {
        return false;
    }

    const product = seller.allowedProducts.find(
        item => getInventoryQuantity(apartment, item) > 0
    );
    const stockSpace = getInventoryFreeSpace(
        getSellerStorageContainer(seller)
    );
    const needsSupply = Boolean(product) && stockSpace > 0 &&
        getInventoryTotal(getSellerStorageContainer(seller)) < seller.capacity / 2;
    const needsCashCollection = seller.money > 0;

    if (!needsSupply && !needsCashCollection) {
        return false;
    }

    const request = {
        id: "request-" + Date.now() + "-" + Math.random(),
        sellerId: seller.id,
        apartmentId: apartment.id,
        type: needsSupply && needsCashCollection
            ? "SUPPLY_AND_COLLECTION"
            : needsSupply
                ? "SUPPLY"
                : "CASH_COLLECTION",
        product: product || null,
        priority: getLogisticsPriority(seller, apartment),
        status: "pending",
        createdAt: performance.now()
    };

    game.logisticsRequests.push(request);

    return true;

}


function assignLogisticsRequests() {

    game.logisticsRequests
        .filter(request => request.status === "pending")
        .sort((first, second) => second.priority - first.priority)
        .forEach(request => {

            const seller = getEmployeeById(request.sellerId);
            const apartment = getApartmentById(request.apartmentId);
            const courier = game.employees.find(employee =>
                employee.role === "ravitailleur" &&
                employee.active &&
                employee.assignment.apartmentId === request.apartmentId &&
                employee.currentMissionId === null
            );

            if (!seller || !apartment || !courier || seller.currentMissionId) {
                return;
            }

            const quantity = request.type === "CASH_COLLECTION"
                ? 0
                : Math.min(
                    getInventoryFreeSpace(getSellerStorageContainer(seller)),
                    courier.capacity - getInventoryTotal(courier),
                    getInventoryQuantity(apartment, request.product)
                );

            if (request.type !== "CASH_COLLECTION" && quantity <= 0) {
                request.status = "completed";
                return;
            }

            const mission = {
                id: "mission-" + Date.now() + "-" + Math.random(),
                requestId: request.id,
                type: request.type,
                courierId: courier.id,
                sellerId: seller.id,
                apartmentId: apartment.id,
                product: request.product,
                quantity,
                stage: "CREATED",
                stageElapsed: 0,
                createdAt: performance.now()
            };

            request.status = "assigned";
            request.missionId = mission.id;
            courier.currentMissionId = mission.id;
            seller.currentMissionId = mission.id;
            game.logisticsMissions.push(mission);
            showMapIndicator(courier, "Mission");
        });

    game.logisticsRequests = game.logisticsRequests.filter(
        request => request.status !== "completed"
    );

}


function finishMission(mission, courier, seller) {

    const request = game.logisticsRequests.find(
        item => item.id === mission.requestId
    );

    if (request) {
        request.status = "completed";
    }

    courier.currentMissionId = null;
    courier.state = "disponible";
    seller.currentMissionId = null;
    seller.state = "en poste";
    game.logisticsMissions = game.logisticsMissions.filter(
        item => item !== mission
    );
    game.logisticsRequests = game.logisticsRequests.filter(
        item => item.status !== "completed"
    );

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
                    finishMission(mission, courier, seller);
                }
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
                transferInventory(
                    courier,
                    getSellerStorageContainer(seller),
                    mission.product,
                    mission.quantity
                );
            }
            return;
        }

        if (mission.stage === "COLLECTING_MONEY") {
            if (progressMissionStage(mission, delta, 0.5, "RETURNING")) {
                transferMoney(seller, apartment, seller.money);
                courier.state = "en déplacement";
            }
            return;
        }

        if (mission.stage === "RETURNING" &&
            moveMapEntity(courier, apartment, delta, speed)) {
            mission.stage = "COMPLETED";
            finishMission(mission, courier, seller);
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
    missions.innerHTML = `<strong>Missions</strong><p>${game.logisticsMissions.length ? game.logisticsMissions.map(mission => `${mission.type} : ${mission.product || "caisse"} × ${mission.quantity} (${mission.stage})`).join("<br>") : "Aucune mission active."}</p><p>Demandes en attente : ${game.logisticsRequests.filter(request => request.status === "pending").length}</p>`;
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
