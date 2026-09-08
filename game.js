// ===============================
// ETAT DU JEU
// ===============================

const game = {

    money: GAME_CONFIG.startingMoney,

    // Source de vérité du stock détenu physiquement par le joueur.
    playerInventory: {
        "Produit A": GAME_CONFIG.startingProductStock,
        "Produit B": GAME_CONFIG.startingProductStock,
        "Produit C": GAME_CONFIG.startingProductStock
    },

    satisfaction: 100,

    playerX: 50,

    playerY: 50,

    playerEntityType: "PLAYER",

    playerPlaced: false,

    startPointPlacementActive: false,

    employees: [],

    apartments: [],

    logisticsMissions: [],

    logisticsRequests: [],

    // Les équipes regroupent les droits logistiques. Les anciennes
    // affectations restent compatibles pour les parties déjà commencées.
    teams: [],

    logisticsSettings: {
        maxSellerCash: LOGISTICS_CONFIG.maxSellerCash,
        lowStockThreshold: LOGISTICS_CONFIG.lowStock
    },

    activeApartmentId: null,

    day: 1,

    dayActive: false,

    phase: DAY_PHASE.PREPARATION,
    clock: { paused: true, speed: 1, elapsed: 0 },
    retreat: { reason: null },

    dayDuration: GAME_CONFIG.dayDuration,

    dayElapsed: 0,

    dailyRevenue: 0,

    dailyExpenses: 0,

    pendingDailyExpenses: 0,

    pendingDayStartMoney: null,

    dailyCustomers: 0,

    dailyProductSales: { "Produit A": 0, "Produit B": 0, "Produit C": 0 },

    dailyStartMoney: GAME_CONFIG.startingMoney,

    alert: 0

};


// ===============================
// ELEMENTS
// ===============================

const player =
    document.getElementById("player");

const map =
    document.getElementById("map");


// ===============================
// INTERFACE
// ===============================

function getAvailableProductStock(product) {

    if (
        !game.playerInventory ||
        typeof game.playerInventory !== "object"
    ) {
        return 0;
    }


    const quantity =
        game.playerInventory[product];


    return Number.isSafeInteger(quantity) &&
        quantity >= 0
        ? quantity
        : 0;

}


function getStockEntries() {

    if (typeof getNetworkStock === "function") {
        const network = getNetworkStock();
        return Object.entries(network.byProduct).map(([product, quantity]) => ({ product, quantity }));
    }

    if (
        !game.playerInventory ||
        typeof game.playerInventory !== "object"
    ) {
        return [];
    }


    return Object.keys(game.playerInventory).map(
        product => ({
            product,
            quantity:
                getAvailableProductStock(product)
        })
    );

}


function formatStock() {

    return getStockEntries()
        .map(
            entry =>
                entry.product +
                " : " +
                entry.quantity
        )
        .join(" · ");

}


function updateStockUI() {

    const stockElement =
        document.getElementById("stock");


    stockElement.replaceChildren();


    getStockEntries().forEach(
        entry => {

            const stockItem =
                document.createElement("span");


            stockItem.className = "stockItem stockProduct";
            const low = game.logisticsSettings && entry.quantity <= game.logisticsSettings.lowStockThreshold;
            stockItem.classList.toggle("stockLow", Boolean(low));
            stockItem.dataset.product = entry.product;
            stockItem.setAttribute("aria-label", `${entry.product} : ${entry.quantity}${low ? ", stock faible" : ""}`);
            const icon = document.createElement("span"); icon.className = "stockIcon"; icon.setAttribute("aria-hidden", "true");
            const name = document.createElement("span"); name.className = "stockProductName"; name.textContent = entry.product;
            const quantity = document.createElement("span"); quantity.textContent = entry.quantity;
            stockItem.append(icon, name, quantity);


            stockElement.appendChild(stockItem);

        }
    );

}


function updateUI() {

    document.getElementById("money").textContent =
        Math.floor(game.money) + " €";

    updateStockUI();

    document.getElementById("satisfaction").textContent =
        game.satisfaction + "%";

    const activeEmployees =
        game.employees.filter(employee => employee.active).length;

    document.getElementById("activeEmployees").textContent =
        activeEmployees;

    updateDayUI();
}


