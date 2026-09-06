// npm install --prefix /tmp/jeu-validation jsdom
// node tests/regression.cjs ; le DOM et les timers sont isolés du navigateur.
const { JSDOM } = require(process.env.JEU_JSDOM || '/tmp/jeu-validation/node_modules/jsdom');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
const context = dom.getInternalVMContext();
const stylesheet = dom.window.document.createElement('style'); stylesheet.textContent = fs.readFileSync(path.join(root, 'styles.css'), 'utf8'); dom.window.document.head.appendChild(stylesheet);
let time = 1000;
dom.window.requestAnimationFrame = () => 1;
dom.window.setTimeout = () => 1;
dom.window.clearTimeout = () => {};
Object.defineProperty(dom.window.performance, 'now', { value: () => time });
// Graine reproductible : les aléas de journée ne rendent pas les assertions intermittentes.
let seed = 42;
dom.window.Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
for (const [, file] of html.matchAll(/<script src="([^"]+)"/g)) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
context.assert = assert;
context.advanceClock = seconds => { time += seconds * 1000; };
function run(name, source) {
    vm.runInContext(`(() => { ${source} })()`, context, { filename: name });
    console.log('PASS', name);
}
run('nouvelle partie, placement, arrivée et file joueur', `
    assert.equal(game.day, 1); assert.equal(game.employees.length, 0);
    finishStartPointPlacement(50, 50); assert.equal(game.dayActive, true);
    assert.ok(customers.length > 0);
    clearWaitingCustomers();
    const c = createCustomer(); Object.assign(c, { product: 'Produit A', quantity: 1, price: 12, budget: 20, x: 50, y: 53.2 });
    assert.equal(joinSellerQueue(c, getPlayerSeller()), true);
    updateCustomersRealtime(.1); assert.equal(c.state, 'WAITING');
`);
run('vente manuelle, stock HUD, rejet du double service et sortie', `
    const c = customers[0], money = game.money, stock = game.playerInventory['Produit A'];
    assert.equal(resolveSale(c).success, true);
    assert.equal(game.money, money + 12); assert.equal(game.playerInventory['Produit A'], stock - 1);
    assert.equal(resolveSale(c).success, false);
    assert.ok(document.getElementById('stock').textContent.includes('Produit A'));
    for (let i = 0; i < 1200 && customers.includes(c); i++) { advanceClock(.1); updateCustomersRealtime(.1); }
    assert.equal(customers.includes(c), false);
`);
run('budget refusé et patience expirée sans transaction', `
    const c = createCustomer(); Object.assign(c, { product: 'Produit A', quantity: 1, price: 12, budget: 0, x: 50, y: 53.2 });
    joinSellerQueue(c, getPlayerSeller()); updateCustomersRealtime(.1);
    const before = game.money; assert.equal(resolveSale(c).success, false); assert.equal(game.money, before);
    clearWaitingCustomers(); const waiting = createCustomer(); Object.assign(waiting, { product: 'Produit A', x: 50, y: 53.2 });
    joinSellerQueue(waiting, getPlayerSeller()); updateCustomersRealtime(.1); waiting.patience = .01;
    updateCustomersRealtime(.1); assert.equal(waiting.state, 'LEAVING'); clearWaitingCustomers();
`);
run('achat fournisseur, transfert aller retour, vendeur automatique', `
    game.money = 10000;
    const apartment = createApartment('depot', 50, 50);
    assert.equal(buyStock('Produit A', 30, apartment.id), true);
    assert.equal(buyStock('Produit A', -1, apartment.id), false);
    const holder = { inventory: game.playerInventory, capacity: Infinity };
    const total = getNetworkStock().total;
    assert.equal(transferInventory(holder, apartment, 'Produit B', 2), true);
    assert.equal(transferInventory(apartment, holder, 'Produit B', 2), true);
    assert.equal(getNetworkStock().total, total);
    const seller = createEmployee('vendeur', 50, 50); seller.state = 'en poste'; game.employees.push(seller); createSalesPoint(seller, 50, 50); createEmployeeVisual(seller);
    transferInventory(apartment, seller, 'Produit A', 5);
    const c = createCustomer(); Object.assign(c, { product: 'Produit A', quantity: 1, price: 12, budget: 20, x: 50, y: 53.2 });
    joinSellerQueue(c, seller); updateCustomersRealtime(.1); updateEmployeesRealtime(1);
    assert.equal(c.saleResolved, true); assert.equal(seller.money, 12); assert.equal(seller.inventory['Produit A'], 4); clearWaitingCustomers();
`);
run('gérant, ravitailleurs parallèles, collecte et dépôt conservatifs', `
    const apartment = game.apartments[0]; apartment.inventory['Produit A'] = 60;
    const manager = createEmployee('gerant', 50, 50); manager.state = 'en poste'; game.employees.push(manager);
    const seller1 = game.employees.find(e => e.role === 'vendeur'); seller1.inventory['Produit A'] = 0;
    const seller2 = createEmployee('vendeur', 52, 50); seller2.state = 'en poste'; game.employees.push(seller2); createSalesPoint(seller2, 52, 50);
    for (const seller of [seller1, seller2]) { seller.assignment.managerId = manager.id; seller.money = 180; }
    for (let i = 0; i < 2; i++) { const c = createEmployee('ravitailleur', 50, 50); c.state = 'en poste'; c.assignment.managerId = manager.id; game.employees.push(c); }
    const stock = getNetworkStock().total;
    const cash = () => game.money + game.employees.reduce((s,e)=>s+e.money,0) + game.apartments.reduce((s,a)=>s+a.money,0);
    const before = cash(); manageNetwork(); assert.ok(game.logisticsRequests.length >= 2); assignLogisticsRequests(); assert.equal(game.logisticsMissions.length, 2);
    assert.equal(new Set(game.logisticsMissions.map(m=>m.courierId)).size, 2);
    for (let i = 0; i < 1600 && game.logisticsMissions.length; i++) { advanceClock(.1); updateLogisticsRealtime(.1); }
    assert.equal(game.logisticsMissions.length, 0); assert.equal(getNetworkStock().total, stock); assert.equal(cash(), before);
    assert.ok(apartment.money >= 360); assert.ok(seller1.inventory['Produit A'] > 0); assert.ok(seller2.inventory['Produit A'] > 0);
`);
run('police mobile, panneaux, chrono, fin et deuxième journée', `
    createPatrol(); const patrol = police.patrols.at(-1), before = [patrol.x, patrol.y]; updatePatrols(1);
    assert.ok(patrol.x !== before[0] || patrol.y !== before[1]);
    renderManagementPanel(); updateEmployeesPanel(); renderLogisticsPanel(); renderPolicePanel(); updateStockPurchasePanel();
    for (const e of game.employees) renderEmployeeDetails(e);
    updateDayTimer(10); assert.ok(game.dayElapsed >= 10); endDay(); assert.equal(game.dayActive, false);
    assert.ok(!document.getElementById('endDayOverlay').classList.contains('hidden'));
    nextDay(); assert.equal(game.day, 2); startDay(); assert.equal(game.dayActive, true); assert.equal(game.dayElapsed, 0); assert.ok(customers.length > 0);
`);
// Chaque phase ajoute ses scénarios ciblés sans remplacer ce parcours historique.
const additions = path.join(__dirname, 'phases.js');
if (fs.existsSync(additions)) run('scénarios des phases', fs.readFileSync(additions, 'utf8'));
const stress = path.join(__dirname, 'stress.js');
if (fs.existsSync(stress)) run('trois journées et conservation', fs.readFileSync(stress, 'utf8'));
const edges = path.join(__dirname, 'edge-cases.js');
if (fs.existsSync(edges)) run('réservations, interruption et opérations', fs.readFileSync(edges, 'utf8'));
dom.window.close();
