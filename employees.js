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
let recruitmentProfile = "balanced";
const EMPLOYEE_PROFILES = Object.freeze({
    balanced: { name: "Polyvalent", speed: 1, capacity: 1, reliability: 75, salary: 1 },
    swift: { name: "Rapide · petit inventaire", speed: 1.2, capacity: .8, reliability: 65, salary: .85 },
    carrier: { name: "Méthodique · grande capacité", speed: .85, capacity: 1.35, reliability: 85, salary: 1.1 },
    expert: { name: "Expérimenté · fiable", speed: 1.15, capacity: 1, reliability: 95, salary: 1.5 }
});

function applyEmployeeLevel(employee) {
    const profile = EMPLOYEE_PROFILES[employee.recruitmentProfile] || EMPLOYEE_PROFILES.balanced;
    employee.level = Math.min(EMPLOYEE_CONFIG.maxLevel, 1 + Math.floor(employee.experience / EMPLOYEE_CONFIG.xpPerLevel));
    const bonus = employee.level - 1;
    employee.reliability = Math.min(99, profile.reliability + bonus);
    employee.efficiency = profile.speed * (1 + bonus * .04);
    employee.discretion = 50 + bonus * 4;
    employee.stressResistance = 50 + bonus * 5;
    employee.salary = Math.ceil(employeeTypes[employee.role].cost / 10 * profile.salary * (1 + bonus * EMPLOYEE_CONFIG.salaryLevelBonus));
    employee.salesSkill = 50 + bonus * 6;
    employee.serviceSpeed = employee.efficiency;
    employee.observation = 50 + bonus * 8;
    employee.recognition = 40 + bonus * 10;
    employee.clientGuidance = 50 + bonus * 8;
    employee.communication = 50 + bonus * 8;
    employee.movementSpeed = 10 * employee.efficiency;
    employee.management = 50 + bonus * 8;
    employee.logisticsSkill = 50 + bonus * 7;
    employee.decisionSpeed = employee.efficiency;
    employee.maxSupervision = EMPLOYEE_CONFIG.managerBaseCapacity + bonus * EMPLOYEE_CONFIG.managerLevelCapacity + (employee.supervisionUpgrade || 0);
    employee.supervisionCapacity = employee.maxSupervision;
    if (employee.role === "vendeur" || employee.role === "ravitailleur") {
        const base = employee.role === "vendeur" ? EMPLOYEE_CONFIG.sellerCapacity + bonus * 3 : EMPLOYEE_CONFIG.courierCapacity[bonus];
        employee.capacity = Math.round(base * profile.capacity) + (employee.capacityUpgrade || 0);
        employee.maxInventory = employee.capacity;
        employee.carryCapacity = employee.capacity;
    }
}

function awardEmployeeExperience(employee, amount = 1) {
    if (!employee || !Number.isFinite(amount) || amount <= 0) return;
    employee.experience = (employee.experience || 0) + amount;
    applyEmployeeLevel(employee);
}

function payDailySalaries() {
    if (game.salaryPaidDay === game.day) return;
    game.salaryPaidDay = game.day;
    const salary = game.employees.filter(e => e.active).reduce((sum, e) => sum + e.salary, 0);
    game.dailySalaries = salary;
    game.money -= salary;
    recordExpense(salary, "salaries");
}
let selectedEmployeeId = null;
let salesPointMoveSellerId = null;
const employeesPanel = document.getElementById("employeesPanel");
const closeEmployees = document.getElementById("closeEmployees");
const employeesList = document.getElementById("employeesList");

