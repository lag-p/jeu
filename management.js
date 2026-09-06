// Présentation dérivée des sources de vérité ; aucun stock ou argent recopié.
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function getNetworkProblems() {
    const problems = [];
    const add = (code, level, entity, message, action, panel = "employees") => problems.push({ code, level, entityId: entity?.id || null, message, action, panel });
    game.employees.forEach(employee => {
        if (!employee.active || !["en poste", "disponible", "en déplacement", "en ravitaillement"].includes(employee.state)) {
            add("EMPLOYEE_INACTIVE", "warning", employee, `${employee.name} : ${employee.state}`, "Consulter sa situation");
        }
        if (employee.role !== "vendeur" || !employee.active) return;
        if (!employee.allowedProducts.length) add("EMPLOYEE_INACTIVE", "critical", employee, `${employee.name} : aucun produit autorisé`, "Configurer les produits vendus");
        const manager = getEmployeeById(employee.assignment.managerId);
        if (!manager?.active) add("NO_MANAGER", "warning", employee, `${employee.name} sans gérant actif`, "Affecter un gérant ou organiser une livraison manuelle");
        employee.allowedProducts.forEach(product => {
            const stock = getSellerProductStock(employee, product);
            if (stock > employee.restockThreshold) return;
            const mission = game.logisticsMissions.find(item => item.sellerId === employee.id && item.product === product);
            add(stock ? "SELLER_LOW_STOCK" : "SELLER_OUT_OF_STOCK", stock ? "warning" : "critical", employee,
                `${employee.name} : ${product} ${stock ? "bientôt vide" : "en rupture"} (${stock})`, mission ? "Ravitaillement en cours" : "Organiser le ravitaillement");
        });
        const point = getSalesPointForSeller(employee.id);
        if (point && getQueue(employee.id).length >= point.capacity) add("QUEUE_TOO_LONG", "warning", employee, `${employee.name} : file complète`, "Renforcer ce secteur ou accélérer le service");
        if (employee.money >= game.logisticsSettings.maxSellerCash) add("CASH_ACCUMULATION", "warning", employee, `${employee.name} conserve ${Math.floor(employee.money)} €`, "Organiser une collecte");
    });
    game.logisticsRequests.filter(request => request.status !== "ASSIGNED").forEach(request => {
        if (request.blockedReason) add("STORAGE_EMPTY", "warning", getEmployeeById(request.sellerId), request.blockedReason, "Vérifier les dépôts accessibles et leur stock", "stock");
        const manager = getEmployeeById(request.managerId);
        const couriers = manager ? getManagerScope(manager).couriers : game.employees;
        if (!getAvailableCouriers(couriers, request).length) add("NO_COURIER_AVAILABLE", "warning", getEmployeeById(request.sellerId), "Demande en attente : aucun ravitailleur disponible", "Attendre une mission ou recruter", "logistics");
    });
    Object.entries(getNetworkStock().byProduct).forEach(([product, quantity]) => {
        if (!quantity) add("STORAGE_EMPTY", "critical", null, `Aucun stock ${product} disponible`, "Acheter du stock", "stock");
    });
    police.alerts.forEach(alert => add("POLICE_ALERT", "critical", alert, "Alerte locale dans le quartier", "Consulter les équipes prévenues", "police"));
    game.teams.filter(team => police.alerts.some(alert => alert.teamIds?.includes(team.id))).forEach(team => add("TEAM_ALERT", "critical", team, `${team.name} en alerte`, "Consulter la zone", "police"));
    game.employees.filter(e => e.role === "gerant" && e.active).forEach(manager => {
        if (getManagerScope(manager).sellers.length > manager.supervisionCapacity) add("MANAGER_OVERLOADED", "warning", manager, `${manager.name} dépasse sa capacité de supervision`, "Répartir les vendeurs entre plusieurs équipes");
    });
    return problems;
}

