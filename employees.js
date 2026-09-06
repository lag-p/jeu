// ===============================
// EMPLOYES : ENTITES ET AFFECTATIONS
// ===============================

const employeeTypes = {
    vendeur: { name: "Vendeur", icon: "👤", cost: 100, description: "Vend les produits qui lui sont affectés.", speed: 4 },
    guetteur: { name: "Guetteur", icon: "👁️", cost: 150, description: "Oriente les clients dans sa zone.", speed: 0 },
    gerant: { name: "Gérant", icon: "📋", cost: 180, description: "Supervise les vendeurs et demande les ravitaillements.", speed: 0 },
    ravitailleur: { name: "Ravitailleur", icon: "🛵", cost: 140, description: "Transporte le stock entre appartements et vendeurs.", speed: 0 }
};

let placementMode = null;
let selectedEmployeeId = null;
let salesPointMoveSellerId = null;
const employeesPanel = document.getElementById("employeesPanel");
const closeEmployees = document.getElementById("closeEmployees");
const employeesList = document.getElementById("employeesList");

function createEmployee(type, x, y) {
    const data = employeeTypes[type];
    if (!data) return null;
    const employee = {
        entityType: ENTITY_TYPES.EMPLOYEE,
        id: "employee-" + Date.now() + "-" + Math.random(), type, role: type,
        name: data.name, icon: data.icon, x, y, state: "disponible", active: true,
        salary: Math.floor(data.cost / 10), experience: 0, efficiency: 1,
        discretion: 50, reliability: 75, inventory: createEmptyInventory(), money: 0, cashCarried: 0,
        capacity: type === "vendeur" ? 8 : type === "ravitailleur" ? 12 : 0,
        assignment: { apartmentId: null, managerId: null, salesPoint: { x, y } },
        cooldown: 0, currentMissionId: null, element: null,
        destination: null, route: [], moving: false
    };
    if (type === "vendeur") Object.assign(employee, {
        allowedProducts: ["Produit A"], salesMode: "sacoche",
        localReserve: createEmptyInventory(), alertProtocol: "autonomie", restockThreshold: 6,
        logisticsAutomation: true, queue: []
    });
    if (type === "guetteur") Object.assign(employee, {
        observationRadius: 22, watchedZone: { x, y, radius: 22 }, orientationSkill: 1
    });
    if (type === "gerant") employee.supervisionCapacity = 3;
    return employee;
}

function normalizeExistingEmployees() {
    game.employees.forEach(employee => {
        const normalized = createEmployee(employee.role || employee.type || "vendeur", employee.x, employee.y);
        Object.keys(normalized).forEach(key => {
            if (employee[key] === undefined) employee[key] = normalized[key];
        });
        employee.role = employee.role || employee.type;
        employee.type = employee.role;
    });
}

function updateEmployeeVisual(employee) {
    updateMapEntityVisual(employee);
}

function createEmployeeVisual(employee) {
    const element = document.createElement("div");
    element.className = "employee";
    element.textContent = employee.icon;
    element.dataset.employeeId = employee.id;
    employee.element = element;
    updateEmployeeVisual(employee);
    element.addEventListener("click", event => {
        event.stopPropagation();
        selectedEmployeeId = employee.id;
        showWatcherRadius(employee);
        employeesPanel.classList.add("visible");
        updateEmployeesPanel();
    });
    map.appendChild(element);
}

function getManagerOptions(selectedId) {
    return game.employees.filter(employee => employee.role === "gerant" && employee.id !== selectedId);
}

function employeeInventoryText(employee) {
    return Object.entries(employee.inventory).map(([product, quantity]) => `${product} : ${quantity}`).join(" · ");
}

