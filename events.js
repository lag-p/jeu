// Effets temporaires lus par la simulation, jamais appliqués par multiplication permanente.
const EVENT_CONFIG = Object.freeze({
    HIGH_DEMAND: { label: "Un produit très recherché", demand: 1.6 },
    LOW_DEMAND: { label: "Demande en baisse", demand: .6 },
    EMPLOYEE_ABSENT: { label: "Une absence aujourd'hui" },
    SUPPLIER_SHORTAGE: { label: "Fournisseur limité", supply: .4 },
    BUSY_DAY: { label: "Quartier animé", flow: 1.4 },
    QUIET_DAY: { label: "Quartier calme", flow: .7 },
    LOGISTICS_DELAY: { label: "Livraisons ralenties", logistics: .7 },
    POLICE_ACTIVITY: { label: "Activité policière accrue", police: 1.5 },
    BIG_CUSTOMER: { label: "Visite d'un gros client" },
    SUPPLIER_DISCOUNT: { label: "Promotion fournisseur", price: .8 },
    EMPLOYEE_BOOST: { label: "Équipe en pleine forme", efficiency: 1.15 }
});

function activateEvent(type, duration = game.dayDuration, product = "Produit A") {
    if (!EVENT_CONFIG[type] || !Number.isFinite(duration) || duration <= 0) return null;
    game.events = game.events || [];
    if (game.events.some(e => e.type === type)) return null;
    const event = { id: `event-${game.day}-${type}`, type, remaining: duration, product, consumed: false };
    if (type === "EMPLOYEE_ABSENT") {
        const employee = game.employees.find(e => e.active && !e.currentMissionId && e.state === "en poste");
        if (!employee) return null;
        event.employeeId = employee.id;
        employee.active = false;
        employee.state = "absent";
    }
    game.events.push(event);
    if (typeof AudioSystem !== "undefined") AudioSystem.play("events", "start");
    showMessage(EVENT_CONFIG[type].label);
    return event;
}

function getEventModifier(key, product = null) {
    return (game.events || []).reduce((value, event) => value * ((!product || event.product === product || key !== "demand") ? (EVENT_CONFIG[event.type]?.[key] || 1) : 1), 1);
}

function finishEvent(event) {
    if (event.type === "EMPLOYEE_ABSENT") {
        const employee = getEmployeeById(event.employeeId);
        if (employee?.state === "absent") { employee.active = true; employee.state = "en poste"; }
    }
    game.events = (game.events || []).filter(e => e !== event);
}

function startEventsDay() {
    (game.events || []).slice().forEach(finishEvent);
    const types = Object.keys(EVENT_CONFIG);
    activateEvent(types[Math.floor(Math.random() * types.length)], game.dayDuration, Object.keys(PRODUCT_CONFIG)[game.day % 3]);
}

function updateEventsRealtime(delta) {
    (game.events || []).slice().forEach(event => { event.remaining -= delta; if (event.remaining <= 0) finishEvent(event); });
}