function createEmployee(type, x, y, profile = "balanced") {
    ({ x, y } = nearestWalkable({ x, y }));
    const data = employeeTypes[type];
    if (!data) return null;
    const employee = {
        entityType: ENTITY_TYPES.EMPLOYEE,
        id: "employee-" + Date.now() + "-" + Math.random(), type, role: type,
        name: data.name, icon: data.icon, x, y, state: "disponible", active: true, recruitmentProfile: profile,
        salary: Math.floor(data.cost / 10), experience: 0, efficiency: 1,
        discretion: 50, reliability: 75, inventory: createEmptyInventory(), money: 0,
        capacity: type === "vendeur" ? 8 : type === "ravitailleur" ? 12 : 0,
        assignment: { apartmentId: null, managerId: null, salesPoint: { x, y } },
        cooldown: 0, currentMissionId: null, element: null,
        destination: null, route: [], moving: false
    };
    if (type === "vendeur") Object.assign(employee, {
        allowedProducts: ["Produit A"], salesMode: "sacoche",
        localReserve: createEmptyInventory(), alertProtocol: "autonomie", restockThreshold: 6, targetStock: 8,
        salesRate: createEmptyInventory(), salesRateUpdatedAt: performance.now(),
        logisticsAutomation: true, queue: []
    });
    if (type === "guetteur") Object.assign(employee, {
        observationRadius: 22, watchedZone: { x, y, radius: 22 }, orientationSkill: 1
    });
    applyEmployeeLevel(employee);
    if (type === "vendeur") employee.targetStock = employee.capacity;
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
    const element = MapRenderer.create(employee, "employee", employee.icon, selectEmployee);
    element.dataset.employeeId = employee.id;
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
            <label class="stockPurchaseLabel">Stock cible<input class="employeeConfig" data-field="targetStock" data-id="${employee.id}" type="number" min="1" max="${employee.capacity}" value="${employee.targetStock}"></label>
            <label class="stockPurchaseLabel">Ravitaillement automatique<select class="employeeConfig" data-field="logisticsAutomation" data-id="${employee.id}"><option value="true" ${employee.logisticsAutomation !== false ? "selected" : ""}>ACTIF</option><option value="false" ${employee.logisticsAutomation === false ? "selected" : ""}>DÉSACTIVÉ</option></select></label>
            <label class="stockPurchaseLabel">Protocole d'alerte<select class="employeeConfig" data-field="alertProtocol" data-id="${employee.id}"><option value="autonomie">Autonomie</option><option value="mise-en-securite">Mise en sécurité</option><option value="repli">Rejoindre un point de repli</option><option value="abandon">Abandon de poste</option></select></label>`);
        details.querySelector('[data-field="alertProtocol"]').value = employee.alertProtocol;
        const point = getSalesPointForSeller(employee.id);
        const manager = employee.assignment.managerId && getEmployeeById(employee.assignment.managerId);
        const supply = game.logisticsRequests.find(request => request.sellerId === employee.id && request.status === "ASSIGNED");
        details.insertAdjacentHTML("beforeend", `<p><strong>VENTE</strong> ${employee.allowedProducts.join(" / ")}</p><p><strong>STOCK</strong><br>${employee.allowedProducts.map(product => { const stock = getSellerProductStock(employee, product); const target = getSellerTargetStock(employee, product); return `${product} ${stock} / ${target} ${stock <= employee.restockThreshold ? "⚠" : "✓"}`; }).join("<br>")}</p><p><strong>GÉRANT</strong> ${manager?.name || "Aucun"}<br><strong>RAVITAILLEMENT</strong> ${employee.logisticsAutomation !== false && manager?.active ? "Automatique ✓" : "À configurer ⚠"}</p><p><strong>PROCHAINE LIVRAISON</strong><br>${supply ? `${supply.product} +${supply.requested} · ${getEmployeeById(supply.missionId && game.logisticsMissions.find(mission => mission.id === supply.missionId)?.courierId)?.name || "en préparation"}` : "Aucune"}</p><p><strong>ARGENT</strong> ${Math.floor(employee.money)} €${employee.money >= (game.logisticsSettings?.maxSellerCash || 150) ? " · Collecte prévue" : ""}</p><button type="button" data-move-seller="${employee.id}">DÉPLACER</button>`);
    }
    if (employee.role === "guetteur") details.insertAdjacentHTML("beforeend", `<p>Zone surveillée : rayon ${employee.observationRadius} · orientation ${employee.orientationSkill}</p>`);
    if (employee.role === "gerant") {
        const requests = game.logisticsRequests.filter(request => {
            const supervised = getEmployeeById(request.sellerId);
            return supervised && supervised.assignment.managerId === employee.id;
        });
        const scope = getManagerScope(employee), missions = game.logisticsMissions.filter(mission => scope.couriers.some(courier => courier.id === mission.courierId));
        details.insertAdjacentHTML("beforeend", `<p><strong>ÉQUIPE</strong> ${scope.team?.name || "Affectations directes"}<br>Supervision : ${scope.sellers.length} / ${employee.supervisionCapacity} vendeurs<br>Ravitailleurs : ${scope.couriers.length}</p><p><strong>ÉTAT</strong> ${requests.some(request => request.blockedReason) ? "⚠ Attention requise" : "Gestion normale ✓"}</p><p><strong>DEMANDES</strong><br>${requests.length ? requests.map(request => `${getEmployeeById(request.sellerId)?.name || "Vendeur"} · ${request.product || "Caisse"} → ${request.blockedReason || (request.status === "ASSIGNED" ? "en préparation" : "en attente")}`).join("<br>") : "Aucune ✓"}</p><p><strong>MISSIONS</strong><br>${missions.length ? missions.map(mission => `${getEmployeeById(mission.courierId)?.name} → ${getEmployeeById(mission.sellerId)?.name}`).join("<br>") : "Aucune"}</p>`);
    }
    if (employee.role === "ravitailleur") {
        const mission = game.logisticsMissions.find(item => item.courierId === employee.id);
        const apartments = game.apartments.filter(apartment => apartment.active).map(apartment => `<option value="${apartment.id}">${apartment.name}</option>`).join("");
        const sellers = game.employees.filter(item => item.role === "vendeur" && item.active && item.state === "en poste").map(seller => `<option value="${seller.id}">${seller.name} (${seller.allowedProducts.join(", ")})</option>`).join("");
        const productOptions = Object.keys(PRODUCT_CONFIG).map(product => `<option value="${product}">${product}</option>`).join("");
        details.insertAdjacentHTML("beforeend", `<p><strong>ÉTAT</strong> ${mission ? "EN MISSION" : "DISPONIBLE"}<br>${mission ? `Mission : ${getApartmentById(mission.apartmentId)?.name} → ${getEmployeeById(mission.sellerId)?.name}<br>Transport : ${mission.product || "Caisse"} ×${mission.quantity}<br>Progression : ${mission.stage}` : "En attente d'une mission du gérant."}</p><p>Capacité : ${employee.capacity} · Argent transporté : ${Math.floor(employee.money || 0)} €</p><div class="manualMission"><strong>NOUVELLE MISSION</strong><label>Appartement source<select data-manual-source="${employee.id}">${apartments}</select></label><label>Vendeur destination<select data-manual-seller="${employee.id}">${sellers}</select></label><label>Produit<select data-manual-product="${employee.id}">${productOptions}</select></label><label>Quantité<input data-manual-quantity="${employee.id}" type="number" min="1" max="${employee.capacity}" value="1"></label><button type="button" data-create-manual-mission="${employee.id}" ${mission ? "disabled" : ""}>NOUVELLE MISSION</button></div>`);
    }
    const summary = document.createElement("div");
    summary.className = "employeeCard";
    summary.innerHTML = `<strong>${employee.icon} ${escapeHTML(employee.name)}</strong><div data-employee-summary="${employee.id}">${employeeOverview(employee)}</div>`;
    summary.insertAdjacentHTML("beforeend", `<p>Niveau ${employee.level} / 5 · expérience ${employee.experience} · salaire ${employee.salary} €/jour</p>`);
    summary.insertAdjacentHTML("beforeend", `<button data-locate="${employee.id}">VOIR SUR LA CARTE</button>`);
    if (employee.active && employee.state === "en pause") summary.insertAdjacentHTML("beforeend", `<button data-resume="${employee.id}">REPRENDRE LE POSTE</button>`);
    const advanced = document.createElement("details");
    const label = document.createElement("summary");
    label.textContent = "CONFIGURER";
    advanced.appendChild(label);
    advanced.appendChild(details);
    summary.appendChild(advanced);
    return summary;
}