function recordExpense(amount, category = "investment") {

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        return false;
    }


    const key = game.dayActive ? "expenseBreakdown" : "pendingExpenseBreakdown";
    game[key] = game[key] || {};
    game[key][category] = (game[key][category] || 0) + amount;
    if (game.dayActive) {

        game.dailyExpenses += amount;

        return true;

    }


    if (
        game.pendingDailyExpenses === 0 ||
        !Number.isFinite(game.pendingDayStartMoney)
    ) {

        game.pendingDayStartMoney =
            game.money;

    }


    game.pendingDailyExpenses += amount;


    return true;

}


function reverseExpense(amount) {

    if (!Number.isFinite(amount) || amount <= 0) return;
    const key = game.dayActive ? "expenseBreakdown" : "pendingExpenseBreakdown";
    if (game[key]) game[key].investment = Math.max(0, (game[key].investment || 0) - amount);
    if (game.dayActive) {
        game.dailyExpenses = Math.max(0, game.dailyExpenses - amount);
        return;
    }
    game.pendingDailyExpenses = Math.max(0, game.pendingDailyExpenses - amount);
    if (game.pendingDailyExpenses === 0) game.pendingDayStartMoney = null;
}


// ===============================
// POSITION DU JOUEUR
// ===============================

function updatePlayer() {

    player.style.left =
        game.playerX + "%";

    player.style.top =
        game.playerY + "%";
}


// ===============================
// MESSAGE
// ===============================

function showMessage(text) {

    const message =
        document.getElementById("message");

    message.textContent = text;

    message.classList.add("show");

    clearTimeout(message.timeout);

    message.timeout = setTimeout(() => {

        message.classList.remove("show");

    }, 1300);
}


// ===============================
// INTERFACE JOUR
// ===============================

function createDayInterface() {

    const dayUI =
        document.createElement("div");

    dayUI.id = "dayUI";

    dayUI.innerHTML = `

        <div id="dayNumber" class="dayMeta">JOUR 1</div>

        <div id="dayClock" class="dayClock">12:00</div>

        <div id="dayStatus" class="dayStatus">Préparation</div>

    `;

    document.getElementById("game").insertBefore(dayUI, map);
    dayUI.insertAdjacentHTML("beforeend", `<div id="timeControls" aria-label="Temps de simulation">
        <button id="pauseTime" type="button">Pause</button>
        <button id="speedOne" type="button">×1</button>
        <button id="speedTwo" type="button" aria-describedby="timeReason">×2</button>
        <button id="closeDay" type="button">Fermer</button>
        <button id="prepareDay" type="button">Préparer</button>
    </div><div id="timeReason" role="status"></div>`);
    document.getElementById("pauseTime").addEventListener("click", toggleSimulationPause);
    document.getElementById("speedOne").addEventListener("click", () => setSimulationSpeed(1));
    document.getElementById("speedTwo").addEventListener("click", () => setSimulationSpeed(2));
    document.getElementById("closeDay").addEventListener("click", () => beginRetreat("manual"));
    document.getElementById("prepareDay").addEventListener("click", () => document.getElementById("startDayOverlay").classList.remove("hidden"));


    const startOverlay =
        document.createElement("div");

    startOverlay.id = "startDayOverlay";

    startOverlay.innerHTML = `

        <div class="dayBox">

            <div class="dayEmoji">
                🌅
            </div>

            <h1 id="startDayTitle">
                JOUR 1
            </h1>

            <p>
                Préparation · temps arrêté. Configure ton équipe et tes stocks.
            </p>

            <p id="placementText">
                Choisis ton point de départ
                directement sur la carte.
            </p>

            <button id="configureDayButton" type="button">ORGANISER SUR LA CARTE</button>
            <button id="startDayButton">
                COMMENCER LA JOURNÉE
            </button>

        </div>

    `;

    document.body.appendChild(startOverlay);


    const endOverlay =
        document.createElement("div");

    endOverlay.id = "endDayOverlay";

    endOverlay.classList.add("hidden");

    endOverlay.innerHTML = `

        <div class="dayBox">

            <div class="dayEmoji">
                🌙
            </div>

            <h1>
                FIN DE JOURNÉE
            </h1>

            <div id="dailySummary"></div>

            <button id="nextDayButton">
                JOUR SUIVANT
            </button>

        </div>

    `;

    document.body.appendChild(endOverlay);


    document
        .getElementById("startDayButton")
        .addEventListener(
            "click",
            startDay
        );


    document
        .getElementById("nextDayButton")
        .addEventListener(
            "click",
            nextDay
        );


    document.getElementById("configureDayButton").addEventListener("click", () => document.getElementById("startDayOverlay").classList.add("hidden"));
    updateDayUI();

}

