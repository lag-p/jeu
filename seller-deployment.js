// Chargement et déploiement des vendeurs recrutés. La simulation possède
// les positions ; choisir/valider une destination ne déplace aucune entité.
function sellerPreparationReason(seller) {
    if (!seller || seller.role !== 'vendeur' || !seller.active || !game.employees.includes(seller)) return 'Sélectionne un vendeur recruté.';
    if (game.phase !== DAY_PHASE.PREPARATION) return 'Disponible uniquement en préparation.';
    if (seller.currentMissionId || seller.policeRetreat || seller.pendingSalesPointId || seller.operationalWarning || seller.assignment?.pending) return 'Termine la mission ou régularise l’affectation.';
    if (seller.moving || ![EMPLOYEE_OPERATION.RESTING, EMPLOYEE_OPERATION.DONE].includes(seller.operationalState)) return 'Le vendeur doit être au repli.';
    const home = getEmployeeHome(seller);
    if (!home || mapDistance(seller, home) > .1) return 'Le vendeur doit rejoindre son rattachement.';
    if (seller.assignment.managerId && !getEmployeeById(seller.assignment.managerId)?.active) return 'Gérant indisponible.';
    if (seller.salesMode !== 'sacoche') return 'Choisis le mode sacoche pour charger le stock transporté.';
    return '';
}

function setSellerLoad(seller, quantities) {
    const reason = sellerPreparationReason(seller); if (reason) return { success: false, reason };
    const products = Object.keys(PRODUCT_CONFIG);
    if (!quantities || Object.keys(quantities).some(p => !products.includes(p)) || products.some(p => !Number.isSafeInteger(quantities[p]) || quantities[p] < 0)) return { success: false, reason: 'Quantités entières positives ou nulles requises.' };
    if (products.reduce((n,p) => n + quantities[p], 0) > seller.capacity) return { success: false, reason: 'Capacité de transport dépassée.' };
    if (products.some(p => quantities[p] - seller.inventory[p] > getAvailableProductStock(p))) return { success: false, reason: 'Stock stratégique insuffisant.' };
    // Valider toute la commande avant le premier transfert : pas de demi-charge.
    for (const p of products) { game.playerInventory[p] -= quantities[p] - seller.inventory[p]; seller.inventory[p] = quantities[p]; }
    seller.allowedProducts = products.filter(p => quantities[p] > 0);
    seller.loadPrepared = true;
    requestSave(); updateUI(); return { success: true };
}

function planSellerDeployment(seller, point) {
    const reason = sellerPreparationReason(seller); if (reason) return { success: false, reason };
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !isWalkable(point)) return { success: false, reason: 'Emplacement inaccessible.' };
    const route = findMapPath(seller, point);
    if (!route.length && mapDistance(seller, point) > .01) return { success: false, reason: 'Aucun trajet piéton vers cet emplacement.' };
    seller.plannedSalesPosition = { x: point.x, y: point.y }; requestSave(); return { success: true };
}

function confirmSellerDeployment(seller) {
    const result = planSellerDeployment(seller, seller?.plannedSalesPosition); if (!result.success) return result;
    if (!seller.loadPrepared || !getInventoryTotal(seller)) return { success: false, reason: 'Attribue du stock avant de déployer.' };
    const point = seller.plannedSalesPosition;
    const previous = getSalesPointForSeller(seller.id); if (previous) previous.active = false;
    const post = createSalesPoint(seller, point.x, point.y); post.active = false;
    seller.deploymentConfirmed = true; seller.assignment.salesPoint = { ...point };
    seller.destination = { x: post.x, y: post.y }; seller.navRoute = findMapPath(seller, post); seller.navKey = null;
    seller.moving = true; setEmployeeOperation(seller, EMPLOYEE_OPERATION.OUTBOUND);
    game.clock.paused = false;
    requestSave(); return { success: true };
}

function sellerDeploymentLabel(seller) {
    if (seller.operationalState === EMPLOYEE_OPERATION.OUTBOUND) return 'En trajet';
    if (seller.operationalState === EMPLOYEE_OPERATION.AT_POST) return !isTrading() ? 'Prêt au poste' : getSellerProductStockTotal(seller) ? 'Actif' : 'Sans stock · attente/ravitaillement';
    if (sellerPreparationReason(seller)) return employeeOperationLabel(seller);
    return seller.loadPrepared && getInventoryTotal(seller) ? 'Prêt à déployer' : 'À préparer';
}
function getSellerProductStockTotal(seller) { return Object.keys(PRODUCT_CONFIG).reduce((n,p) => n + getSellerProductStock(seller,p),0); }

