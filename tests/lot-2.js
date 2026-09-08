// Lot 2 : états physiques, déplacements déterministes, repli et migration.
newGame();
game.money = 5000; game.playerPlaced = true;
const homeA = createApartment('depot', 20, 20), homeB = createApartment('depot', 80, 74);
homeA.inventory['Produit A'] = 20;
const manager2 = createEmployee('gerant', 80, 74), seller2 = createEmployee('vendeur', 78, 30), watcher2 = createEmployee('guetteur', 77, 31), courier2 = createEmployee('ravitailleur', 80, 74);
for (const employee of [manager2, seller2, watcher2, courier2]) { employee.assignment.apartmentId = homeA.id; employee.assignment.manual = true; game.employees.push(employee); }
seller2.assignment.managerId = manager2.id; watcher2.assignment.managerId = manager2.id; courier2.assignment.managerId = manager2.id;
seller2.allowedProducts = ['Produit A']; createSalesPoint(seller2, 76, 30);
assert.equal(configureTeam({ id: 'lot2-team', name: 'Physique', managerId: manager2.id, sellerIds: [seller2.id], courierIds: [courier2.id], watcherIds: [watcher2.id], apartmentIds: [homeA.id] }), true);

startDay();
assert.equal(seller2.operationalState, EMPLOYEE_OPERATION.OUTBOUND);
assert.notEqual(seller2.state, 'en poste');
assert.ok(seller2.inventory['Produit A'] > 0, 'le chargement vient du rattachement');
assert.ok(seller2.navRoute.every(point => isWalkable(point)));
const pausedPosition = { x: seller2.x, y: seller2.y }; game.clock.paused = true; updateSimulation(2);
assert.deepEqual({ x: seller2.x, y: seller2.y }, pausedPosition); game.clock.paused = false;
for (let i = 0; i < 1200 && seller2.operationalState !== EMPLOYEE_OPERATION.AT_POST; i++) updateSimulation(.1);
assert.equal(seller2.operationalState, EMPLOYEE_OPERATION.AT_POST);
assert.equal(seller2.state, 'en poste');

const walkerOne = { x: 5, y: 20 }, walkerTwo = { x: 5, y: 20 };
for (let i = 0; i < 100; i++) moveMapEntity(walkerOne, { x: 33, y: 20 }, .1, 10);
for (let i = 0; i < 20; i++) moveMapEntity(walkerTwo, { x: 33, y: 20 }, .5, 10);
assert.ok(Math.abs(walkerOne.x - walkerTwo.x) < .0001 && Math.abs(walkerOne.y - walkerTwo.y) < .0001);
assert.equal(requestEmployeeAssignment(seller2, { apartmentId: homeB.id }), true);
assert.equal(seller2.assignment.apartmentId, homeA.id); assert.equal(seller2.assignment.pending.apartmentId, homeB.id);
const manual2 = createEmployee('vendeur', 20, 20); manual2.assignment = { apartmentId: homeA.id, managerId: null, manual: true, reason: '' }; game.employees.push(manual2);
assert.equal(applyAutomaticAssignment(manual2), false);

seller2.money = 31; const cashBeforeRetreat = homeA.money + seller2.money;
clearWaitingCustomers(); police.patrols = []; police.alerts = []; police.activeOperation = null; police.plannedOperation = null; game.events = [];
assert.equal(beginRetreat('manual'), true);
for (let i = 0; i < 2400 && game.dayActive; i++) updateSimulation(.1);
assert.equal(game.phase, DAY_PHASE.BILAN);
assert.equal(seller2.money, 0); assert.ok(game.dailyLocalReceipts >= cashBeforeRetreat);
assert.equal(seller2.operationalState, EMPLOYEE_OPERATION.DONE);

const legacy2 = createSaveSnapshot(); legacy2.version = 3; delete legacy2.game.personalFallback;
legacy2.game.employees.forEach(employee => { delete employee.operationalState; delete employee.navRoute; });
assert.equal(restoreSaveSnapshot(legacy2), true);
assert.ok(game.personalFallback && game.employees.every(employee => employee.operationalState));
