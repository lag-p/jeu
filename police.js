// ===============================
// ACTIVITE POLICIERE (MECANIQUE DE JEU)
// ===============================

const police = {
    level: "CALM",
    globalSuspicion: 0,
    attention: 0.2,
    dayProfile: "NORMAL",
    zoneKnowledge: {},
    pointKnowledge: {},
    observations: [],
    patrols: [],
    alerts: [],
    plannedOperation: null,
    activeOperation: null,
    lastOperation: null,
    tick: 0
};

const policePanel = document.getElementById("policePanel");
const policeContent = document.getElementById("policeContent");


function policeLabel(value) {
    if (value < 20) return "Faible";
    if (value < 45) return "Modéré";
    if (value < 70) return "Élevé";
    return "Critique";
}


function knowledgeLabel(value) {
    if (value < 15) return "UNKNOWN";
    if (value < 35) return "SUSPECTED";
    if (value < 55) return "OBSERVED";
    if (value < 75) return "LIKELY";
    return "IDENTIFIED";
}


function getZoneSuspicion(zone) {
    return Number.isFinite(zone.suspicion) ? zone.suspicion : 0;
}


function addZoneSuspicion(zone, amount) {
    zone.suspicion = Math.max(0, Math.min(100, getZoneSuspicion(zone) + amount));
    police.zoneKnowledge[zone.id] = Math.max(
        0,
        Math.min(100, (police.zoneKnowledge[zone.id] || 0) + amount * 0.65)
    );
}


function createPatrol() {
    const entry = mapData.entries[
        Math.floor(Math.random() * mapData.entries.length)
    ];
    const patrol = {
        entityType: ENTITY_TYPES.POLICE,
        id: "patrol-" + Date.now() + "-" + Math.random(),
        x: entry.x,
        y: entry.y,
        route: [],
        destination: null,
        moving: false,
        speed: 5,
        state: "PATROL",
        duration: 0,
        zonesTraversed: [],
        observationCooldown: 0,
        element: null
    };
    const element = document.createElement("div");
    element.className = "policePatrol";
    element.textContent = "🚓";
    patrol.element = element;
    map.appendChild(element);
    updateMapEntityVisual(patrol);
    setPatrolDestination(patrol);
    police.patrols.push(patrol);
}


function setPatrolDestination(patrol) {
    const zone = mapData.zones[
        Math.floor(Math.random() * mapData.zones.length)
    ];
    beginMapMovement(patrol, zone, "PATROL");
    patrol.zonesTraversed.push(zone.id);
}


function updatePatrols(delta) {
    police.patrols.slice().forEach(patrol => {
        patrol.duration += delta;
        patrol.observationCooldown = Math.max(0, patrol.observationCooldown - delta);
        if (!patrol.destination) setPatrolDestination(patrol);
        if (moveMapEntity(patrol, patrol.destination, delta, patrol.speed)) {
            setPatrolDestination(patrol);
        }
        observeFromPatrol(patrol);
        if (patrol.duration > 55) {
            patrol.element.remove();
            police.patrols = police.patrols.filter(item => item !== patrol);
        }
    });
}


function observeFromPatrol(patrol) {
    if (patrol.observationCooldown > 0) return;

    const point = mapData.salesPoints.find(salesPoint =>
        salesPoint.active && mapDistance(patrol, salesPoint) < 18
    );
    const zone = getMapZoneAt(patrol);

    if (zone) addZoneSuspicion(zone, 0.25 + police.attention * 0.35);

    if (point) {
        const observation = 0.8 + police.attention * 1.4 + point.currentVisitors * 0.2;
        police.pointKnowledge[point.id] = Math.min(
            100,
            (police.pointKnowledge[point.id] || 0) + observation
        );
        if (zone) addZoneSuspicion(zone, observation * 0.35);
        police.observations.push({ pointId: point.id, zoneId: zone && zone.id, time: performance.now() });
        police.observations = police.observations.slice(-40);
    }
    patrol.observationCooldown = 1.5;
}


