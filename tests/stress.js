newGame();
game.money = 5000; game.playerPlaced = true;
for (let i = 0; i < 2; i++) {
    const depot = createApartment('depot', 50 + i * 6, 50); depot.inventory['Produit A'] = 60; depot.rent = 5;
    const manager = createEmployee('gerant', 50, 50), seller = createEmployee('vendeur', 50 + i * 6, 50), courier = createEmployee('ravitailleur', 50, 50);
    for (const e of [manager, seller, courier]) { e.state = 'en poste'; game.employees.push(e); createEmployeeVisual(e); }
    createSalesPoint(seller, seller.x, seller.y);
    assert.equal(configureTeam({ id: 'stress-' + i, name: 'Équipe ' + i, managerId: manager.id, sellerIds: [seller.id], courierIds: [courier.id], watcherIds: [], apartmentIds: [depot.id] }), true);
}
const allCash = () => game.money + game.employees.reduce((s,e)=>s+e.money,0) + game.apartments.reduce((s,a)=>s+a.money,0);
const initialStock = getNetworkStock().total, initialMoney = allCash();
let unitsSold = 0, stockLost = 0, revenue = 0, expenses = 0;
for (let day = 0; day < 3; day++) {
    startDay();
    let frames = 0;
    while (game.dayActive && frames++ < 1900) {
        const beforeUnits = Object.values(game.dailyProductSales).reduce((s,q)=>s+q,0), beforeLost = game.dailyLostStock || 0, beforeRevenue = game.dailyRevenue, beforeExpenses = game.dailyExpenses;
        const c = getQueue(PLAYER_SELLER_ID)[0]; if (c?.state === 'WAITING') resolveSale(c);
        updateSimulation(.1);
        if (frames % 10 === 0) renderGameFrame(1);
        unitsSold += Object.values(game.dailyProductSales).reduce((s,q)=>s+q,0) - beforeUnits;
        stockLost += (game.dailyLostStock || 0) - beforeLost;
        revenue += game.dailyRevenue - beforeRevenue; expenses += game.dailyExpenses - beforeExpenses;
        assert.equal(getNetworkStock().total + unitsSold + stockLost, initialStock);
        assert.equal(allCash(), initialMoney + revenue - expenses);
        assert.equal(new Set(game.logisticsMissions.map(m=>m.courierId)).size, game.logisticsMissions.length);
        assert.equal(new Set(customers.map(c=>c.id)).size, customers.length);
        for (const e of [...game.employees, ...customers, ...police.patrols]) assert.ok(isWalkable(e));
        for (const mission of game.logisticsMissions) if (!mission.manual) {
            const team = getTeamForMember(mission.courierId);
            assert.ok(team.sellerIds.includes(mission.sellerId)); assert.ok(team.apartmentIds.includes(mission.apartmentId));
        }
        if (frames % 300 === 0 && game.dayActive) { assert.equal(saveGame(), true); assert.equal(loadGame(), true); }
    }
    assert.equal(game.dayActive, false); assert.ok(frames < 1900); assert.ok(game.lastDailyReport);
    if (day < 2) nextDay();
}
assert.ok(revenue > 0); assert.ok(unitsSold > 0); assert.equal(game.history.length, 3);
renderManagementPanel(); renderEmployeesForStress();
function renderEmployeesForStress() { for (const e of game.employees) renderEmployeeDetails(e); }