function renderEmployeeDetails(employee) {
    const apartmentOptions = game.apartments.map(apartment => `<option value="${apartment.id}" ${employee.assignment.apartmentId === apartment.id ? "selected" : ""}>${apartment.name}</option>`).join("");
    const managerOptions = getManagerOptions(employee.id).map(manager => `<option value="${manager.id}" ${employee.assignment.managerId === manager.id ? "selected" : ""}>${manager.name}</option>`).join("");
    const details = document.createElement("div");
    details.className = "employeeCard employeeDetails";
    details.innerHTML = `
        <div class="employeeTitle"><span>${employee.icon}</span><strong>${employee.name}</strong></div>
        <p>Rôle : ${employee.role} · État : ${employee.state}</p>
        <p>Alerte : ${employee.alertLevel ? "niveau " + employee.alertLevel : "aucune"}</p>
        <p>Exp. ${employee.experience} · efficacité ${employee.efficiency} · discrétion ${employee.discretion} · fiabilité ${employee.reliability}</p>
        <p>Inventaire : ${employeeInventoryText(employee)}</p><p>Argent porté : ${Math.floor(employee.money)} €</p>
        <label class="stockPurchaseLabel">Appartement associé<select class="employeeConfig" data-field="apartmentId" data-id="${employee.id}"><option value="">Aucun</option>${apartmentOptions}</select></label>
        <label class="stockPurchaseLabel">Gérant responsable<select class="employeeConfig" data-field="managerId" data-id="${employee.id}"><option value="">Aucun</option>${managerOptions}</select></label>`;
    if (employee.role === "vendeur") {
        const products = Object.keys(employee.inventory).map(product => `<label class="employeeProduct"><input class="employeeProductToggle" data-id="${employee.id}" value="${product}" type="checkbox" ${employee.allowedProducts.includes(product) ? "checked" : ""}> ${product}</label>`).join("");
        details.insertAdjacentHTML("beforeend", `
            <p>Configuration vendeur</p><div>${products}</div>
            <p>Réserve locale : ${Object.entries(employee.localReserve).map(([product, quantity]) => `${product} : ${quantity}`).join(" · ")}</p>
            <label class="stockPurchaseLabel">Mode de vente<select class="employeeConfig" data-field="salesMode" data-id="${employee.id}"><option value="sacoche" ${employee.salesMode === "sacoche" ? "selected" : ""}>Sacoche</option><option value="cachette" ${employee.salesMode === "cachette" ? "selected" : ""}>Cachette</option></select></label>
            <label class="stockPurchaseLabel">Seuil de ravitaillement<input class="employeeConfig" data-field="restockThreshold" data-id="${employee.id}" type="number" min="1" max="${employee.capacity}" value="${employee.restockThreshold}"></label>
            <label class="stockPurchaseLabel">Ravitaillement automatique<select class="employeeConfig" data-field="logisticsAutomation" data-id="${employee.id}"><option value="true" ${employee.logisticsAutomation !== false ? "selected" : ""}>ACTIF</option><option value="false" ${employee.logisticsAutomation === false ? "selected" : ""}>DÉSACTIVÉ</option></select></label>
            <label class="stockPurchaseLabel">Protocole d'alerte<select class="employeeConfig" data-field="alertProtocol" data-id="${employee.id}"><option value="autonomie">Autonomie</option><option value="mise-en-securite">Mise en sécurité</option><option value="repli">Rejoindre un point de repli</option><option value="abandon">Abandon de poste</option></select></label>`);
        details.querySelector('[data-field="alertProtocol"]').value = employee.alertProtocol;
        const point = getSalesPointForSeller(employee.id);
        const manager = employee.assignment.managerId && getEmployeeById(employee.assignment.managerId);
        details.insertAdjacentHTML("beforeend", `<p>Point de vente : ${point ? `${getMapZoneAt(point).id} · ${point.currentVisitors}/${point.capacity} clients` : "non défini"}</p><p>Ravitaillement automatique : ${manager && manager.active ? `ACTIF · Gérant : ${manager.name}` : "NON · Aucun gérant affecté"}</p><p>Performance : ${point ? `${point.stats.customersServed} servis · ${point.stats.customersLost} perdus · ${Math.round(point.stats.revenue)} € · attente moy. ${point.stats.customersServed ? Math.round(point.stats.totalWaitTime / point.stats.customersServed) : 0} s` : "-"}</p><button type="button" data-move-seller="${employee.id}">Déplacer le point de vente</button>`);
    }
    if (employee.role === "guetteur") details.insertAdjacentHTML("beforeend", `<p>Zone surveillée : rayon ${employee.observationRadius} · orientation ${employee.orientationSkill}</p>`);
    if (employee.role === "gerant") {
        const requests = game.logisticsRequests.filter(request => {
            const supervised = getEmployeeById(request.sellerId);
            return supervised && supervised.assignment.managerId === employee.id;
        });
        details.insertAdjacentHTML("beforeend", `<p>Capacité de supervision : ${employee.supervisionCapacity} employés.</p><p>Demandes logistiques : ${requests.length ? requests.map(request => `${request.type} (${Math.round(request.priority)})`).join(" · ") : "aucune"}</p>`);
    }
    if (employee.role === "ravitailleur") {
        const mission = game.logisticsMissions.find(item => item.courierId === employee.id);
        const apartments = game.apartments.filter(apartment => apartment.active).map(apartment => `<option value="${apartment.id}">${apartment.name}</option>`).join("");
        const sellers = game.employees.filter(item => item.role === "vendeur" && item.active && item.state === "en poste").map(seller => `<option value="${seller.id}">${seller.name} (${seller.allowedProducts.join(", ")})</option>`).join("");
        const productOptions = Object.keys(PRODUCT_CONFIG).map(product => `<option value="${product}">${product}</option>`).join("");
        details.insertAdjacentHTML("beforeend", `<p>Capacité : ${employee.capacity}. Mission : ${mission ? `${mission.product} × ${mission.quantity} (${mission.stage})` : "aucune"}.</p><p>Ravitaillement manuel : toujours disponible. Automatique : ${employee.assignment.managerId ? "ACTIF" : "NON · aucun gérant affecté"}.</p><div class="manualMission"><strong>NOUVELLE MISSION</strong><label>Appartement source<select data-manual-source="${employee.id}">${apartments}</select></label><label>Vendeur destination<select data-manual-seller="${employee.id}">${sellers}</select></label><label>Produit<select data-manual-product="${employee.id}">${productOptions}</select></label><label>Quantité<input data-manual-quantity="${employee.id}" type="number" min="1" max="${employee.capacity}" value="1"></label><button type="button" data-create-manual-mission="${employee.id}" ${mission ? "disabled" : ""}>NOUVELLE MISSION</button></div>`);
    }
    return details;
}

