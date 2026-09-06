// Ordre unique des systèmes. Aucun système ne planifie sa propre animation.
function updateSimulation(delta) {
    if (!game.dayActive || !Number.isFinite(delta) || delta <= 0) return;
    const step = Math.min(delta, Math.max(0, game.dayDuration - game.dayElapsed));
    updateDayTimer(step);
    updateCustomerSpawning(step);
    updateEventsRealtime(step);
    updateCustomersRealtime(step);
    updateLogisticsRealtime(step);
    updateEmployeesRealtime(step);
    updateMapRealtime(step);
    updatePoliceRealtime(step);
    if (game.dayElapsed >= game.dayDuration) endDay();
}
