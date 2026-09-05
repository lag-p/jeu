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
        discretion: 50, reliability: 75, inventory: createEmptyInventory(), money: 0,
        capacity: type === "vendeur" ? 8 : type === "ravitailleur" ? 12 : 0,
        assignment: { apartmentId: null, managerId: null, salesPoint: { x, y } },
        cooldown: 0, currentMissionId: null, element: null,
        destination: null, route: [], moving: false
    };
    if (type === "vendeur") Object.assign(employee, {
        allowedProducts: ["Produit A"], salesMode: "sacoche",
        localReserve: createEmptyInventory(), alertProtocol: "autonomie"
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
            <label class="stockPurchaseLabel">Protocole d'alerte<select class="employeeConfig" data-field="alertProtocol" data-id="${employee.id}"><option value="autonomie">Autonomie</option><option value="mise-en-securite">Mise en sécurité</option><option value="repli">Rejoindre un point de repli</option><option value="abandon">Abandon de poste</option></select></label>`);
        details.querySelector('[data-field="alertProtocol"]').value = employee.alertProtocol;
        const point = getSalesPointForSeller(employee.id);
        details.insertAdjacentHTML("beforeend", `<p>Point de vente : ${point ? `${getMapZoneAt(point).id} · ${point.currentVisitors}/${point.capacity} clients` : "non défini"}</p><p>Performance : ${point ? `${point.stats.customersServed} servis · ${point.stats.customersLost} perdus · ${Math.round(point.stats.revenue)} € · attente moy. ${point.stats.customersServed ? Math.round(point.stats.totalWaitTime / point.stats.customersServed) : 0} s` : "-"}</p><button type="button" data-move-seller="${employee.id}">Déplacer le point de vente</button>`);
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
        details.insertAdjacentHTML("beforeend", `<p>Capacité : ${employee.capacity}. Mission : ${mission ? `${mission.product} × ${mission.quantity} (${mission.stage})` : "aucune"}.</p>`);
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
    showMessage(`${employee.name} placé.`); updateEmployeesPanel(); updateUI(); return true;
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
    customer.assignedSellerId = seller.id;
    setCustomerDestination(customer, seller);
    customer.oriented = true;
    showMapIndicator(watcher, "→ client");
    return true;
}

function findNearestCustomer(employee) {
    if (!Array.isArray(customers) || !employee.active || employee.state !== "en poste") return null;
    let nearest = null; let nearestDistance = Infinity;
    customers.forEach(customer => {
        if (customer.entityType !== ENTITY_TYPES.CUSTOMER ||
            customer.state !== "waiting" || customer.assignedSellerId !== employee.id) return;
        const distance = Math.hypot(customer.x - employee.x, customer.y - employee.y);
        if (distance < nearestDistance) { nearest = customer; nearestDistance = distance; }
    });
    return nearestDistance <= 25 ? nearest : null;
}

function serveCustomerAutomatically(employee, customer) {
    if (!customer || customer.entityType !== ENTITY_TYPES.CUSTOMER ||
        employee.entityType !== ENTITY_TYPES.EMPLOYEE ||
        customer.assignedSellerId !== employee.id) return;
    const sale = resolveSale(customer, { seller: employee }); if (sale.success) updateUI();
}

function manageNetwork() {
    game.employees.filter(employee => employee.role === "gerant" && employee.active && employee.state === "en poste").forEach(manager => {
        game.employees.filter(employee => employee.assignment.managerId === manager.id).slice(0, manager.supervisionCapacity).filter(employee => employee.role === "vendeur").forEach(seller => {
            createLogisticsRequest(seller);
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
        if (target) { serveCustomerAutomatically(employee, target); employee.cooldown = employee.salesMode === "cachette" ? employee.speed + 3 : employee.speed; }
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
});
employeesList.addEventListener("change", event => {
    const employee = getEmployeeById(event.target.dataset.id); if (!employee) return;
    if (event.target.classList.contains("employeeConfig")) {
        const field = event.target.dataset.field;
        if (field === "apartmentId" || field === "managerId") employee.assignment[field] = event.target.value || null;
        else employee[field] = event.target.value;
    }
    if (event.target.classList.contains("employeeProductToggle")) {
        const product = event.target.value; employee.allowedProducts = employee.allowedProducts.filter(item => item !== product);
        if (event.target.checked) employee.allowedProducts.push(product);
    }
    updateEmployeesPanel();
});
document.getElementById("employeesButton").addEventListener("click", () => { employeesPanel.classList.add("visible"); updateEmployeesPanel(); });
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
