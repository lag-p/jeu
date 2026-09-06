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
function chooseProduct() { return weightedPick(Object.entries(PRODUCT_CONFIG).map(([name, data]) => ({ name, ...data })), item => item.demandWeight * getProductDemand(item.name)); }
function getProductDemand(product) {
    const index = Object.keys(PRODUCT_CONFIG).indexOf(product);
    const daily = [1.35, 1, .75][(game.day + index) % 3];
    const hourly = 1 + Math.sin(game.dayElapsed / game.dayDuration * Math.PI * 2 + index) * .15;
    return daily * hourly * (typeof getEventModifier === "function" ? getEventModifier("demand", product) : 1);
}

function recordCustomerFeedback(customer, success) {
    if (customer.feedbackRecorded) return;
    customer.feedbackRecorded = true;
    const score = success ? customer.satisfaction : Math.max(0, customer.satisfaction - 35);
    game.reputation = Math.max(10, Math.min(100, (game.reputation ?? CUSTOMER_CONFIG.reputationStart) * .97 + score * .03));
    game.satisfaction = Math.round((game.satisfaction * .9) + score * .1);
    game.customerLoyalty = game.customerLoyalty || [];
    let record = game.customerLoyalty.find(item => item.id === customer.loyaltyId);
    if (!record && success) { record = { id: customer.loyaltyId || customer.id, visits: 0, satisfaction: score, sellerId: customer.assignedSellerId }; game.customerLoyalty.push(record); }
    if (record) { record.visits += success ? 1 : 0; record.satisfaction = record.satisfaction * .6 + score * .4; }
    if (game.customerLoyalty.length > CUSTOMER_CONFIG.loyaltyLimit) game.customerLoyalty.shift();
}
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
const PLAYER_SELLER_ID = "player-seller";
function getPlayerSeller() { return { id: PLAYER_SELLER_ID, role: "vendeur", active: true, state: "en poste", allowedProducts: Object.keys(game.playerInventory || {}), inventory: game.playerInventory, capacity: Infinity, x: game.playerX, y: game.playerY, queue: game.playerQueue || (game.playerQueue = []), isPlayer: true }; }
function getSellerEntity(id) { return id === PLAYER_SELLER_ID ? getPlayerSeller() : getEmployeeById(id); }
function isPlayerSeller(seller) { return Boolean(seller && seller.isPlayer); }
function getSellerPoint(seller) { return isPlayerSeller(seller) ? { id: PLAYER_SELLER_ID, x: game.playerX, y: game.playerY, active: game.playerPlaced, capacity: 1, importance: 1, currentVisitors: (game.playerQueue || []).length, stats: { customersServed: 0, customersLost: 0, totalWaitTime: 0, revenue: 0 } } : getSalesPointForSeller(seller.id); }
function getQueue(sellerId) {
    const seller = getSellerEntity(sellerId);
    if (!seller) return [];
    seller.queue = Array.isArray(seller.queue) ? seller.queue : [];
    const eligible = customers.filter(customer => customer.active && customer.assignedSellerId === sellerId && customer.targetSellerId === sellerId && ["GOING_TO_SELLER", "WAITING"].includes(customer.state));
    const eligibleById = new Map(eligible.map(customer => [customer.id, customer]));
    seller.queue = seller.queue.filter((id, index, queue) => queue.indexOf(id) === index && eligibleById.has(id));
    eligible.forEach(customer => { if (!seller.queue.includes(customer.id)) seller.queue.push(customer.id); });
    if (isPlayerSeller(seller)) game.playerQueue = seller.queue;
    return seller.queue.map(id => eligibleById.get(id)).filter(Boolean);
}
function queueDestination(seller, index) { const point = getSellerPoint(seller) || seller; return nearestWalkable({ x: point.x, y: Math.min(97, point.y + (index + 1) * CUSTOMER_FLOW.QUEUE_SPACING) }); }
function chooseSeller(customer, excludeId = null) {
    const eligible = seller => seller.active && seller.state === "en poste" && seller.id !== excludeId && seller.allowedProducts.includes(customer.product) && (isPlayerSeller(seller) ? getInventoryQuantity(seller, customer.product) : getSellerProductStock(seller, customer.product)) >= customer.quantity && getSellerPoint(seller)?.active && getQueue(seller.id).length < getSellerPoint(seller).capacity;
    const employees = game.employees.filter(seller => seller.role === "vendeur" && eligible(seller)).sort((a, b) => mapDistance(customer, a) - mapDistance(customer, b));
    if (employees.length) return employees[0];
    const candidates = [getPlayerSeller()];
    return candidates.filter(eligible).filter(seller => {
        const point = getSellerPoint(seller); return point && point.active && getQueue(seller.id).length < point.capacity;
    }).sort((a, b) => mapDistance(customer, a) - mapDistance(customer, b))[0] || null;
}
function updateQueueTargets(sellerId) {
    const seller = getSellerEntity(sellerId), point = seller && getSellerPoint(seller);
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
    [...game.employees.filter(seller => seller.role === "vendeur"), getPlayerSeller()].filter(seller => Array.isArray(seller.queue) && seller.queue.includes(customer.id)).forEach(seller => sellerIds.add(seller.id));
    sellerIds.forEach(sellerId => {
        const seller = getSellerEntity(sellerId);
        if (seller && Array.isArray(seller.queue)) {
            seller.queue = seller.queue.filter(id => id !== customer.id);
            if (isPlayerSeller(seller)) game.playerQueue = seller.queue;
        }
    });
    customer.targetSellerId = null;
    customer.queuePointId = null;
    customer.queueIndex = null;
    if (!options.keepAssignment) customer.assignedSellerId = null;
    sellerIds.forEach(updateQueueTargets);
}
function joinSellerQueue(customer, seller) {
    const point = seller && getSellerPoint(seller);
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
function recordLoss(customer) { if (customer.lossRecorded || customer.saleResolved) return; customer.lossRecorded = true; recordCustomerFeedback(customer, false); game.dailyLostCustomers = (game.dailyLostCustomers || 0) + 1; const point = customer.assignedSellerId && getSalesPointForSeller(customer.assignedSellerId); if (point) point.stats.customersLost++; }
function startCustomerLeaving(customer, reason = "left") { if (!customer || ["LEAVING", "EXITED"].includes(customer.state)) return; recordLoss(customer); leaveSellerQueue(customer); customer.leaveReason = reason; setCustomerState(customer, "LEAVING"); setCustomerDestination(customer, chooseExit(customer)); customer.movementState = "leaving"; }

function createCustomer() {
    if (!game.dayActive || customers.length >= CUSTOMER_FLOW.MAX_ACTIVE_CUSTOMERS) return null;
    const returning = (game.customerLoyalty || []).filter(r => r.satisfaction >= 65 && !customers.some(c => c.loyaltyId === r.id));
    const regular = returning.length && Math.random() < CUSTOMER_CONFIG.returnChance ? returning[Math.floor(Math.random() * returning.length)] : null;
    const profile = regular ? { name: regular.visits >= 3 ? "habitué" : "occasionnel", ...CUSTOMER_PROFILES[regular.visits >= 3 ? "habitué" : "occasionnel"] } : chooseProfile();
    const entry = randomEntryPoint(), product = chooseProduct(), quantity = chooseQuantity(profile), value = product.salePrice * quantity;
    const budget = Math.max(0, Math.round(value * (profile.budgetFactor[0] + Math.random() * (profile.budgetFactor[1] - profile.budgetFactor[0]))));
    const element = null;
    const customer = { entityType: ENTITY_TYPES.CUSTOMER, id: `customer-${Date.now()}-${Math.random()}`, active: true, x: entry.x, y: entry.y, targetX: entry.x, targetY: entry.y, speed: 5 + Math.random() * 2, state: "ENTERING", customerType: profile.name, profile: profile.name, product: product.name, quantity, price: value, order: { items: [{ product: product.name, quantity, unitPrice: product.salePrice }], total: value }, budget, maxPatience: randomInteger(...profile.patience), patience: 0, satisfaction: randomInteger(80, 100), assignedSellerId: null, targetSellerId: null, queuePointId: null, queueIndex: null, saleResolved: false, lossRecorded: false, waitTime: 0, searchTime: 0, element };
    customer.loyaltyId = regular?.id || customer.id;
    const bigEvent = (game.events || []).find(e => e.type === "BIG_CUSTOMER" && !e.consumed);
    if (bigEvent) {
        bigEvent.consumed = true; customer.quantity = 5; customer.price = product.salePrice * 5; customer.budget = customer.price + 10;
        customer.order = { items: [{ product: product.name, quantity: 5, unitPrice: product.salePrice }], total: customer.price };
        customer.trait = "gros client";
    }
    customer.knownSellerId = regular?.sellerId || null;
    customer.trait = customer.trait || (Math.random() < .2 ? "impatient" : Math.random() < .2 ? "sensible au prix" : "ordinaire");
    if (customer.trait === "impatient") customer.maxPatience *= .75;
    if (customer.trait === "sensible au prix") customer.budget = Math.floor(customer.budget * .9);
    customer.patience = customer.maxPatience; setCustomerDestination(customer, { x: 50 + (Math.random() - .5) * 12, y: 50 + (Math.random() - .5) * 12 });
    MapRenderer.create(customer, "customer", "👤", selectCustomer);
    customers.push(customer); return customer;
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
            if (!customer.oriented && orientCustomerWithWatchers(customer)) return;
            const known = getSellerEntity(customer.knownSellerId);
            if (known?.active && getSellerProductStock(known, customer.product) >= customer.quantity && joinSellerQueue(customer, known)) return;
            const seller = chooseSeller(customer);
            if (seller) joinSellerQueue(customer, seller);
            else { customer.searchTime += delta; if (customer.searchTime >= Math.min(12, customer.maxPatience)) startCustomerLeaving(customer, "no-compatible-seller"); }
        }
        if (customer.state === "GOING_TO_SELLER") {
            const seller = getSellerEntity(customer.targetSellerId), point = seller && getSellerPoint(seller);
            if (!seller || !point || !point.active) { leaveSellerQueue(customer); setCustomerState(customer, "SEARCHING"); return; }
            if (customer.queueIndex == null || customer.queueIndex >= point.capacity) { const other = chooseSeller(customer, seller.id); if (other && joinSellerQueue(customer, other)) return; startCustomerLeaving(customer, "queue-full"); return; }
            updateQueueTargets(seller.id);
            if (mapDistance(customer, queueDestination(seller, customer.queueIndex)) < .8) { setCustomerState(customer, "WAITING"); customer.waitTime = 0; customer.patience = customer.maxPatience; }
        }
        if (customer.state === "WAITING") { customer.waitTime += delta; customer.patience = Math.max(0, customer.patience - delta); changeCustomerSatisfaction(customer, -delta * .4); if (customer.patience <= 0) startCustomerLeaving(customer, "patience"); }
        if (customer.state === "BEING_SERVED") { customer.serviceRemaining = Math.max(0, (customer.serviceRemaining || 0) - delta); if (!customer.serviceRemaining) startCustomerLeaving(customer, "served"); }
        updateMapEntityVisual(customer);
        if (selectedCustomer === customer) updateCustomerPanel(customer);
    });
}
function removeCustomer(customer) { leaveSellerQueue(customer); customer.active = false; const index = customers.indexOf(customer); if (index >= 0) customers.splice(index, 1); customer.element?.remove(); if (selectedCustomer === customer) { selectedCustomer = null; customerPanel.style.display = "none"; } }
function resolveSale(customer, options = {}) {
    const seller = options.seller || (customer?.assignedSellerId === PLAYER_SELLER_ID ? getPlayerSeller() : null);
    if (!customer || !customer.active || customer.saleResolved || customer.state !== "WAITING") return { success: false, reason: "customer-left" };
    if (!game.dayActive || customer.patience <= 0 || !seller || seller.state !== "en poste") return { success: false, reason: "seller-unavailable" };
    if (!Number.isSafeInteger(customer.price) || customer.price <= 0 || customer.price !== PRODUCT_CONFIG[customer.product]?.salePrice * customer.quantity) return { success: false, reason: "invalid-order" };
    if (seller && (!seller.active || seller.role !== "vendeur" || !seller.allowedProducts.includes(customer.product) || seller.id !== customer.assignedSellerId || customer.targetSellerId !== seller.id || getQueue(seller.id)[0] !== customer || mapDistance(customer, seller) > 25 || (!isPlayerSeller(seller) && seller.cooldown > 0))) return { success: false, reason: "seller-unavailable" };
    if (!seller && customer.assignedSellerId) return { success: false, reason: "seller-unavailable" };
    if (!customerAcceptsPurchase(customer)) { startCustomerLeaving(customer, "budget"); return { success: false, reason: "customer-refused" }; }
    const stock = seller && !isPlayerSeller(seller) ? getSellerProductStock(seller, customer.product) : getAvailableProductStock(customer.product);
    if (!Number.isSafeInteger(customer.quantity) || customer.quantity <= 0 || stock < customer.quantity) { if (options.removeOnInsufficientStock) startCustomerLeaving(customer, "stockout"); return { success: false, reason: "insufficient-stock" }; }
    customer.saleResolved = true; setCustomerState(customer, "BEING_SERVED"); leaveSellerQueue(customer, { keepAssignment: true }); customer.serviceRemaining = CUSTOMER_CONFIG.serviceVisualSeconds;
    if (seller && !isPlayerSeller(seller)) {
        getSellerStorageContainer(seller).inventory[customer.product] = stock - customer.quantity;
        seller.money += customer.price;
        awardEmployeeExperience(seller);
        // Moyenne glissante très légère : unités/seconde, utilisée uniquement pour
        // relever modestement la cible des points réellement très actifs.
        seller.salesRate = seller.salesRate || createEmptyInventory();
        const now = (game.day - 1) * game.dayDuration + game.dayElapsed;
        seller.salesRateTimes = seller.salesRateTimes || {};
        const elapsed = Math.max(5, now - (seller.salesRateTimes[customer.product] ?? now - 20));
        const instantRate = customer.quantity / elapsed;
        seller.salesRate[customer.product] = (seller.salesRate[customer.product] || 0) * 0.8 + instantRate * 0.2;
        seller.salesRateTimes[customer.product] = now;
    } else { game.playerInventory[customer.product] = stock - customer.quantity; game.money += customer.price; }
    game.dailyCustomers++; game.totalCustomers = (game.totalCustomers || 0) + 1; game.dailyRevenue += customer.price; game.dailyProductSales[customer.product] = (game.dailyProductSales[customer.product] || 0) + customer.quantity;
    const point = seller && getSalesPointForSeller(seller.id); if (point) { point.stats.customersServed++; point.stats.totalWaitTime += customer.waitTime; point.stats.totalServiceTime = (point.stats.totalServiceTime || 0) + (isPlayerSeller(seller) ? CUSTOMER_CONFIG.serviceVisualSeconds : (CUSTOMER_FLOW.SERVICE_TIME[seller.salesMode] + customer.quantity * CUSTOMER_FLOW.SERVICE_TIME.perUnit) / seller.serviceSpeed); point.stats.revenue += customer.price; }
    if (seller && !isPlayerSeller(seller)) { seller.cooldown = (CUSTOMER_FLOW.SERVICE_TIME[seller.salesMode] + customer.quantity * CUSTOMER_FLOW.SERVICE_TIME.perUnit) / seller.serviceSpeed; showMapIndicator(seller, `+${customer.price}€`); }
    changeCustomerSatisfaction(customer, 5 + (seller.salesSkill || 50) / 10); recordCustomerFeedback(customer, true);
    if (typeof updateUI === "function") updateUI();
    return { success: true, reason: "sold" };
}
serveButton.addEventListener("click", () => { if (!selectedCustomer) return; const sale = resolveSale(selectedCustomer, { removeOnInsufficientStock: true }); showMessage(sale.success ? `+${selectedCustomer.price} €` : sale.reason === "insufficient-stock" ? "Stock insuffisant" : "Le client est parti."); updateUI(); });
function getDynamicSpawnDelay() { const sellers = [...game.employees.filter(employee => employee.role === "vendeur" && employee.active && employee.state === "en poste"), getPlayerSeller()]; const waiters = customers.filter(customer => ["WAITING", "GOING_TO_SELLER"].includes(customer.state)).length; const capacity = sellers.reduce((sum, seller) => sum + (getSellerPoint(seller)?.capacity || 0), 0); const reputation = .65 + (game.reputation ?? CUSTOMER_CONFIG.reputationStart) / 130; const flow = typeof getEventModifier === "function" ? getEventModifier("flow") : 1; return Math.max(CUSTOMER_CONFIG.minimumSpawnMs, (CUSTOMER_FLOW.SPAWN_BASE_MS + waiters * 240 - Math.min(capacity, 10) * 90 + customers.length * 80) / reputation / flow); }
function scheduleCustomerSpawn() { if (!game.dayActive) return; game.customerSpawnRemaining = getDynamicSpawnDelay() / 1000; customerSpawnTimer = true; }
function updateCustomerSpawning(delta) { if (!game.dayActive || !customerSpawnTimer) return; game.customerSpawnRemaining -= delta; if (game.customerSpawnRemaining <= 0) { createCustomer(); scheduleCustomerSpawn(); } }
function startCustomerSpawning() { stopCustomerSpawning(); createCustomer(); scheduleCustomerSpawn(); }
function stopCustomerSpawning() { customerSpawnTimer = null; }
function prepareCustomerSystem() { stopCustomerSpawning(); customers.slice().forEach(removeCustomer); if (game.dayActive) startCustomerSpawning(); }
function clearWaitingCustomers() { stopCustomerSpawning(); customers.slice().forEach(removeCustomer); }
function disperseCustomersInZone(zone, radius) { let count = 0; customers.forEach(customer => { if (customer.state !== "LEAVING" && Math.hypot(customer.x - zone.x, customer.y - zone.y) <= radius) { startCustomerLeaving(customer, "dispersed"); count++; } }); return count; }