function updateEmployeesPanel() {
    employeesList.replaceChildren();
    Object.entries(employeeTypes).forEach(([type, data]) => {
        const card = document.createElement("div"); card.className = "employeeCard";
        card.innerHTML = `<div class="employeeTitle"><span>${data.icon}</span><strong>${data.name}</strong></div><p>${data.description}</p><button type="button" data-hire="${type}">Recruter · ${data.cost} €</button>`;
        employeesList.appendChild(card);
    });
    const employee = getEmployeeById(selectedEmployeeId);
    if (employee) employeesList.appendChild(renderEmployeeDetails(employee));
    const roster = document.createElement("div"); roster.className = "employeeCard";
    roster.innerHTML = `<strong>Équipe (${game.employees.length})</strong>`;
    game.employees.forEach(item => {
        const button = document.createElement("button"); button.type = "button";
        button.dataset.selectEmployee = item.id; button.textContent = `${item.icon} ${item.name} · ${item.state}`;
        roster.appendChild(button);
    });
    employeesList.appendChild(roster);
    renderTeamsPanel();
}

function renderTeamsPanel() {
    const panel = document.createElement("div"); panel.className = "employeeCard";
    const options = role => game.employees.filter(employee => employee.role === role).map(employee => `<option value="${employee.id}">${employee.name}</option>`).join("");
    panel.innerHTML = `<strong>ÉQUIPES</strong><p>Un gérant pilote automatiquement vendeurs, ravitailleurs et dépôts de son équipe.</p><label class="stockPurchaseLabel">Nom<input id="teamName" value="Équipe ${game.teams.length + 1}"></label><label class="stockPurchaseLabel">Gérant<select id="teamManager"><option value="">Choisir</option>${options("gerant")}</select></label><label class="stockPurchaseLabel">Vendeurs<select id="teamSellers" multiple>${options("vendeur")}</select></label><label class="stockPurchaseLabel">Ravitailleurs<select id="teamCouriers" multiple>${options("ravitailleur")}</select></label><label class="stockPurchaseLabel">Guetteurs<select id="teamWatchers" multiple>${options("guetteur")}</select></label><label class="stockPurchaseLabel">Dépôts accessibles<select id="teamApartments" multiple>${game.apartments.map(apartment => `<option value="${apartment.id}">${apartment.name}</option>`).join("")}</select></label><button type="button" data-create-team>CRÉER UNE ÉQUIPE</button>`;
    game.teams.forEach(team => {
        const manager = getEmployeeById(team.managerId);
        const stock = (team.apartmentIds || []).map(getApartmentById).filter(Boolean).reduce((total, apartment) => total + getInventoryTotal(apartment), 0);
        const pending = game.logisticsRequests.filter(request => request.managerId === team.managerId && request.status !== "COMPLETED" && request.status !== "ASSIGNED");
        panel.insertAdjacentHTML("beforeend", `<hr><strong>${team.name}</strong><p>Gérant : ${manager?.name || "aucun"} · Vendeurs ${team.sellerIds.length} · Ravitailleurs ${team.courierIds.length} · Guetteurs ${team.watcherIds.length}</p><p>Stock accessible : ${stock} · Demandes : ${pending.length} · Missions : ${game.logisticsMissions.filter(mission => team.courierIds.includes(mission.courierId)).length}</p><p>${pending.map(request => `⚠ ${getEmployeeById(request.sellerId)?.name || "Vendeur"} : ${request.blockedReason || "en attente"}`).join("<br>")}</p>`);
    });
    employeesList.appendChild(panel);
}