function updateEmployeesPanel() {
    employeesList.replaceChildren();
    const recruitment = document.createElement("details");
    recruitment.className = "employeeCard";
    recruitment.innerHTML = "<summary>RECRUTER · comparer les profils</summary>";
    Object.entries(employeeTypes).forEach(([type, data]) => {
        const card = document.createElement("div"); card.className = "employeeCard";
        card.innerHTML = `<div class="employeeTitle"><span>${data.icon}</span><strong>${data.name}</strong></div><p>${data.description}</p>${Object.entries(EMPLOYEE_PROFILES).map(([key, profile]) => { const sample = createEmployee(type, 50, 50, key); return `<p>${profile.name} · capacité ${sample.capacity} · efficacité ${sample.efficiency.toFixed(2)} · fiabilité ${sample.reliability}% · ${sample.salary} €/jour</p><button type="button" data-hire="${type}" data-profile="${key}">Recruter · ${data.cost} €</button>`; }).join("")}`;
        recruitment.appendChild(card);
    });
    const employee = getEmployeeById(selectedEmployeeId);
    if (employee) employeesList.prepend(renderEmployeeDetails(employee));
    const roster = document.createElement("div"); roster.className = "employeeCard";
    roster.innerHTML = `<strong>Équipe (${game.employees.length})</strong>`;
    game.employees.forEach(item => {
        const button = document.createElement("button"); button.type = "button";
        button.dataset.selectEmployee = item.id; button.textContent = `${item.icon} ${item.name} · ${item.state}`;
        roster.appendChild(button);
    });
    employeesList.appendChild(roster);
    employeesList.appendChild(recruitment);
    renderTeamsPanel();
}

