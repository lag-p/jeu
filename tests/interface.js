newGame(); finishStartPointPlacement(50, 50); clearWaitingCustomers();
for (const paused of [false, true]) {
    game.clock.paused = false;
    const c = createCustomer(), other = createCustomer();
    game.clock.paused = paused;
    for (const customer of [c, other, c, other]) {
        const patience = customer.patience;
        selectCustomer(customer);
        assert.equal(selectedCustomer, customer);
        document.getElementById('closeCustomer').click();
        assert.equal(selectedCustomer, null);
        assert.equal(customerPanel.style.display, 'none');
        assert.equal(customer.patience, patience);
        assert.ok(customers.includes(customer));
    }
    selectCustomer(c); startCustomerLeaving(c);
    assert.equal(selectedCustomer, null); assert.equal(serveButton.disabled, true);
    selectCustomer(c); assert.equal(customerPanel.style.display, 'none');
    selectCustomer(other); removeCustomer(other);
    assert.equal(selectedCustomer, null);
    const money = game.money, stock = getNetworkStock().total;
    assert.equal(resolveSale(other).success, false);
    assert.equal(game.money, money); assert.equal(getNetworkStock().total, stock);
}
game.clock.paused = false; clearWaitingCustomers();
const c = createCustomer();
Object.assign(c, {product:'Produit A', quantity:1, price:12, budget:20, x:50, y:53.2});
joinSellerQueue(c, getPlayerSeller()); updateCustomersRealtime(.1); selectCustomer(c);
serveButton.click(); assert.equal(c.saleResolved,true); assert.equal(selectedCustomer,null);
const impatient = createCustomer();
Object.assign(impatient, {product:'Produit A', quantity:1, price:12, budget:20, x:50, y:53.2});
joinSellerQueue(impatient, getPlayerSeller()); updateCustomersRealtime(.1); selectCustomer(impatient);
impatient.patience = .01; updateCustomersRealtime(.1);
assert.equal(impatient.state,'LEAVING'); assert.equal(selectedCustomer,null);
const stale = createCustomer(); selectCustomer(stale); customers.splice(customers.indexOf(stale),1);
updateDayUI(); assert.equal(selectedCustomer,null); assert.equal(serveButton.disabled,true);
assert.equal(resolveSale(stale).reason,'customer-left'); stale.element.remove();
const depot = createApartment('depot',50,50), manager = createEmployee('gerant',50,50);
game.employees.push(manager);
for (const role of ['vendeur','ravitailleur','guetteur','gerant']) {
    const employee = createEmployee(role,50,50); game.employees.push(employee);
    selectEmployee(employee);
    const section = employeesList.querySelector('[data-employee-detail] details'); section.open = true;
    for (const [field,value] of [['apartmentId',depot.id],['managerId',manager.id],['salesMode','cachette'],['restockThreshold','7'],['targetStock','12'],['logisticsAutomation','false'],['alertProtocol','mise-en-securite']]) {
        const input = employeesList.querySelector(`[data-field="${field}"]`); if (!input) continue;
        input.focus(); input.value = value; input.dispatchEvent(new Event('change',{bubbles:true}));
        assert.ok(input.isConnected); assert.ok(section.open); assert.equal(document.activeElement,input);
        assert.equal(selectedEmployeeId,employee.id); assert.equal(interfaceState.activePanel,'employeesPanel');
        assert.equal(employeesList.querySelector('.employeeDetails p').textContent, `Rôle : ${employee.role} · État : ${employee.state}`);
        assert.equal(String(['apartmentId','managerId'].includes(field)?employee.assignment[field]:employee[field]),value);
    }
    const toggle = employeesList.querySelector('.employeeProductToggle');
    if (toggle) { toggle.checked = false; toggle.dispatchEvent(new Event('change',{bubbles:true})); assert.ok(toggle.isConnected); assert.ok(!employee.allowedProducts.includes(toggle.value)); }
    employee.currentMissionId='blocked';
    const apartment = employeesList.querySelector('[data-field="apartmentId"]'); apartment.value=''; apartment.dispatchEvent(new Event('change',{bubbles:true}));
    assert.equal(apartment.value,depot.id); assert.ok(section.open); employee.currentMissionId=null;
    backMainPanel(); assert.equal(section.open,false); assert.equal(selectedEmployeeId,employee.id);
    backMainPanel(); assert.equal(selectedEmployeeId,null); assert.equal(interfaceState.activePanel,'employeesPanel');
}
for (const id of ['stock','police','logistics','management','employees']) {
    document.getElementById(id+'Button').click();
    assert.equal(document.querySelectorAll('.sidePanel.visible').length,1);
}
updateStockPurchasePanel();
const supplier = stockPurchaseList.querySelector('#supplierChoice'), quantity = stockPurchaseList.querySelector('.stockQuantity');
quantity.value='3'; supplier.dispatchEvent(new Event('change',{bubbles:true}));
assert.ok(quantity.isConnected); assert.equal(quantity.value,'3');
closeMainPanel(); clearWaitingCustomers();

openMainPanel('managementPanel'); renderManagementPanel();
const audioSection = document.querySelector('#audioEnabled').closest('details'); audioSection.open = true;
renderManagementPanel(); assert.equal(document.querySelector('#audioEnabled').closest('details').open,true);
document.getElementById('manageTeams').click(); assert.equal(interfaceState.activePanel,'employeesPanel');
backMainPanel(); assert.equal(interfaceState.activePanel,'managementPanel');
closeMainPanel();