// ===============================
// HORLOGE
// ===============================

function updateDayUI() {

    const dayNumber =
        document.getElementById("dayNumber");

    const dayClock =
        document.getElementById("dayClock");

    const dayStatus =
        document.getElementById("dayStatus");


    if (!dayNumber) {
        return;
    }


    dayNumber.textContent =
        "JOUR " + game.day;


    const minute = TIME_CONFIG.openingMinute + Math.floor((TIME_CONFIG.closingMinute - TIME_CONFIG.openingMinute) * game.dayElapsed / game.dayDuration + 1e-8);
    dayClock.textContent = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const labels = { PREPARATION: "Préparation", ACTIVITE: "Activité", REPLI: "Repli", BILAN: "Bilan" };
    dayStatus.textContent = `${labels[game.phase]} · ${game.clock.paused ? "Pause" : "×" + game.clock.speed}`;
    if (typeof syncCustomerSelection === "function") syncCustomerSelection();
    const running = game.dayActive;
    const reason = running ? getAccelerationBlockReason() : "";
    document.getElementById("timeReason").textContent = reason;
    document.getElementById("pauseTime").disabled = !running;
    document.getElementById("pauseTime").textContent = game.clock.paused && running ? "Reprendre" : "Pause";
    document.getElementById("pauseTime").setAttribute("aria-pressed", String(game.clock.paused));
    for (const [id, speed] of [["speedOne", 1], ["speedTwo", 2]]) {
        const button = document.getElementById(id);
        button.disabled = !running || speed === 2 && Boolean(reason);
        button.setAttribute("aria-pressed", String(game.clock.speed === speed));
    }
    document.getElementById("closeDay").hidden = game.phase !== DAY_PHASE.ACTIVITE;
    document.getElementById("prepareDay").hidden = game.phase !== DAY_PHASE.PREPARATION;

}


// ===============================
// PLACEMENT DU JOUEUR
// ===============================

function closePanelsForStartPointPlacement() {

    closeMainPanel();
    closeCustomerPanel();

}


function beginStartPointPlacement() {

    if (game.startPointPlacementActive) {
        return;
    }

    game.startPointPlacementActive = true;

    document
        .getElementById("startDayOverlay")
        .classList.add("hidden");

    closePanelsForStartPointPlacement();
    document.body.classList.add("startPointPlacementActive");
    map.classList.add("startPointPlacementActive");

    showMessage(
        "Choisis ton point de départ sur la carte."
    );

}


function finishStartPointPlacement(x, y) {
    if (typeof nearestWalkable === "function") ({ x, y } = nearestWalkable({ x, y }));

    game.playerX = Math.max(5, Math.min(95, x));
    game.playerY = Math.max(5, Math.min(95, y));
    game.playerPlaced = true;
    game.startPointPlacementActive = false;

    document.body.classList.remove("startPointPlacementActive");
    map.classList.remove("startPointPlacementActive");

    updatePlayer();
    showMessage("Point de départ choisi.");
    startDay();

}

map.addEventListener(
    "click",
    function(event) {

        // Les boutons et personnages
        // ne doivent pas déplacer le joueur.

        if (
            event.target.classList.contains("customer") ||
            event.target.classList.contains("employee") ||
            event.target.classList.contains("policePatrol") ||
            event.target.closest("#customerPanel")
        ) {

            return;

        }


        if (
            typeof handleMapPlacement ===
            "function" &&
            handleMapPlacement(event)
        ) {

            return;

        }


        if (
            typeof handleMapStrategicPlacement ===
            "function" &&
            handleMapStrategicPlacement(event)
        ) {

            return;

        }


        // Placement d'un employé

        if (placementMode) {

            const rect =
                map.getBoundingClientRect();

            const x =
                ((event.clientX - rect.left) /
                rect.width) * 100;

            const y =
                ((event.clientY - rect.top) /
                rect.height) * 100;

            placeEmployee(x, y);

            return;
        }


        if (!game.startPointPlacementActive) {
            if (game.phase === DAY_PHASE.ACTIVITE && !event.target.closest("button")) {
                const rect = map.getBoundingClientRect();
                requestPlayerMovement({ x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 });
            }
            return;
        }


        const rect =
            map.getBoundingClientRect();


        finishStartPointPlacement(
            ((event.clientX - rect.left) / rect.width) * 100,
            ((event.clientY - rect.top) / rect.height) * 100
        );

    }
);


