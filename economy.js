// Configuration économique unique. Les achats, ventes et commandes y puisent
// leurs valeurs afin d'éviter les prix divergents entre systèmes.
const PRODUCT_CONFIG = Object.freeze({
    "Produit A": Object.freeze({ purchasePrice: 5, salePrice: 12, demandWeight: 50 }),
    "Produit B": Object.freeze({ purchasePrice: 10, salePrice: 24, demandWeight: 30 }),
    "Produit C": Object.freeze({ purchasePrice: 20, salePrice: 48, demandWeight: 20 })
});

const CUSTOMER_PROFILES = Object.freeze({
    "nouveau": Object.freeze({ weight: 45, quantityWeights: [40, 35, 18, 6, 1], budgetFactor: [0.88, 1.15], patience: [10, 18], knowsSeller: 0.05 }),
    "occasionnel": Object.freeze({ weight: 35, quantityWeights: [20, 35, 27, 13, 5], budgetFactor: [0.95, 1.25], patience: [16, 26], knowsSeller: 0.28 }),
    "habitué": Object.freeze({ weight: 20, quantityWeights: [10, 25, 30, 22, 13], budgetFactor: [1.02, 1.4], patience: [22, 34], knowsSeller: 0.78 })
});

const CUSTOMER_FLOW = Object.freeze({
    MAX_ACTIVE_CUSTOMERS: 14,
    SERVICE_TIME: Object.freeze({ sacoche: 1.2, cachette: 2.4, perUnit: 0.18 }),
    QUEUE_SPACING: 3.2,
    SPAWN_BASE_MS: 2600
});