function updateSuspicion(delta) {
    mapData.zones.forEach(zone => {
        const points = mapData.salesPoints.filter(point =>
            point.active && getMapZoneAt(point).id === zone.id
        );
        const employees = game.employees.filter(employee =>
            employee.active && getMapZoneAt(employee).id === zone.id
        );
        const activity = points.reduce((total, point) =>
            total + point.currentVisitors + point.importance + point.stats.revenue / 100,
            0
        );
        const pressure = activity * 0.025 + Math.max(0, employees.length - 2) * 0.015;
        addZoneSuspicion(zone, (pressure - 0.018) * delta);
        police.zoneKnowledge[zone.id] = Math.max(
            0,
            (police.zoneKnowledge[zone.id] || 0) - 0.008 * delta
        );
    });

    mapData.salesPoints.forEach(point => {
        police.pointKnowledge[point.id] = Math.max(
            0,
            (police.pointKnowledge[point.id] || 0) - (point.active ? 0.002 : 0.05) * delta
        );
    });

    police.globalSuspicion = mapData.zones.reduce(
        (total, zone) => total + getZoneSuspicion(zone), 0
    ) / mapData.zones.length;
    const profilePressure = police.dayProfile === "HIGH_PRESSURE"
        ? 0.18
        : police.dayProfile === "OBSERVATION"
            ? 0.1
            : police.dayProfile === "ACTIVE_PATROLS"
                ? 0.06
                : 0;
    police.attention = Math.min(
        1,
        0.15 + police.globalSuspicion / 120 + profilePressure
    );
    police.level = police.globalSuspicion < 18 ? "CALM" :
        police.globalSuspicion < 38 ? "PATROL" :
        police.globalSuspicion < 58 ? "OBSERVATION" :
        police.globalSuspicion < 75 ? "INVESTIGATION" : "HIGH_ALERT";
}


function createAlert(origin, position, radius = 18, danger = 1) {
    const duplicate = police.alerts.find(alert =>
        mapDistance(alert, position) < 8 && alert.duration > 2
    );
    if (duplicate) return duplicate;

    const alert = {
        id: "alert-" + Date.now() + "-" + Math.random(),
        origin,
        x: position.x,
        y: position.y,
        radius,
        danger,
        duration: 12,
        elapsed: 0,
        informedEmployeeIds: [],
        element: null
    };
    const element = document.createElement("div");
    element.className = "policeAlertZone";
    element.style.left = alert.x + "%";
    element.style.top = alert.y + "%";
    element.style.width = radius * 2 + "%";
    element.style.height = radius * 2 + "%";
    alert.element = element;
    map.appendChild(element);
    police.alerts.push(alert);
    return alert;
}


function applySellerAlertProtocol(seller, alert) {
    const distance = mapDistance(seller, alert);
    const protocol = seller.alertProtocol || "autonomie";

    if (protocol === "autonomie" && distance > 12) return;
    if (protocol === "mise-en-securite") {
        seller.state = "en sécurité";
        const point = getSalesPointForSeller(seller.id);
        if (point) point.active = false;
    }
    if (protocol === "repli") {
        const point = getSalesPointForSeller(seller.id);
        if (point) point.active = false;
        seller.policeRetreat = true;
        seller.policeProtocolAction = "repli";
        beginMapMovement(seller, mapData.fallbackPoints[0], "en déplacement");
    }
    if (protocol === "abandon") {
        const point = getSalesPointForSeller(seller.id);
        if (point) point.active = false;
        seller.policeRetreat = true;
        seller.policeProtocolAction = "abandon";
        beginMapMovement(seller, mapData.entries[0], "en déplacement");
    }
}


function updateAlerts(delta) {
    police.alerts.slice().forEach(alert => {
        alert.elapsed += delta;
        alert.duration -= delta;
        game.employees.forEach(employee => {
            if (!employee.active || alert.informedEmployeeIds.includes(employee.id)) return;
            const direct = mapDistance(employee, alert) <= alert.radius;
            const connected = alert.elapsed >= 1.5 && (
                employee.assignment.managerId || employee.assignment.apartmentId
            );
            if (!direct && !connected) return;
            alert.informedEmployeeIds.push(employee.id);
            employee.alertLevel = alert.danger;
            if (employee.role === "vendeur") applySellerAlertProtocol(employee, alert);
        });
        if (alert.duration <= 0) {
            alert.element.remove();
            police.alerts = police.alerts.filter(item => item !== alert);
            game.employees.forEach(employee => {
                if (employee.alertLevel === alert.danger && employee.active &&
                    (employee.state === "en sécurité" || employee.state === "en alerte")) {
                    employee.alertLevel = 0;
                    employee.state = "en poste";
                    const point = getSalesPointForSeller(employee.id);
                    if (point && !employee.policeRetreat) point.active = true;
                }
            });
        }
    });
}


