newGame(); game.money = 2000; game.playerPlaced = true;
assert.equal(game.phase, DAY_PHASE.PREPARATION);
const initial = JSON.stringify(serializeState({ game, customers, police }));
updateSimulation(30);
assert.equal(JSON.stringify(serializeState({ game, customers, police })), initial);
document.getElementById('configureDayButton').click();
document.getElementById('stockButton').click();
assert.ok(document.getElementById('stockPanel').classList.contains('visible'));
const depot = createApartment('depot', 50, 50);
const seller = createEmployee('vendeur', 60, 50), courier = createEmployee('ravitailleur', 65, 50);
for (const e of [seller, courier]) { e.state = 'en poste'; game.employees.push(e); createEmployeeVisual(e); }
createSalesPoint(seller, 60, 50); depot.inventory['Produit A'] = 20;
startDay();
assert.equal(game.dayDuration, 720); assert.equal(game.phase, DAY_PHASE.ACTIVITE);
updateSimulation(10); assert.ok(Math.abs(game.dayElapsed - 10) < 1e-8);
updateDayUI(); assert.equal(document.getElementById('dayClock').textContent, '12:10');
assert.equal(setSimulationSpeed(2), true);
updateSimulation(10); assert.ok(Math.abs(game.dayElapsed - 30) < 1e-8);
// Missions, service, patience, déplacement joueur et événement dans un vrai DOM.
assert.equal(createManualLogisticsMission(courier.id, depot.id, seller.id, 'Produit A', 3).success, true);
game.playerDestination = nearestWalkable({ x: 55, y: 50 });
clearWaitingCustomers(); const customer = createCustomer();
Object.assign(customer, { product: 'Produit A', quantity: 1, price: 12, budget: 20, ...queueDestination(getPlayerSeller(), 0) });
joinSellerQueue(customer, getPlayerSeller()); updateCustomersRealtime(.1);
activateEvent('SUPPLIER_DISCOUNT', 4);
scheduleCustomerSpawn(); toggleSimulationPause();
const paused = JSON.stringify(serializeState({ game, customers, police }));
updateSimulation(50);
assert.equal(JSON.stringify(serializeState({ game, customers, police })), paused);
assert.equal(resolveSale(customer).success, false); assert.equal(createCustomer(), null);
assert.equal(saveGame(), true); assert.equal(loadGame(), true); assert.equal(game.clock.paused, true);
const pausedElapsed = game.clock.elapsed; updateSimulation(10); assert.equal(game.clock.elapsed, pausedElapsed);
// Une intervention impose ×1 sans annuler la pause, puis libère l'accélération.
police.activeOperation = { id: 'test-operation', phase: 'ACTIVE', elapsed: 0, targetZoneIds: [], affectedEmployeeIds: [], stockLost: 0, moneyLost: 0, pointsDisrupted: 0, clientsLost: 0 };
updateSimulation(1); assert.equal(game.clock.speed, 1); assert.equal(game.clock.paused, true);
assert.equal(setSimulationSpeed(2), false); updateDayUI();
assert.ok(document.getElementById('timeReason').textContent.includes('policière'));
toggleSimulationPause(); updateSimulation(18);
assert.equal(police.activeOperation, null); assert.equal(setSimulationSpeed(2), true);
// Minuit attend réellement la sortie, les retours chargés et les événements.
const liveCourier = getEmployeeById(courier.id), liveSeller = getEmployeeById(seller.id), liveDepot = getApartmentById(depot.id);
clearWaitingCustomers(); createCustomer();
if (!game.logisticsMissions.length) {
    assert.equal(createManualLogisticsMission(liveCourier.id, liveDepot.id, liveSeller.id, 'Produit A', 2).success, true);
}
// Argent déjà transporté : il n'appartient pas encore à la trésorerie.
liveCourier.money = 37; liveDepot.money = 23;
const stock = getNetworkStock().total, cash = game.money, revenue = game.dailyRevenue;
const positions = serializeState(customers.map(c => ({ x: c.x, y: c.y })));
game.dayElapsed = game.dayDuration;
endDay();
assert.equal(game.phase, DAY_PHASE.REPLI); assert.equal(game.clock.speed, 1);
assert.equal(game.money, cash); assert.equal(liveDepot.money, 23);
assert.deepEqual(serializeState(customers.map(c => ({ x: c.x, y: c.y }))), positions);
assert.equal(createCustomer(), null); assert.equal(setSimulationSpeed(2), false);
assert.equal(finishRetreat(), false); assert.ok(document.getElementById('endDayOverlay').classList.contains('hidden'));
assert.equal(createManualLogisticsMission(liveCourier.id, liveDepot.id, liveSeller.id, 'Produit A', 1).success, false);
activateEvent('SUPPLIER_DISCOUNT', 25);
assert.equal(saveGame(), true); assert.equal(loadGame(), true); assert.equal(game.phase, DAY_PHASE.REPLI);
toggleSimulationPause(); const frozen = JSON.stringify(serializeState({ game, customers, police })); updateSimulation(5);
assert.equal(JSON.stringify(serializeState({ game, customers, police })), frozen); toggleSimulationPause();
for (let i = 0; i < 3000 && game.dayActive; i++) updateSimulation(.1);
assert.equal(game.phase, DAY_PHASE.BILAN); assert.equal(game.clock.paused, true);
assert.equal(game.dailyRevenue, revenue); assert.ok(game.dailyLocalReceipts >= 60);
assert.equal(game.money, cash + game.dailyLocalReceipts - game.dailySalaries);
assert.equal(getNetworkStock().total, stock); assert.equal(customers.length, 0);
assert.equal(game.apartments[0].money, 0);
const balance = game.money, report = JSON.stringify(game.lastDailyReport);
finishRetreat(); recoverLocalReceipts(); payDailySalaries(); assert.equal(game.money, balance);
updateSimulation(100); assert.equal(JSON.stringify(game.lastDailyReport), report);
assert.equal(saveGame(), true); assert.equal(loadGame(), true); assert.equal(game.phase, DAY_PHASE.BILAN);
const employeeIds = game.employees.map(e => e.id).join(',');
nextDay(); assert.equal(game.phase, DAY_PHASE.PREPARATION); assert.equal(game.day, 2);
assert.equal(game.money, balance); assert.equal(getNetworkStock().total, stock); assert.equal(game.employees.map(e => e.id).join(','), employeeIds);
nextDay(); assert.equal(game.day, 2);
startDay(); assert.equal(game.phase, DAY_PHASE.ACTIVITE); assert.equal(game.dayElapsed, 0);
// Frontière automatique ACTIVITE -> REPLI, puis migration et refus atomique.
activateEvent("SUPPLIER_DISCOUNT", 5);
game.dayElapsed = game.dayDuration - .05; updateSimulation(.1);
assert.equal(game.phase, DAY_PHASE.REPLI); assert.equal(game.dayElapsed, 720);
const snapshot = createSaveSnapshot(); const invalid = serializeState(snapshot); invalid.game.clock.speed = 4;
assert.throws(() => restoreSaveSnapshot(invalid)); assert.equal(game.phase, DAY_PHASE.REPLI);
const legacy = serializeState(snapshot); legacy.version = 2; delete legacy.game.phase; delete legacy.game.clock; delete legacy.game.retreat;
legacy.game.dayDuration = 180; legacy.game.dayElapsed = 90;
restoreSaveSnapshot(legacy); assert.equal(game.phase, DAY_PHASE.ACTIVITE); assert.equal(game.dayDuration, 720); assert.equal(game.dayElapsed, 360);
// Contrôles tactiles présents hors de la carte transformée.
assert.equal(document.getElementById('dayUI').parentNode.id, 'game');
for (const id of ['pauseTime', 'speedOne', 'speedTwo']) assert.equal(window.getComputedStyle(document.getElementById(id)).minHeight, '44px');