function employeeOverview(employee) {
    const mission = game.logisticsMissions.find(item => item.courierId === employee.id || item.sellerId === employee.id);
    const manager = getEmployeeById(employee.assignment.managerId);
    const scope = employee.role === "gerant" ? getManagerScope(employee) : null;
    const point = getSalesPointForSeller(employee.id);
    let body = `<p>${escapeHTML(employee.state)} · ${Math.floor(employee.money)} € portés</p>`;
    if (employee.role === "vendeur") body += `<p>${employee.allowedProducts.map(product => `${product} : ${getSellerProductStock(employee, product)}`).join(" · ")}</p><p>${point?.stats.customersServed || 0} clients servis · Gérant : ${escapeHTML(manager?.name || "aucun")}</p><p>Ravitaillement : ${mission ? "en cours" : employee.logisticsAutomation ? "automatique" : "manuel"}</p>`;
    if (employee.role === "ravitailleur") body += `<p>${mission ? `${escapeHTML(getApartmentById(mission.apartmentId)?.name)} → ${escapeHTML(getEmployeeById(mission.sellerId)?.name)} · ${escapeHTML(mission.stage)}` : "Aucune mission"}</p><p>Transport : ${employeeInventoryText(employee)}</p>`;
    if (employee.role === "guetteur") body += `<p>Zone : ${escapeHTML(getMapZoneAt(employee)?.id)} · rayon ${employee.observationRadius}</p><p>Expérience ${employee.experience} · ${employee.clientsGuided || 0} clients orientés · ${employee.alertsDetected || 0} alertes</p>`;
    if (scope) body += `<p>${escapeHTML(scope.team?.name || "Affectations directes")} · ${scope.sellers.length}/${employee.supervisionCapacity} vendeurs · ${scope.couriers.length} ravitailleurs</p><p>${game.logisticsRequests.filter(r => r.managerId === employee.id).length} demandes · ${game.logisticsMissions.filter(m => scope.couriers.some(c => c.id === m.courierId)).length} missions</p>`;
    const issues = getNetworkProblems().filter(problem => problem.entityId === employee.id);
    return `${body}${issues.map(problem => `<p class="problem ${problem.level}">${escapeHTML(problem.message)}<br>${escapeHTML(problem.action)}</p>`).join("")}`;
}