function sellerDeploymentPanel(seller) {
    const panel = document.createElement('section'); panel.className = 'sellerPreparation';
    panel.dataset.deployment = seller.id;
    const reason = sellerPreparationReason(seller);
    panel.innerHTML = `<h3>Préparer le vendeur</h3><p>${sellerDeploymentLabel(seller)} · Transport ${getInventoryTotal(seller)}/${seller.capacity}</p><p>${reason || 'Saisis les quantités finales à transporter. Zéro restitue le produit au stock stratégique.'}</p>`;
    for (const p of Object.keys(PRODUCT_CONFIG)) {
        const label = document.createElement('label'); label.className = 'stockPurchaseLabel';
        label.textContent = `${p} · stratégique ${getAvailableProductStock(p)} · transporté ${seller.inventory[p]}`;
        const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = String(seller.capacity); input.step = '1'; input.value = seller.inventory[p]; input.dataset.loadProduct = p; input.disabled = Boolean(reason); label.appendChild(input); panel.appendChild(label);
    }
    for (const [action,text] of [['load','Attribuer / retirer du stock'],['position','Choisir l’emplacement'],['deploy','Confirmer le déploiement']]) {
        const button = document.createElement('button'); button.textContent = text; button.dataset.sellerPreparation = action; button.disabled = Boolean(reason); panel.appendChild(button);
    }
    const cancel = document.createElement('button'); cancel.textContent = 'Annuler le choix sur la carte'; cancel.dataset.sellerPreparation = 'cancel'; panel.appendChild(cancel);
    const position = document.createElement('p'); position.textContent = seller.plannedSalesPosition ? `Emplacement choisi : ${seller.plannedSalesPosition.x.toFixed(1)}, ${seller.plannedSalesPosition.y.toFixed(1)}` : 'Aucun emplacement choisi.'; panel.appendChild(position);
    return panel;
}

let sellerPositionSelection = null;
function chooseSellerPositionOnMap(point) {
    if (!sellerPositionSelection) return false;
    const seller = getEmployeeById(sellerPositionSelection), result = planSellerDeployment(seller, point);
    showMessage(result.success ? 'Emplacement choisi. Confirme le déploiement dans la fiche.' : result.reason);
    if (result.success) { sellerPositionSelection = null; selectEmployee(seller); }
    return true;
}
employeesList.addEventListener('click', event => {
    const action = event.target.dataset.sellerPreparation; if (!action) return;
    const panel = event.target.closest('[data-deployment]'), seller = getEmployeeById(panel.dataset.deployment);
    if (action === 'cancel') { sellerPositionSelection = null; showMessage('Choix annulé.'); return; }
    if (action === 'position') {
        const reason = sellerPreparationReason(seller); if (reason) return showMessage(reason);
        sellerPositionSelection = seller.id; closeMainPanel(); showMessage('Touche un emplacement accessible. Aucun déplacement avant confirmation.'); return;
    }
    const result = action === 'load' ? setSellerLoad(seller, Object.fromEntries([...panel.querySelectorAll('[data-load-product]')].map(input => [input.dataset.loadProduct, Number(input.value)]))) : confirmSellerDeployment(seller);
    showMessage(result.success ? action === 'load' ? 'Stock transporté mis à jour.' : 'Le vendeur rejoint son poste.' : result.reason); updateEmployeesPanel();
});

function refreshSellerDeploymentStatus() {
    document.querySelectorAll('[data-deployment]').forEach(panel => {
        const seller = getEmployeeById(panel.dataset.deployment); if (!seller) return;
        const paragraphs = panel.querySelectorAll('p');
        paragraphs[0].textContent = `${sellerDeploymentLabel(seller)} · Transport ${getInventoryTotal(seller)}/${seller.capacity}`;
        const reason = sellerPreparationReason(seller);
        paragraphs[1].textContent = reason || 'Saisis les quantités finales à transporter. Zéro restitue le produit au stock stratégique.';
        panel.querySelectorAll('[data-load-product], [data-seller-preparation]').forEach(input => {
            if (input.dataset.sellerPreparation !== 'cancel') input.disabled = Boolean(reason);
        });
    });
}