// ===============================
// COMMENCER LA JOURNEE
// ===============================

function startDay() {
    if (game.phase !== DAY_PHASE.PREPARATION) return;

    if (!game.playerPlaced) {
        beginStartPointPlacement();
        return;

    }

    if (game.startPointPlacementActive || game.dayActive) return;

    game.dayActive = true;
    game.phase = DAY_PHASE.ACTIVITE;
    game.clock.paused = false;
    game.clock.speed = 1;
    game.retreat = { reason: null };
    game.employees.forEach(employee => applyPendingEmployeeAssignment(employee));
    game.dailyStartStock = getNetworkStock().total;
    game.dailyLocalReceipts = 0;
    game.dailyIncidents = 0;
    game.dailySalaries = 0;

    game.dayElapsed = 0;

    game.dailyRevenue = 0;

    game.dailyExpenses =
        game.pendingDailyExpenses;
    game.expenseBreakdown = { ...(game.pendingExpenseBreakdown || {}) };
    game.pendingExpenseBreakdown = {};
    game.dailyLostStock = 0;
    game.dayStockoutSeconds = 0;

    game.dailyCustomers = 0;

    game.dailyProductSales = { "Produit A": 0, "Produit B": 0, "Produit C": 0 };

    game.dailyStartMoney =
        Number.isFinite(game.pendingDayStartMoney)
            ? game.pendingDayStartMoney
            : game.money;

    game.pendingDailyExpenses = 0;

    game.pendingDayStartMoney = null;
    game.dailyLostCustomers = 0;
    game.dailyStartSatisfaction = game.satisfaction;
    game.dailyStockoutCount = 0;
    game.dailyRestockWaitFailures = 0;
    if (typeof startEventsDay === "function") startEventsDay();
    beginEmployeeActivity();
    document
        .getElementById("startDayOverlay")
        .classList.add("hidden");


    showMessage(
        "La journée commence."
    );


    updateDayUI();


    if (
        typeof startCustomerSpawning ===
        "function"
    ) {

        startCustomerSpawning();

    }


    if (typeof startPoliceDay === "function") {
        startPoliceDay();
    }

}

// ===============================
// FIN DE JOURNEE
// ===============================

function endDay() { beginRetreat("midnight"); }