function renderTeamsPanel() {
    const panel = document.createElement("div"); panel.className = "employeeCard";
    const options = role => game.employees.filter(employee => employee.role === role).map(employee => `<option value="${employee.id}">${employee.name}</option>`).join("");
    const sellers = game.employees.filter(employee => employee.role === "vendeur" && employee.active);
    const couriers = game.employees.filter(employee => employee.role === "ravitailleur" && employee.active);
    const pending = game.logisticsRequests.filter(request => request.status !== "COMPLETED" && request.status !== "ASSIGNED");
    const lowStock = sellers.filter(seller => seller.allowedProducts.some(product => getSellerProductStock(seller, product) <= seller.restockThreshold));
    panel.innerHTML = `<strong>RÉSEAU</strong><p>${sellers.length} vendeurs actifs · ${couriers.length} ravitailleurs · ${game.employees.filter(employee => employee.role === "gerant" && employee.active).length} gérant(s) · ${game.employees.filter(employee => employee.role === "guetteur" && employee.active).length} guetteurs</p><p><strong>VENTES</strong> ${Math.floor(game.dailyRevenue)} € aujourd'hui</p><p><strong>LOGISTIQUE</strong> ${lowStock.length ? `⚠ ${lowStock.length} vendeur(s) à ravitailler` : "✓ vendeurs correctement approvisionnés"}<br><strong>MISSIONS</strong> ${game.logisticsMissions.length} en cours · ${pending.length} en attente${pending.length > couriers.length ? "<br>⚠ CAPACITÉ LOGISTIQUE INSUFFISANTE" : ""}</p><p><strong>STOCK</strong><br>${Object.entries(getNetworkStock().byProduct).map(([product, stock]) => `${product} ${stock}${stock <= (game.logisticsSettings?.lowStockThreshold || 5) ? " ⚠" : ""}`).join(" · ")}</p><hr><strong>CONFIGURER UNE ÉQUIPE</strong><label class="stockPurchaseLabel">Nom<input id="teamName" value="Équipe ${game.teams.length + 1}"></label><label class="stockPurchaseLabel">Gérant<select id="teamManager"><option value="">Choisir</option>${options("gerant")}</select></label><label class="stockPurchaseLabel">Vendeurs<select id="teamSellers" multiple>${options("vendeur")}</select></label><label class="stockPurchaseLabel">Ravitailleurs<select id="teamCouriers" multiple>${options("ravitailleur")}</select></label><label class="stockPurchaseLabel">Guetteurs<select id="teamWatchers" multiple>${options("guetteur")}</select></label><label class="stockPurchaseLabel">Dépôts accessibles<select id="teamApartments" multiple>${game.apartments.map(apartment => `<option value="${apartment.id}">${apartment.name}</option>`).join("")}</select></label><button type="button" data-create-team>CRÉER UNE ÉQUIPE</button>`;
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
    if (!configureTeam(team)) { showMessage("Équipe refusée : membre déjà affecté ou mission en cours."); return; }
    showMessage(`${team.name} configurée : le gérant prend la logistique en charge.`); updateEmployeesPanel();
}

