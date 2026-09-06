// CLIENTS : commandes, file et cycle de vie physique.
let customers = [];
let customerSpawnTimer = null;
let selectedCustomer = null;
const customerPanel = document.getElementById("customerPanel");
const serveButton = document.getElementById("serveButton");

function randomInteger(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function weightedPick(entries, weight = item => item.weight) { let n = Math.random() * entries.reduce((sum, item, index) => sum + weight(item, index), 0); return entries.find((item, index) => (n -= weight(item, index)) <= 0) || entries.at(-1); }
function chooseProfile() { return weightedPick(Object.entries(CUSTOMER_PROFILES).map(([name, data]) => ({ name, ...data }))); }
function chooseQuantity(profile) { return weightedPick([1, 2, 3, 4, 5], (quantity, index) => profile.quantityWeights[index]); }
function chooseProduct() { return weightedPick(Object.entries(PRODUCT_CONFIG).map(([name, data]) => ({ name, ...data })), item => item.demandWeight); }
function randomEntryPoint() { const all = mapData.entries || []; return all[Math.floor(Math.random() * all.length)] || { x: 2, y: 50 }; }
function chooseExit(customer) { return (mapData.entries || []).map(exit => ({ ...exit, score: mapDistance(customer, exit) + Math.random() * 12 })).sort((a, b) => a.score - b.score)[0] || { x: customer.x < 50 ? -4 : 104, y: customer.y }; }
function setCustomerDestination(customer, destination) { if (!customer || !destination || !Number.isFinite(destination.x) || !Number.isFinite(destination.y)) return false; customer.targetX = destination.x; customer.targetY = destination.y; customer.destination = { x: destination.x, y: destination.y, id: destination.id || null }; customer.moving = true; customer.movementState = "moving"; return true; }
function changeCustomerSatisfaction(customer, amount) { customer.satisfaction = Math.max(0, Math.min(100, (customer.satisfaction ?? 75) + amount)); }
function updateCustomerPanel(customer) {
    document.getElementById("customerName").textContent = customer.customerType.toUpperCase();
    document.getElementById("customerRequest").textContent = `Demande : ${customer.product} × ${customer.quantity}`;
    document.getElementById("customerPrice").textContent = `Commande : ${customer.price} €`;
    document.getElementById("customerBudget").textContent = `Budget : ${customer.budget} €`;
    document.getElementById("customerPatience").textContent = `Patience : ${Math.max(0, Math.ceil(customer.patience))} s`;
    document.getElementById("customerSatisfaction").textContent = `État : ${customer.state}${customer.assignedSellerId ? " · vendeur ciblé" : ""}`;
}
function setCustomerState(customer, newState) {
    if (!customer) return false;
    if (newState === "SEARCHING" && (customer.targetSellerId || customer.assignedSellerId || customer.queuePointId != null || customer.queueIndex != null)) return false;
    if (newState === "WAITING" && (!customer.targetSellerId || customer.targetSellerId !== customer.assignedSellerId || customer.queueIndex == null)) return false;
    customer.state = newState;
    return true;
}
function getQueue(sellerId) {
    const seller = getEmployeeById(sellerId);
    if (!seller) return [];
    seller.queue = Array.isArray(seller.queue) ? seller.queue : [];
    const eligible = customers.filter(customer => customer.active && customer.assignedSellerId === sellerId && customer.targetSellerId === sellerId && ["GOING_TO_SELLER", "WAITING"].includes(customer.state));
    const eligibleById = new Map(eligible.map(customer => [customer.id, customer]));
    seller.queue = seller.queue.filter((id, index, queue) => queue.indexOf(id) === index && eligibleById.has(id));
    eligible.forEach(customer => { if (!seller.queue.includes(customer.id)) seller.queue.push(customer.id); });
    return seller.queue.map(id => eligibleById.get(id)).filter(Boolean);
}
function queueDestination(seller, index) { const point = getSalesPointForSeller(seller.id) || seller; return { x: point.x, y: Math.min(97, point.y + (index + 1) * CUSTOMER_FLOW.QUEUE_SPACING) }; }
function chooseSeller(customer, excludeId = null) {
    return game.employees.filter(seller => seller.role === "vendeur" && seller.active && seller.state === "en poste" && seller.id !== excludeId && seller.allowedProducts.includes(customer.product)).filter(seller => {
        const point = getSalesPointForSeller(seller.id); return point && point.active && getQueue(seller.id).length < point.capacity;
    }).sort((a, b) => mapDistance(customer, a) - mapDistance(customer, b))[0] || null;
}
function updateQueueTargets(sellerId) {
    const seller = getEmployeeById(sellerId), point = seller && getSalesPointForSeller(sellerId);
    if (!seller) return;
    const queue = getQueue(sellerId);
    if (point) point.currentVisitors = queue.length;
    queue.forEach((customer, index) => {
        customer.queueIndex = index;
        customer.queuePointId = point?.id || null;
        setCustomerDestination(customer, queueDestination(seller, index));
    });
}
function leaveSellerQueue(customer, options = {}) {
    if (!customer) return;
    const sellerIds = new Set([customer.targetSellerId, customer.assignedSellerId].filter(Boolean));
    game.employees.filter(seller => seller.role === "vendeur" && Array.isArray(seller.queue) && seller.queue.includes(customer.id)).forEach(seller => sellerIds.add(seller.id));
    sellerIds.forEach(sellerId => {
        const seller = getEmployeeById(sellerId);
        if (seller && Array.isArray(seller.queue)) seller.queue = seller.queue.filter(id => id !== customer.id);
    });
    customer.targetSellerId = null;
    customer.queuePointId = null;
    customer.queueIndex = null;
    if (!options.keepAssignment) customer.assignedSellerId = null;
    sellerIds.forEach(updateQueueTargets);
}
function joinSellerQueue(customer, seller) {
    const point = seller && getSalesPointForSeller(seller.id);
    if (!customer || !seller || !point || !point.active || !seller.active || seller.role !== "vendeur" || seller.state !== "en poste" || !seller.allowedProducts.includes(customer.product)) return false;
    if (customer.targetSellerId && customer.targetSellerId !== seller.id) leaveSellerQueue(customer);
    seller.queue = Array.isArray(seller.queue) ? seller.queue : [];
    if (!seller.queue.includes(customer.id) && getQueue(seller.id).length >= point.capacity) return false;
    customer.assignedSellerId = seller.id;
    customer.targetSellerId = seller.id;
    customer.queuePointId = point.id;
    if (!seller.queue.includes(customer.id)) seller.queue.push(customer.id);
    setCustomerState(customer, "GOING_TO_SELLER");
    updateQueueTargets(seller.id);
    return true;
}
function recordLoss(customer) { if (customer.lossRecorded || customer.saleResolved) return; customer.lossRecorded = true; const point = customer.assignedSellerId && getSalesPointForSeller(customer.assignedSellerId); if (point) point.stats.customersLost++; }
function startCustomerLeaving(customer, reason = "left") { if (!customer || ["LEAVING", "EXITED"].includes(customer.state)) return; recordLoss(customer); leaveSellerQueue(customer); customer.leaveReason = reason; setCustomerState(customer, "LEAVING"); setCustomerDestination(customer, chooseExit(customer)); customer.movementState = "leaving"; }

function createCustomer() {
    if (!game.dayActive || customers.length >= CUSTOMER_FLOW.MAX_ACTIVE_CUSTOMERS) return null;
    const entry = randomEntryPoint(), profile = chooseProfile(), product = chooseProduct(), quantity = chooseQuantity(profile), value = product.salePrice * quantity;
    const budget = Math.max(0, Math.round(value * (profile.budgetFactor[0] + Math.random() * (profile.budgetFactor[1] - profile.budgetFactor[0]))));
    const element = document.createElement("div"); element.className = "customer"; element.textContent = "👤";
    const customer = { entityType: ENTITY_TYPES.CUSTOMER, id: `customer-${Date.now()}-${Math.random()}`, active: true, x: entry.x, y: entry.y, targetX: entry.x, targetY: entry.y, speed: 5 + Math.random() * 2, state: "ENTERING", customerType: profile.name, profile: profile.name, product: product.name, quantity, price: value, order: { items: [{ product: product.name, quantity, unitPrice: product.salePrice }], total: value }, budget, maxPatience: randomInteger(...profile.patience), patience: 0, satisfaction: randomInteger(80, 100), assignedSellerId: null, targetSellerId: null, queuePointId: null, queueIndex: null, saleResolved: false, lossRecorded: false, waitTime: 0, searchTime: 0, element };
    customer.patience = customer.maxPatience; setCustomerDestination(customer, { x: 50 + (Math.random() - .5) * 12, y: 50 + (Math.random() - .5) * 12 });
    element.addEventListener("click", event => { event.stopPropagation(); selectedCustomer = customer; updateCustomerPanel(customer); customerPanel.style.display = "block"; });
    customers.push(customer); map.appendChild(element); return customer;
}
function customerAcceptsPurchase(customer) { return customer.budget >= customer.price; }
function updateCustomersRealtime(delta) {
    customers.slice().forEach(customer => {
        if (!customer.active) return;
        if (["ENTERING", "SEARCHING", "GOING_TO_SELLER", "LEAVING"].includes(customer.state)) {
            const reached = moveMapEntity(customer, { x: customer.targetX, y: customer.targetY }, delta, customer.speed);
            if (customer.state === "LEAVING" && reached) { setCustomerState(customer, "EXITED"); removeCustomer(customer); return; }
            if (customer.state === "ENTERING" && reached) setCustomerState(customer, "SEARCHING");
        }
        if (customer.state === "SEARCHING") {
            const seller = chooseSeller(customer);
            if (seller) joinSellerQueue(customer, seller);
            else { customer.searchTime += delta; if (customer.searchTime >= Math.min(12, customer.maxPatience)) startCustomerLeaving(customer, "no-compatible-seller"); }
        }
        if (customer.state === "GOING_TO_SELLER") {
            const seller = getEmployeeById(customer.targetSellerId), point = seller && getSalesPointForSeller(seller.id);
            if (!seller || !point || !point.active) { leaveSellerQueue(customer); setCustomerState(customer, "SEARCHING"); return; }
            if (customer.queueIndex == null || customer.queueIndex >= point.capacity) { const other = chooseSeller(customer, seller.id); if (other && joinSellerQueue(customer, other)) return; startCustomerLeaving(customer, "queue-full"); return; }
            updateQueueTargets(seller.id);
            if (mapDistance(customer, queueDestination(seller, customer.queueIndex)) < .8) { setCustomerState(customer, "WAITING"); customer.waitTime = 0; customer.patience = customer.maxPatience; }
        }
        if (customer.state === "WAITING") { customer.waitTime += delta; customer.patience = Math.max(0, customer.patience - delta); changeCustomerSatisfaction(customer, -delta * .4); if (customer.patience <= 0) startCustomerLeaving(customer, "patience"); }
        if (customer.state === "BEING_SERVED" && performance.now() >= customer.serviceEndsAt) startCustomerLeaving(customer, "served");
        if (customer.element?.style) { customer.element.style.left = `${customer.x}%`; customer.element.style.top = `${customer.y}%`; }
        if (selectedCustomer === customer) updateCustomerPanel(customer);
    });
}
function removeCustomer(customer) { leaveSellerQueue(customer); customer.active = false; const index = customers.indexOf(customer); if (index >= 0) customers.splice(index, 1); customer.element?.remove(); if (selectedCustomer === customer) { selectedCustomer = null; customerPanel.style.display = "none"; } }
function resolveSale(customer, options = {}) {
    const seller = options.seller || null;
    if (!customer || !customer.active || customer.saleResolved || customer.state !== "WAITING") return { success: false, reason: "customer-left" };
    if (seller && (!seller.active || seller.role !== "vendeur" || !seller.allowedProducts.includes(customer.product) || seller.id !== customer.assignedSellerId || customer.targetSellerId !== seller.id || getQueue(seller.id)[0] !== customer || mapDistance(customer, seller) > 25 || seller.cooldown > 0)) return { success: false, reason: "seller-unavailable" };
    if (!seller && customer.assignedSellerId) return { success: false, reason: "seller-unavailable" };
    if (!customerAcceptsPurchase(customer)) { startCustomerLeaving(customer, "budget"); return { success: false, reason: "customer-refused" }; }
    const stock = seller ? getSellerProductStock(seller, customer.product) : getAvailableProductStock(customer.product);
    if (!Number.isSafeInteger(customer.quantity) || customer.quantity <= 0 || stock < customer.quantity) { const point = seller && getSalesPointForSeller(seller.id); if (point) point.stats.stockouts++; if (options.removeOnInsufficientStock) startCustomerLeaving(customer, "stockout"); return { success: false, reason: "insufficient-stock" }; }
    customer.saleResolved = true; setCustomerState(customer, "BEING_SERVED"); leaveSellerQueue(customer, { keepAssignment: true }); customer.serviceEndsAt = performance.now() + 350;
    if (seller) { getSellerStorageContainer(seller).inventory[customer.product] = stock - customer.quantity; seller.money += customer.price; } else { game.stock[customer.product] = stock - customer.quantity; game.money += customer.price; }
    game.dailyCustomers++; game.dailyRevenue += customer.price; game.dailyProductSales[customer.product] = (game.dailyProductSales[customer.product] || 0) + customer.quantity;
    const point = seller && getSalesPointForSeller(seller.id); if (point) { point.stats.customersServed++; point.stats.totalWaitTime += customer.waitTime; point.stats.revenue += customer.price; }
    if (seller) { seller.cooldown = CUSTOMER_FLOW.SERVICE_TIME[seller.salesMode] + customer.quantity * CUSTOMER_FLOW.SERVICE_TIME.perUnit; showMapIndicator(seller, `+${customer.price}€`); }
    changeCustomerSatisfaction(customer, 10); game.satisfaction = Math.min(100, game.satisfaction + 1);
    if (typeof updateUI === "function") updateUI();
    return { success: true, reason: "sold" };
}
serveButton.addEventListener("click", () => { if (!selectedCustomer) return; const sale = resolveSale(selectedCustomer, { removeOnInsufficientStock: true }); showMessage(sale.success ? `+${selectedCustomer.price} €` : sale.reason === "insufficient-stock" ? "Stock insuffisant" : "Le client est parti."); updateUI(); });
function getDynamicSpawnDelay() { const sellers = game.employees.filter(employee => employee.role === "vendeur" && employee.active && employee.state === "en poste"); const waiters = customers.filter(customer => ["WAITING", "GOING_TO_SELLER"].includes(customer.state)).length; const capacity = sellers.reduce((sum, seller) => sum + (getSalesPointForSeller(seller.id)?.capacity || 0), 0); return Math.max(1200, CUSTOMER_FLOW.SPAWN_BASE_MS + waiters * 240 - Math.min(capacity, 10) * 90 + customers.length * 80); }
function scheduleCustomerSpawn() { if (!game.dayActive) return; customerSpawnTimer = setTimeout(() => { createCustomer(); scheduleCustomerSpawn(); }, getDynamicSpawnDelay()); }
function startCustomerSpawning() { stopCustomerSpawning(); createCustomer(); scheduleCustomerSpawn(); }
function stopCustomerSpawning() { if (customerSpawnTimer) clearTimeout(customerSpawnTimer); customerSpawnTimer = null; }
function prepareCustomerSystem() { stopCustomerSpawning(); customers.slice().forEach(removeCustomer); if (game.dayActive) setTimeout(startCustomerSpawning, 300); }
function clearWaitingCustomers() { stopCustomerSpawning(); customers.slice().forEach(removeCustomer); }
function disperseCustomersInZone(zone, radius) { let count = 0; customers.forEach(customer => { if (customer.state !== "LEAVING" && Math.hypot(customer.x - zone.x, customer.y - zone.y) <= radius) { startCustomerLeaving(customer, "dispersed"); count++; } }); return count; }
