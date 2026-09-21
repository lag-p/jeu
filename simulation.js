// Raster walking is measured in master pixels, independently of zoom and axis.
// Existing role/upgrade ratios are preserved. 9 units/s -> 19.19 pixels/s.
const WALKING_CONFIG=Object.freeze({pixelsPerWorldUnit:8.53,metresPerWorldUnit:1.4/2.25,baseWorldUnitsPerSecond:2.25,referenceRoleSpeed:9,stridePixels:18});
function simulationWalkingSpeed(baseSpeed) { return isRasterMap()?baseSpeed/WALKING_CONFIG.referenceRoleSpeed*WALKING_CONFIG.baseWorldUnitsPerSecond:baseSpeed; }
// Entrée unique en secondes réelles. La vitesse s'applique une seule fois.
// Les petits pas bornent les transitions et les risques même à vitesse ×2.
function updateSimulation(realDelta) {
    if (!Number.isFinite(realDelta) || realDelta <= 0) return;
    enforceTimeConstraints();
    if (game.clock.paused) return;
    if (game.phase === DAY_PHASE.PREPARATION) {
        let preparationDelta = realDelta;
        while (preparationDelta > 1e-9) {
            const step = Math.min(TIME_CONFIG.stepSeconds, preparationDelta);
            updateEmployeePhysicalRealtime(step); preparationDelta -= step;
        }
        return;
    }
    if (!game.dayActive) return;
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
