productNewGame("PONCETTE_INSPIRED_V1");
assert.equal(mapData.mapId, 'PONCETTE_INSPIRED_V1');
assert.equal(createSaveSnapshot().map.mapId, "PONCETTE_INSPIRED_V1");
assert.equal(SAVE_VERSION, 5);
const collections = ['buildings', 'roads', 'walls', 'transitions', 'entries', 'buildingEntries', 'apartmentSites', 'zones', 'strategicSalesSites', 'courts', 'sidewalks', 'crossings', 'openSpaces', 'parking', 'vegetation', 'obstacles', 'fallbackPoints', 'pointsOfInterest', 'logisticsPlaces'];
const ids = collections.flatMap(key => mapData[key].map(item => item.id));
assert.equal(new Set(ids).size, ids.length);
for (const key of collections) for (const item of mapData[key]) {
    if (item.polygon) {
        assert.ok(item.width > 0 && item.height > 0);
        assert.ok(item.polygon.every(p => pointInPolygon(p, mapData.perimeter)), item.id);
    } else assert.ok(isWalkable(item), item.id);
}
const routeValid = (from, to) => {
    const route = findMapPath(from, to); assert.ok(route.length, JSON.stringify({ from, to }));
    for (const next of route) { assert.ok(walkableSegment(from, next), 'segment sans obstacle'); from = next; }
    assert.ok(mapDistance(from, to) < 1e-8); return route;
};
for (const entry of mapData.entries) {
    assert.ok(entry.navNodeId);
    for (const zone of mapData.zones) routeValid(entry, zone);
}
for (const apartment of mapData.apartmentSites) {
    assert.equal(apartment.mapId, "PONCETTE_INSPIRED_V1"); assert.ok(apartment.navNodeId);
    assert.ok(mapData.buildingEntries.some(entry => entry.id === apartment.entryId));
    for (const post of mapData.strategicSalesSites) routeValid(apartment, post);
}
for (const edge of mapData.navigation.connections) assert.ok(walkableSegment(mapData.navigation.lookup.get(edge.from), mapData.navigation.lookup.get(edge.to)));
assert.equal(walkableSegment({ x: 25, y: 20 }, { x: 34, y: 20 }), false, 'barre');
assert.equal(walkableSegment({ x: 28, y: 58 }, { x: 28, y: 61 }), false, 'mur');
assert.equal(walkableSegment({ x: 25, y: 14 }, { x: 26, y: 13 }), false, 'angle fermé');
for (const transition of mapData.transitions) routeValid(transition.from, transition.to);
assert.deepEqual(findMapPath(mapData.entries[0], mapData.zones[1]), findMapPath(mapData.entries[0], mapData.zones[1]));
const walkerA = { ...mapData.entries[0] }, walkerB = { ...mapData.entries[0] }, destination = mapData.zones[1];
for (let i = 0; i < 100; i++) moveMapEntity(walkerA, destination, .1, 3);
for (let i = 0; i < 20; i++) moveMapEntity(walkerB, destination, .5, 3);
assert.ok(mapDistance(walkerA, walkerB) < 1e-8);

