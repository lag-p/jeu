// Cycle métier : le rendu et requestAnimationFrame restent dans game.js.
// dayActive reste vrai pendant le repli pour imputer ses frais au bon jour.
function isTrading() { return game.phase === DAY_PHASE.ACTIVITE; }
function canMakeSale() { return isTrading() && !game.clock.paused; }
function getAccelerationBlockReason() {
    if (police.activeOperation || police.plannedOperation?.phase === "PREPARING" || police.alerts.some(alert => alert.danger >= 3)) {
        return "Intervention policière : vitesse ×1 imposée. Pause disponible.";
    }
    return game.phase === DAY_PHASE.REPLI ? "Repli : retours à vitesse ×1. Pause disponible." : "";
}
function enforceTimeConstraints() {
    if (getAccelerationBlockReason()) game.clock.speed = 1;
}
function setSimulationSpeed(speed) {
    if (!game.dayActive || !TIME_CONFIG.speeds.includes(speed) || speed !== 1 && getAccelerationBlockReason()) return false;
    game.clock.speed = speed;
    updateDayUI();
    return true;
}
function toggleSimulationPause() {
    if (!game.dayActive && !(game.phase === DAY_PHASE.PREPARATION && game.employees.some(e => e.deploymentConfirmed))) return false;
    game.clock.paused = !game.clock.paused;
    enforceTimeConstraints();
    updateDayUI();
    return true;
}
function beginRetreat(reason = "manual") {
    if (!isTrading()) return false;
    game.phase = DAY_PHASE.REPLI;
    game.clock.speed = 1;
    game.retreat = { reason, startedAt: game.clock.elapsed };
    stopCustomerSpawning();
    customers.slice().forEach(customer => startCustomerLeaving(customer, "closing"));
    // On ne crée plus de livraisons. Les porteurs rentrent dans leur vrai dépôt.
    game.logisticsRequests = game.logisticsRequests.filter(request => request.status === "ASSIGNED");
    game.logisticsMissions.forEach(mission => {
        mission.cancelled = true;
        mission.stage = "RETURNING";
        mission.stageElapsed = 0;
        const courier = getEmployeeById(mission.courierId);
        if (courier) {
            const home = getEmployeeHome(courier);
            mission.returnApartmentId = home?.id || mission.apartmentId;
            setEmployeeOperation(courier, EMPLOYEE_OPERATION.RETREAT_ORDERED, "Mission annulée : retour sûr.");
        }
    });
    beginEmployeeRetreat();
    // Les modificateurs de journée cessent à la fermeture ; les événements
    // temporisés indépendants et les interventions continuent jusqu'à résolution.
    (game.events || []).filter(event => event.dayScoped).forEach(finishEvent);
    updateDayUI();
    return true;
}
// Interface extensible : un futur trajet de retour ajoute son propre bloqueur.
// Les employés sans trajet réel restent à leur position, inventaire conservé.
function getRetreatBlockers() {
    return {
        customers: customers.length,
        missions: game.logisticsMissions.length,
        employees: getPhysicalRetreatBlockers(),
        movements: game.employees.filter(e => e.active && (e.policeRetreat || e.pendingSalesPointId || e.operationalState === EMPLOYEE_OPERATION.MANUAL_ORDER) && e.destination).length,
        patrols: police.patrols.length,
        alerts: police.alerts.length,
        operations: Number(Boolean(police.activeOperation || police.plannedOperation)),
        events: (game.events || []).length
    };
}
function recoverLocalReceipts() {
    if (game.phase !== DAY_PHASE.REPLI || game.localReceiptsRecoveredDay === game.day) return;
    let amount = 0;
    game.apartments.forEach(apartment => {
        const cash = apartment.money;
        if (cash > 0 && transferMoney(apartment, game, cash)) amount += cash;
    });
    const fallback = ensurePersonalFallback();
    const fallbackCash = fallback.money;
    recoverPersonalFallbackReceipts();
    amount += fallbackCash;
    game.dailyLocalReceipts = amount;
    game.localReceiptsRecoveredDay = game.day;
    // Les ventes sont déjà comptées dans dailyRevenue : aucun deuxième CA.
}
function calculateDailyReport() {
    settleDailyEconomy();
    Object.assign(game.lastDailyReport, {
        localReceipts: game.dailyLocalReceipts,
        salaries: game.dailySalaries,
        stockStart: game.dailyStartStock ?? null,
        stockEnd: getNetworkStock().total,
        satisfaction: game.satisfaction,
        incidents: game.dailyIncidents,
        unavailableEmployees: game.employees.filter(e => !e.active).map(e => e.id)
    });
}
function finishRetreat() {
    if (game.clock.paused || game.phase !== DAY_PHASE.REPLI || Object.values(getRetreatBlockers()).some(Boolean)) return false;
    recoverLocalReceipts();
    payDailySalaries();
    calculateDailyReport();
    game.phase = DAY_PHASE.BILAN;
    game.dayActive = false;
    game.clock.paused = true;
    updateUI();
    renderDailySummary();
    saveGame();
    return true;
}
function prepareNextDay() {
    game.phase = DAY_PHASE.PREPARATION;
    game.clock.paused = true;
    game.clock.speed = 1;
    game.retreat = { reason: null };
    employeeSimulationElapsed = 0;
    if (typeof applyPendingTeams === "function") applyPendingTeams();
}