function detectPatrolsWithWatchers() {
    police.patrols.forEach(patrol => {
        const watcher = game.employees.find(employee =>
            employee.role === "guetteur" && employee.active &&
            employee.state === "en poste" &&
            mapDistance(employee, patrol) <= employee.observationRadius
        );
        if (!watcher) return;
        const chance = Math.min(0.9, 0.25 + watcher.experience * 0.02 + watcher.orientationSkill * 0.08 + police.attention * 0.2);
        if (Math.random() < chance * 0.08) createAlert("guetteur", patrol, watcher.observationRadius, 1);
    });
}


function cancelEmployeeLogistics(employeeId) {
    const affected = game.logisticsMissions.filter(mission =>
        mission.courierId === employeeId || mission.sellerId === employeeId
    );
    affected.forEach(mission => {
        const courier = getEmployeeById(mission.courierId);
        const seller = getEmployeeById(mission.sellerId);
        const apartment = getApartmentById(mission.apartmentId);
        if (
            courier && courier.active && apartment && mission.product &&
            getInventoryQuantity(courier, mission.product) > 0
        ) {
            transferInventory(
                courier,
                apartment,
                mission.product,
                getInventoryQuantity(courier, mission.product)
            );
        }
        if (courier) courier.currentMissionId = null;
        if (seller) seller.currentMissionId = null;
    });
    game.logisticsMissions = game.logisticsMissions.filter(mission => !affected.includes(mission));
    game.logisticsRequests = game.logisticsRequests.filter(request =>
        request.sellerId !== employeeId
    );
}


function neutralizeEmployee(employee, operation) {
    if (!employee.active || operation.affectedEmployeeIds.includes(employee.id)) return;
    operation.affectedEmployeeIds.push(employee.id);
    const stockLost = getInventoryTotal(employee) + getInventoryTotal({ inventory: employee.localReserve || {} });
    const moneyLost = Number.isFinite(employee.money) ? employee.money : 0;
    operation.stockLost += stockLost;
    operation.moneyLost += moneyLost;
    employee.inventory = createEmptyInventory();
    if (employee.localReserve) employee.localReserve = createEmptyInventory();
    employee.money = 0;
    employee.active = false;
    employee.state = "indisponible";
    employee.unavailableUntil = game.day + 1;
    const point = employee.role === "vendeur" && getSalesPointForSeller(employee.id);
    if (point) {
        point.active = false;
        operation.pointsDisrupted++;
    }
    cancelEmployeeLogistics(employee.id);
}


function createOperation() {
    const targetZones = mapData.zones
        .filter(zone => getZoneSuspicion(zone) > 45)
        .sort((a, b) => getZoneSuspicion(b) - getZoneSuspicion(a))
        .slice(0, 2);
    if (!targetZones.length) return;
    police.plannedOperation = {
        id: "operation-" + Date.now(),
        phase: "PLANNED",
        elapsed: 0,
        targetZoneIds: targetZones.map(zone => zone.id),
        affectedEmployeeIds: [], stockLost: 0, moneyLost: 0, pointsDisrupted: 0,
        clientsLost: 0
    };
}


function updateOperation(delta) {
    const operation = police.activeOperation || police.plannedOperation;
    if (!operation) return;
    operation.elapsed += delta;
    if (operation.phase === "PLANNED" && operation.elapsed >= 5) {
        operation.phase = "PREPARING"; operation.elapsed = 0;
    } else if (operation.phase === "PREPARING" && operation.elapsed >= 7) {
        operation.phase = "ACTIVE"; operation.elapsed = 0; police.activeOperation = operation; police.plannedOperation = null;
        operation.targetZoneIds.forEach(zoneId => {
            const zone = mapData.zones.find(item => item.id === zoneId);
            if (zone) createAlert("operation", zone, 24, 3);
        });
    } else if (operation.phase === "ACTIVE") {
        police.level = "OPERATION";
        operation.targetZoneIds.forEach(zoneId => {
            const zone = mapData.zones.find(item => item.id === zoneId);
            game.employees.filter(employee => employee.active && zone && mapDistance(employee, zone) < 26).forEach(employee => {
                const risk = 0.012 + police.attention * 0.025 + Math.max(0, 50 - employee.discretion) / 3000;
                if (Math.random() < risk * delta) neutralizeEmployee(employee, operation);
            });
            if (typeof disperseCustomersInZone === "function" && zone) {
                operation.clientsLost += disperseCustomersInZone(zone, 24);
            }
        });
        if (operation.elapsed >= 13) { operation.phase = "ENDING"; operation.elapsed = 0; }
    } else if (operation.phase === "ENDING" && operation.elapsed >= 4) {
        operation.phase = "COMPLETED";
        police.lastOperation = { ...operation };
        police.activeOperation = null;
        mapData.zones.forEach(zone => { zone.suspicion *= 0.8; });
        showMessage("Opération terminée : " + operation.affectedEmployeeIds.length + " employé(s) indisponible(s).");
    }
}