const SUPPLIER_CONFIG = Object.freeze({
    local: { name: "Fournisseur local", price: 1, capacity: 100, reliability: 100, unlock: 0 },
    wholesale: { name: "Grossiste", price: .8, capacity: 180, reliability: 75, unlock: 20 },
    express: { name: "Service régulier", price: 1.15, capacity: 250, reliability: 100, unlock: 0 }
});
function getSupplier() { return SUPPLIER_CONFIG[game.supplierId] || SUPPLIER_CONFIG.local; }
function getEstimatedProfit() {
    const salaries = game.salaryPaidDay === game.day ? 0 : game.employees.filter(e => e.active).reduce((sum, e) => sum + e.salary, 0);
    const rents = game.economySettledDay === game.day ? 0 : game.apartments.filter(a => a.active).reduce((sum, a) => sum + (a.rent || 0), 0);
    return game.dailyRevenue - game.dailyExpenses - salaries - rents;
}
function supplierAvailable(supplier = getSupplier()) { return (game.totalCustomers || 0) >= supplier.unlock && (supplier.reliability === 100 || game.day % 4 !== 0); }
function getSupplierRemaining(product) {
    const key = `${game.day}:${game.supplierId || "local"}:${product}`;
    return supplierAvailable() ? Math.max(0, Math.floor(getSupplier().capacity * getEventModifier("supply")) - (game.supplierPurchases?.[key] || 0)) : 0;
}
function settleDailyEconomy() {
    if (game.economySettledDay === game.day) return;
    game.economySettledDay = game.day;
    const rent = game.apartments.filter(a => a.active).reduce((sum, a) => sum + (a.rent || 0), 0);
    game.money -= rent; recordExpense(rent, "rents");
    const net = game.dailyRevenue - game.dailyExpenses;
    game.totalNetProfit = (game.totalNetProfit || 0) + net;
    game.lastDailyReport = { day: game.day, revenue: game.dailyRevenue, expenses: game.dailyExpenses, net, breakdown: { ...game.expenseBreakdown }, lostStock: game.dailyLostStock || 0 };
    game.history = [...(game.history || []), game.lastDailyReport].slice(-30);
    if (game.employees.some(e => e.role === "vendeur") && !(game.dayStockoutSeconds > 0)) game.stockoutFreeDay = true;
}
function getProgression() {
    const served = game.totalCustomers || 0;
    const objectives = [
        { label: "Servir 50 clients", done: served >= 50, progress: `${served}/50` },
        { label: "Cumuler 1 000 € de bénéfice", done: game.totalNetProfit >= 1000, progress: `${Math.floor(game.totalNetProfit || 0)}/1 000 €` },
        { label: "90 % de satisfaction après 20 clients", done: served >= 20 && game.satisfaction >= 90, progress: `${served}/20 · ${game.satisfaction}%` },
        { label: "Gérer deux équipes", done: game.teams.length >= 2, progress: `${game.teams.length}/2` },
        { label: "Une journée sans rupture vendeur", done: Boolean(game.stockoutFreeDay), progress: game.stockoutFreeDay ? "Accompli" : "À accomplir" }
    ];
    const stage = game.teams.length >= 2 && game.totalNetProfit >= 1000 ? "PATRON" : game.teams.length ? "GÉRANT DE RÉSEAU" : game.employees.length ? "ORGANISATEUR" : "VENDEUR";
    return { stage, objectives };
}
function purchaseUpgrade(kind, id = null) {
    const entity = kind === "apartment" ? getApartmentById(id) : getEmployeeById(id);
    if (kind !== "logistics" && (!entity || entity.currentMissionId)) return false;
    if (kind === "seller" && entity.role !== "vendeur" || kind === "manager" && entity.role !== "gerant") return false;
    if (!["apartment", "seller", "manager", "logistics"].includes(kind)) return false;
    const holder = kind === "logistics" ? game : entity, field = kind === "logistics" ? "logisticsUpgrade" : "upgradeLevel";
    const level = holder[field] || 0, cost = 80 * (level + 1);
    if (level >= 3 || game.money < cost || (game.totalCustomers || 0) < 10) return false;
    recordExpense(cost, "upgrades"); game.money -= cost; holder[field] = level + 1;
    if (kind === "apartment") entity.capacity += 20;
    if (kind === "seller") { entity.capacityUpgrade = (entity.capacityUpgrade || 0) + 6; applyEmployeeLevel(entity); }
    if (kind === "manager") { entity.supervisionUpgrade = (entity.supervisionUpgrade || 0) + 2; applyEmployeeLevel(entity); }
    updateUI(); if (typeof requestSave === "function") requestSave(); return true;
}
function renderEconomyManagement(target) {
    const progression = getProgression(), card = document.createElement("div"); card.className = "employeeCard";
    card.innerHTML = `<strong>${progression.stage}</strong>${progression.objectives.map(o => `<p>${o.done ? "✓" : "○"} ${o.label} · ${o.progress}</p>`).join("")}<p>Déblocages : améliorations après 10 clients, grossiste après 20, profil expert après 30.</p><strong>AMÉLIORATIONS</strong>`;
    const options = [...game.apartments.map(a => ({ kind: "apartment", entity: a, label: "+20 stock" })), ...game.employees.filter(e => ["vendeur", "gerant"].includes(e.role)).map(e => ({ kind: e.role === "vendeur" ? "seller" : "manager", entity: e, label: e.role === "vendeur" ? "+6 capacité" : "+2 supervision" })), { kind: "logistics", entity: game, label: "+10% vitesse logistique" }];
    options.forEach(({ kind, entity, label }) => {
        const level = entity[kind === "logistics" ? "logisticsUpgrade" : "upgradeLevel"] || 0;
        const button = document.createElement("button"); button.textContent = `${entity.name || "Réseau"} · ${label} · ${80 * (level + 1)} € (${level}/3)`;
        button.disabled = level >= 3 || (game.totalCustomers || 0) < 10 || game.money < 80 * (level + 1) || Boolean(entity.currentMissionId);
        button.addEventListener("click", () => { purchaseUpgrade(kind, entity.id); renderManagementPanel(); }); card.appendChild(button);
    });
    if (game.lastDailyReport) card.insertAdjacentHTML("beforeend", `<p>Dernier bilan : CA ${game.lastDailyReport.revenue} € · dépenses ${game.lastDailyReport.expenses} € · net ${game.lastDailyReport.net} €</p>`);
    if (game.money < 0) card.insertAdjacentHTML("beforeend", '<p class="problem critical">Solde négatif : récupérer les caisses du réseau ou vendre pour financer les prochaines dépenses.</p>');
    target.appendChild(card);
}