game.money = 5000; game.playerPlaced = true;
assert.equal(buyApartment('depot', mapData.apartmentSites[0].id), true);
const home = game.apartments[0]; home.id = '0'; game.activeApartmentId = '0';
assert.equal(buyStock('Produit A', 30, 0), true);
assert.equal(home.inventory['Produit A'], 30);
const team = ['vendeur', 'guetteur', 'gerant', 'ravitailleur'].map((role, i) => {
    const point = mapData.strategicSalesSites[i]; const e = createEmployee(role, point.x, point.y);
    e.assignment.apartmentId = home.id; e.assignment.manual = true; game.employees.push(e); createEmployeeVisual(e); return e;
});
const [seller, watcher, manager, courier] = team;
seller.assignment.managerId = manager.id; courier.assignment.managerId = manager.id;
createSalesPoint(seller, mapData.zones[1].x, mapData.zones[1].y);
seller.logisticsAutomation = false;
startDay(); clearWaitingCustomers();
assert.equal(seller.operationalState, EMPLOYEE_OPERATION.OUTBOUND);
const frozen = serializeState(game); game.clock.paused = true; const paused = serializeState(game); updateSimulation(2); assert.deepEqual(serializeState(game), paused);
game.clock.paused = false;
assert.equal(requestPlayerMovement({ x: 48, y: 52 }), true); updateSimulation(.1); assert.notEqual(game.playerX, frozen.playerX);
const transit = createSaveSnapshot(); const transitStock = getNetworkStock().total;
restoreSaveSnapshot(transit); assert.equal(getNetworkStock().total, transitStock);
assert.deepEqual(game.employees.map(e => [e.x, e.y]), transit.game.employees.map(e => [e.x, e.y]));
for (let i = 0; i < 500 && game.employees.some(e => e.operationalState === EMPLOYEE_OPERATION.OUTBOUND); i++) updateSimulation(.1);
for (const e of game.employees) assert.equal(e.operationalState, EMPLOYEE_OPERATION.AT_POST, e.role);
clearWaitingCustomers();
const liveSeller = getEmployeeById(seller.id), liveCourier = getEmployeeById(courier.id);
assert.equal(createManualLogisticsMission(liveCourier.id, '0', liveSeller.id, 'Produit A', 2).success, true);
const missionStock = getNetworkStock().total;
for (let i = 0; i < 2000 && game.logisticsMissions.length; i++) updateLogisticsRealtime(.1);
assert.equal(game.logisticsMissions.length, 0); assert.equal(getNetworkStock().total, missionStock);
const visitor = createCustomer(); assert.ok(mapData.entries.some(e => e.x === visitor.x && e.y === visitor.y));
startCustomerLeaving(visitor);
for (let i = 0; i < 2000 && customers.includes(visitor); i++) updateCustomersRealtime(.1);
assert.ok(!customers.includes(visitor));
const elapsed = game.dayElapsed; assert.equal(setSimulationSpeed(2), true); updateSimulation(1); assert.ok(Math.abs(game.dayElapsed - elapsed - 2) < 1e-6);
clearWaitingCustomers(); game.events = []; police.patrols.forEach(p => p.element?.remove()); police.patrols = []; police.alerts = []; police.activeOperation = null; police.plannedOperation = null;
liveSeller.money = 31;
beginRetreat('manual'); assert.equal(game.phase, DAY_PHASE.REPLI); assert.equal(finishRetreat(), false);
const retreat = createSaveSnapshot(), stock = getNetworkStock().total; restoreSaveSnapshot(retreat);
assert.equal(getNetworkStock().total, stock); assert.equal(game.phase, DAY_PHASE.REPLI);
for (let i = 0; i < 2000 && game.dayActive; i++) updateSimulation(.1);
assert.equal(game.phase, DAY_PHASE.BILAN); assert.ok(game.employees.every(e => e.operationalState === EMPLOYEE_OPERATION.DONE));
assert.equal(getNetworkStock().total, stock); assert.ok(game.dailyLocalReceipts >= 31);
const cash = game.money; finishRetreat(); recoverLocalReceipts(); assert.equal(game.money, cash);
const saved = createSaveSnapshot(); restoreSaveSnapshot(saved); assert.equal(game.money, cash); assert.equal(getNetworkStock().total, stock);
const bad = serializeState(saved); bad.map.mapId = 'unknown'; assert.throws(() => restoreSaveSnapshot(bad)); assert.equal(mapData.mapId, "PONCETTE_INSPIRED_V1");
productNewGame('LEGACY_TEST_MAP');
const legacy = createSaveSnapshot(); legacy.version = 4; delete legacy.map.mapId; delete legacy.map.schemaVersion;
restoreSaveSnapshot(legacy); assert.equal(mapData.mapId, 'LEGACY_TEST_MAP'); assert.equal(mapData.buildings.length, 8);
assert.equal(game.money, legacy.game.money); assert.deepEqual(serializeState(game.playerInventory), legacy.game.playerInventory);
productNewGame("PONCETTE_INSPIRED_V1"); assert.equal(mapData.mapId, "PONCETTE_INSPIRED_V1");
console.log('MAP', mapData.mapId, mapData.buildings.length, 'buildings', mapData.zones.length, 'zones', mapData.entries.length, 'entries', mapData.apartmentSites.length, 'homes', mapData.navigation.nodes.length, 'nodes', mapData.navigation.connections.length, 'edges');