function selectedValues(selector) { return Array.from(employeesList.querySelector(selector)?.selectedOptions || []).map(option => option.value); }
function createTeamFromPanel() {
    const managerId = employeesList.querySelector("#teamManager")?.value;
    if (!managerId) { showMessage("Choisis un gérant."); return; }
    const team = { id: `team-${Date.now()}-${Math.random()}`, name: employeesList.querySelector("#teamName")?.value.trim() || "Équipe", managerId, sellerIds: selectedValues("#teamSellers"), courierIds: selectedValues("#teamCouriers"), watcherIds: selectedValues("#teamWatchers"), apartmentIds: selectedValues("#teamApartments") };
    game.teams = game.teams.filter(item => item.managerId !== managerId);
    game.teams.push(team);
    [...team.sellerIds, ...team.courierIds, ...team.watcherIds].forEach(id => { const employee = getEmployeeById(id); if (employee) employee.assignment.managerId = managerId; });
    showMessage(`${team.name} configurée : le gérant prend la logistique en charge.`); updateEmployeesPanel();
}

function buyEmployee(type) {
    const data = employeeTypes[type];
    if (!data || game.money < data.cost) { showMessage("Pas assez d'argent."); return; }
    recordExpense(data.cost); game.money -= data.cost; placementMode = type;
    beginMapPlacement(
        `Place ton ${data.name.toLowerCase()}`,
        (x, y) => placeEmployee(x, y),
        () => {
            placementMode = null;
            game.money += data.cost;
            reverseExpense(data.cost);
            updateUI();
            showMessage("Recrutement annulé.");
        }
    );
    employeesPanel.classList.remove("visible"); showMessage(`Place ton ${data.name.toLowerCase()} sur la carte.`); updateUI();
}

function placeEmployee(x, y) {
    if (!placementMode) return false;
    const employee = createEmployee(placementMode, x, y); employee.state = "en poste";
    game.employees.push(employee);
    if (employee.role === "vendeur") createSalesPoint(employee, x, y);
    createEmployeeVisual(employee); placementMode = null; selectedEmployeeId = employee.id;
    const assignHint = game.teams.length && ["vendeur", "ravitailleur", "guetteur", "gerant"].includes(employee.role)
        ? " Affecte-le à une équipe dans Gestion."
        : "";
    showMessage(`${employee.name} placé.${assignHint}`); updateEmployeesPanel(); updateUI(); return true;
}

function findCompatibleSeller(product, options = {}) {
    const sellers = game.employees.filter(employee => employee.role === "vendeur" && employee.active && employee.state === "en poste" && employee.allowedProducts.includes(product));
    const available = sellers.filter(seller =>
        !options.requireStock || getSellerProductStock(seller, product) > 0
    );
    return available.sort((first, second) => {
        const firstPoint = getSalesPointForSeller(first.id);
        const secondPoint = getSalesPointForSeller(second.id);
        return (secondPoint ? secondPoint.traffic * secondPoint.accessibility : 0) -
            (firstPoint ? firstPoint.traffic * firstPoint.accessibility : 0);
    })[0] || sellers[0] || null;
}

function orientCustomerWithWatchers(customer) {
    const watcher = game.employees.find(employee => employee.role === "guetteur" && employee.active && employee.state === "en poste" && Math.hypot(customer.x - employee.x, customer.y - employee.y) <= employee.observationRadius);
    const seller = findCompatibleSeller(customer.product);
    if (!watcher || !seller) return false;
    if (typeof joinSellerQueue !== "function" || !joinSellerQueue(customer, seller)) return false;
    customer.oriented = true;
    showMapIndicator(watcher, "→ client");
    return true;
}

function findNearestCustomer(employee) {
    if (!Array.isArray(customers) || !employee.active || employee.state !== "en poste") return null;
    const customer = getQueue(employee.id)[0];
    if (!customer || customer.entityType !== ENTITY_TYPES.CUSTOMER || customer.state !== "WAITING" || customer.assignedSellerId !== employee.id || !employee.allowedProducts.includes(customer.product) || getSellerProductStock(employee, customer.product) < customer.quantity) return null;
    return Math.hypot(customer.x - employee.x, customer.y - employee.y) <= 25 ? customer : null;
}

