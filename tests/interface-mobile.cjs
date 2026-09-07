const assert = require('node:assert/strict');
module.exports = async function testInterface(page, width) {
    await page.evaluate(() => {
        clearWaitingCustomers(); game.clock.paused = false;
        window.uiCustomers = [createCustomer(), createCustomer()]; game.clock.paused = true;
    });
    for (const index of [0,1,0,1]) {
        const patience = await page.evaluate(i => { selectCustomer(window.uiCustomers[i]); return selectedCustomer.patience; },index);
        await page.locator('#closeCustomer').tap();
        assert.equal(await page.evaluate(i => selectedCustomer === null && customers.includes(window.uiCustomers[i]) && window.uiCustomers[i].patience, index),patience);
    }
    await page.evaluate(() => { selectCustomer(window.uiCustomers[0]); startCustomerLeaving(selectedCustomer); });
    assert.equal(await page.locator('#customerPanel').isVisible(),false);
    assert.equal(await page.locator('#serveButton').isDisabled(),true);
    await page.evaluate(() => {
        const depot = createApartment('depot',50,50); depot.name = 'AppartementTrèsLongSansEspaces'.repeat(5);
        const manager = createEmployee('gerant',50,50); manager.name = 'ResponsableTrèsLongSansEspaces'.repeat(5); game.employees.push(manager);
        const seller = createEmployee('vendeur',50,50); seller.name = 'EmployéTrèsLongSansEspaces'.repeat(5); game.employees.push(seller);
        window.uiEmployee = {id:seller.id,apartmentId:depot.id,managerId:manager.id}; selectEmployee(seller);
    });
    await page.locator('[data-employee-detail] summary').tap();
    for (const field of ['apartmentId','managerId','salesMode','logisticsAutomation','alertProtocol']) {
        const input = page.locator(`[data-field="${field}"]`);
        await input.scrollIntoViewIfNeeded();
        await input.focus();
        const before = await page.locator('#employeesList').evaluate(e=>e.scrollTop);
        const value = await page.evaluate(f => window.uiEmployee[f] || ({salesMode:'cachette',logisticsAutomation:'false',alertProtocol:'mise-en-securite'})[f],field);
        await input.selectOption(value);
        assert.equal(await input.inputValue(),value);
        assert.equal(await page.locator('[data-employee-detail] details').evaluate(e=>e.open),true);
        assert.ok(Math.abs(await page.locator('#employeesList').evaluate(e=>e.scrollTop)-before)<=1, field + ': scroll changed from '+before+' to '+await page.locator('#employeesList').evaluate(e=>e.scrollTop));
        assert.equal(await page.evaluate(()=>selectedEmployeeId===window.uiEmployee.id),true);
    }
    for (const name of ['employees','stock','logistics','management','police']) {
        await page.locator('#'+name+'Button').tap();
        assert.equal(await page.locator('.sidePanel.visible').count(),1);
        const panel=page.locator('#'+name+'Panel');
        if(name==='employees') await page.locator('[data-employee-detail] details').evaluate(e=>e.open=true);
        if(name==='management') await panel.locator('details').evaluateAll(items=>items.forEach(e=>e.open=true));
        const check = await panel.evaluate(panel => {
            const body=panel.lastElementChild, nav=document.getElementById('bottomMenu').getBoundingClientRect();
            const overflow=[panel,body,...panel.querySelectorAll('input,select,button,.employeeCard')].filter(e=>e.scrollWidth>e.clientWidth+1 && !['SELECT','INPUT'].includes(e.tagName)).map(e=>e.id||e.className);
            body.scrollTop=body.scrollHeight;
            const controls=[...body.querySelectorAll('button,input,select')].filter(e=>e.checkVisibility());
            const last=controls.at(-1);
            last?.scrollIntoView({block:'nearest'});
            const lastBox=last?.getBoundingClientRect();
            const hit=lastBox && document.elementFromPoint(lastBox.x+lastBox.width/2,lastBox.y+lastBox.height/2);
            const lastAccessible=!last || hit===last || last.contains(hit);
            const wide=[...panel.querySelectorAll('input,select,button')].filter(e=>e.checkVisibility()).some(e=>{ const r=e.getBoundingClientRect(); return r.left<0 || r.right>innerWidth; });
            const header=panel.querySelector('.panelHeader').getBoundingClientRect(), box=panel.getBoundingClientRect();
            return {overflow,lastAccessible,wide,lastBottom:last?.getBoundingClientRect().bottom||0,navTop:nav.top,headerTop:header.top,headerBottom:header.bottom,top:box.top,bottom:box.bottom,pageOverflow:document.documentElement.scrollWidth>innerWidth};
        });
        assert.deepEqual(check.overflow,[],`${name}: horizontal overflow`);
        assert.equal(check.wide,false); assert.equal(check.lastAccessible,true,name+": last control covered");
        assert.equal(check.pageOverflow,false); assert.ok(check.lastBottom<=check.navTop+1, name+": "+JSON.stringify(check));
        assert.ok(check.headerTop>=check.top && check.headerBottom<=check.bottom);
        const close=panel.locator('.panelHeader button').last(), rect=await close.boundingBox();
        assert.ok(rect.width>=44 && rect.height>=44 && rect.x>=0 && rect.x+rect.width<=width);
        if (['stock','employees'].includes(name)) await page.screenshot({path:`/tmp/jeu-interface-${name}-${width}.png`});
        await close.tap(); assert.equal(await panel.isVisible(),false);
    }
    // Insets synthétiques : le gestionnaire suit les dimensions réelles du HUD/nav.
    const insets = await page.addStyleTag({content:'#game { padding-top: 24px; } #bottomMenu { height: 106px; padding-bottom: 39px; }'});
    await page.locator('#stockButton').tap();
    await page.waitForFunction(() => {
        const panel=document.getElementById('stockPanel').getBoundingClientRect();
        const nav=document.getElementById('bottomMenu').getBoundingClientRect();
        const hud=document.getElementById('dayUI').getBoundingClientRect();
        return panel.bottom<=nav.top+1 && panel.top>=hud.bottom;
    }, null, {timeout: 3000}).catch(async error => {
        console.error(await page.evaluate(()=>Object.fromEntries(['stockPanel','dayUI','bottomMenu'].map(id=>[id,document.getElementById(id).getBoundingClientRect().toJSON()]))));
        throw error;
    });
    await page.locator('#closeStock').tap();
    await insets.evaluate(e=>e.remove());
    await page.evaluate(()=>{ clearWaitingCustomers(); });
};