function renderDailySummary() {
    const summary =
        document.getElementById(
            "dailySummary"
        );


    const profit = game.dailyRevenue - game.dailyExpenses;


    const formattedProfit =
        profit >= 0
            ? "+" + Math.floor(profit)
            : Math.floor(profit);


    const satisfactionChange = Number.isFinite(game.dailyStartSatisfaction) ? game.satisfaction - game.dailyStartSatisfaction : 0;
    const insights = [];
    if (game.dailyLostCustomers) insights.push(`${game.dailyLostCustomers} client(s) perdu(s) : rupture, attente ou refus`);
    if (game.dailyStockoutCount) insights.push(`${game.dailyStockoutCount} rupture(s) annoncée(s) immédiatement`);
    if (game.dailyRestockWaitFailures) insights.push(`${game.dailyRestockWaitFailures} ravitaillement(s) arrivé(s) trop tard`);
    if (!insights.length) insights.push("Aucun incident important");
    const rows = entries => entries.map(([label, value]) => `<div class="summaryLine"><span>${label}</span><strong>${value}</strong></div>`).join("");
    summary.innerHTML = `<section class="dailyHeadline"><strong>Résultat net</strong><b>${formattedProfit} €</b><p>Trésorerie ${Math.floor(game.money)} € · variation ${Math.floor(game.money - game.dailyStartMoney) >= 0 ? "+" : ""}${Math.floor(game.money - game.dailyStartMoney)} €</p></section>${rows([["Clients servis / perdus", `${game.dailyCustomers} / ${game.dailyLostCustomers || 0}`], ["Satisfaction", `${game.satisfaction}% ${satisfactionChange ? `(${satisfactionChange > 0 ? "+" : ""}${satisfactionChange})` : ""}`]])}<section class="dailyInsights"><strong>À retenir</strong>${insights.slice(0, 3).map(item => `<p>${item}</p>`).join("")}</section><details><summary>Ventes et demandes</summary>${rows(Object.entries(game.dailyProductSales).map(([product, quantity]) => [`${product} vendu`, `×${quantity}`]))}</details><details><summary>Stocks et dépenses</summary>${rows([["Stock restant", formatStock()], ["Achats, salaires et charges", `${Math.floor(game.dailyExpenses)} €`], ["Salaires", `${game.dailySalaries || 0} €`], ["Stock perdu", `${game.dailyLostStock || 0} unités`]])}</details><details><summary>Logistique et incidents</summary>${rows([["Recettes locales récupérées", `${game.dailyLocalReceipts || 0} €`], ["Évolution du stock", `${Number.isFinite(game.dailyStartStock) ? getNetworkStock().total - game.dailyStartStock : "Non relevée"}`], ["Incidents / indisponibles", `${game.dailyIncidents || 0} / ${game.employees.filter(e => !e.active).length}`]])}</details>`;
    const expenseLabels = { stock: "Stock acheté", salaries: "Salaires", rents: "Loyers", losses: "Argent perdu", investment: "Recrutement / appartements", upgrades: "Améliorations" };
    summary.insertAdjacentHTML("beforeend", Object.entries(game.expenseBreakdown || {}).map(([key, value]) => `<div class="summaryLine"><span>${expenseLabels[key] || key}</span><strong>${Math.floor(value)} €</strong></div>`).join("") + `<p>Stock perdu : ${game.dailyLostStock || 0} unités. Bilan en flux : achats comptés au paiement.</p>`);
    document
        .getElementById("endDayOverlay")
        .classList.remove("hidden");


    updateDayUI();

}


// ===============================
// JOUR SUIVANT
// ===============================

function nextDay() {
    if (game.phase !== DAY_PHASE.BILAN) return;
    prepareNextDay();

    game.day++;

    game.dayActive = false;

    game.dayElapsed = 0;

    game.dailyRevenue = 0;

    game.dailyExpenses = 0;

    game.dailyCustomers = 0;

    game.dailyProductSales = { "Produit A": 0, "Produit B": 0, "Produit C": 0 };


    document
        .getElementById("endDayOverlay")
        .classList.add("hidden");


    document
        .getElementById("startDayTitle")
        .textContent =
        "JOUR " + game.day;


    document
        .getElementById("placementText")
        .textContent =
        "Ton point est conservé.";


    // Le joueur reste exactement
    // au même endroit.

    updatePlayer();


    updateUI();


    document.getElementById("startDayOverlay").classList.remove("hidden");


    if (
        typeof prepareCustomerSystem ===
        "function"
    ) {

        prepareCustomerSystem();

    }

}


// ===============================
// BOUCLE PRINCIPALE
// ===============================

let lastFrame =
    performance.now();

function updateDayTimer(delta) {

    if (!Number.isFinite(delta) || delta <= 0) {
        return;
    }

    game.dayElapsed = Math.min(
        game.dayDuration,
        game.dayElapsed + delta
    );

}


function gameLoop(now) {

    // La frame suivante est toujours demandée avant les mises à jour : une
    // exception métier ne doit jamais tuer la boucle globale.
    requestAnimationFrame(gameLoop);

    const delta = Math.max(0, Math.min(GAME_CONFIG.maxFrameSeconds, (now - lastFrame) / 1000));


    lastFrame = now;
    if (typeof updateSimulation === "function") updateSimulation(delta);
    if (typeof renderGameFrame === "function" && typeof customers !== "undefined") renderGameFrame(delta);
    if (typeof updateSaveRealtime === "function") updateSaveRealtime(delta);

}


// ===============================
// INITIALISATION
// ===============================

createDayInterface();

updatePlayer();

updateUI();

// Attendre tous les modules : une frame pendant le chargement ne doit pas
// appeler un système qui n’a pas encore été défini.
window.addEventListener("DOMContentLoaded", () => {
    lastFrame = performance.now();
    requestAnimationFrame(gameLoop);
}, { once: true });