function renderManagementPanel() {
    const target = document.getElementById("managementContent");
    if (!target) return;
    const problems = getNetworkProblems(), stock = getNetworkStock();
    const count = role => game.employees.filter(e => e.role === role && e.active).length;
    const sellers = game.employees.filter(e => e.role === "vendeur" && e.active);
    const low = sellers.filter(e => e.allowedProducts.some(p => getSellerProductStock(e, p) <= e.restockThreshold)).length;
    target.innerHTML = `<div class="employeeCard"><strong>RÉSEAU · JOUR ${game.day}</strong><p>Disponible : ${Math.floor(game.money)} €</p><div class="dashboardNumbers"><p>CA aujourd’hui<strong>${Math.floor(game.dailyRevenue)} €</strong></p><p>Bénéfice estimé<strong>${Math.floor(getEstimatedProfit())} €</strong></p></div><p>CA moins dépenses et charges de journée prévues ; caisses à collecter.</p><p>Vendeurs ${count("vendeur")} · Gérants ${count("gerant")}<br>Ravitailleurs ${count("ravitailleur")} · Guetteurs ${count("guetteur")}</p></div><div class="employeeCard"><strong>LOGISTIQUE</strong><p>✓ ${sellers.length - low} vendeurs approvisionnés<br>${low ? `⚠ ${low} vendeurs à ravitailler<br>` : ""}${game.logisticsMissions.length} missions en cours</p><strong>STOCK GLOBAL</strong><p>${Object.entries(stock.byProduct).map(([p, q]) => `${p} ${q}${q <= game.logisticsSettings.lowStockThreshold ? " ⚠" : ""}`).join(" · ")}</p></div><div class="employeeCard"><strong>PROBLÈMES · ${problems.length}</strong>${problems.map((p, i) => `<div class="problem ${p.level}"><p>${escapeHTML(p.message)}</p><button data-problem="${i}">${escapeHTML(p.action)}</button></div>`).join("") || "<p>✓ Aucun problème détecté.</p>"}</div><button id="manageTeams">CONFIGURER LES ÉQUIPES</button>`;
    target.querySelectorAll("[data-problem]").forEach(button => button.addEventListener("click", () => {
        const problem = problems[Number(button.dataset.problem)];
        selectedEmployeeId = problem.entityId;
        document.getElementById("managementPanel").classList.remove("visible");
        document.getElementById(`${problem.panel}Button`)?.click();
    }));
    game.teams.forEach(team => {
        const p = getTeamPerformance(team);
        target.insertAdjacentHTML("beforeend", `<div class="employeeCard"><strong>${escapeHTML(team.name)} · cumul</strong><p>CA ${p.revenue} € · servis ${p.served} · perdus ${p.lost}<br>Ruptures ${p.stockouts} · service moyen ${p.service.toFixed(1)} · attente ${p.wait.toFixed(1)} s · mission moyenne ${p.logistics.toFixed(1)} s</p></div>`);
    });
    target.insertAdjacentHTML("beforeend", `<div class="employeeCard"><strong>CLIENTÈLE</strong><p>Réputation : ${Math.round(game.reputation ?? 65)}/100 · clientèle connue : ${(game.customerLoyalty || []).length}</p><p>${Object.keys(PRODUCT_CONFIG).map(p => `${p} : ${getProductDemand(p) > 1.2 ? "demande forte" : getProductDemand(p) < .85 ? "demande calme" : "demande normale"}`).join("<br>")}</p></div>`);
    target.insertAdjacentHTML("beforeend", `<div class="employeeCard"><strong>AUJOURD'HUI</strong>${(game.events || []).map(e => `<p>${EVENT_CONFIG[e.type].label} · ${Math.ceil(e.remaining)} s</p>`).join("") || "<p>Aucun événement.</p>"}</div>`);
    renderEconomyManagement(target);
    if (typeof renderDebugPanel === "function") renderDebugPanel();
    if (typeof renderAudioSettings === "function") renderAudioSettings(target);
    target.insertAdjacentHTML("beforeend", `<p>${escapeHTML(game.saveStatus || "Sauvegarde automatique toutes les 30 secondes")}</p>`);
    target.querySelector("#manageTeams").addEventListener("click", () => {
        document.getElementById("managementPanel").classList.remove("visible");
        document.getElementById("employeesButton").click();
    });
}

let managementElapsed = 0;
function updateManagementRealtime(delta) {
    managementElapsed += delta;
    if (managementElapsed < 1) return;
    managementElapsed = 0;
    updatePoliceUI();
    if (document.getElementById("managementPanel")?.classList.contains("visible") && !document.activeElement?.closest("#managementContent input, #managementContent select")) renderManagementPanel();
    if (employeesPanel.classList.contains("visible")) document.querySelectorAll("[data-employee-summary]").forEach(element => { const employee = getEmployeeById(element.dataset.employeeSummary); if (employee) element.innerHTML = employeeOverview(employee); });
    game.employees.forEach(employee => {
        if (!employee.element) return;
        const low = employee.role === "vendeur" && employee.allowedProducts.find(p => getSellerProductStock(employee, p) <= employee.restockThreshold);
        const badge = employee.alertLevel ? "!" : employee.currentMissionId ? "📦" : low ? (getSellerProductStock(employee, low) ? `⚠ ${low.slice(-1)}` : "!") : "";
        employee.element.dataset.status = badge;
    });
}

document.getElementById("managementButton").addEventListener("click", () => {
    renderManagementPanel();
    document.getElementById("managementPanel").classList.add("visible");
});
document.getElementById("closeManagement").addEventListener("click", () => document.getElementById("managementPanel").classList.remove("visible"));
