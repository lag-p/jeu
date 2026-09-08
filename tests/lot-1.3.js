// Scénarios ciblés lot 1.3. Exécutés dans le même VM déterministe que la régression.
const northSearch = getCustomerSearchPoints(mapData.entries[0]);
const westSearch = getCustomerSearchPoints(mapData.entries[2]);
assert.ok(northSearch.length > 1 && westSearch.length > 1);
assert.notDeepEqual(northSearch, westSearch);
assert.ok(northSearch.every(point => isWalkable(point)) && westSearch.every(point => isWalkable(point)));

clearWaitingCustomers();
const sellerA = createEmployee('vendeur', 50, 36); sellerA.state = 'en poste'; sellerA.allowedProducts = ['Produit A']; game.employees.push(sellerA); createSalesPoint(sellerA, 50, 36);
const sellerB = createEmployee('vendeur', 55, 36); sellerB.state = 'en poste'; sellerB.allowedProducts = ['Produit A']; sellerB.inventory['Produit A'] = 5; game.employees.push(sellerB); createSalesPoint(sellerB, 55, 36);
const first = createCustomer(); Object.assign(first, { product: 'Produit A', quantity: 1, x: 50, y: 38, state: 'WAITING', assignedSellerId: sellerA.id, targetSellerId: sellerA.id, patience: 10 }); sellerA.queue = [first.id];
const following = createCustomer(); Object.assign(following, { product: 'Produit A', quantity: 1, x: 50, y: 39, state: 'WAITING', assignedSellerId: sellerA.id, targetSellerId: sellerA.id, patience: 10 }); sellerA.queue.push(following.id);
assert.equal(handleUnavailableCustomer(first, sellerA), 'redirected');
assert.equal(first.redirectCount, 1); assert.equal(getQueue(sellerA.id)[0], following);
assert.equal(findRedirectSeller(first, sellerA), null, 'une redirection suffit');

const mission = { id: 'test-restock', sellerId: sellerA.id, product: 'Produit A', stage: 'GOING_TO_SELLER', createdAt: game.clock.elapsed, cancelled: false, failed: false };
game.logisticsMissions.push(mission);
const waiting = createCustomer(); Object.assign(waiting, { product: 'Produit A', quantity: 1, x: 50, y: 38, state: 'WAITING', assignedSellerId: sellerA.id, targetSellerId: sellerA.id, patience: 10 }); sellerA.queue.unshift(waiting.id);
assert.equal(waitForRestock(waiting, sellerA, mission), true); assert.equal(waiting.state, 'WAITING_FOR_RESTOCK'); assert.equal(getQueue(sellerA.id).includes(waiting), false);
sellerA.inventory['Produit A'] = 2; updateCustomersRealtime(.1); assert.equal(waiting.state, 'GOING_TO_SELLER');

const manual = createEmployee('vendeur', 40, 36); manual.assignment = { apartmentId: 'manual', managerId: null, manual: true }; game.employees.push(manual); assert.equal(applyAutomaticAssignment(manual), false);
const automatic = createEmployee('ravitailleur', 42, 36); game.employees.push(automatic); applyAutomaticAssignment(automatic); assert.ok(automatic.assignment.reason !== undefined);
clearWaitingCustomers();