function serveCustomerAutomatically(employee, customer) {
    if (!customer || customer.entityType !== ENTITY_TYPES.CUSTOMER ||
        employee.entityType !== ENTITY_TYPES.EMPLOYEE ||
        customer.assignedSellerId !== employee.id) return;
    const sale = resolveSale(customer, { seller: employee }); if (sale.success) updateUI();
}

function manageNetwork() {
    game.employees.filter(employee => employee.role === "gerant" && employee.active && employee.state === "en poste").forEach(manager => {
        const scope = getManagerScope(manager);
        scope.sellers.slice(0, manager.supervisionCapacity).forEach(seller => {
            // Chaque produit est autonome : une rupture A ne coupe jamais B/C.
            seller.allowedProducts.forEach(product => createLogisticsRequest(seller, manager, product));
            createLogisticsRequest(seller, manager, null, { cashOnly: true });
        });
    });
}

let employeeSimulationElapsed = 0;

function updateEmployeesRealtime(delta) {
    employeeSimulationElapsed += delta;
    if (employeeSimulationElapsed < 1) return;
    employeeSimulationElapsed = 0;
    if (!game.dayActive) return;
    game.employees.filter(employee => employee.role === "vendeur").forEach(employee => {
        if (employee.cooldown > 0) { employee.cooldown--; return; }
        const target = findNearestCustomer(employee);
        if (target) serveCustomerAutomatically(employee, target);
    });
    manageNetwork();
}

employeesList.addEventListener("click", event => {
    if (event.target.dataset.hire) buyEmployee(event.target.dataset.hire);
    if (event.target.dataset.selectEmployee) {
        selectedEmployeeId = event.target.dataset.selectEmployee;
        showWatcherRadius(getEmployeeById(selectedEmployeeId));
        updateEmployeesPanel();
    }
    if (event.target.dataset.moveSeller) {
        salesPointMoveSellerId = event.target.dataset.moveSeller;
        employeesPanel.classList.remove("visible");
        showMessage("Choisis le nouveau point de vente sur la carte.");
    }
    if (event.target.dataset.createManualMission) {
        const courierId = event.target.dataset.createManualMission;
        const pick = name => employeesList.querySelector(`[data-manual-${name}="${courierId}"]`);
        const result = createManualLogisticsMission(courierId, pick("source")?.value, pick("seller")?.value, pick("product")?.value, Number(pick("quantity")?.value));
        showMessage(result.success ? "Mission créée." : result.message);
        updateEmployeesPanel();
    }
    if (event.target.dataset.createTeam !== undefined) createTeamFromPanel();
});
employeesList.addEventListener("change", event => {
    const employee = getEmployeeById(event.target.dataset.id); if (!employee) return;
    if (event.target.classList.contains("employeeConfig")) {
        const field = event.target.dataset.field;
        if (field === "apartmentId" || field === "managerId") employee.assignment[field] = event.target.value || null;
        else if (field === "restockThreshold") employee[field] = Math.max(1, Math.min(employee.capacity, Number(event.target.value) || 1));
        else if (field === "logisticsAutomation") employee[field] = event.target.value === "true";
        else employee[field] = event.target.value;
    }
    if (event.target.classList.contains("employeeProductToggle")) {
        const product = event.target.value; employee.allowedProducts = employee.allowedProducts.filter(item => item !== product);
        if (event.target.checked) employee.allowedProducts.push(product);
    }
    updateEmployeesPanel();
});
document.getElementById("employeesButton").addEventListener("click", () => { employeesPanel.classList.add("visible"); updateEmployeesPanel(); });
document.getElementById("managementButton").addEventListener("click", () => { employeesPanel.classList.add("visible"); updateEmployeesPanel(); });
closeEmployees.addEventListener("click", () => employeesPanel.classList.remove("visible"));

function handleMapStrategicPlacement(event) {
    if (!salesPointMoveSellerId) return false;
    const seller = getEmployeeById(salesPointMoveSellerId);
    salesPointMoveSellerId = null;
    if (!seller || seller.role !== "vendeur" || seller.currentMissionId) {
        showMessage("Vendeur indisponible pour ce déplacement.");
        return true;
    }
    beginMapPlacement("Nouveau point de vente", (x, y) => {
        requestSellerMove(seller, { x, y });
        showMessage("Le vendeur rejoint son nouveau point de vente.");
    });
    return true;
}
normalizeExistingEmployees();