function buyEmployee(type, profile = "balanced") {
    if (profile === "expert" && (game.totalCustomers || 0) < 30) { showMessage("Profil expert débloqué après 30 clients servis."); return; }
    if (mapPlacement) cancelMapPlacement();
    recruitmentProfile = EMPLOYEE_PROFILES[profile] ? profile : "balanced";
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
    const employee = createEmployee(placementMode, x, y, recruitmentProfile); employee.state = "en poste";
    game.employees.push(employee);
    if (employee.role === "vendeur") createSalesPoint(employee, x, y);
    createEmployeeVisual(employee); placementMode = null; selectedEmployeeId = employee.id;
    if (typeof requestSave === "function") requestSave();
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
    if (Math.random() > watcher.clientGuidance / 100) return false;
    if (typeof joinSellerQueue !== "function" || !joinSellerQueue(customer, seller)) return false;
    customer.oriented = true;
    watcher.clientsGuided = (watcher.clientsGuided || 0) + 1;
    awardEmployeeExperience(watcher);
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
        const load = Math.max(1, scope.sellers.length / manager.supervisionCapacity);
        manager.managementElapsed = (manager.managementElapsed || 0) + 1;
        if (manager.managementElapsed < load / manager.decisionSpeed) return;
        manager.managementElapsed = 0;
        scope.sellers.filter(seller => seller.active && seller.state === "en poste").forEach(seller => {
            // Chaque produit est autonome : une rupture A ne coupe jamais B/C.
            seller.allowedProducts.forEach(product => createLogisticsRequest(seller, manager, product));
            createLogisticsRequest(seller, manager, null, { cashOnly: true });
        });
    });
}

let employeeSimulationElapsed = 0;

function updateEmployeesRealtime(delta) {
    if (!game.dayActive) return;
    game.employees.filter(employee => employee.role === "vendeur").forEach(employee => {
        employee.cooldown = Math.max(0, employee.cooldown - delta);
        if (employee.cooldown > 0) return;
        const target = findNearestCustomer(employee);
        if (target) serveCustomerAutomatically(employee, target);
    });
    employeeSimulationElapsed += delta;
    if (employeeSimulationElapsed < 1) return;
    employeeSimulationElapsed %= 1;
    manageNetwork();
}

employeesList.addEventListener("click", event => {
    if (event.target.dataset.locate) {
        const employee = getEmployeeById(event.target.dataset.locate);
        if (employee) { centerCamera(employee); employeesPanel.classList.remove("visible"); }
    }
    if (event.target.dataset.resume) {
        const seller = getEmployeeById(event.target.dataset.resume), point = seller && getSalesPointForSeller(seller.id);
        if (seller?.active && point && !seller.currentMissionId) requestSellerMove(seller, point);
    }
    if (event.target.dataset.hire) buyEmployee(event.target.dataset.hire, event.target.dataset.profile);
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
        if (field === "apartmentId" || field === "managerId") {
            if (employee.currentMissionId || getTeamForMember(employee.id)) { showMessage("Modifier les affectations depuis l'équipe, après les missions."); updateEmployeesPanel(); return; }
            employee.assignment[field] = event.target.value || null;
            game.logisticsRequests = game.logisticsRequests.filter(r => r.sellerId !== employee.id);
        }
        else if (field === "salesMode") {
            const source = getSellerStorageContainer(employee);
            const target = event.target.value === "cachette" ? { inventory: employee.localReserve, capacity: employee.capacity } : employee;
            if (employee.currentMissionId || getInventoryFreeSpace(target) < getInventoryTotal(source)) { showMessage("Termine la mission ou libère la réserve avant de changer de mode."); updateEmployeesPanel(); return; }
            if (source.inventory !== target.inventory) Object.keys(PRODUCT_CONFIG).forEach(p => { const q = getInventoryQuantity(source, p); if (q) transferInventory(source, target, p, q); });
            employee.salesMode = event.target.value;
        }
        else if (field === "restockThreshold" || field === "targetStock") employee[field] = Math.max(1, Math.min(employee.capacity, Number(event.target.value) || 1));
        else if (field === "logisticsAutomation") employee[field] = event.target.value === "true";
        else employee[field] = event.target.value;
    }
    if (event.target.classList.contains("employeeProductToggle")) {
        if (employee.currentMissionId) { showMessage("Attends la fin de la livraison pour modifier les produits."); updateEmployeesPanel(); return; }
        const product = event.target.value; employee.allowedProducts = employee.allowedProducts.filter(item => item !== product);
        if (event.target.checked) employee.allowedProducts.push(product);
        game.logisticsRequests = game.logisticsRequests.filter(r => r.sellerId !== employee.id || !r.product || employee.allowedProducts.includes(r.product));
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