function startPoliceDay() {
    game.employees.forEach(employee => {
        if (
            !employee.active &&
            Number.isFinite(employee.unavailableUntil) &&
            employee.unavailableUntil <= game.day
        ) {
            employee.active = true;
            employee.state = "en poste";
            employee.unavailableUntil = null;
            if (employee.role === "vendeur") {
                const point = getSalesPointForSeller(employee.id);
                if (point) point.active = true;
            }
        }
    });

    const profiles = ["QUIET", "NORMAL", "ACTIVE_PATROLS", "OBSERVATION", "HIGH_PRESSURE"];
    police.dayProfile = profiles[Math.floor(Math.random() * profiles.length)];
    const count = police.dayProfile === "QUIET" ? 0 : police.dayProfile === "NORMAL" ? 1 : 2;
    for (let index = 0; index < count; index++) createPatrol();
}


function endPoliceDay() {
    police.patrols.forEach(patrol => patrol.element.remove());
    police.patrols = [];
    police.alerts.forEach(alert => alert.element.remove());
    police.alerts = [];
}


function updatePoliceRealtime(delta) {
    police.tick += delta;
    updatePatrols(delta);
    updateAlerts(delta);
    if (police.tick >= 1) {
        updateSuspicion(police.tick);
        detectPatrolsWithWatchers();
        if (!police.plannedOperation && !police.activeOperation && police.globalSuspicion > 65 && Math.random() < 0.012 * police.attention) createOperation();
        police.tick = 0;
    }
    updateOperation(delta);
    updatePoliceUI();
}


function renderPolicePanel() {
    const watchedZones = mapData.zones
        .filter(zone => getZoneSuspicion(zone) >= 20)
        .sort((a, b) => getZoneSuspicion(b) - getZoneSuspicion(a));
    policeContent.innerHTML = `<div class="employeeCard"><strong>Attention : ${police.level}</strong><p>Suspicion : ${policeLabel(police.globalSuspicion)}</p><p>Profil de journée : ${police.dayProfile === "NORMAL" ? "non communiqué" : police.dayProfile}</p></div><div class="employeeCard"><strong>Alertes</strong><p>${police.alerts.length ? police.alerts.map(alert => `${alert.origin} · danger ${alert.danger}`).join("<br>") : "Aucune alerte active."}</p></div><div class="employeeCard"><strong>Zones surveillées</strong><p>${watchedZones.length ? watchedZones.map(zone => `${zone.id} : ${policeLabel(getZoneSuspicion(zone))} · ${knowledgeLabel(police.zoneKnowledge[zone.id] || 0)}`).join("<br>") : "Aucune donnée notable."}</p></div><div class="employeeCard"><strong>Dernière opération</strong><p>${police.lastOperation ? `${police.lastOperation.affectedEmployeeIds.length} indisponible(s) · ${police.lastOperation.stockLost} stock perdu · ${Math.floor(police.lastOperation.moneyLost)} € perdus` : "Aucune."}</p></div>`;
}

function updatePoliceUI() {
    const status = document.getElementById("policeStatus");
    if (status) status.textContent = policeLabel(police.globalSuspicion);
    if (policePanel.classList.contains("visible")) renderPolicePanel();
}

document.getElementById("policeButton").addEventListener("click", () => { renderPolicePanel(); policePanel.classList.add("visible"); });
document.getElementById("closePolice").addEventListener("click", () => policePanel.classList.remove("visible"));
