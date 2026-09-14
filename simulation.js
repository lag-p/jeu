// Raster walking is measured in master pixels, independently of zoom and axis.
// Existing role/upgrade ratios are preserved. 9 units/s -> 19.19 pixels/s.
function simulationWalkingSpeed(baseSpeed) { return baseSpeed * (isRasterMap() ? .25 : 1); }
// Entrée unique en secondes réelles. La vitesse s'applique une seule fois.
// Les petits pas bornent les transitions et les risques même à vitesse ×2.
function updateSimulation(realDelta) {
    if (!Number.isFinite(realDelta) || realDelta <= 0) return;
    enforceTimeConstraints();
    if (!game.dayActive || game.clock.paused) return;
    let remaining = realDelta;
    while (remaining > 1e-9 && game.dayActive && !game.clock.paused) {
        enforceTimeConstraints();
        const speed = game.clock.speed;
        let step = Math.min(TIME_CONFIG.stepSeconds, remaining * speed);
        if (isTrading()) step = Math.min(step, game.dayDuration - game.dayElapsed);
        if (step > 1e-9) {
            remaining = Math.max(0, remaining - step / speed);
            game.clock.elapsed += step;
            if (isTrading()) updateDayTimer(step);
            // À minuit, aucune nouvelle vente ni arrivée sur le dernier pas.
            if (isTrading() && game.dayElapsed >= game.dayDuration - 1e-9) {
                game.dayElapsed = game.dayDuration;
                beginRetreat("midnight");
            }
            if (isTrading()) updateCustomerSpawning(step);
            updateEventsRealtime(step);
            updateEmployeePhysicalRealtime(step);
            updateCustomersRealtime(step);
            updateLogisticsRealtime(step);
            if (isTrading()) updateEmployeesRealtime(step);
            updateMapRealtime(step);
            updatePoliceRealtime(step);
        } else if (isTrading()) beginRetreat("midnight");
        enforceTimeConstraints();
        if (game.phase === DAY_PHASE.REPLI) finishRetreat();
    }
}
